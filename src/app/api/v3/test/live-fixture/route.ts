// ============================================================================
// LIVE FIXTURE TEST ENDPOINT
// Fetches upcoming matches and formats data for v3/analyze testing
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getUpcomingFixtures,
  getTeamStatsForAnalysis,
  getH2HDataForMatch,
  getTeamXGData
} from '@/lib/data-providers/fixture-fetcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/v3/test/live-fixture
 * 
 * Query params:
 * - days: number of days ahead to look (default: 3)
 * - leagues: comma-separated league IDs (optional)
 * - format: 'raw' | 'analyze' (default: 'analyze')
 * 
 * Returns: Fixtures formatted for v3/analyze endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysAhead = parseInt(searchParams.get('days') || '3');
    const leaguesParam = searchParams.get('leagues');
    const format = searchParams.get('format') || 'analyze';
    
    const leagues = leaguesParam ? leaguesParam.split(',').map(Number) : undefined;
    
    console.log(`🎯 Fetching live fixtures (${daysAhead} days ahead)...`);
    
    // Get upcoming fixtures
    const fixtures = await getUpcomingFixtures(daysAhead, leagues);
    
    if (fixtures.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No fixtures found for the specified period',
        fixtures: [],
        count: 0
      }, { status: 200 });
    }
    
    console.log(`📊 Processing ${fixtures.length} fixtures for analysis...`);
    
    if (format === 'raw') {
      return NextResponse.json({
        success: true,
        count: fixtures.length,
        fixtures,
        timestamp: new Date().toISOString()
      });
    }
    
    // Format for analyze endpoint (format === 'analyze')
    const analyzeReady: any[] = [];
    
    for (let i = 0; i < fixtures.length && i < 10; i++) {  // Limit to first 10 to avoid API limits
      const fixture = fixtures[i];
      
      console.log(`\n⚙️  Processing: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
      
      try {
        // Fetch all necessary data in parallel
        const [homeStats, awayStats, h2h, homeXGRaw, awayXGRaw] = await Promise.all([
          getTeamStatsForAnalysis(fixture.homeTeamId),
          getTeamStatsForAnalysis(fixture.awayTeamId),
          getH2HDataForMatch(fixture.homeTeamId, fixture.awayTeamId),
          getTeamXGData(fixture.homeTeamId),
          getTeamXGData(fixture.awayTeamId)
        ]);
        
        // Type-safe xG data
        const homeXG = homeXGRaw as { xGFor?: number; xGAgainst?: number } | null;
        const awayXG = awayXGRaw as { xGFor?: number; xGAgainst?: number } | null;
        
        if (!homeStats || !awayStats || !h2h) {
          console.log(`⏭️  Skipping: incomplete data for ${fixture.homeTeam} vs ${fixture.awayTeam}`);
          continue;
        }
        
        // Build H2H with home/away records
        const h2hWithRecords = {
          ...h2h,
          homeRecord: {
            wins: h2h.homeWins || 0,
            draws: h2h.draws || 0,
            losses: h2h.awayWins || 0
          },
          awayRecord: {
            wins: h2h.awayWins || 0,
            draws: h2h.draws || 0,
            losses: h2h.homeWins || 0
          }
        };
        
        // Format for v3/analyze endpoint
        const matchData = {
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          league: fixture.league,
          date: fixture.date,
          venue: fixture.venue,
          fixtureId: fixture.fixtureId
        };
        
        const homeStatsFormatted = {
          name: homeStats.name,
          form: homeStats.form,
          last5: `${Math.round((homeStats.homeWinRate || 0) / 20)}W ${Math.round((homeStats.homeAvgGoalsScored || 0) * 2)}D`,
          avgGF: homeStats.homeAvgGoalsScored || homeStats.avgGF || 0,
          avgGA: homeStats.homeAvgGoalsConceded || homeStats.avgGA || 0,
          homeWinRate: homeStats.homeWinRate || 0,
          awayWinRate: homeStats.awayWinRate || 0,
          trend: (homeStats.form?.includes('W') ? '↑ Up' : homeStats.form?.includes('L') ? '↓ Down' : '→ Stable'),
          issues: 'N/A',
          motivation: 'Normal',
          bttsPercentage: homeStats.bttsPercentage || 0,
          over25Percentage: homeStats.over25Percentage || 0,
          xGFor: homeXG?.xGFor || homeStats.avgGF * 0.95,
          xGAgainst: homeXG?.xGAgainst || homeStats.avgGA * 0.95
        };
        
        const awayStatsFormatted = {
          name: awayStats.name,
          form: awayStats.form,
          last5: `${Math.round((awayStats.awayWinRate || 0) / 20)}W ${Math.round((awayStats.awayAvgGoalsScored || 0) * 2)}D`,
          avgGF: awayStats.awayAvgGoalsScored || awayStats.avgGF || 0,
          avgGA: awayStats.awayAvgGoalsConceded || awayStats.avgGA || 0,
          homeWinRate: awayStats.homeWinRate || 0,
          awayWinRate: awayStats.awayWinRate || 0,
          trend: (awayStats.form?.includes('W') ? '↑ Up' : awayStats.form?.includes('L') ? '↓ Down' : '→ Stable'),
          issues: 'N/A',
          motivation: 'Normal',
          bttsPercentage: awayStats.bttsPercentage || 0,
          over25Percentage: awayStats.over25Percentage || 0,
          xGFor: awayXG?.xGFor || awayStats.avgGF * 0.95,
          xGAgainst: awayXG?.xGAgainst || awayStats.avgGA * 0.95
        };
        
        analyzeReady.push({
          match: matchData,
          homeStats: homeStatsFormatted,
          awayStats: awayStatsFormatted,
          h2h: h2hWithRecords,
          dataQuality: {
            homeXGAvailable: !!homeXG,
            awayXGAvailable: !!awayXG,
            h2hMatches: h2h.matches,
            confidence: h2h.matches > 5 ? 'high' : 'medium'
          }
        });
        
        console.log(`✅ Formatted: ${fixture.homeTeam} vs ${fixture.awayTeam}`);
      } catch (error: any) {
        console.error(`❌ Error processing ${fixture.homeTeam} vs ${fixture.awayTeam}:`, error.message);
        continue;
      }
    }
    
    return NextResponse.json({
      success: true,
      count: analyzeReady.length,
      totalAvailable: fixtures.length,
      fixtures: analyzeReady,
      readyForAnalyze: true,
      testInstructions: {
        message: 'Ready to test with v3/analyze endpoint',
        example: `curl -X POST http://localhost:3000/api/v3/analyze -H "Content-Type: application/json" -d '{...}'`,
        format: 'Each fixture object contains: match, homeStats, awayStats, h2h - compatible with v3/analyze'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Live fixture fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        message: 'Failed to fetch live fixtures'
      },
      { status: 500 }
    );
  }
}
