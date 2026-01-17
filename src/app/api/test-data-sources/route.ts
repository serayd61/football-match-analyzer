// ============================================================================
// DATA SOURCES TEST ENDPOINT
// SoccerData ve Sportmonks veri kaynaklarını test et
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getHybridDataManager } from '@/lib/data-sources/hybrid-manager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/test-data-sources
 * 
 * Query params:
 * - league: Lig adı (default: 'premier-league')
 * - season: Sezon (default: '2023-2024')
 * - test: 'fixtures' | 'live' | 'xg' | 'all'
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get('league') || 'premier-league';
    const season = searchParams.get('season') || '2023-2024';
    const test = searchParams.get('test') || 'all';

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      league,
      season,
      tests: {}
    };

    const manager = getHybridDataManager();

    // Test 1: Fixtures
    if (test === 'fixtures' || test === 'all') {
      try {
        const fixtures = await manager.getFixtures(league, season);
        results.tests.fixtures = {
          success: true,
          count: fixtures.length,
          sources: fixtures.length > 0 
            ? Array.from(new Set(fixtures.map(f => f.source)))
            : [],
          sample: fixtures.slice(0, 3).map(f => ({
            fixtureId: f.fixtureId,
            homeTeam: f.homeTeam,
            awayTeam: f.awayTeam,
            date: f.date,
            source: f.source
          })),
          hasSoccerData: fixtures.some(f => f.source === 'soccerdata'),
          hasSportmonks: fixtures.some(f => f.source === 'sportmonks')
        };
      } catch (error: any) {
        results.tests.fixtures = {
          success: false,
          error: error.message
        };
      }
    }

    // Test 2: Live Scores
    if (test === 'live' || test === 'all') {
      try {
        const liveScores = await manager.getLiveScores();
        results.tests.live = {
          success: true,
          count: liveScores.length,
          sources: liveScores.length > 0
            ? Array.from(new Set(liveScores.map(l => l.source)))
            : [],
          sample: liveScores.slice(0, 3).map(l => ({
            fixtureId: l.fixtureId,
            homeTeam: l.homeTeam,
            awayTeam: l.awayTeam,
            score: `${l.homeScore}-${l.awayScore}`,
            source: l.source
          })),
          hasSoccerData: liveScores.some(l => l.source === 'soccerdata'),
          hasSportmonks: liveScores.some(l => l.source === 'sportmonks'),
          note: 'Live scores are Sportmonks-only (SoccerData does not support live data)'
        };
      } catch (error: any) {
        results.tests.live = {
          success: false,
          error: error.message
        };
      }
    }

    // Test 3: xG Data
    if (test === 'xg' || test === 'all') {
      try {
        // Önce bir fixture ID bulalım
        const fixtures = await manager.getFixtures(league, season);
        if (fixtures.length > 0) {
          const fixtureId = fixtures[0].fixtureId;
          const xgData = await manager.getXGData(fixtureId);
          results.tests.xg = {
            success: true,
            fixtureId,
            data: xgData,
            source: xgData?.source || 'none',
            hasSoccerData: xgData?.source === 'soccerdata',
            hasSportmonks: xgData?.source === 'sportmonks'
          };
        } else {
          results.tests.xg = {
            success: false,
            error: 'No fixtures found to test xG data'
          };
        }
      } catch (error: any) {
        results.tests.xg = {
          success: false,
          error: error.message
        };
      }
    }

    // Environment Check
    results.environment = {
      sportmonksToken: !!process.env.SPORTMONKS_API_KEY,
      sportmonksTokenLength: process.env.SPORTMONKS_API_KEY?.length || 0,
      pythonAvailable: 'N/A (Python script not integrated yet)',
      note: 'SoccerData integration requires Python script to be running as a separate service'
    };

    // Summary
    results.summary = {
      totalTests: Object.keys(results.tests).length,
      successfulTests: Object.values(results.tests).filter((t: any) => t.success).length,
      soccerDataAvailable: Object.values(results.tests).some((t: any) => 
        t.hasSoccerData || t.source === 'soccerdata'
      ),
      sportmonksAvailable: Object.values(results.tests).some((t: any) => 
        t.hasSportmonks || t.source === 'sportmonks'
      ),
      recommendation: results.environment.sportmonksToken
        ? 'Sportmonks is configured and working. SoccerData requires Python script integration.'
        : 'Sportmonks token not configured. Configure SPORTMONKS_API_KEY environment variable.'
    };

    return NextResponse.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    console.error('❌ Data sources test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
