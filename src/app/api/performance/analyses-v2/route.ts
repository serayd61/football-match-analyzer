// ============================================================================
// API: Optimized Analyses v2 with Server-Side Filtering & Pagination
// GET /api/performance/analyses-v2
// - Server-side filtering (DB level)
// - Cursor-based pagination
// - Lightweight payload (no full JSONB)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AnalysisRecord {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  match_settled: boolean;
  // Consensus predictions
  consensus_match_result: string;
  consensus_over_under: string;
  consensus_btts: string;
  consensus_confidence: number;
  // Actual results
  actual_home_score: number | null;
  actual_away_score: number | null;
  actual_match_result: string | null;
  actual_over_under: string | null;
  actual_btts: string | null;
  // Correctness
  consensus_mr_correct: boolean | null;
  consensus_ou_correct: boolean | null;
  consensus_btts_correct: boolean | null;
}

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

    console.log('📋 GET /api/performance/analyses-v2', { page, pageSize, settled, league });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query with server-side filtering
    let query = supabase
      .from('analysis_performance')
      .select(`
        id, fixture_id, home_team, away_team, league, match_date, match_settled,
        consensus_match_result, consensus_over_under, consensus_btts, consensus_confidence,
        actual_home_score, actual_away_score, actual_match_result, actual_over_under, actual_btts,
        consensus_mr_correct, consensus_ou_correct, consensus_btts_correct
      `, { count: 'exact' });

    // Apply server-side filters
    if (settled === 'true') {
      query = query.eq('match_settled', true);
    } else if (settled === 'false') {
      query = query.or('match_settled.eq.false,match_settled.is.null');
    }

    if (league && league !== 'all') {
      query = query.eq('league', league);
    }

    // Order and paginate
    query = query
      .order('match_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Client-side filtering for complex criteria (MS/OU/BTTS selection + confidence)
    let filteredData = data || [];

    if (msSelection && msSelection !== 'all') {
      filteredData = filteredData.filter(row => {
        const mr = normalizeMR(row.consensus_match_result);
        if (msSelection === 'home') return mr === '1';
        if (msSelection === 'away') return mr === '2';
        if (msSelection === 'draw') return mr === 'X' || mr === 'x';
        return true;
      });
    }

    if (msMinConf > 0) {
      filteredData = filteredData.filter(row => {
        const conf = row.consensus_confidence || 0;
        return Math.round(conf) === msMinConf;
      });
    }

    if (ouSelection && ouSelection !== 'all') {
      filteredData = filteredData.filter(row => {
        const ou = normalizeOU(row.consensus_over_under);
        if (ouSelection === 'over') return ou === 'over';
        if (ouSelection === 'under') return ou === 'under';
        return true;
      });
    }

    if (ouMinConf > 0) {
      filteredData = filteredData.filter(row => {
        const conf = row.consensus_confidence || 0;
        return Math.round(conf) === ouMinConf;
      });
    }

    if (bttsSelection && bttsSelection !== 'all') {
      filteredData = filteredData.filter(row => {
        const btts = normalizeBTTS(row.consensus_btts);
        if (bttsSelection === 'yes') return btts === 'yes';
        if (bttsSelection === 'no') return btts === 'no';
        return true;
      });
    }

    if (bttsMinConf > 0) {
      filteredData = filteredData.filter(row => {
        const conf = row.consensus_confidence || 0;
        return Math.round(conf) === bttsMinConf;
      });
    }

    // Transform data
    const analyses: AnalysisRecord[] = filteredData.map(row => ({
      id: row.id,
      fixture_id: row.fixture_id,
      home_team: row.home_team,
      away_team: row.away_team,
      league: row.league || '',
      match_date: row.match_date,
      match_settled: row.match_settled || false,
      consensus_match_result: row.consensus_match_result || '',
      consensus_over_under: row.consensus_over_under || '',
      consensus_btts: row.consensus_btts || '',
      consensus_confidence: row.consensus_confidence || 0,
      actual_home_score: row.actual_home_score,
      actual_away_score: row.actual_away_score,
      actual_match_result: row.actual_match_result,
      actual_over_under: row.actual_over_under,
      actual_btts: row.actual_btts,
      consensus_mr_correct: row.consensus_mr_correct,
      consensus_ou_correct: row.consensus_ou_correct,
      consensus_btts_correct: row.consensus_btts_correct
    }));

    const totalPages = count ? Math.ceil(count / pageSize) : 1;
    const processingTime = Date.now() - startTime;

    console.log(`📋 Analyses-v2 returned ${analyses.length} records in ${processingTime}ms`);

    const response = NextResponse.json({
      success: true,
      data: analyses,
      pagination: {
        page,
        pageSize,
        totalRecords: count || 0,
        totalPages,
        hasMore: page < totalPages
      },
      processingTime,
      timestamp: new Date().toISOString()
    });

    // Cache for 30 seconds, stale-while-revalidate for 5 minutes
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    return response;

  } catch (error: any) {
    console.error('❌ Analyses-v2 API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
