// ============================================================================
// ADMIN API: Cleanup Incomplete Analyses
// deepseek_master olmayan veya deepseek_master.finalVerdict olmayan kayıtları temizler
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    console.log('🧹 Starting cleanup of incomplete analyses...');
    
    // Get all analyses
    const { data: allAnalyses, error: queryError } = await supabase
      .from('match_full_analysis')
      .select('fixture_id, home_team, away_team, deepseek_master, ai_consensus, quad_brain, ai_agents');

    if (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!allAnalyses || allAnalyses.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No analyses found',
        total: 0,
        incomplete: 0,
        deleted: 0
      });
    }

    // Find incomplete analyses (no deepseek_master or no finalVerdict)
    const incompleteAnalyses = allAnalyses.filter((a: any) => {
      // Has no deepseek_master
      if (!a.deepseek_master) return true;
      
      // deepseek_master is not an object
      if (typeof a.deepseek_master !== 'object') return true;
      
      // Has no finalVerdict
      if (!a.deepseek_master.finalVerdict) return true;
      
      // finalVerdict is not an object
      if (typeof a.deepseek_master.finalVerdict !== 'object') return true;
      
      return false;
    });

    console.log(`📊 Found ${incompleteAnalyses.length} incomplete analyses out of ${allAnalyses.length} total`);

    if (incompleteAnalyses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All analyses are complete',
        total: allAnalyses.length,
        incomplete: 0,
        deleted: 0
      });
    }

    // Log incomplete analyses
    console.log('⚠️ Incomplete analyses:');
    incompleteAnalyses.forEach((a: any) => {
      console.log(`   - ${a.fixture_id}: ${a.home_team} vs ${a.away_team} (deepseek_master: ${a.deepseek_master ? 'exists' : 'missing'})`);
    });

    // Delete incomplete analyses from match_full_analysis
    const incompleteIds = incompleteAnalyses.map((a: any) => a.fixture_id);
    
    const { error: deleteError } = await supabase
      .from('match_full_analysis')
      .delete()
      .in('fixture_id', incompleteIds);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Also delete related prediction sessions (if any)
    const { error: sessionDeleteError } = await supabase
      .from('prediction_sessions')
      .delete()
      .in('fixture_id', incompleteIds)
      .eq('prediction_source', 'auto_analysis');

    if (sessionDeleteError) {
      console.log('⚠️ Could not delete related sessions:', sessionDeleteError.message);
    }

    // Also delete deepseek_master prediction sessions
    const { error: masterSessionDeleteError } = await supabase
      .from('prediction_sessions')
      .delete()
      .in('fixture_id', incompleteIds)
      .eq('prediction_source', 'deepseek_master');

    if (masterSessionDeleteError) {
      console.log('⚠️ Could not delete master sessions:', masterSessionDeleteError.message);
    }

    console.log(`✅ Deleted ${incompleteIds.length} incomplete analyses`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${incompleteIds.length} incomplete analyses. Run auto-analyze-matches to re-analyze.`,
      total: allAnalyses.length,
      incomplete: incompleteIds.length,
      deleted: incompleteIds.length,
      deletedFixtures: incompleteAnalyses.map((a: any) => ({
        fixture_id: a.fixture_id,
        match: `${a.home_team} vs ${a.away_team}`,
        reason: !a.deepseek_master ? 'missing deepseek_master' : 'missing finalVerdict'
      }))
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

