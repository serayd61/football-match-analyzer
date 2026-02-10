// ============================================================================
// WEBHOOK - MATCH ENDED
// Maç bittiğinde tetiklenen endpoint - Hızlı settlement ve weight update
// n8n veya Sportmonks webhook'u tarafından çağrılır
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settleAgentPredictions } from '@/lib/agent-learning/performance-tracker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
async function fetchMatchResult(fixtureId: number): Promise<{
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  status: string;
} | null> {
  const apiKey = process.env.SPORTMONKS_API_KEY;

  if (!apiKey) {
    console.log('❌ SPORTMONKS_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${apiKey}&include=state;scores;participants`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.log(`❌ API error: ${response.status}`);
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
      stateInfo?.short_name === 'FT';

    if (!isFinished) {
      console.log(`⏳ Match not finished yet. State: ${stateName}, ID: ${stateId}`);
      return null;
    }

    // Skorları çek
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;

    for (const scoreEntry of scores) {
      const participant = scoreEntry.score?.participant || scoreEntry.participant;
      const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;

      if (scoreEntry.description === 'CURRENT') {
        if (participant === 'home') homeScore = goals;
        if (participant === 'away') awayScore = goals;
      }
    }

    // Fallback: FULLTIME veya FT skorları
    if (homeScore === 0 && awayScore === 0) {
      for (const scoreEntry of scores) {
        const participant = scoreEntry.score?.participant || scoreEntry.participant;
        const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;

        if (['FULLTIME', 'FT', '2ND_HALF'].includes(scoreEntry.description)) {
          if (participant === 'home') homeScore = Math.max(homeScore, goals);
          if (participant === 'away') awayScore = Math.max(awayScore, goals);
        }
      }
    }

    // Takım isimlerini al
    const participants = fixture.participants || [];
    const homeTeam = participants.find((p: any) => p.meta?.location === 'home')?.name || 'Home';
    const awayTeam = participants.find((p: any) => p.meta?.location === 'away')?.name || 'Away';

    return {
      homeScore,
      awayScore,
      homeTeam,
      awayTeam,
      status: stateName || 'FT',
    };
  } catch (error) {
    console.error('❌ Error fetching match result:', error);
    return null;
  }
}

// Unified analysis'i settle et
async function settleUnifiedAnalysis(
  fixtureId: number,
  homeScore: number,
  awayScore: number
): Promise<boolean> {
  const supabase = getSupabase();

  try {
    // Unified analysis kaydını bul
    const { data: analysis, error: fetchError } = await (supabase
      .from('unified_analysis') as any)
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('is_settled', false)
      .maybeSingle();

    if (fetchError || !analysis) {
      console.log(`⚠️ No unsettled unified analysis for fixture ${fixtureId}`);
      return false;
    }

    // Sonuçları hesapla
    const totalGoals = homeScore + awayScore;
    const actualMatchResult = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
    const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
    const actualBtts = homeScore > 0 && awayScore > 0;

    // Tahminleri normalize et
    const normalizeMR = (pred: string | null): string => {
      if (!pred) return '';
      const p = pred.toLowerCase().trim();
      if (p === 'home' || p === '1') return '1';
      if (p === 'away' || p === '2') return '2';
      if (p === 'draw' || p === 'x') return 'X';
      return pred;
    };

    const normalizeOU = (pred: string | null): string => {
      if (!pred) return '';
      const p = pred.toLowerCase().trim();
      if (p.includes('over') || p === 'üst') return 'Over';
      if (p.includes('under') || p === 'alt') return 'Under';
      return pred;
    };

    // Doğruluk kontrolü
    const matchResultCorrect = normalizeMR(analysis.match_result_prediction) === actualMatchResult;
    const overUnderCorrect = normalizeOU(analysis.over_under_prediction) === actualOverUnder;
    const bttsCorrect = analysis.btts_prediction !== null
      ? (analysis.btts_prediction === true && actualBtts) || (analysis.btts_prediction === false && !actualBtts)
      : null;

    // Güncelle
    const { error: updateError } = await (supabase
      .from('unified_analysis') as any)
      .update({
        is_settled: true,
        actual_home_score: homeScore,
        actual_away_score: awayScore,
        actual_total_goals: totalGoals,
        actual_match_result: actualMatchResult,
        actual_over_under: actualOverUnder,
        actual_btts: actualBtts,
        match_result_correct: matchResultCorrect,
        over_under_correct: overUnderCorrect,
        btts_correct: bttsCorrect,
        settled_at: new Date().toISOString(),
      })
      .eq('id', analysis.id);

    if (updateError) {
      console.error('❌ Error settling unified analysis:', updateError);
      return false;
    }

    console.log(`✅ Unified analysis settled: MR=${matchResultCorrect}, OU=${overUnderCorrect}, BTTS=${bttsCorrect}`);
    return true;
  } catch (error) {
    console.error('❌ Exception settling unified analysis:', error);
    return false;
  }
}

// POST: Tek bir maç için settlement
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { fixtureId, homeScore, awayScore, forceSettle = false } = body;

    if (!fixtureId) {
      return NextResponse.json(
        { success: false, error: 'fixtureId is required' },
        { status: 400 }
      );
    }

    console.log(`\n🔔 WEBHOOK: Match Ended - Fixture ${fixtureId}`);

    let result: { homeScore: number; awayScore: number } | null = null;

    // Eğer skor verilmişse direkt kullan, yoksa API'den çek
    if (typeof homeScore === 'number' && typeof awayScore === 'number') {
      result = { homeScore, awayScore };
      console.log(`📊 Using provided scores: ${homeScore} - ${awayScore}`);
    } else {
      const matchResult = await fetchMatchResult(fixtureId);
      if (!matchResult) {
        return NextResponse.json(
          { success: false, error: 'Match not finished or result not available' },
          { status: 400 }
        );
      }
      result = matchResult;
      console.log(`📊 Fetched scores: ${result.homeScore} - ${result.awayScore}`);
    }

    // 1. Unified Analysis'i settle et
    const unifiedSettled = await settleUnifiedAnalysis(fixtureId, result.homeScore, result.awayScore);

    // 2. Agent Predictions'ları settle et (bu trigger ile weight'leri otomatik günceller)
    const totalGoals = result.homeScore + result.awayScore;
    const actualMatchResult = result.homeScore > result.awayScore ? '1' : result.homeScore < result.awayScore ? '2' : 'X';
    const actualBtts = result.homeScore > 0 && result.awayScore > 0;

    const agentsSettled = await settleAgentPredictions(fixtureId, {
      homeGoals: result.homeScore,
      awayGoals: result.awayScore,
      matchResult: actualMatchResult as '1' | 'X' | '2',
      totalGoals,
      btts: actualBtts,
    });

    // 3. AutoLearn model güncelle (background, non-blocking)
    let autoLearnUpdated = false;
    try {
      const { updateModel } = await import('@/lib/autolearn/model');
      const alResult = await updateModel([fixtureId]);
      autoLearnUpdated = true;
      console.log(`🧠 AutoLearn model updated: ${alResult.updated} matches processed`);
    } catch (alError) {
      console.warn('⚠️ AutoLearn model update failed (non-critical):', alError);
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Settlement complete in ${duration}ms`);
    console.log(`   Unified: ${unifiedSettled ? '✓' : '✗'}, Agents: ${agentsSettled ? '✓' : '✗'}, AutoLearn: ${autoLearnUpdated ? '✓' : '✗'}`);

    return NextResponse.json({
      success: true,
      fixtureId,
      result: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        matchResult: actualMatchResult,
        totalGoals,
        btts: actualBtts,
      },
      settled: {
        unified: unifiedSettled,
        agents: agentsSettled,
        autoLearn: autoLearnUpdated,
      },
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Biten maçları kontrol et ve settle et (n8n polling için)
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const supabase = getSupabase();

  try {
    console.log('\n🔍 Checking for finished matches to settle...');

    // Son 24 saat içindeki settle edilmemiş maçları bul
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 3); // Maç bitiminden 3 saat sonra settle et

    const { data: pendingAnalyses, error: fetchError } = await (supabase
      .from('unified_analysis') as any)
      .select('fixture_id, home_team, away_team, match_date')
      .eq('is_settled', false)
      .gte('match_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('match_date', cutoffDate.toISOString().split('T')[0])
      .order('match_date', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('❌ Error fetching pending analyses:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pending analyses' },
        { status: 500 }
      );
    }

    if (!pendingAnalyses || pendingAnalyses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending matches to settle',
        checked: 0,
        settled: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`📋 Found ${pendingAnalyses.length} pending matches`);

    const results = {
      checked: 0,
      settled: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };

    // Her maç için settlement yap
    for (const analysis of pendingAnalyses) {
      results.checked++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const matchResult = await fetchMatchResult(analysis.fixture_id);

        if (!matchResult) {
          results.skipped++;
          continue;
        }

        console.log(`⚽ ${analysis.home_team} ${matchResult.homeScore} - ${matchResult.awayScore} ${analysis.away_team}`);

        // Settlement
        const unifiedSettled = await settleUnifiedAnalysis(
          analysis.fixture_id,
          matchResult.homeScore,
          matchResult.awayScore
        );

        const totalGoals = matchResult.homeScore + matchResult.awayScore;
        const actualMatchResult = matchResult.homeScore > matchResult.awayScore ? '1' 
          : matchResult.homeScore < matchResult.awayScore ? '2' : 'X';
        const actualBtts = matchResult.homeScore > 0 && matchResult.awayScore > 0;

        const agentsSettled = await settleAgentPredictions(analysis.fixture_id, {
          homeGoals: matchResult.homeScore,
          awayGoals: matchResult.awayScore,
          matchResult: actualMatchResult as '1' | 'X' | '2',
          totalGoals,
          btts: actualBtts,
        });

        if (unifiedSettled || agentsSettled) {
          results.settled++;
          results.details.push({
            fixtureId: analysis.fixture_id,
            match: `${analysis.home_team} vs ${analysis.away_team}`,
            score: `${matchResult.homeScore} - ${matchResult.awayScore}`,
            unified: unifiedSettled,
            agents: agentsSettled,
          });
        }
      } catch (error) {
        console.error(`❌ Error settling fixture ${analysis.fixture_id}:`, error);
        results.errors++;
      }
    }

    // Settlement sonrası AutoLearn model güncelle
    if (results.settled > 0) {
      try {
        const { updateModel } = await import('@/lib/autolearn/model');
        await updateModel();
        console.log(`🧠 AutoLearn model updated after settling ${results.settled} matches`);
      } catch (alError) {
        console.warn('⚠️ AutoLearn model update failed (non-critical):', alError);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n✅ Settlement complete in ${duration}ms`);
    console.log(`   Checked: ${results.checked}, Settled: ${results.settled}, Skipped: ${results.skipped}, Errors: ${results.errors}`);

    return NextResponse.json({
      success: true,
      ...results,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Webhook GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
