// ============================================================================
// API: Optimized Performance Stats v2
// GET /api/performance/stats-v2
// - Uses unified_analysis as primary data source
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
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
      
      // 3. Summary counts from unified_analysis (ana veri kaynağı)
      supabase.from('unified_analysis')
        .select('fixture_id, is_settled', { count: 'exact', head: false })
    ]);

    // Agent stats - materialized view yoksa fallback
    let agentStats: AgentStats[] = [];
    if (agentStatsResult.error) {
      console.log('⚠️ Materialized view not found, using fallback query from unified_analysis');
      // Fallback: unified_analysis'dan direkt hesapla
      const { data: fallbackData } = await supabase
        .from('unified_analysis')
        .select(`
          match_result_correct, over_under_correct, btts_correct,
          overall_confidence, is_settled
        `)
        .eq('is_settled', true);

      if (fallbackData && fallbackData.length > 0) {
        const total = fallbackData.length;
        
        // Consensus stats (unified_analysis uses these field names)
        const consensusMR = fallbackData.filter((r: any) => r.match_result_correct === true).length;
        const consensusOU = fallbackData.filter((r: any) => r.over_under_correct === true).length;
        const consensusBTTS = fallbackData.filter((r: any) => r.btts_correct === true).length;
        const avgConf = fallbackData.reduce((sum: number, r: any) => sum + (r.overall_confidence || 0), 0) / total;
        
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
      }
    } else {
      agentStats = (agentStatsResult.data || []) as AgentStats[];
    }

    // League stats - materialized view yoksa fallback
    let leagueStats: LeagueStats[] = [];
    if (leagueStatsResult.error) {
      console.log('⚠️ League materialized view not found, using fallback from unified_analysis');
      const { data: leagueFallback } = await supabase
        .from('unified_analysis')
        .select('league, match_result_correct, over_under_correct, btts_correct, overall_confidence')
        .eq('is_settled', true)
        .not('league', 'is', null);

      if (leagueFallback && leagueFallback.length > 0) {
        const leagueMap = new Map<string, any>();
        
        for (const row of leagueFallback) {
          if (!(row as any).league) continue;
          
          if (!leagueMap.has((row as any).league)) {
            leagueMap.set((row as any).league, {
              league: (row as any).league,
              total: 0,
              mr: 0,
              ou: 0,
              btts: 0,
              confSum: 0
            });
          }
          
          const stats = leagueMap.get((row as any).league);
          stats.total++;
          if ((row as any).match_result_correct) stats.mr++;
          if ((row as any).over_under_correct) stats.ou++;
          if ((row as any).btts_correct) stats.btts++;
          stats.confSum += (row as any).overall_confidence || 0;
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

    // Summary hesapla (unified_analysis'dan)
    const summaryData = summaryResult.data || [];
    const totalMatches = summaryData.length;
    const settledMatches = summaryData.filter((r: any) => r.is_settled === true).length;
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
    console.log(`📊 Stats-v2 completed in ${processingTime}ms - Total: ${totalMatches}, Settled: ${settledMatches}`);

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
