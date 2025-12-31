// ============================================================================
// API: Get Performance Statistics
// GET /api/performance/stats
// ============================================================================

import { NextResponse } from 'next/server';
import { getAccuracyStats } from '@/lib/performance';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('📊 GET /api/performance/stats called');
    
    const result = await getAccuracyStats();
    
    console.log(`   Stats: ${result.stats?.length || 0} agents, summary: ${result.summary ? 'yes' : 'no'}, error: ${result.error || 'none'}`);
    
    if (result.error) {
      console.error('❌ getAccuracyStats error:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      stats: result.stats,
      summary: result.summary
    });
    
  } catch (error: any) {
    console.error('❌ Stats API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

