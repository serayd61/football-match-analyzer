// ============================================================================
// HYBRID DATA API ENDPOINT
// SoccerData + Sportmonks hibrit veri yönetimi
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getHybridDataManager } from '@/lib/data-sources/hybrid-manager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/hybrid-data
 * 
 * Query params:
 * - action: 'fixtures' | 'live' | 'xg' | 'analysis' | 'elo' | 'shots'
 * - league: lig adı (opsiyonel)
 * - season: sezon (opsiyonel)
 * - date: tarih (YYYY-MM-DD) (opsiyonel)
 * - fixtureId: maç ID (xg, analysis için)
 * - homeTeam: ev sahibi takım (analysis için)
 * - awayTeam: deplasman takımı (analysis için)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'fixtures';
    const league = searchParams.get('league') || '';
    const season = searchParams.get('season') || '';
    const date = searchParams.get('date') || undefined;
    const fixtureId = searchParams.get('fixtureId') ? parseInt(searchParams.get('fixtureId')!) : undefined;
    const homeTeam = searchParams.get('homeTeam') || '';
    const awayTeam = searchParams.get('awayTeam') || '';

    const manager = getHybridDataManager();

    switch (action) {
      case 'fixtures':
        if (!league) {
          return NextResponse.json(
            { success: false, error: 'league parameter required' },
            { status: 400 }
          );
        }
        const fixtures = await manager.getFixtures(league, season, date);
        return NextResponse.json({
          success: true,
          data: fixtures,
          count: fixtures.length,
          source: fixtures.length > 0 ? fixtures[0].source : 'none'
        });

      case 'live':
        const liveScores = await manager.getLiveScores();
        return NextResponse.json({
          success: true,
          data: liveScores,
          count: liveScores.length,
          source: 'sportmonks'
        });

      case 'xg':
        if (!fixtureId) {
          return NextResponse.json(
            { success: false, error: 'fixtureId parameter required' },
            { status: 400 }
          );
        }
        const xgData = await manager.getXGData(fixtureId);
        return NextResponse.json({
          success: true,
          data: xgData,
          source: xgData?.source || 'none'
        });

      case 'analysis':
        if (!league || !homeTeam || !awayTeam) {
          return NextResponse.json(
            { success: false, error: 'league, homeTeam, and awayTeam parameters required' },
            { status: 400 }
          );
        }
        const analysis = await manager.getMatchAnalysis(
          league,
          season,
          homeTeam,
          awayTeam,
          fixtureId
        );
        return NextResponse.json({
          success: true,
          data: analysis,
          sources: analysis.dataSources
        });

      case 'elo':
        const eloRatings = await manager.getEloRatings();
        return NextResponse.json({
          success: true,
          data: eloRatings,
          count: eloRatings.length,
          source: 'soccerdata',
          note: 'Python script integration required'
        });

      case 'shots':
        if (!league || !season) {
          return NextResponse.json(
            { success: false, error: 'league and season parameters required' },
            { status: 400 }
          );
        }
        const shots = await manager.getShotMapData(league, season, fixtureId);
        return NextResponse.json({
          success: true,
          data: shots,
          count: shots.length,
          source: 'soccerdata',
          note: 'Python script integration required'
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('❌ Hybrid data API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
