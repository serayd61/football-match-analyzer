// src/app/api/update-results/route.ts
// n8n workflow'u tarafından çağrılır
// Sportmonks'tan bitmiş maçları çeker ve predictions tablosunu günceller

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const API_SECRET = process.env.PREDICTIONS_API_SECRET || process.env.CRON_SECRET || 'your-secret-key';

interface PredictionAccuracy {
  matchResult: boolean | null;
  overUnder: boolean | null;
  btts: boolean | null;
}

// Tahmin doğruluğunu kontrol et
function checkPredictionAccuracy(
  prediction: any,
  homeScore: number,
  awayScore: number
): PredictionAccuracy {
  const totalGoals = homeScore + awayScore;
  const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
  const actualBtts = (homeScore > 0 && awayScore > 0) ? 'Yes' : 'No';
  const actualMatchResult = homeScore > awayScore ? '1' : (awayScore > homeScore ? '2' : 'X');

  // Over/Under kontrolü
  const checkOverUnder = (pred: string | null): boolean | null => {
    if (!pred) return null;
    const p = pred.toLowerCase();
    if (p.includes('over') || p.includes('üst') || p.includes('ust')) {
      return actualOverUnder === 'Over';
    }
    if (p.includes('under') || p.includes('alt')) {
      return actualOverUnder === 'Under';
    }
    return null;
  };

  // Match Result kontrolü
  const checkMatchResult = (pred: string | null): boolean | null => {
    if (!pred) return null;
    const p = pred.toUpperCase();
    if (p.includes('HOME') || p === '1' || p.includes('EV SAHİBİ')) {
      return actualMatchResult === '1';
    }
    if (p.includes('AWAY') || p === '2' || p.includes('DEPLASMAN')) {
      return actualMatchResult === '2';
    }
    if (p.includes('DRAW') || p === 'X' || p.includes('BERABERLİK')) {
      return actualMatchResult === 'X';
    }
    return null;
  };

  // BTTS kontrolü
  const checkBtts = (pred: string | null): boolean | null => {
    if (!pred) return null;
    const p = pred.toLowerCase();
    if (p.includes('yes') || p.includes('var') || p.includes('evet')) {
      return actualBtts === 'Yes';
    }
    if (p.includes('no') || p.includes('yok') || p.includes('hayır')) {
      return actualBtts === 'No';
    }
    return null;
  };

  return {
    matchResult: checkMatchResult(prediction.final_match_result),
    overUnder: checkOverUnder(prediction.final_over_under),
    btts: checkBtts(prediction.final_btts),
  };
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = getSupabaseAdmin();

    console.log('');
    console.log('🔄 ═══════════════════════════════════════════════════');
    console.log('🔄 AUTOMATIC RESULT UPDATE');
    console.log('🔄 ═══════════════════════════════════════════════════');

    // 1. Bekleyen tahminleri al (match_finished = false veya null)
    const { data: pendingPredictions, error: fetchError } = await supabase
      .from('predictions')
      .select('fixture_id, home_team, away_team, match_date, final_over_under, final_match_result, final_btts')
      .or('match_finished.is.null,match_finished.eq.false')
      .order('match_date', { ascending: true });

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingPredictions || pendingPredictions.length === 0) {
      console.log('ℹ️ No pending predictions to update');
      return NextResponse.json({
        success: true,
        message: 'No pending predictions',
        updated: 0,
        notFinished: 0,
        errors: 0,
        details: [],
      });
    }

    console.log(`📋 Found ${pendingPredictions.length} pending prediction(s)`);

    // 2. Sadece maç tarihi geçmiş olanları filtrele
    const now = new Date();
    const pastPredictions = pendingPredictions.filter(p => {
      const matchDate = new Date(p.match_date);
      // Maç tarihinden en az 2 saat geçmiş olmalı
      return (now.getTime() - matchDate.getTime()) > (2 * 60 * 60 * 1000);
    });

    console.log(`⏰ ${pastPredictions.length} match(es) have passed (2+ hours ago)`);

    if (pastPredictions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches finished yet',
        updated: 0,
        notFinished: pendingPredictions.length,
        errors: 0,
        details: [],
      });
    }

    // 3. Her maç için Sportmonks'tan sonuç çek
    let updated = 0;
    let notFinished = 0;
    let errors = 0;
    const details: any[] = [];

    for (const prediction of pastPredictions) {
      try {
        console.log(`🔍 Checking: ${prediction.home_team} vs ${prediction.away_team}`);

        const response = await fetch(
          `https://api.sportmonks.com/v3/football/fixtures/${prediction.fixture_id}?api_token=${SPORTMONKS_API_KEY}&include=scores`
        );

        if (!response.ok) {
          console.log(`   ❌ API error: ${response.status}`);
          errors++;
          continue;
        }

        const data = await response.json();
        const fixture = data.data;

        if (!fixture) {
          errors++;
          continue;
        }

        // Maç bitti mi kontrol et (state_id = 5 = FT)
        const isFinished = fixture.state_id === 5;

        if (!isFinished) {
          console.log(`   ⏳ Not finished yet (state: ${fixture.state_id})`);
          notFinished++;
          continue;
        }

        // Skorları çıkar
        let homeScore = 0;
        let awayScore = 0;

        if (fixture.scores && Array.isArray(fixture.scores)) {
          const currentScores = fixture.scores.filter((s: any) =>
            s.description === 'CURRENT' || s.type_id === 1525
          );

          currentScores.forEach((s: any) => {
            const goals = s.score?.goals ?? 0;
            const participant = s.score?.participant;

            if (participant === 'home') homeScore = goals;
            else if (participant === 'away') awayScore = goals;
          });
        }

        console.log(`   ✅ Final score: ${homeScore}-${awayScore}`);

        // Doğrulukları hesapla
        const accuracy = checkPredictionAccuracy(prediction, homeScore, awayScore);

        // Veritabanını güncelle
        const totalGoals = homeScore + awayScore;
        const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
        const actualBtts = (homeScore > 0 && awayScore > 0) ? 'Yes' : 'No';
        const actualMatchResult = homeScore > awayScore ? '1' : (awayScore > homeScore ? '2' : 'X');

        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            actual_home_score: homeScore,
            actual_away_score: awayScore,
            actual_total_goals: totalGoals,
            actual_over_under: actualOverUnder,
            actual_match_result: actualMatchResult,
            actual_btts: actualBtts,
            match_finished: true,
            result_updated_at: new Date().toISOString(),
            final_over_under_correct: accuracy.overUnder,
            final_match_result_correct: accuracy.matchResult,
            final_btts_correct: accuracy.btts,
          })
          .eq('fixture_id', prediction.fixture_id);

        if (updateError) {
          console.log(`   ❌ Update error: ${updateError.message}`);
          errors++;
          continue;
        }

        updated++;
        details.push({
          match: `${prediction.home_team} vs ${prediction.away_team}`,
          fixtureId: prediction.fixture_id,
          score: `${homeScore}-${awayScore}`,
          accuracy: {
            matchResult: accuracy.matchResult === true ? '✓' : (accuracy.matchResult === false ? '✗' : '-'),
            overUnder: accuracy.overUnder === true ? '✓' : (accuracy.overUnder === false ? '✗' : '-'),
            btts: accuracy.btts === true ? '✓' : (accuracy.btts === false ? '✗' : '-'),
          },
        });

      } catch (err: any) {
        console.error(`   ❌ Error: ${err.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Updated: ${updated} | ⏳ Not finished: ${notFinished} | ❌ Errors: ${errors}`);

    return NextResponse.json({
      success: true,
      updated,
      notFinished,
      errors,
      details,
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    console.error('❌ Update results error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint - durum kontrolü için
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: pending } = await supabase
      .from('predictions')
      .select('fixture_id, home_team, away_team, match_date')
      .or('match_finished.is.null,match_finished.eq.false')
      .order('match_date', { ascending: true });

    const { data: finished } = await supabase
      .from('predictions')
      .select('fixture_id')
      .eq('match_finished', true);

    return NextResponse.json({
      message: 'Prediction Results Update API',
      pendingCount: pending?.length || 0,
      finishedCount: finished?.length || 0,
      pendingMatches: pending?.slice(0, 10).map(p => ({
        match: `${p.home_team} vs ${p.away_team}`,
        date: p.match_date,
        fixtureId: p.fixture_id,
      })) || [],
      usage: 'PUT /api/update-results to fetch and update results from Sportmonks',
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
