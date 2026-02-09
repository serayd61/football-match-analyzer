// ============================================================================
// API: Optimized Performance Stats v2
// GET /api/performance/stats-v2
// - Materialized view'lardan okur (hızlı)
// - Agent bazlı detaylı istatistikler
// - Lig bazlı breakdown
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AgentStats {
  agent_name: string;
  total_matches: number;
  mr_correct: number;
  mr_accuracy: number;
  ou_correct: number;
  ou_accuracy: number;
  btts_correct: number;
  btts_accuracy: number;
  overall_accuracy: number;
  avg_confidence: number;
}

interface LeagueStats {
  league: string;
  total_matches: number;
  mr_correct: number;
  mr_accuracy: number;
  ou_correct: number;
  ou_accuracy: number;
  btts_correct: number;
  btts_accuracy: number;
  avg_confidence: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('📊 GET /api/performance/stats-v2 called');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Paralel olarak tüm verileri çek
    const [agentStatsResult, leagueStatsResult, summaryResult] = await Promise.all([
      // 1. Agent performance stats (materialized view veya fallback)
      supabase.from('mv_agent_performance_stats').select('*'),
      
      // 2. League performance stats (materialized view veya fallback)
      supabase.from('mv_league_performance_stats').select('*'),
      
      // 3. Summary counts (hızlı count query)
      supabase.from('analysis_performance')
        .select('fixture_id, match_settled', { count: 'exact', head: false })
    ]);

