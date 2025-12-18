import { NextResponse } from 'next/server';
import { 
  getOverallStats, 
  getModelStats, 
  getRecentPredictions, 
  getDailyStats 
} from '@/lib/admin/enhanced-service';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const days = parseInt(searchParams.get('days') || '7');

    let data: object = {};

    switch (type) {
      case 'overall':
        data = await getOverallStats();
        break;

      case 'models':
        data = { models: await getModelStats() };
        break;

      case 'recent':
        data = { predictions: await getRecentPredictions(limit) };
        break;

      case 'daily':
        data = { daily: await getDailyStats(days) };
        break;

      case 'all':
      default:
        console.log('🔄 Enhanced stats API: Fetching all data...');
        
        const [overall, models, recent, daily] = await Promise.all([
          getOverallStats(),
          getModelStats(),
          getRecentPredictions(limit),
          getDailyStats(days)
        ]);

        console.log('📊 Enhanced stats API results:', {
          overallTotal: (overall as any)?.total_predictions || 0,
          modelsCount: (models as any[])?.length || 0,
          recentCount: (recent as any[])?.length || 0,
          dailyCount: (daily as any[])?.length || 0
        });

        data = {
          overall,
          models,
          recent,
          daily,
          generated_at: new Date().toISOString()
        };
        break;
    }

    return NextResponse.json({
      success: true,
      ...data
    });

  } catch (error) {
    console.error('Enhanced stats API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

