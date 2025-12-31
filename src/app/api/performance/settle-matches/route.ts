// ============================================================================
// API: Settle Matches - Fetch results from Sportmonks and calculate accuracy
// POST /api/performance/settle-matches
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyses, settleMatch, SettledMatch } from '@/lib/performance';

// Sportmonks API
const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3/football';

async function fetchFixtureResult(fixtureId: number): Promise<SettledMatch | null> {
  try {
    const url = `${SPORTMONKS_BASE}/fixtures/${fixtureId}?api_token=${SPORTMONKS_TOKEN}&include=scores`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 } // Cache for 1 minute
    });
    
    if (!response.ok) {
      console.log(`⚠️ Sportmonks error for fixture ${fixtureId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const fixture = data.data;
    
    if (!fixture) {
      console.log(`⚠️ No fixture data for ${fixtureId}`);
      return null;
    }
    
    // Check if match is finished
    // state_id: 5 = Finished, 11 = Finished After Extra Time, etc.
    const finishedStates = [5, 11, 12, 13, 14];
    if (!finishedStates.includes(fixture.state_id)) {
      console.log(`⏳ Match ${fixtureId} not finished yet (state: ${fixture.state_id})`);
      return null;
    }
    
    // Extract scores
    let homeScore = 0;
    let awayScore = 0;
    
    if (fixture.scores && Array.isArray(fixture.scores)) {
      // Find final score (usually participant home/away with type FT)
      for (const score of fixture.scores) {
        if (score.description === 'CURRENT' || score.description === '2ND_HALF') {
          if (score.score?.participant === 'home') {
            homeScore = score.score?.goals || 0;
          } else if (score.score?.participant === 'away') {
            awayScore = score.score?.goals || 0;
          }
        }
      }
      
      // Fallback: look for FT scores
      if (homeScore === 0 && awayScore === 0) {
        for (const score of fixture.scores) {
          if (score.description === 'FT' || score.description === 'FINAL') {
            if (score.score?.participant === 'home') {
              homeScore = score.score?.goals || 0;
            } else if (score.score?.participant === 'away') {
              awayScore = score.score?.goals || 0;
            }
          }
        }
      }
    }
    
    // Calculate actual results
    const totalGoals = homeScore + awayScore;
    const matchResult = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
    const overUnder = totalGoals > 2.5 ? 'over' : 'under';
    const btts = homeScore > 0 && awayScore > 0 ? 'yes' : 'no';
    
    console.log(`📊 Fixture ${fixtureId}: ${homeScore}-${awayScore} (${matchResult}, ${overUnder}, BTTS: ${btts})`);
    
    return {
      fixtureId,
      homeScore,
      awayScore,
      matchResult,
      overUnder,
      btts,
      totalGoals
    };
    
  } catch (error) {
    console.error(`❌ Error fetching fixture ${fixtureId}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting match settlement process...');
    
    // Get all unsettled analyses
    const { data: unsettledAnalyses, error: fetchError } = await getAnalyses({ settled: false });
    
    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError },
        { status: 500 }
      );
    }
    
    if (!unsettledAnalyses || unsettledAnalyses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unsettled matches to process',
        settled: 0,
        pending: 0
      });
    }
    
    console.log(`📋 Found ${unsettledAnalyses.length} unsettled analyses`);
    
    let settledCount = 0;
    let pendingCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    
    // Process each analysis
    for (const analysis of unsettledAnalyses) {
      const fixtureId = analysis.fixture_id;
      
      // Fetch result from Sportmonks
      const result = await fetchFixtureResult(fixtureId);
      
      if (!result) {
        pendingCount++;
        results.push({
          fixtureId,
          homeTeam: analysis.home_team,
          awayTeam: analysis.away_team,
          status: 'pending',
          reason: 'Match not finished or result unavailable'
        });
        continue;
      }
      
      // Settle the match
      const settleResult = await settleMatch(fixtureId, result);
      
      if (settleResult.success) {
        settledCount++;
        results.push({
          fixtureId,
          homeTeam: analysis.home_team,
          awayTeam: analysis.away_team,
          status: 'settled',
          score: `${result.homeScore}-${result.awayScore}`,
          matchResult: result.matchResult,
          overUnder: result.overUnder,
          btts: result.btts
        });
      } else {
        errorCount++;
        results.push({
          fixtureId,
          homeTeam: analysis.home_team,
          awayTeam: analysis.away_team,
          status: 'error',
          error: settleResult.error
        });
      }
      
      // Rate limiting - wait 100ms between API calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Settlement complete: ${settledCount} settled, ${pendingCount} pending, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${unsettledAnalyses.length} matches`,
      settled: settledCount,
      pending: pendingCount,
      errors: errorCount,
      results
    });
    
  } catch (error: any) {
    console.error('❌ Settle matches API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to settle matches',
    endpoint: '/api/performance/settle-matches'
  });
}

