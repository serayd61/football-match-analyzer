// ============================================================================
// API: Optimized Analyses v2 with Server-Side Filtering & Pagination
// GET /api/performance/analyses-v2
// - Uses unified_analysis table (main data source)
// - Server-side filtering (DB level)
// - Cursor-based pagination
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Normalize prediction values
function normalizeMR(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === '1' || v === 'home' || v === 'ev sahibi' || v === 'h') return '1';
  if (v === '2' || v === 'away' || v === 'deplasman' || v === 'a') return '2';
  if (v === 'x' || v === 'draw' || v === 'beraberlik' || v === 'tie' || v === 'd') return 'X';
  return v;
}

function normalizeOU(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v.includes('over') || v.includes('üst') || v === 'o' || v === '+2.5') return 'over';
  if (v.includes('under') || v.includes('alt') || v === 'u' || v === '-2.5') return 'under';
  return v;
}

function normalizeBTTS(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === 'yes' || v === 'evet' || v === 'var' || v === 'y' || v === 'true') return 'yes';
  if (v === 'no' || v === 'hayır' || v === 'yok' || v === 'n' || v === 'false') return 'no';
  return v;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100);
    const offset = (page - 1) * pageSize;
    
    // Filter params
    const settled = searchParams.get('settled'); // 'true', 'false', or null (all)
    const league = searchParams.get('league');
    const msSelection = searchParams.get('msSelection');
    const msMinConf = parseInt(searchParams.get('msMinConf') || '0');
    const ouSelection = searchParams.get('ouSelection');
    const ouMinConf = parseInt(searchParams.get('ouMinConf') || '0');
    const bttsSelection = searchParams.get('bttsSelection');
    const bttsMinConf = parseInt(searchParams.get('bttsMinConf') || '0');

    console.log('📋 GET /api/performance/analyses-v2', { 
      page, pageSize, settled, league,
      msSelection, msMinConf, ouSelection, ouMinConf, bttsSelection, bttsMinConf 
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query from unified_analysis table
    let query = supabase
      .from('unified_analysis')
      .select(`
        id, fixture_id, home_team, away_team, league, match_date, is_settled,
        match_result_prediction, match_result_confidence, match_result_correct,
        over_under_prediction, over_under_confidence, over_under_correct,
        btts_prediction, btts_confidence, btts_correct,
        actual_home_score, actual_away_score, overall_confidence
      `, { count: 'exact' });

    // Apply server-side filters
    if (settled === 'true') {
      query = query.eq('is_settled', true);
    } else if (settled === 'false') {
      query = query.or('is_settled.eq.false,is_settled.is.null');
    }

    if (league && league !== 'all') {
      query = query.eq('league', league);
    }

    // Order and paginate - get more records for client-side filtering
    const fetchSize = pageSize * 3; // Fetch more to account for client-side filtering
    query = query
      .order('match_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, fetchSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Client-side filtering for complex criteria
    let filteredData = data || [];

    // MS (Match Result) filtering
    if (msSelection && msSelection !== 'all') {
      filteredData = filteredData.filter((row: any) => {
        const mr = normalizeMR(row.match_result_prediction);
        if (msSelection === 'home') return mr === '1';
        if (msSelection === 'away') return mr === '2';
        if (msSelection === 'draw') return mr === 'X' || mr === 'x';
        return true;
      });
    }

    if (msMinConf > 0) {
      filteredData = filteredData.filter((row: any) => {
        const conf = row.match_result_confidence || 0;
        return Math.round(conf) === msMinConf;
      });
    }

    // OU (Over/Under) filtering
    if (ouSelection && ouSelection !== 'all') {
      filteredData = filteredData.filter((row: any) => {
        const ou = normalizeOU(row.over_under_prediction);
        if (ouSelection === 'over') return ou === 'over';
        if (ouSelection === 'under') return ou === 'under';
        return true;
      });
    }

    if (ouMinConf > 0) {
      filteredData = filteredData.filter((row: any) => {
        const conf = row.over_under_confidence || 0;
        return Math.round(conf) === ouMinConf;
      });
    }

    // BTTS filtering
    if (bttsSelection && bttsSelection !== 'all') {
      filteredData = filteredData.filter((row: any) => {
        const btts = normalizeBTTS(row.btts_prediction);
        if (bttsSelection === 'yes') return btts === 'yes';
        if (bttsSelection === 'no') return btts === 'no';
        return true;
      });
    }

    if (bttsMinConf > 0) {
      filteredData = filteredData.filter((row: any) => {
        const conf = row.btts_confidence || 0;
        return Math.round(conf) === bttsMinConf;
      });
    }

    // Apply pagination after filtering
    const totalFiltered = filteredData.length;
    const paginatedData = filteredData.slice(offset, offset + pageSize);

    // Transform data to expected format
    const analyses = paginatedData.map((row: any) => ({
      id: row.id,
      fixture_id: row.fixture_id,
      home_team: row.home_team || '',
      away_team: row.away_team || '',
      league: row.league || '',
      match_date: row.match_date,
      match_settled: row.is_settled || false,
      // Predictions
      consensus_match_result: row.match_result_prediction || '',
      consensus_over_under: row.over_under_prediction || '',
      consensus_btts: row.btts_prediction || '',
      consensus_confidence: row.overall_confidence || 0,
      // Individual confidences
      mr_confidence: row.match_result_confidence || 0,
      ou_confidence: row.over_under_confidence || 0,
      btts_confidence: row.btts_confidence || 0,
      // Actual results
      actual_home_score: row.actual_home_score,
      actual_away_score: row.actual_away_score,
      actual_match_result: null,
      actual_over_under: null,
      actual_btts: null,
      // Correctness
      consensus_mr_correct: row.match_result_correct,
      consensus_ou_correct: row.over_under_correct,
      consensus_btts_correct: row.btts_correct
    }));

    const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
    const processingTime = Date.now() - startTime;

    console.log(`📋 Analyses-v2 returned ${analyses.length} records (filtered from ${data?.length || 0}) in ${processingTime}ms`);

    const response = NextResponse.json({
      success: true,
      data: analyses,
      pagination: {
        page,
        pageSize,
        totalRecords: totalFiltered,
        totalPages,
        hasMore: page < totalPages
      },
      processingTime,
      timestamp: new Date().toISOString()
    });

    // Cache for 30 seconds
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    return response;

  } catch (error: any) {
    console.error('❌ Analyses-v2 API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
