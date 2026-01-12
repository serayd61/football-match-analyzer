// ============================================================================
// ADMIN API - SETTLE ALL AGENT PREDICTIONS
// agent_predictions tablosundaki tüm bekleyen maçları settle eder
// unified_analysis'a bağımlı değil, direkt agent_predictions'tan çalışır
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Sportmonks API'den maç sonucu çek
async function fetchMatchResultFromSportmonks(fixtureId: number): Promise<{
  homeScore: number;
  awayScore: number;
  status: string;
} | null> {
  const apiKey = process.env.SPORTMONKS_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${apiKey}&include=state;scores`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const fixture = data.data;

    if (!fixture) {
      return null;
    }

    // State kontrolü
    const stateInfo = fixture.state;
    const stateName = stateInfo?.state || stateInfo?.developer_name || stateInfo?.short_name || '';
    const stateId = fixture.state_id;

    // Finished state IDs: 5 = FT, 8 = FT_PEN, 11 = AET, 12 = PEN
    const finishedStateIds = [5, 8, 11, 12];
    const finishedStates = ['FT', 'FT_PEN', 'AET', 'PEN', 'FINISHED', 'ended'];

    const isFinished =
      finishedStates.includes(stateName) ||
      finishedStateIds.includes(stateId) ||
      stateInfo?.short_name === 'FT' ||
      stateName.includes('FT') ||
      stateName.includes('FINISHED');

    if (!isFinished) {
      return null;
    }

    // Skorları çek
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;

    // CURRENT skorlarını bul
    for (const scoreEntry of scores) {
      const participant = scoreEntry.score?.participant || scoreEntry.participant;
      const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;

      if (scoreEntry.description === 'CURRENT') {
        if (participant === 'home') homeScore = goals;
        if (participant === 'away') awayScore = goals;
      }
    }

    // Eğer CURRENT bulunamadıysa, FULLTIME, FT, 2ND_HALF veya en yüksek skorları dene
    if (homeScore === 0 && awayScore === 0) {
      for (const scoreEntry of scores) {
        const participant = scoreEntry.score?.participant || scoreEntry.participant;
        const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;
        const description = scoreEntry.description || '';

        if (description === 'FULLTIME' || description === 'FT' || description === '2ND_HALF' || description.includes('FT')) {
          if (participant === 'home' && goals > homeScore) homeScore = goals;
          if (participant === 'away' && goals > awayScore) awayScore = goals;
        }
      }
    }

    // Eğer hala skor yoksa, tüm skorlardan en yüksek değerleri al
    if (homeScore === 0 && awayScore === 0 && scores.length > 0) {
      for (const scoreEntry of scores) {
        const participant = scoreEntry.score?.participant || scoreEntry.participant;
        const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;

        if (participant === 'home' && goals > homeScore) homeScore = goals;
        if (participant === 'away' && goals > awayScore) awayScore = goals;
      }
    }

    // Eğer hala skor yoksa, result_score'u kontrol et
    if (homeScore === 0 && awayScore === 0 && fixture.result_score) {
      const resultScore = fixture.result_score;
      if (typeof resultScore === 'string') {
        const parts = resultScore.split('-');
        if (parts.length === 2) {
          homeScore = parseInt(parts[0]) || 0;
          awayScore = parseInt(parts[1]) || 0;
        }
      }
    }

    return {
      homeScore,
      awayScore,
      status: 'FT'
    };
  } catch (error: any) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const daysBack = body.daysBack || 7;
    const limit = body.limit || 50;

    console.log(`\n🔄 SETTLING ALL AGENT PREDICTIONS`);
    console.log(`   📅 Looking back ${daysBack} days, limit: ${limit}\n`);

    // Bekleyen agent predictions'ları al (settled_at IS NULL)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Unique fixture_id'leri al (her fixture için bir kez işlem yapmak için)
    const { data: uniqueFixtures, error: fetchError } = await (supabase
      .from('agent_predictions') as any)
      .select('fixture_id, match_date')
      .is('settled_at', null)
      .gte('match_date', cutoffDateStr)
      .lte('match_date', new Date().toISOString().split('T')[0])
      .order('match_date', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching agent predictions:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    if (!uniqueFixtures || uniqueFixtures.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending predictions to settle',
        stats: {
          total: 0,
          settled: 0,
          skipped: 0,
          errors: 0
        }
      });
    }

    // Unique fixture_id'leri al
    const fixtureIds: number[] = [...new Set(uniqueFixtures.map((f: any) => Number(f.fixture_id)))].slice(0, limit).filter(id => !isNaN(id));
    console.log(`📋 Found ${fixtureIds.length} unique fixtures to process\n`);

    let settledCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const fixtureId of fixtureIds) {
      try {
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

        // Sportmonks'tan sonuç al
        const result = await fetchMatchResultFromSportmonks(fixtureId);

        if (!result) {
          skippedCount++;
          continue;
        }

        // Match result hesapla
        let matchResult: '1' | 'X' | '2';
        if (result.homeScore > result.awayScore) matchResult = '1';
        else if (result.awayScore > result.homeScore) matchResult = '2';
        else matchResult = 'X';

        const totalGoals = result.homeScore + result.awayScore;
        const btts = result.homeScore > 0 && result.awayScore > 0;

        // Bu fixture için tüm agent predictions'ları bul ve settle et
        const { data: predictions, error: predError } = await (supabase
          .from('agent_predictions') as any)
          .select('*')
          .eq('fixture_id', fixtureId)
          .is('settled_at', null);

        if (predError || !predictions || predictions.length === 0) {
          skippedCount++;
          continue;
        }

        // Her tahmini doğrula ve güncelle
        for (const pred of predictions) {
          // Match Result doğruluğu
          const normalizeMR = (pred: string | null): '1' | 'X' | '2' | null => {
            if (!pred) return null;
            const p = String(pred).toLowerCase().trim();
            if (p === '1' || p === 'home' || p === 'home_win') return '1';
            if (p === '2' || p === 'away' || p === 'away_win') return '2';
            if (p === 'x' || p === 'draw' || p === 'tie') return 'X';
            return null;
          };

          const matchResultCorrect = pred.match_result_prediction
            ? normalizeMR(pred.match_result_prediction) === matchResult
            : null;

          // Over/Under doğruluğu
          const overUnderCorrect = pred.over_under_prediction
            ? (pred.over_under_prediction.toLowerCase() === 'over' && totalGoals > 2.5) ||
              (pred.over_under_prediction.toLowerCase() === 'under' && totalGoals < 2.5)
            : null;

          // BTTS doğruluğu
          const bttsCorrect = pred.btts_prediction
            ? (pred.btts_prediction.toLowerCase() === 'yes' && btts) ||
              (pred.btts_prediction.toLowerCase() === 'no' && !btts)
            : null;

          // Güncelle
          const { error: updateError } = await (supabase
            .from('agent_predictions') as any)
            .update({
              match_result_correct: matchResultCorrect,
              over_under_correct: overUnderCorrect,
              btts_correct: bttsCorrect,
              actual_match_result: matchResult,
              actual_home_goals: result.homeScore,
              actual_away_goals: result.awayScore,
              actual_total_goals: totalGoals,
              actual_btts: btts,
              settled_at: new Date().toISOString(),
            })
            .eq('id', pred.id);

          if (updateError) {
            console.error(`   ❌ Error settling prediction ${pred.id}:`, updateError);
            errorCount++;
          }
        }

        settledCount++;
        console.log(`   ✅ Settled fixture ${fixtureId}: ${result.homeScore}-${result.awayScore} (${predictions.length} predictions)`);

      } catch (error: any) {
        console.error(`   ❌ Error processing fixture ${fixtureId}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ SETTLEMENT COMPLETE`);
    console.log(`   ✅ Settled: ${settledCount} fixtures`);
    console.log(`   ⏭️ Skipped: ${skippedCount} fixtures`);
    console.log(`   ❌ Errors: ${errorCount} fixtures\n`);

    return NextResponse.json({
      success: true,
      stats: {
        total: fixtureIds.length,
        settled: settledCount,
        skipped: skippedCount,
        errors: errorCount
      }
    });

  } catch (error: any) {
    console.error('❌ Settlement error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ daysBack, limit })
    }));

    return result;
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
