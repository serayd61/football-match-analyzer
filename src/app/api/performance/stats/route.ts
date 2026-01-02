// ============================================================================
// API: Get Performance Stats from unified_analysis Table
// GET /api/performance/stats
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

interface AccuracyStats {
  agent: string;
  totalMatches: number;
  matchResultCorrect: number;
  matchResultAccuracy: number;
  overUnderCorrect: number;
  overUnderAccuracy: number;
  bttsCorrect: number;
  bttsAccuracy: number;
  overallAccuracy: number;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/performance/stats called');
    
    const supabase = getSupabase();
    
    // Get all data (select * to avoid any column-specific RLS issues)
    const { data: allData, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('*');
    
    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }
    
    // Calculate counts from data
    const totalCount = allData?.length || 0;
    const settledCount = allData?.filter(r => r.is_settled === true).length || 0;
    const pendingCount = allData?.filter(r => r.is_settled === false || r.is_settled === null).length || 0;
    
    // Get settled matches from allData
    const settledMatches = allData?.filter(r => r.is_settled === true) || [];
    
    console.log(`📊 All data: ${allData?.length}, Settled: ${settledMatches.length}`);
    
    // Calculate consensus accuracy
    let consensusAccuracy = 0;
    let mrCorrect = 0;
    let ouCorrect = 0;
    let bttsCorrect = 0;
    
    if (settledMatches.length > 0) {
      const total = settledMatches.length;
      
      for (const match of settledMatches) {
        if (match.match_result_correct === true) mrCorrect++;
        if (match.over_under_correct === true) ouCorrect++;
        if (match.btts_correct === true) bttsCorrect++;
      }
      
      console.log(`📈 Correct counts: MR=${mrCorrect}, OU=${ouCorrect}, BTTS=${bttsCorrect}`);
      
      // Overall accuracy is average of all three
      const totalCorrect = mrCorrect + ouCorrect + bttsCorrect;
      const totalPredictions = total * 3;
      consensusAccuracy = totalPredictions > 0 
        ? Math.round((totalCorrect / totalPredictions) * 100) 
        : 0;
    }
    
    // Create stats array (simplified - just consensus for unified analysis)
    const stats: AccuracyStats[] = [];
    
    if (settledMatches.length > 0) {
      const total = settledMatches.length;
      
      stats.push({
        agent: 'KONSENSÜS',
        totalMatches: total,
        matchResultCorrect: mrCorrect,
        matchResultAccuracy: Math.round((mrCorrect / total) * 100),
        overUnderCorrect: ouCorrect,
        overUnderAccuracy: Math.round((ouCorrect / total) * 100),
        bttsCorrect: bttsCorrect,
        bttsAccuracy: Math.round((bttsCorrect / total) * 100),
        overallAccuracy: consensusAccuracy
      });
    }
    
    // Summary
    const summary = {
      totalMatches: totalCount || 0,
      settledMatches: settledCount || 0,
      pendingMatches: pendingCount || 0,
      consensusAccuracy,
      matchResultAccuracy: settledMatches && settledMatches.length > 0 
        ? Math.round((mrCorrect / settledMatches.length) * 100) 
        : 0,
      overUnderAccuracy: settledMatches && settledMatches.length > 0 
        ? Math.round((ouCorrect / settledMatches.length) * 100) 
        : 0,
      bttsAccuracy: settledMatches && settledMatches.length > 0 
        ? Math.round((bttsCorrect / settledMatches.length) * 100) 
        : 0
    };
    
    console.log(`   Summary: total=${summary.totalMatches}, settled=${summary.settledMatches}, pending=${summary.pendingMatches}`);
    console.log(`   Accuracy: MR=${summary.matchResultAccuracy}%, OU=${summary.overUnderAccuracy}%, BTTS=${summary.bttsAccuracy}%`);
    
    return NextResponse.json({
      success: true,
      stats,
      summary,
      debug: {
        totalFromQuery: allData?.length || 0,
        settledFiltered: settledMatches.length,
        correctCounts: { mrCorrect, ouCorrect, bttsCorrect },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('❌ Stats API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
