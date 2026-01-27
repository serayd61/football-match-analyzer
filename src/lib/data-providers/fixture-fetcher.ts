// ============================================================================
// FIXTURE FETCHER - Simple utility to get upcoming matches
// ============================================================================

import { dataProviderManager } from './index';

export interface SimplifiedFixture {
  fixtureId: number;
  homeTeamId: number;
  homeTeam: string;
  awayTeamId: number;
  awayTeam: string;
  league: string;
  leagueId: number;
  date: string;
  time?: string;
  venue?: string;
  status: 'scheduled' | 'live' | 'completed' | 'postponed';
}

/**
 * Fetch fixtures for next N days
 * 
 * @param daysAhead - Number of days to look ahead (default: 3)
 * @param leagues - Optional specific league IDs to filter
 * @returns Array of fixture objects
 */
export async function getUpcomingFixtures(
  daysAhead: number = 3,
  leagues?: number[]
): Promise<SimplifiedFixture[]> {
  const fixtures: SimplifiedFixture[] = [];
  
  try {
    // Get dates for next N days
    const today = new Date();
    const dates: string[] = [];
    
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      // Format as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      dates.push(`${year}-${month}-${day}`);
    }
    
    // Fetch fixtures for each date
    for (const dateStr of dates) {
      console.log(`📅 Fetching fixtures for ${dateStr}...`);
      
      const result = await dataProviderManager.getFixturesByDate(dateStr);
      
      if (result && result.data) {
        const fixturesList = Array.isArray(result.data) ? result.data : [result.data];
        
        for (const fixture of fixturesList) {
          // Filter by league if specified
          if (leagues && !leagues.includes(fixture.league?.id)) {
            continue;
          }
          
          fixtures.push({
            fixtureId: fixture.fixtureId,
            homeTeamId: fixture.homeTeam?.id || 0,
            homeTeam: fixture.homeTeam?.name || 'Unknown',
            awayTeamId: fixture.awayTeam?.id || 0,
            awayTeam: fixture.awayTeam?.name || 'Unknown',
            league: fixture.league?.name || 'Unknown',
            leagueId: fixture.league?.id || 0,
            date: fixture.date || dateStr,
            venue: fixture.venue,
            status: fixture.status || 'scheduled'
          });
        }
      }
    }
    
    console.log(`✅ Found ${fixtures.length} upcoming fixtures`);
    return fixtures;
  } catch (error: any) {
    console.error('❌ Error fetching upcoming fixtures:', error.message);
    return [];
  }
}

/**
 * Fetch a single fixture's full details
 */
export async function getFixtureFullData(fixtureId: number) {
  try {
    const result = await dataProviderManager.getFixture(fixtureId);
    return result?.data || null;
  } catch (error: any) {
    console.error(`❌ Error fetching fixture ${fixtureId}:`, error.message);
    return null;
  }
}

/**
 * Fetch team stats for analysis
 */
export async function getTeamStatsForAnalysis(teamId: number) {
  try {
    const result = await dataProviderManager.getTeamStats(teamId);
    if (!result?.data) return null;
    
    const stats = result.data;
    return {
      teamId,
      name: stats.teamName,
      form: stats.recentForm || 'N/A',
      avgGF: stats.avgGoalsScored || 0,
      avgGA: stats.avgGoalsConceded || 0,
      homeWinRate: ((stats.homeWins || 0) / Math.max((stats.homeWins || 0) + (stats.homeDraws || 0) + (stats.homeLosses || 0), 1)) * 100,
      awayWinRate: ((stats.awayWins || 0) / Math.max((stats.awayWins || 0) + (stats.awayDraws || 0) + (stats.awayLosses || 0), 1)) * 100,
      homeAvgGoalsScored: stats.homeAvgGoalsScored || stats.avgGoalsScored || 0,
      homeAvgGoalsConceded: stats.homeAvgGoalsConceded || stats.avgGoalsConceded || 0,
      awayAvgGoalsScored: stats.awayAvgGoalsScored || stats.avgGoalsScored || 0,
      awayAvgGoalsConceded: stats.awayAvgGoalsConceded || stats.avgGoalsConceded || 0,
      bttsPercentage: stats.bttsPercentage || 0,
      over25Percentage: stats.over25Percentage || 0,
    };
  } catch (error: any) {
    console.error(`❌ Error fetching team stats for ${teamId}:`, error.message);
    return null;
  }
}

/**
 * Fetch H2H data for two teams
 */
export async function getH2HDataForMatch(homeTeamId: number, awayTeamId: number) {
  try {
    const result = await dataProviderManager.getHeadToHead(homeTeamId, awayTeamId);
    if (!result?.data) return null;
    
    const h2h = result.data;
    return {
      matches: h2h.totalMatches || 0,
      homeWins: h2h.homeWins || 0,
      draws: h2h.draws || 0,
      awayWins: h2h.awayWins || 0,
      avgGoals: h2h.avgGoals || 0,
      bttsPercent: h2h.bttsPercentage || 0,
      over25Percent: h2h.over25Percentage || 0,
      recentMatches: (h2h.recentMatches || []).map((m: any) => ({
        date: m.date || '',
        home: 'Team A',
        homeGoals: m.teamScore || m.goalsFor || 0,
        away: 'Team B',
        awayGoals: m.opponentScore || m.goalsAgainst || 0,
      }))
    };
  } catch (error: any) {
    console.error(`❌ Error fetching H2H data:`, error.message);
    return null;
  }
}

/**
 * Fetch xG data for team
 */
export async function getTeamXGData(teamId: number) {
  try {
    const result = await dataProviderManager.getTeamXG(teamId);
    if (!result?.data) return null;
    
    return result.data;
  } catch (error: any) {
    console.error(`❌ Error fetching xG data for ${teamId}:`, error.message);
    return null;
  }
}
