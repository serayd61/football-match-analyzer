// ============================================================================
// ADMIN: Debug migration - test a single record
// GET /api/admin/migrate-debug
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase credentials not configured');
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

export async function GET(request: NextRequest) {
  const steps: any[] = [];
  
  try {
    const supabase = getSupabase();
    
    // Get one record from analysis_performance
    const { data: oldRecords, error: fetchError } = await supabase
      .from('analysis_performance')
      .select('*')
      .limit(1);
    
    if (fetchError) {
      steps.push({ step: 'fetch', error: fetchError });
      return NextResponse.json({ steps });
    }
    
    if (!oldRecords || oldRecords.length === 0) {
      steps.push({ step: 'fetch', result: 'No records found' });
      return NextResponse.json({ steps });
    }
    
    const record = oldRecords[0];
    steps.push({ step: 'fetch', record: {
      fixture_id: record.fixture_id,
      home_team: record.home_team,
      away_team: record.away_team,
      match_date: record.match_date,
      consensus_match_result: record.consensus_match_result
    }});
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('unified_analysis')
      .select('fixture_id')
      .eq('fixture_id', record.fixture_id)
      .maybeSingle();
    
    if (existing) {
      steps.push({ step: 'check_existing', result: 'Already exists - skipping' });
      return NextResponse.json({ steps });
    }
    
    // Normalize match_date
    let matchDate = record.match_date;
    if (matchDate && matchDate.includes('T')) {
      matchDate = matchDate.split('T')[0];
    }
    steps.push({ step: 'normalize_date', original: record.match_date, normalized: matchDate });
    
    // Normalize predictions
    const normalizeMatchResult = (v: string | null): string => {
      if (!v) return 'X';
      const lower = v.toLowerCase();
      if (lower === '1' || lower === 'home' || lower === 'h') return '1';
      if (lower === '2' || lower === 'away' || lower === 'a') return '2';
      return 'X';
    };
    
    const normalizeOverUnder = (v: string | null): string => {
      if (!v) return 'Under';
      if (v.toLowerCase().includes('over')) return 'Over';
      return 'Under';
    };
    
    const normalizeBtts = (v: string | null): string => {
      if (!v) return 'No';
      const lower = v.toLowerCase();
      if (lower === 'yes' || lower === 'y' || lower === 'true') return 'Yes';
      return 'No';
    };
    
    const mrPred = normalizeMatchResult(record.consensus_match_result);
    const ouPred = normalizeOverUnder(record.consensus_over_under);
    const bttsPred = normalizeBtts(record.consensus_btts);
    
    steps.push({ step: 'normalize_predictions', original: {
      mr: record.consensus_match_result,
      ou: record.consensus_over_under,
      btts: record.consensus_btts
    }, normalized: { mr: mrPred, ou: ouPred, btts: bttsPred }});
    
    // Build record
    const unifiedRecord = {
      fixture_id: record.fixture_id,
      home_team: record.home_team,
      away_team: record.away_team,
      league: record.league || 'Unknown',
      match_date: matchDate,
      analysis: {},
      match_result_prediction: mrPred,
      match_result_confidence: 65,
      over_under_prediction: ouPred,
      over_under_confidence: 65,
      btts_prediction: bttsPred,
      btts_confidence: 65,
      best_bet_market: 'Match Result',
      best_bet_selection: mrPred,
      best_bet_confidence: 60,
      overall_confidence: record.consensus_confidence || 60,
      agreement: 75,
      risk_level: 'medium',
      data_quality: 'good',
      processing_time: 1000,
      systems_used: ['migration'],
      is_settled: false,
      created_at: record.created_at,
      updated_at: new Date().toISOString(),
    };
    
    steps.push({ step: 'build_record', record: unifiedRecord });
    
    // Try insert
    const { data: insertData, error: insertError } = await supabase
      .from('unified_analysis')
      .insert(unifiedRecord)
      .select();
    
    if (insertError) {
      steps.push({ step: 'insert', error: insertError });
    } else {
      steps.push({ step: 'insert', success: true, data: insertData });
    }
    
    return NextResponse.json({ success: !insertError, steps });
    
  } catch (error: any) {
    steps.push({ step: 'exception', error: error.message });
    return NextResponse.json({ success: false, steps }, { status: 500 });
  }
}