    // Agent stats - materialized view yoksa fallback
    let agentStats: AgentStats[] = [];
    if (agentStatsResult.error) {
      console.log('⚠️ Materialized view not found, using fallback query');
      // Fallback: analysis_performance'dan direkt hesapla
      const { data: fallbackData } = await supabase
        .from('analysis_performance')
        .select(`
          consensus_mr_correct, consensus_ou_correct, consensus_btts_correct,
          consensus_confidence, match_settled,
          stats_agent_mr_correct, stats_agent_ou_correct, stats_agent_btts_correct,
          odds_agent_mr_correct, odds_agent_ou_correct, odds_agent_btts_correct,
          deep_analysis_mr_correct, deep_analysis_ou_correct, deep_analysis_btts_correct,
          master_strategist_mr_correct, master_strategist_ou_correct, master_strategist_btts_correct,
          ai_smart_mr_correct, ai_smart_ou_correct, ai_smart_btts_correct
        `)
        .eq('match_settled', true);

      if (fallbackData && fallbackData.length > 0) {
        const total = fallbackData.length;
        
        // Consensus stats
        const consensusMR = fallbackData.filter(r => r.consensus_mr_correct === true).length;
        const consensusOU = fallbackData.filter(r => r.consensus_ou_correct === true).length;
        const consensusBTTS = fallbackData.filter(r => r.consensus_btts_correct === true).length;
        const avgConf = fallbackData.reduce((sum, r) => sum + (r.consensus_confidence || 0), 0) / total;
        
        agentStats.push({
          agent_name: 'consensus',
          total_matches: total,
          mr_correct: consensusMR,
          mr_accuracy: Math.round((consensusMR / total) * 100 * 10) / 10,
          ou_correct: consensusOU,
          ou_accuracy: Math.round((consensusOU / total) * 100 * 10) / 10,
          btts_correct: consensusBTTS,
          btts_accuracy: Math.round((consensusBTTS / total) * 100 * 10) / 10,
          overall_accuracy: Math.round(((consensusMR + consensusOU + consensusBTTS) / (total * 3)) * 100 * 10) / 10,
          avg_confidence: Math.round(avgConf * 10) / 10
        });

        // Stats Agent
        const statsMR = fallbackData.filter(r => r.stats_agent_mr_correct === true).length;
        const statsOU = fallbackData.filter(r => r.stats_agent_ou_correct === true).length;
        const statsBTTS = fallbackData.filter(r => r.stats_agent_btts_correct === true).length;
        if (statsMR > 0 || statsOU > 0 || statsBTTS > 0) {
          agentStats.push({
            agent_name: 'stats_agent',
            total_matches: total,
            mr_correct: statsMR,
            mr_accuracy: Math.round((statsMR / total) * 100 * 10) / 10,
            ou_correct: statsOU,
            ou_accuracy: Math.round((statsOU / total) * 100 * 10) / 10,
            btts_correct: statsBTTS,
            btts_accuracy: Math.round((statsBTTS / total) * 100 * 10) / 10,
            overall_accuracy: Math.round(((statsMR + statsOU + statsBTTS) / (total * 3)) * 100 * 10) / 10,
            avg_confidence: 0
          });
        }

        // Odds Agent
        const oddsMR = fallbackData.filter(r => r.odds_agent_mr_correct === true).length;
        const oddsOU = fallbackData.filter(r => r.odds_agent_ou_correct === true).length;
        const oddsBTTS = fallbackData.filter(r => r.odds_agent_btts_correct === true).length;
        if (oddsMR > 0 || oddsOU > 0 || oddsBTTS > 0) {
          agentStats.push({
            agent_name: 'odds_agent',
            total_matches: total,
            mr_correct: oddsMR,
            mr_accuracy: Math.round((oddsMR / total) * 100 * 10) / 10,
            ou_correct: oddsOU,
            ou_accuracy: Math.round((oddsOU / total) * 100 * 10) / 10,
            btts_correct: oddsBTTS,
            btts_accuracy: Math.round((oddsBTTS / total) * 100 * 10) / 10,
            overall_accuracy: Math.round(((oddsMR + oddsOU + oddsBTTS) / (total * 3)) * 100 * 10) / 10,
            avg_confidence: 0
          });
        }

        // Deep Analysis
        const deepMR = fallbackData.filter(r => r.deep_analysis_mr_correct === true).length;
        const deepOU = fallbackData.filter(r => r.deep_analysis_ou_correct === true).length;
        const deepBTTS = fallbackData.filter(r => r.deep_analysis_btts_correct === true).length;
        if (deepMR > 0 || deepOU > 0 || deepBTTS > 0) {
          agentStats.push({
            agent_name: 'deep_analysis',
            total_matches: total,
            mr_correct: deepMR,
            mr_accuracy: Math.round((deepMR / total) * 100 * 10) / 10,
            ou_correct: deepOU,
            ou_accuracy: Math.round((deepOU / total) * 100 * 10) / 10,
            btts_correct: deepBTTS,
            btts_accuracy: Math.round((deepBTTS / total) * 100 * 10) / 10,
            overall_accuracy: Math.round(((deepMR + deepOU + deepBTTS) / (total * 3)) * 100 * 10) / 10,
            avg_confidence: 0
          });
        }

        // Master Strategist
        const masterMR = fallbackData.filter(r => r.master_strategist_mr_correct === true).length;
        const masterOU = fallbackData.filter(r => r.master_strategist_ou_correct === true).length;
        const masterBTTS = fallbackData.filter(r => r.master_strategist_btts_correct === true).length;
        if (masterMR > 0 || masterOU > 0 || masterBTTS > 0) {
          agentStats.push({
            agent_name: 'master_strategist',
            total_matches: total,
            mr_correct: masterMR,
            mr_accuracy: Math.round((masterMR / total) * 100 * 10) / 10,
            ou_correct: masterOU,
            ou_accuracy: Math.round((masterOU / total) * 100 * 10) / 10,
            btts_correct: masterBTTS,
            btts_accuracy: Math.round((masterBTTS / total) * 100 * 10) / 10,
            overall_accuracy: Math.round(((masterMR + masterOU + masterBTTS) / (total * 3)) * 100 * 10) / 10,
            avg_confidence: 0
          });
        }

        // AI Smart
        const smartMR = fallbackData.filter(r => r.ai_smart_mr_correct === true).length;
        const smartOU = fallbackData.filter(r => r.ai_smart_ou_correct === true).length;
        const smartBTTS = fallbackData.filter(r => r.ai_smart_btts_correct === true).length;
        if (smartMR > 0 || smartOU > 0 || smartBTTS > 0) {
          agentStats.push({
            agent_name: 'ai_smart',
            total_matches: total,
            mr_correct: smartMR,
            mr_accuracy: Math.round((smartMR / total) * 100 * 10) / 10,
            ou_correct: smartOU,
            ou_accuracy: Math.round((smartOU / total) * 100 * 10) / 10,
            btts_correct: smartBTTS,
            btts_accuracy: Math.round((smartBTTS / total) * 100 * 10) / 10,
            overall_accuracy: Math.round(((smartMR + smartOU + smartBTTS) / (total * 3)) * 100 * 10) / 10,
            avg_confidence: 0
          });
        }
      }
    } else {
      agentStats = (agentStatsResult.data || []) as AgentStats[];
    }

