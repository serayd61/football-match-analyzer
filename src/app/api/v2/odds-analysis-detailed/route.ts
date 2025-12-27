// ============================================================================
// ODDS ANALYSIS DETAILED API
// Tüm analiz edilen maçları detaylı analizleriyle birlikte getirir
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const fixtureId = searchParams.get('fixtureId');
    
    let query = supabase
      .from('odds_analysis_log')
      .select('*')
      .order('analyzed_at', { ascending: false })
      .limit(limit);
    
    if (fixtureId) {
      query = query.eq('fixture_id', parseInt(fixtureId));
    }
    
    const { data: logs, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching detailed odds analysis:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Get agent analysis data for each log
    const detailedLogs = await Promise.all((logs || []).map(async (log) => {
      // Get agent analysis from agent_analysis table
      const { data: agentAnalysis } = await supabase
        .from('agent_analysis')
        .select('agent_results, match_result_prediction, match_result_confidence, match_result_reasoning, top3Predictions, corners')
        .eq('fixture_id', log.fixture_id)
        .single();
      
      return {
        ...log,
        agentAnalysis: agentAnalysis?.agent_results || null,
        matchResult: agentAnalysis ? {
          prediction: agentAnalysis.match_result_prediction,
          confidence: agentAnalysis.match_result_confidence,
          reasoning: agentAnalysis.match_result_reasoning
        } : null,
        top3Predictions: agentAnalysis?.top3Predictions || null,
        corners: agentAnalysis?.corners || null
      };
    }));
    
    return NextResponse.json({
      success: true,
      logs: detailedLogs,
      count: detailedLogs.length
    });
    
  } catch (error: any) {
    console.error('❌ Error in detailed odds analysis:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch detailed analysis' },
      { status: 500 }
    );
  }
}

