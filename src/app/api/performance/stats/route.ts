// ============================================================================
// API: Get Performance Stats from unified_analysis Table
// GET /api/performance/stats
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    console.log('📊 GET /api/performance/stats called at', timestamp);

    // Create fresh client inline
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('unified_analysis')
      .select('fixture_id, home_team, is_settled, match_result_correct, over_under_correct, btts_correct')
      .order('match_date', { ascending: false });

    if (error) {
      console.error('❌ Fetch error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Filter in JavaScript (more reliable than Supabase .eq())
    const allData = data || [];
    const settled = allData.filter(r => r.is_settled === true);
    const pending = allData.filter(r => r.is_settled === false || r.is_settled === null);

    const totalCount = allData.length;
    const settledCount = settled.length;
    const pendingCount = pending.length;

    console.log(`📊 Total: ${totalCount}, Settled: ${settledCount}, Pending: ${pendingCount}`);

    // Count correct predictions
    let mrCorrect = 0;
    let ouCorrect = 0;
    let bttsCorrect = 0;

    for (const m of settled) {
      if (m.match_result_correct === true) mrCorrect++;
      if (m.over_under_correct === true) ouCorrect++;
      if (m.btts_correct === true) bttsCorrect++;
    }

    console.log(`📈 Correct: MR=${mrCorrect}, OU=${ouCorrect}, BTTS=${bttsCorrect}`);

    // Calculate percentages
    const mrAccuracy = settledCount > 0 ? Math.round((mrCorrect / settledCount) * 100) : 0;
    const ouAccuracy = settledCount > 0 ? Math.round((ouCorrect / settledCount) * 100) : 0;
    const bttsAccuracy = settledCount > 0 ? Math.round((bttsCorrect / settledCount) * 100) : 0;

    // Overall accuracy is average of all three
    const totalCorrect = mrCorrect + ouCorrect + bttsCorrect;
    const totalPredictions = settledCount * 3;
    const consensusAccuracy = totalPredictions > 0 ? Math.round((totalCorrect / totalPredictions) * 100) : 0;

    // Stats array
    const stats = settledCount > 0 ? [{
      agent: 'KONSENSÜS',
      totalMatches: settledCount,
      matchResultCorrect: mrCorrect,
      matchResultAccuracy: mrAccuracy,
      overUnderCorrect: ouCorrect,
      overUnderAccuracy: ouAccuracy,
      bttsCorrect: bttsCorrect,
      bttsAccuracy: bttsAccuracy,
      overallAccuracy: consensusAccuracy
    }] : [];

    // Summary
    const summary = {
      totalMatches: totalCount,
      settledMatches: settledCount,
      pendingMatches: pendingCount,
      consensusAccuracy,
      matchResultAccuracy: mrAccuracy,
      overUnderAccuracy: ouAccuracy,
      bttsAccuracy: bttsAccuracy
    };

    console.log(`   Summary: MR=${mrAccuracy}%, OU=${ouAccuracy}%, BTTS=${bttsAccuracy}%`);

    // Set cache control headers to prevent caching
    const response = NextResponse.json({
      success: true,
      stats,
      summary,
      timestamp
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');

    return response;

  } catch (error: any) {
    console.error('❌ Stats API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