    // League stats - materialized view yoksa fallback
    let leagueStats: LeagueStats[] = [];
    if (leagueStatsResult.error) {
      console.log('⚠️ League materialized view not found, using fallback');
      const { data: leagueFallback } = await supabase
        .from('analysis_performance')
        .select('league, consensus_mr_correct, consensus_ou_correct, consensus_btts_correct, consensus_confidence')
        .eq('match_settled', true)
        .not('league', 'is', null);

      if (leagueFallback && leagueFallback.length > 0) {
        const leagueMap = new Map<string, any>();
        
        for (const row of leagueFallback) {
          if (!row.league) continue;
          
          if (!leagueMap.has(row.league)) {
            leagueMap.set(row.league, {
              league: row.league,
              total: 0,
              mr: 0,
              ou: 0,
              btts: 0,
              confSum: 0
            });
          }
          
          const stats = leagueMap.get(row.league);
          stats.total++;
          if (row.consensus_mr_correct) stats.mr++;
          if (row.consensus_ou_correct) stats.ou++;
          if (row.consensus_btts_correct) stats.btts++;
          stats.confSum += row.consensus_confidence || 0;
        }

        leagueStats = Array.from(leagueMap.values()).map(s => ({
          league: s.league,
          total_matches: s.total,
          mr_correct: s.mr,
          mr_accuracy: Math.round((s.mr / s.total) * 100 * 10) / 10,
          ou_correct: s.ou,
          ou_accuracy: Math.round((s.ou / s.total) * 100 * 10) / 10,
          btts_correct: s.btts,
          btts_accuracy: Math.round((s.btts / s.total) * 100 * 10) / 10,
          avg_confidence: Math.round((s.confSum / s.total) * 10) / 10
        })).sort((a, b) => b.total_matches - a.total_matches);
      }
    } else {
      leagueStats = (leagueStatsResult.data || []) as LeagueStats[];
    }

    // Summary hesapla
    const summaryData = summaryResult.data || [];
    const totalMatches = summaryData.length;
    const settledMatches = summaryData.filter(r => r.match_settled === true).length;
    const pendingMatches = totalMatches - settledMatches;

    // Consensus accuracy from agent stats
    const consensusStats = agentStats.find(a => a.agent_name === 'consensus');
    
    const summary = {
      totalMatches,
      settledMatches,
      pendingMatches,
      consensusAccuracy: consensusStats?.overall_accuracy || 0,
      matchResultAccuracy: consensusStats?.mr_accuracy || 0,
      overUnderAccuracy: consensusStats?.ou_accuracy || 0,
      bttsAccuracy: consensusStats?.btts_accuracy || 0
    };

    const processingTime = Date.now() - startTime;
    console.log(`📊 Stats-v2 completed in ${processingTime}ms`);

    const response = NextResponse.json({
      success: true,
      agentStats,
      leagueStats,
      summary,
      processingTime,
      timestamp: new Date().toISOString()
    });

    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    return response;

  } catch (error: any) {
    console.error('❌ Stats-v2 API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
