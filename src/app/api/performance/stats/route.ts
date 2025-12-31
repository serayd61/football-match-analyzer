// ============================================================================
// API: Get Performance Statistics
// GET /api/performance/stats
// ============================================================================

import { NextResponse } from 'next/server';
import { getAccuracyStats } from '@/lib/performance';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await getAccuracyStats();
    
    if (result.error) {
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

