// ============================================================================
// API: Get Performance Stats from unified_analysis Table
// GET /api/performance/stats
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/performance/stats called at', new Date().toISOString());
    
    // Create fresh client inline
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all data
    const { data: allData, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }
    
    // Calculate counts from data using JavaScript filter
    const totalCount = allData?.length || 0;
    const settledMatches = (allData || []).filter(r => r.is_settled === true);
    const pendingCount = (allData || []).filter(r => r.is_settled === false || r.is_settled === null).length;
    const settledCount = settledMatches.length;
    
    console.log(`📊 Total: ${totalCount}, Settled: ${settledCount}, Pending: ${pendingCount}`);
    
    // Calculate consensus accuracy
    let mrCorrect = 0;
    let ouCorrect = 0;
    let bttsCorrect = 0;
    
    for (const match of settledMatches) {
      if (match.match_result_correct === true) mrCorrect++;
      if (match.over_under_correct === true) ouCorrect++;
      if (match.btts_correct === true) bttsCorrect++;
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
    
    return NextResponse.json({
      success: true,
      stats,
      summary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Stats API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
