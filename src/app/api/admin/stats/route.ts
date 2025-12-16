// ============================================================================
// ADMIN API - DASHBOARD STATS ENDPOINT
// ============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDashboardStats, getModelStats } from '@/lib/admin/service';

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as '7d' | '30d' | '90d' | 'all') || '30d';

    // Get dashboard stats
    const stats = await getAdminDashboardStats({ period });
    const modelStats = await getModelStats(period);

    return NextResponse.json({
      success: true,
      stats,
      modelStats,
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

