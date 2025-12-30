// ============================================================================
// DATA PROVIDER ADAPTER
// Provider manager'dan gelen verileri FullFixtureData formatına çevirir
// ============================================================================

import { FullFixtureData } from '../sportmonks/index';
import { dataProviderManager, FixtureData, TeamStats, MatchData, H2HData, Injury, OddsData, RefereeData, LineupData } from './index';

/**
 * Provider manager'dan gelen verileri FullFixtureData formatına çevir
 * Agent Analyzer'ın beklediği formata uyumlu hale getirir
 */
export async function fetchFullFixtureDataFromProvider(
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number
): Promise<FullFixtureData | null> {
  try {
    // 1. Fixture data
    const fixtureResult = await dataProviderManager.getFixture(fixtureId);
    if (!fixtureResult?.data) {
      console.error('❌ Failed to fetch fixture data from providers');
      return null;
    }
    
    const fixture = fixtureResult.data as FixtureData;
    console.log(`✅ Fixture data from ${fixtureResult.provider}`);
    
    // 2. Team stats
    const [homeStatsResult, awayStatsResult] = await Promise.all([
      dataProviderManager.getTeamStats(homeTeamId),
      dataProviderManager.getTeamStats(awayTeamId)
    ]);
    
    if (!homeStatsResult?.data || !awayStatsResult?.data) {
      console.error('❌ Failed to fetch team stats from providers');
      return null;
    }
    
    const homeStats = homeStatsResult.data as TeamStats;
    const awayStats = awayStatsResult.data as TeamStats;
    console.log(`✅ Team stats from ${homeStatsResult.provider} / ${awayStatsResult.provider}`);
    
    // 3. Recent matches
    const [homeMatchesResult, awayMatchesResult] = await Promise.all([
      dataProviderManager.getTeamRecentMatches(homeTeamId, 10),
      dataProviderManager.getTeamRecentMatches(awayTeamId, 10)
    ]);
    
    const homeMatches = (homeMatchesResult?.data || []) as MatchData[];
    const awayMatches = (awayMatchesResult?.data || []) as MatchData[];
    
    // 4. H2H
    const h2hResult = await dataProviderManager.getHeadToHead(homeTeamId, awayTeamId);
    const h2h = h2hResult?.data as H2HData | undefined;
    
    // 5. Injuries
    const [homeInjuriesResult, awayInjuriesResult] = await Promise.all([
      dataProviderManager.getTeamInjuries(homeTeamId),
      dataProviderManager.getTeamInjuries(awayTeamId)
    ]);
    
    const homeInjuries = (homeInjuriesResult?.data || []) as Injury[];
    const awayInjuries = (awayInjuriesResult?.data || []) as Injury[];
    
    // 6. Odds
    const oddsResult = await dataProviderManager.getPreMatchOdds(fixtureId);
    const odds = oddsResult?.data as OddsData | undefined;
    
    // 7. Referee
    const refereeResult = await dataProviderManager.getReferee(fixtureId);
    const referee = refereeResult?.data as RefereeData | undefined;
    
    // 8. Lineup
    const lineupResult = await dataProviderManager.getLineup(fixtureId);
    const lineup = lineupResult?.data as LineupData | undefined;
    
    // Convert to FullFixtureData format
    const fullData: FullFixtureData = {
      fixtureId: fixture.fixtureId,
      homeTeam: {
        id: fixture.homeTeam.id,
        name: fixture.homeTeam.name,
        shortCode: fixture.homeTeam.name.substring(0, 3).toUpperCase(),
        logo: '',
        form: homeStats.recentForm || 'DDDDD',
        formPoints: homeStats.formPoints || 5,
        position: 0,
        statistics: null,
        recentMatches: homeMatches.map(m => ({
          id: 0,
          starting_at: m.date,
          participants: [
            { id: homeTeamId, name: fixture.homeTeam.name, meta: { location: m.isHome ? 'home' : 'away' } },
            { id: 0, name: m.opponent, meta: { location: m.isHome ? 'away' : 'home' } }
          ],
          scores: m.teamScore !== undefined && m.opponentScore !== undefined ? [
            {
              score: {
                participant: 'home',
                goals: m.isHome ? m.teamScore : m.opponentScore
              },
              description: 'CURRENT'
            },
            {
              score: {
                participant: 'away',
                goals: m.isHome ? m.opponentScore : m.teamScore
              },
              description: 'CURRENT'
            }
          ] : [],
          score: `${m.isHome ? m.teamScore : m.opponentScore}-${m.isHome ? m.opponentScore : m.teamScore}`
        })),
        coach: ''
      },
      awayTeam: {
        id: fixture.awayTeam.id,
        name: fixture.awayTeam.name,
        shortCode: fixture.awayTeam.name.substring(0, 3).toUpperCase(),
        logo: '',
        form: awayStats.recentForm || 'DDDDD',
        formPoints: awayStats.formPoints || 5,
        position: 0,
        statistics: null,
        recentMatches: awayMatches.map(m => ({
          id: 0,
          starting_at: m.date,
          participants: [
            { id: awayTeamId, name: fixture.awayTeam.name, meta: { location: m.isHome ? 'home' : 'away' } },
            { id: 0, name: m.opponent, meta: { location: m.isHome ? 'away' : 'home' } }
          ],
          scores: m.teamScore !== undefined && m.opponentScore !== undefined ? [
            {
              score: {
                participant: 'home',
                goals: m.isHome ? m.teamScore : m.opponentScore
              },
              description: 'CURRENT'
            },
            {
              score: {
                participant: 'away',
                goals: m.isHome ? m.opponentScore : m.teamScore
              },
              description: 'CURRENT'
            }
          ] : [],
          score: `${m.isHome ? m.teamScore : m.opponentScore}-${m.isHome ? m.opponentScore : m.teamScore}`
        })),
        coach: ''
      },
      league: {
        id: fixture.league.id,
        name: fixture.league.name,
        country: '',
        logo: ''
      },
      round: '',
      stage: '',
      venue: fixture.venue ? {
        name: fixture.venue,
        city: '',
        capacity: 0,
        surface: ''
      } : {
        name: '',
        city: '',
        capacity: 0,
        surface: ''
      },
      referee: referee ? {
        name: referee.name || '',
        avgCardsPerMatch: referee.avgYellowCards + referee.avgRedCards,
        avgFoulsPerMatch: 0
      } : {
        name: '',
        avgCardsPerMatch: 0,
        avgFoulsPerMatch: 0
      },
      weather: {
        temperature: 15,
        description: 'Clear',
        humidity: 50,
        wind: 0
      },
      matchStatistics: [],
      events: [],
      lineups: lineup ? {
        home: lineup.home.players.map((p: any) => ({
          name: p.name,
          position: p.position
        })),
        away: lineup.away.players.map((p: any) => ({
          name: p.name,
          position: p.position
        })),
        homeFormation: lineup.home.formation,
        awayFormation: lineup.away.formation
      } : {
        home: [],
        away: [],
        homeFormation: '4-3-3',
        awayFormation: '4-4-2'
      },
      odds: odds ? {
        matchResult: {
          home: odds.matchWinner.home,
          draw: odds.matchWinner.draw,
          away: odds.matchWinner.away
        },
        btts: {
          yes: odds.btts.yes,
          no: odds.btts.no
        },
        overUnder25: {
          over: odds.overUnder25.over,
          under: odds.overUnder25.under
        },
        asianHandicap: null
      } : {
        matchResult: { home: 2.0, draw: 3.0, away: 2.5 },
        btts: { yes: 1.8, no: 2.0 },
        overUnder25: { over: 1.9, under: 1.9 },
        asianHandicap: null
      },
      predictions: {
        sportmonks: null,
        probability: { home: 33, draw: 33, away: 34 }
      },
      h2h: h2h ? {
        totalMatches: h2h.totalMatches,
        team1Wins: h2h.homeWins,
        team2Wins: h2h.awayWins,
        draws: h2h.draws,
        avgGoals: h2h.avgGoals,
        bttsPercentage: h2h.bttsPercentage,
        over25Percentage: h2h.over25Percentage,
        avgCorners: 9,
        over85CornersPercentage: 50,
        over95CornersPercentage: 40,
        recentMatches: h2h.recentMatches.map(m => ({
          date: m.date,
          homeTeam: '',
          awayTeam: '',
          homeScore: m.isHome ? m.teamScore : m.opponentScore,
          awayScore: m.isHome ? m.opponentScore : m.teamScore,
          result: m.result
        }))
      } : {
        totalMatches: 0,
        team1Wins: 0,
        team2Wins: 0,
        draws: 0,
        avgGoals: 0,
        bttsPercentage: 0,
        over25Percentage: 0,
        avgCorners: 9,
        over85CornersPercentage: 50,
        over95CornersPercentage: 40,
        recentMatches: []
      },
      injuries: {
        home: homeInjuries.map(i => ({
          playerName: i.playerName,
          reason: i.reason,
          expectedReturn: i.expectedReturn,
          isOut: true
        })),
        away: awayInjuries.map(i => ({
          playerName: i.playerName,
          reason: i.reason,
          expectedReturn: i.expectedReturn,
          isOut: true
        }))
      },
      dataQuality: {
        hasOdds: !!odds,
        hasLineups: !!lineup,
        hasStatistics: false,
        hasH2H: !!h2h,
        hasInjuries: homeInjuries.length > 0 || awayInjuries.length > 0,
        hasPredictions: false,
        hasWeather: false,
        score: (homeMatches.length > 0 && awayMatches.length > 0 ? 20 : 0) +
               (h2h ? 20 : 0) +
               (homeInjuries.length > 0 || awayInjuries.length > 0 ? 10 : 0) +
               (odds ? 20 : 0) +
               (referee ? 10 : 0) +
               (lineup ? 20 : 0)
      },
      rawData: null
    };
    
    return fullData;
  } catch (error: any) {
    console.error('❌ Error converting provider data to FullFixtureData:', error);
    return null;
  }
}

