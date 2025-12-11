// ============================================================================
// FOOTBALL ANALYTICS PRO - İSTATİSTİK API
// ============================================================================
// /api/stats endpoint - Tahmin doğruluğu ve AI performansı
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { 
  getOverallStats, 
  getLeagueStats, 
  getPendingPredictions,
  getRecentPredictions 
} from '@/lib/prediction-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overall';
    
    switch (type) {
      case 'overall':
        const overallStats = await getOverallStats();
        return NextResponse.json({
          success: true,
          data: overallStats,
        });
        
      case 'leagues':
        const leagueStats = await getLeagueStats();
        return NextResponse.json({
          success: true,
          data: leagueStats,
        });
        
      case 'pending':
        const pending = await getPendingPredictions();
        return NextResponse.json({
          success: true,
          count: pending.length,
          data: pending.map(p => ({
            id: p.id,
            match: `${p.homeTeam} vs ${p.awayTeam}`,
            league: p.league,
            matchDate: p.matchDate,
            prediction: {
              matchResult: p.matchResultPrediction,
              overUnder: p.overUnderPrediction,
              btts: p.bttsPrediction,
            },
          })),
        });
        
      case 'recent':
        const limit = parseInt(searchParams.get('limit') || '20');
        const recent = await getRecentPredictions(limit);
        return NextResponse.json({
          success: true,
          count: recent.length,
          data: recent.map(p => ({
            id: p.id,
            match: `${p.homeTeam} vs ${p.awayTeam}`,
            league: p.league,
            matchDate: p.matchDate,
            status: p.status,
            prediction: {
              matchResult: p.matchResultPrediction,
              confidence: p.matchResultConfidence,
              overUnder: p.overUnderPrediction,
              btts: p.bttsPrediction,
            },
            ...(p.status === 'completed' && {
              actual: {
                score: `${p.actualHomeGoals}-${p.actualAwayGoals}`,
                result: p.actualResult,
              },
              accuracy: {
                matchResult: p.matchResultCorrect,
                overUnder: p.overUnderCorrect,
                btts: p.bttsCorrect,
              },
            }),
          })),
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid type. Use: overall, leagues, pending, recent',
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
