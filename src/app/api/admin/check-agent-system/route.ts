// ============================================================================
// ADMIN API - AGENT LEARNING SYSTEM STATUS CHECK
// Sistemin çalışıp çalışmadığını kontrol etmek için endpoint
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

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    // 1. Agent Predictions Özet
    const { data: predictionsSummary, error: predError } = await (supabase
      .from('agent_predictions') as any)
      .select('*')
      .limit(1);

    if (predError) {
      return NextResponse.json({
        success: false,
        error: 'agent_predictions table not accessible',
        details: predError.message
      }, { status: 500 });
    }

    // Toplam tahmin sayısı
    const { count: totalPredictions } = await (supabase
      .from('agent_predictions') as any)
      .select('*', { count: 'exact', head: true });

    // Settle edilmiş tahminler
    const { count: settledCount } = await (supabase
      .from('agent_predictions') as any)
      .select('*', { count: 'exact', head: true })
      .not('settled_at', 'is', null);

    // Bekleyen tahminler
    const { count: pendingCount } = await (supabase
      .from('agent_predictions') as any)
      .select('*', { count: 'exact', head: true })
      .is('settled_at', null);

    // Son 24 saatte settle edilenler
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const { count: settledLast24h } = await (supabase
      .from('agent_predictions') as any)
      .select('*', { count: 'exact', head: true })
      .gte('settled_at', yesterday.toISOString());

    // Tüm settle edilmiş tahminler (all-time stats)
    const { data: allSettled, error: allSettledError } = await (supabase
      .from('agent_predictions') as any)
      .select('agent_name, match_result_correct, over_under_correct, btts_correct')
      .not('settled_at', 'is', null);
    
    // Son 7 günde settle edilenler (recent stats)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentSettled, error: recentError } = await (supabase
      .from('agent_predictions') as any)
      .select('agent_name, match_result_correct, over_under_correct, btts_correct')
      .gte('settled_at', sevenDaysAgo.toISOString())
      .not('settled_at', 'is', null);

    // Agent bazında istatistikler (TÜM ZAMANLAR)
    const agentStats: Record<string, any> = {};
    if (allSettled) {
      allSettled.forEach((pred: any) => {
        if (!agentStats[pred.agent_name]) {
          agentStats[pred.agent_name] = {
            total: 0,
            mr_correct: 0,
            ou_correct: 0,
            btts_correct: 0,
            mr_total: 0,
            ou_total: 0,
            btts_total: 0
          };
        }
        agentStats[pred.agent_name].total++;
        if (pred.match_result_correct !== null) {
          agentStats[pred.agent_name].mr_total++;
          if (pred.match_result_correct) agentStats[pred.agent_name].mr_correct++;
        }
        if (pred.over_under_correct !== null) {
          agentStats[pred.agent_name].ou_total++;
          if (pred.over_under_correct) agentStats[pred.agent_name].ou_correct++;
        }
        if (pred.btts_correct !== null) {
          agentStats[pred.agent_name].btts_total++;
          if (pred.btts_correct) agentStats[pred.agent_name].btts_correct++;
        }
      });
    }
    
    // Son 7 gün istatistikleri (ayrı)
    const recentAgentStats: Record<string, any> = {};
    if (recentSettled) {
      recentSettled.forEach((pred: any) => {
        if (!recentAgentStats[pred.agent_name]) {
          recentAgentStats[pred.agent_name] = {
            total: 0,
            mr_correct: 0,
            ou_correct: 0,
            btts_correct: 0,
            mr_total: 0,
            ou_total: 0,
            btts_total: 0
          };
        }
        recentAgentStats[pred.agent_name].total++;
        if (pred.match_result_correct !== null) {
          recentAgentStats[pred.agent_name].mr_total++;
          if (pred.match_result_correct) recentAgentStats[pred.agent_name].mr_correct++;
        }
        if (pred.over_under_correct !== null) {
          recentAgentStats[pred.agent_name].ou_total++;
          if (pred.over_under_correct) recentAgentStats[pred.agent_name].ou_correct++;
        }
        if (pred.btts_correct !== null) {
          recentAgentStats[pred.agent_name].btts_total++;
          if (pred.btts_correct) recentAgentStats[pred.agent_name].btts_correct++;
        }
      });
    }

    // Agent Performance
    const { data: agentPerformance, error: perfError } = await (supabase
      .from('agent_performance') as any)
      .select('*')
      .order('current_weight', { ascending: false });

    // Bekleyen tahminler (dünden bugüne)
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const { data: pendingRecent, error: pendingError } = await (supabase
      .from('agent_predictions') as any)
      .select('fixture_id, agent_name, match_date, created_at')
      .is('settled_at', null)
      .gte('match_date', yesterdayStr)
      .lte('match_date', today)
      .order('match_date', { ascending: false })
      .limit(50);

    // Unified Analysis karşılaştırma
    const { count: unifiedSettled } = await supabase
      .from('unified_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('is_settled', true);

    const { count: unifiedPending } = await supabase
      .from('unified_analysis')
      .select('*', { count: 'exact', head: true })
      .eq('is_settled', false)
      .gte('match_date', sevenDaysAgo.toISOString().split('T')[0]);

    // Agent Weights (RPC function)
    const { data: agentWeights, error: weightsError } = await (supabase.rpc as any)('get_agent_weights', {
      p_league: null
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_predictions: totalPredictions || 0,
        settled_count: settledCount || 0,
        pending_count: pendingCount || 0,
        settled_last_24h: settledLast24h || 0,
        settlement_rate: totalPredictions 
          ? ((settledCount || 0) / totalPredictions * 100).toFixed(2) + '%'
          : '0%'
      },
      // TÜM ZAMANLAR - Agent istatistikleri
      agent_stats: Object.entries(agentStats).map(([agent, stats]: [string, any]) => ({
        agent_name: agent,
        total: stats.total,
        match_result: {
          correct: stats.mr_correct,
          total: stats.mr_total,
          accuracy: stats.mr_total 
            ? ((stats.mr_correct / stats.mr_total) * 100).toFixed(2) + '%'
            : 'N/A'
        },
        over_under: {
          correct: stats.ou_correct,
          total: stats.ou_total,
          accuracy: stats.ou_total
            ? ((stats.ou_correct / stats.ou_total) * 100).toFixed(2) + '%'
            : 'N/A'
        },
        btts: {
          correct: stats.btts_correct,
          total: stats.btts_total,
          accuracy: stats.btts_total
            ? ((stats.btts_correct / stats.btts_total) * 100).toFixed(2) + '%'
            : 'N/A'
        }
      })),
      // SON 7 GÜN - Agent istatistikleri
      agent_stats_recent: Object.entries(recentAgentStats).map(([agent, stats]: [string, any]) => ({
        agent_name: agent,
        total: stats.total,
        match_result: {
          correct: stats.mr_correct,
          total: stats.mr_total,
          accuracy: stats.mr_total 
            ? ((stats.mr_correct / stats.mr_total) * 100).toFixed(2) + '%'
            : 'N/A'
        },
        over_under: {
          correct: stats.ou_correct,
          total: stats.ou_total,
          accuracy: stats.ou_total
            ? ((stats.ou_correct / stats.ou_total) * 100).toFixed(2) + '%'
            : 'N/A'
        },
        btts: {
          correct: stats.btts_correct,
          total: stats.btts_total,
          accuracy: stats.btts_total
            ? ((stats.btts_correct / stats.btts_total) * 100).toFixed(2) + '%'
            : 'N/A'
        }
      })),
      agent_performance: agentPerformance || [],
      agent_weights: agentWeights || [],
      pending_recent: pendingRecent || [],
      comparison: {
        unified_settled: unifiedSettled || 0,
        unified_pending: unifiedPending || 0,
        agent_settled: settledCount || 0,
        agent_pending: pendingCount || 0
      },
      system_status: {
        tables_accessible: !predError && !perfError,
        has_predictions: (totalPredictions || 0) > 0,
        has_settled: (settledCount || 0) > 0,
        has_pending: (pendingCount || 0) > 0,
        system_active: (settledLast24h || 0) > 0 || (pendingCount || 0) > 0
      }
    });

  } catch (error: any) {
    console.error('❌ Error checking agent system:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
