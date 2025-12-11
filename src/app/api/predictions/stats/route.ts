export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getPerformanceStats, getLeaguePerformance, getPendingPredictions } from '@/lib/predictions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let data: any = {};

    if (type === 'all' || type === 'performance') {
      data.performance = await getPerformanceStats();
    }

    if (type === 'all' || type === 'leagues') {
      data.leagues = await getLeaguePerformance();
    }

    if (type === 'all' || type === 'pending') {
      data.pending = await getPendingPredictions();
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ Stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
