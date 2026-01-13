// ============================================================================
// ADMIN API - CONSENSUS ALIGNMENT KONTROL
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

export async function GET(request: NextRequest) {
  try {
    // Auth check (basit secret kontrolü)
    const authHeader = request.headers.get('authorization');
    const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
    
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabase();

    // 1. Genel durum
    const { data: generalStats, error: generalError } = await supabase
      .from('agent_predictions')
      .select('consensus_alignment');

    if (generalError) throw generalError;

    const total = generalStats?.length || 0;
    const withAlignment = generalStats?.filter(p => p.consensus_alignment !== null).length || 0;
    const withoutAlignment = total - withAlignment;
    const coveragePct = total > 0 ? Math.round((withAlignment / total) * 100 * 100) / 100 : 0;

    // 2. Agent bazında alignment
    const { data: agentStats, error: agentError } = await supabase
      .from('agent_predictions')
      .select('agent_name, consensus_alignment');

    if (agentError) throw agentError;

    const agentAlignmentMap = new Map<string, { total: number; withAlignment: number; scores: number[] }>();
    
    agentStats?.forEach(p => {
      const agent = p.agent_name;
      if (!agentAlignmentMap.has(agent)) {
        agentAlignmentMap.set(agent, { total: 0, withAlignment: 0, scores: [] });
      }
      const stats = agentAlignmentMap.get(agent)!;
      stats.total++;
      if (p.consensus_alignment !== null) {
        stats.withAlignment++;
        stats.scores.push(p.consensus_alignment);
      }
    });

    const agentBreakdown = Array.from(agentAlignmentMap.entries()).map(([agent, stats]) => ({
      agent_name: agent,
      total_predictions: stats.total,
      with_alignment: stats.withAlignment,
      without_alignment: stats.total - stats.withAlignment,
      avg_alignment_score: stats.scores.length > 0
        ? Math.round((stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) * 100) / 100
        : null
    })).sort((a, b) => (b.avg_alignment_score || 0) - (a.avg_alignment_score || 0));

    // 3. Son 7 günde settled olan ama alignment'ı null olan
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: missingAlignment, error: missingError } = await supabase
      .from('agent_predictions')
      .select('fixture_id, agent_name, settled_at')
      .not('settled_at', 'is', null)
      .is('consensus_alignment', null)
      .gte('settled_at', sevenDaysAgo.toISOString())
      .limit(20);

    if (missingError) throw missingError;

    // 4. Alignment skorları dağılımı
    const alignmentScores = agentStats?.filter(p => p.consensus_alignment !== null)
      .map(p => p.consensus_alignment as number) || [];

    const distribution = {
      veryHigh: alignmentScores.filter(s => s >= 80).length,
      high: alignmentScores.filter(s => s >= 60 && s < 80).length,
      medium: alignmentScores.filter(s => s >= 40 && s < 60).length,
      low: alignmentScores.filter(s => s >= 20 && s < 40).length,
      veryLow: alignmentScores.filter(s => s < 20).length
    };

    // 5. Agent performance tablosundan alignment skorları
    const { data: performanceData, error: perfError } = await supabase
      .from('agent_performance')
      .select('agent_name, league, total_matches, consensus_alignment_score')
      .order('consensus_alignment_score', { ascending: false, nullsFirst: false })
      .limit(20);

    if (perfError) throw perfError;

    // 6. Son hesaplanan alignment'lar
    const { data: recentAlignments, error: recentError } = await supabase
      .from('agent_predictions')
      .select('fixture_id, agent_name, consensus_alignment, settled_at')
      .not('consensus_alignment', 'is', null)
      .order('settled_at', { ascending: false, nullsFirst: false })
      .limit(10);

    if (recentError) throw recentError;

    return NextResponse.json({
      success: true,
      stats: {
        general: {
          total_predictions: total,
          with_alignment: withAlignment,
          without_alignment: withoutAlignment,
          coverage_percentage: coveragePct
        },
        agent_breakdown: agentBreakdown,
        missing_alignment_count: missingAlignment?.length || 0,
        missing_alignment_samples: missingAlignment?.slice(0, 10) || [],
        distribution,
        top_performers: performanceData || [],
        recent_alignments: recentAlignments || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Check consensus alignment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
