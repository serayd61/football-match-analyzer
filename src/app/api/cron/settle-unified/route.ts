// ============================================================================
// CRON JOB - SETTLE UNIFIED ANALYSIS
// unified_analysis tablosundaki bekleyen tahminleri Sportmonks sonuçlarıyla settle eder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Lazy-loaded Supabase client
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

// Sportmonks API'den maç sonucu çek
async function fetchMatchResultFromSportmonks(fixtureId: number): Promise<{
  homeScore: number;
  awayScore: number;
  status: string;
} | null> {
  const apiKey = process.env.SPORTMONKS_API_KEY;

  if (!apiKey) {
    console.log('❌ SPORTMONKS_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${apiKey}&include=state;scores`;

    console.log(`   📡 Fetching fixture ${fixtureId}...`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.log(`   ❌ API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const fixture = data.data;

    if (!fixture) {
      console.log(`   ❌ No fixture data`);
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
      console.log(`   ⏳ Not finished yet. State: ${stateName}, ID: ${stateId}`);
      return null;
    }

    // Skorları çek - Sportmonks v3 format: score.score.goals, score.score.participant
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;

    // Önce CURRENT skorlarını bul (nihai skor)
    for (const scoreEntry of scores) {
      // Sportmonks v3 format: nested score object
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

    // Eğer hala skor yoksa, result_score'u kontrol et (alternatif format)
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

    console.log(`   ✅ Score: ${homeScore}-${awayScore}`);

    return {
      homeScore,
      awayScore,
      status: 'FT'
    };
  } catch (error: any) {
    console.error(`   ❌ Sportmonks error:`, error.message);
    return null;
  }
}

// Tek bir analizi settle et
async function settleUnifiedAnalysis(
  supabase: SupabaseClient,
  analysis: any,
  homeScore: number,
  awayScore: number
): Promise<boolean> {
  // Normalize prediction helper - maps 'home'→'1', 'away'→'2', 'draw/x'→'X'
  // Daha sağlam: Sadece 'home' veya 'away' string'lerini yakala (kelime sınırları olmadan)
  const normalizeMR = (pred: string | undefined): string => {
    if (!pred) return '';
    const p = pred.toLowerCase().trim();
    // Önce tam eşleşmeleri kontrol et
    if (p === '1' || p === 'home' || p === 'ev sahibi' || p === 'home_win' || p === 'homewin') return '1';
    if (p === '2' || p === 'away' || p === 'deplasman' || p === 'away_win' || p === 'awaywin') return '2';
    if (p === 'x' || p === 'draw' || p === 'beraberlik' || p === 'tie' || p === 'd') return 'X';
    // Sonra içerik kontrolü (kelime sınırları ile daha güvenli)
    if (p.includes('home') && !p.includes('away')) return '1';
    if (p.includes('away') && !p.includes('home')) return '2';
    return p.toUpperCase();
  };

  const normalizeOU = (pred: string | undefined): string => {
    if (!pred) return '';
    const p = pred.toLowerCase().trim();
    // Case-insensitive karşılaştırma için normalize et
    if (p.includes('over') || p.includes('üst') || p === 'o') return 'Over';
    if (p.includes('under') || p.includes('alt') || p === 'u') return 'Under';
    // Eğer zaten doğru formattaysa (büyük/küçük harf fark etmez)
    if (p === 'over') return 'Over';
    if (p === 'under') return 'Under';
    return pred;
  };

  try {
    // Gerçek sonuçları hesapla
    const totalGoals = homeScore + awayScore;
    const actualMatchResult = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
    const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
    const actualBtts = homeScore > 0 && awayScore > 0;

    // Normalize predictions before comparison
    const normalizedMRPred = normalizeMR(analysis.match_result_prediction);
    const normalizedOUPred = normalizeOU(analysis.over_under_prediction);

    // Tahmin doğruluğunu kontrol et - NORMALIZED karşılaştırma
    const matchResultCorrect = normalizedMRPred === actualMatchResult;
    const overUnderCorrect = normalizedOUPred === actualOverUnder;
    const bttsCorrect = (analysis.btts_prediction === 'Yes' && actualBtts) ||
      (analysis.btts_prediction === 'No' && !actualBtts);

    // Skor tahmini kontrolü
    const predictedScore = analysis.analysis?.predictions?.matchResult?.scorePrediction ||
      analysis.analysis?.matchResult?.scorePrediction;
    const scorePredictionCorrect = predictedScore ?
      predictedScore === `${homeScore}-${awayScore}` : false;

    // Güncelle
    const { error: updateError } = await supabase
      .from('unified_analysis')
      .update({
        is_settled: true,
        actual_home_score: homeScore,
        actual_away_score: awayScore,
        actual_total_goals: totalGoals,
        actual_btts: actualBtts,
        actual_match_result: actualMatchResult,
        match_result_correct: matchResultCorrect,
        over_under_correct: overUnderCorrect,
        btts_correct: bttsCorrect,
        score_prediction_correct: scorePredictionCorrect,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fixture_id', analysis.fixture_id);

    if (updateError) {
      console.error(`   ❌ Update error for ${analysis.fixture_id}:`, updateError.message);
      return false;
    }

    console.log(`   ✅ Settled: ${analysis.home_team} ${homeScore}-${awayScore} ${analysis.away_team}`);
    console.log(`      MR: ${analysis.match_result_prediction} → ${actualMatchResult} (${matchResultCorrect ? '✓' : '✗'})`);
    console.log(`      O/U: ${analysis.over_under_prediction} → ${actualOverUnder} (${overUnderCorrect ? '✓' : '✗'})`);
    console.log(`      BTTS: ${analysis.btts_prediction} → ${actualBtts ? 'Yes' : 'No'} (${bttsCorrect ? '✓' : '✗'})`);

    return true;
  } catch (error: any) {
    console.error(`   ❌ Settle error:`, error.message);
    return false;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🔄 SETTLE UNIFIED ANALYSIS CRON JOB');
    console.log('═'.repeat(70));

    const supabase = getSupabase();

    // Maç saatinden en az 2.5 saat geçmiş bekleyen analizleri al
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 2.5 * 60 * 60 * 1000);
    const cutoffDate = cutoffTime.toISOString().split('T')[0]; // YYYY-MM-DD formatı

    // 7 günden eski maçları atla
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0];

    // Dünkü ve bugünkü (2.5 saat öncesine kadar) maçları al
    // match_date sadece tarih (YYYY-MM-DD), saat bilgisi yok
    // Bu yüzden dünkü maçlar için match_date < bugün, bugünkü maçlar için match_date <= bugün
    const today = new Date().toISOString().split('T')[0];
    
    const { data: pendingAnalyses, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('fixture_id, home_team, away_team, match_date, match_result_prediction, over_under_prediction, btts_prediction, analysis')
      .eq('is_settled', false)
      .gte('match_date', sevenDaysAgoDate)
      .lte('match_date', cutoffDate) // Dünkü ve bugünkü (2.5 saat öncesine kadar) maçlar
      .order('match_date', { ascending: true })
      .limit(50); // Limit artırıldı: 30 → 50

    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json({
        success: false,
        error: fetchError.message
      }, { status: 500 });
    }

    if (!pendingAnalyses || pendingAnalyses.length === 0) {
      console.log('✅ No pending analyses to settle');
      return NextResponse.json({
        success: true,
        message: 'No pending analyses',
        settled: 0
      });
    }

    console.log(`📋 Found ${pendingAnalyses.length} pending analyses\n`);

    let settledCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const analysis of pendingAnalyses) {
      console.log(`\n📊 ${analysis.home_team} vs ${analysis.away_team} (${analysis.match_date})`);

      try {
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

        // Sportmonks'tan sonuç al
        const result = await fetchMatchResultFromSportmonks(analysis.fixture_id);

        if (!result) {
          skippedCount++;
          continue;
        }

        // Settle et
        const success = await settleUnifiedAnalysis(
          supabase,
          analysis,
          result.homeScore,
          result.awayScore
        );

        // 🧠 ÖĞRENEN SİSTEM: Agent tahminlerini settle et
        if (success) {
          try {
            const { settleAgentPredictions } = await import('@/lib/agent-learning/performance-tracker');
            
            // Match result hesapla
            let matchResult: '1' | 'X' | '2';
            if (result.homeScore > result.awayScore) matchResult = '1';
            else if (result.awayScore > result.homeScore) matchResult = '2';
            else matchResult = 'X';
            
            await settleAgentPredictions(analysis.fixture_id, {
              homeGoals: result.homeScore,
              awayGoals: result.awayScore,
              matchResult,
              totalGoals: result.homeScore + result.awayScore,
              btts: result.homeScore > 0 && result.awayScore > 0
            });
            
            console.log(`   🧠 Agent predictions settled for fixture ${analysis.fixture_id}`);
          } catch (agentError) {
            console.warn(`   ⚠️ Failed to settle agent predictions:`, agentError);
            // Non-blocking - devam et
          }
        }

        if (success) {
          settledCount++;
        } else {
          errorCount++;
        }

      } catch (error: any) {
        console.error(`   ❌ Error:`, error.message);
        errorCount++;
      }
    }

    // 🧠 Settlement sonrası AutoLearn model güncelle
    if (settledCount > 0) {
      try {
        const { updateModel } = await import('@/lib/autolearn/model');
        const alResult = await updateModel();
        console.log(`🧠 AutoLearn model updated after settling ${settledCount} matches (${alResult.updated} total processed)`);
      } catch (alError) {
        console.warn('⚠️ AutoLearn model update failed (non-critical):', alError);
      }
    }

    const duration = Date.now() - startTime;

    console.log('\n' + '═'.repeat(70));
    console.log('✅ CRON JOB COMPLETED');
    console.log(`   📊 Checked: ${pendingAnalyses.length}`);
    console.log(`   ✅ Settled: ${settledCount}`);
    console.log(`   ⏳ Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏱️ Duration: ${duration}ms`);
    console.log('═'.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      stats: {
        checked: pendingAnalyses.length,
        settled: settledCount,
        skipped: skippedCount,
        errors: errorCount,
        duration
      }
    });

  } catch (error: any) {
    console.error('❌ CRON JOB ERROR:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST için de destekle (manuel trigger)
export async function POST(request: NextRequest) {
  return GET(request);
}

