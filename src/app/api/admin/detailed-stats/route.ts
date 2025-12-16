// ============================================================================
// ADMIN - DETAILED MODEL STATISTICS API
// Günlük/Haftalık/Aylık breakdown ve güven eşiği analizi
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDetailedModelStatistics, getWeeklyBreakdown } from '@/lib/admin/service';

const ADMIN_EMAILS = ['serayd61@hotmail.com'];

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get detailed statistics
    const [detailedStats, weeklyBreakdown] = await Promise.all([
      getDetailedModelStatistics(),
      getWeeklyBreakdown(8), // Last 8 weeks
    ]);

    return NextResponse.json({
      success: true,
      data: {
        modelStats: detailedStats.modelStats,
        confidenceAnalysis: detailedStats.confidenceAnalysis,
        periodComparison: detailedStats.periodComparison,
        weeklyBreakdown,
      },
    });
  } catch (error: any) {
    console.error('Error fetching detailed stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

