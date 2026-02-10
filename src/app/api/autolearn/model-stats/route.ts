// ============================================================================
// GET /api/autolearn/model-stats
// Model istatistikleri: kac pattern ogrendi, accuracy vs baseline
// ============================================================================

import { NextResponse } from 'next/server';
import { getModelStats } from '@/lib/autolearn/model';

export async function GET() {
  try {
    const stats = await getModelStats();

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('❌ AutoLearn Model Stats Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get model stats'
    }, { status: 500 });
  }
}
