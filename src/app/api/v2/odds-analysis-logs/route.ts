// ============================================================================
// ODDS ANALYSIS LOGS API
// Odds analiz kayıtlarını getirir
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOddsAnalysisLogs } from '@/lib/odds-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filters = {
      league: searchParams.get('league') || undefined,
      valueRating: searchParams.get('valueRating') || undefined,
      minValueAmount: searchParams.get('minValueAmount') ? parseInt(searchParams.get('minValueAmount')!) : undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    };
    
    const logs = await getOddsAnalysisLogs(filters);
    
    return NextResponse.json({
      success: true,
      logs,
      count: logs.length
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching odds analysis logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

