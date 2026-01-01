// ============================================================================
// API: Get Analyses from unified_analysis Table
// GET /api/performance/get-analyses
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Create fresh client each time to avoid stale data
function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/performance/get-analyses called');
    
    const { searchParams } = new URL(request.url);
    
    const settled = searchParams.get('settled');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const league = searchParams.get('league');
    
    console.log(`   Params: settled=${settled}, limit=${limit}, offset=${offset}, league=${league}`);
    
    const supabase = getSupabase();
    
    // Query unified_analysis table
    let query = supabase
      .from('unified_analysis')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Filter by settled status
    if (settled !== null) {
      query = query.eq('is_settled', settled === 'true');
    }
    
    // Filter by league
    if (league) {
      query = query.eq('league', league);
    }
    
    // Pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data, count, error } = await query;
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    console.log(`   Result: ${data?.length || 0} records (total: ${count})`);
    
    // Transform data to match the expected format for the performance page
    const transformedData = (data || []).map(row => ({
      id: row.id,
      fixture_id: row.fixture_id,
      home_team: row.home_team,
      away_team: row.away_team,
      league: row.league,
      match_date: row.match_date,
      match_settled: row.is_settled,
      
      // Consensus predictions
      consensus_match_result: row.match_result_prediction,
      consensus_over_under: row.over_under_prediction,
      consensus_btts: row.btts_prediction,
      consensus_confidence: row.overall_confidence,
      
      // Actual results
      actual_home_score: row.actual_home_score,
      actual_away_score: row.actual_away_score,
      actual_match_result: row.actual_match_result,
      actual_over_under: row.actual_total_goals !== null 
        ? (row.actual_total_goals > 2.5 ? 'Over' : 'Under') 
        : null,
      actual_btts: row.actual_btts !== null 
        ? (row.actual_btts ? 'Yes' : 'No') 
        : null,
      
      // Correctness
      consensus_mr_correct: row.match_result_correct,
      consensus_ou_correct: row.over_under_correct,
      consensus_btts_correct: row.btts_correct,
      
      // Metadata
      created_at: row.created_at,
      settled_at: row.settled_at,
    }));
    
    return NextResponse.json({
      success: true,
      data: transformedData,
      count: count || 0,
      limit,
      offset
    });
    
  } catch (error: any) {
    console.error('❌ Get analyses API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
