// ============================================================================
// API: Get Analyses from unified_analysis Table
// GET /api/performance/get-analyses
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    console.log('📊 GET /api/performance/get-analyses called at', timestamp);
    
    const { searchParams } = new URL(request.url);
    
    const settledParam = searchParams.get('settled');
    const limit = parseInt(searchParams.get('limit') || '1000', 10); // Default 1000, tüm maçları getir
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const league = searchParams.get('league');
    
    console.log(`   Params: settled=${settledParam}, limit=${limit}, offset=${offset}, league=${league}`);
    
    // Create fresh client inline
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all data with ORDER BY
    const { data: allData, error } = await supabase
      .from('unified_analysis')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Filter in JavaScript (more reliable than Supabase .eq())
    let filteredData = allData || [];
    
    // Filter by settled status
    if (settledParam !== null) {
      const wantSettled = settledParam === 'true';
      filteredData = filteredData.filter(r => r.is_settled === wantSettled);
    }
    
    // Filter by league
    if (league) {
      filteredData = filteredData.filter(r => r.league === league);
    }
    
    const totalCount = filteredData.length;
    
    // Apply pagination
    const paginatedData = filteredData.slice(offset, offset + limit);
    
    console.log(`   Result: ${paginatedData.length} records (total filtered: ${totalCount})`);
    
    // Transform data to match the expected format for the performance page
    const transformedData = paginatedData.map(row => ({
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
      
      // Best Bet (En İyi Bahis)
      best_bet_market: row.best_bet_market,
      best_bet_selection: row.best_bet_selection,
      best_bet_confidence: row.best_bet_confidence,
      
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
    
    // Set cache control headers to prevent caching
    const response = NextResponse.json({
      success: true,
      data: transformedData,
      count: totalCount,
      limit,
      offset,
      timestamp
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    
    return response;
    
  } catch (error: any) {
    console.error('❌ Get analyses API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
