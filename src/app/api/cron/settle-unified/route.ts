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
    
    // Finished state IDs: 5 = FT, 11 = AET, 12 = PEN
    const finishedStateIds = [5, 11, 12];
    const finishedStates = ['FT', 'AET', 'PEN', 'FINISHED', 'ended'];
    
    const isFinished = 
      finishedStates.includes(stateName) || 
      finishedStateIds.includes(stateId) ||
      stateInfo?.short_name === 'FT';

    if (!isFinished) {
      console.log(`   ⏳ Not finished yet. State: ${stateName}, ID: ${stateId}`);
      return null;
    }

    // Skorları çek - Sportmonks v3 format: score.score.goals, score.score.participant
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;

    // CURRENT skorlarını bul (nihai skor)
    for (const scoreEntry of scores) {
      // Sportmonks v3 format: nested score object
      const participant = scoreEntry.score?.participant || scoreEntry.participant;
      const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;
      
      if (scoreEntry.description === 'CURRENT') {
        if (participant === 'home') homeScore = goals;
        if (participant === 'away') awayScore = goals;
      }
    }

    // Eğer CURRENT bulunamadıysa, 2ND_HALF veya FULLTIME dene
    if (homeScore === 0 && awayScore === 0) {
      for (const scoreEntry of scores) {
        const participant = scoreEntry.score?.participant || scoreEntry.participant;
        const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;
        
        if (scoreEntry.description === '2ND_HALF' || scoreEntry.description === 'FULLTIME') {
          if (participant === 'home' && goals > homeScore) homeScore = goals;
          if (participant === 'away' && goals > awayScore) awayScore = goals;
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
  try {
    // Gerçek sonuçları hesapla
    const totalGoals = homeScore + awayScore;
    const actualMatchResult = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
    const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
    const actualBtts = homeScore > 0 && awayScore > 0;

    // Tahmin doğruluğunu kontrol et
    const matchResultCorrect = analysis.match_result_prediction === actualMatchResult;
    const overUnderCorrect = analysis.over_under_prediction === actualOverUnder;
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
    
    // 7 günden eski maçları atla
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: pendingAnalyses, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('fixture_id, home_team, away_team, match_date, match_result_prediction, over_under_prediction, btts_prediction, analysis')
      .eq('is_settled', false)
      .gte('match_date', sevenDaysAgo.toISOString().split('T')[0])
      .lte('match_date', cutoffTime.toISOString().split('T')[0])
      .order('match_date', { ascending: true })
      .limit(30);

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

