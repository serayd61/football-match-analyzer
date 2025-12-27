// ============================================================================
// ODDS ANALYSIS SETTLEMENT API
// Maç sonuçlarını odds_analysis_log tablosuna kaydeder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { settleOddsAnalysisFromSportmonks, settleAllUnsettledOddsAnalyses } from '@/lib/odds-logger/settlement';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId, settleAll } = body;
    
    if (settleAll) {
      // Settle all unsettled analyses
      const result = await settleAllUnsettledOddsAnalyses();
      return NextResponse.json({
        success: true,
        settled: result.settled,
        errors: result.errors
      });
    }
    
    if (!fixtureId) {
      return NextResponse.json(
        { success: false, error: 'fixtureId is required' },
        { status: 400 }
      );
    }
    
    const success = await settleOddsAnalysisFromSportmonks(fixtureId);
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: `Odds analysis settled for fixture ${fixtureId}`
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to settle odds analysis' },
        { status: 500 }
      );
    }
    
  } catch (error: any) {
    console.error('❌ Error settling odds analysis:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to settle odds analysis' },
      { status: 500 }
    );
  }
}

