// ============================================================================
// SPORTMONKS PROVIDER (Mevcut implementasyonu wrapper)
// ============================================================================

import { DataProvider, FixtureData, TeamStats, MatchData, Injury, H2HData, OddsData, RefereeData, LineupData, XGData } from './types';
import { 
  getTeamStats as getTeamStatsSM, 
  getTeamRecentMatches as getTeamRecentMatchesSM,
  getTeamInjuries as getTeamInjuriesSM,
  getHeadToHead as getHeadToHeadSM,
  getFullFixtureData
} from '../sportmonks/index';
import { getPreMatchOdds as getPreMatchOddsSM } from '../sportmonks';
import { fetchRefereeFromSportMonks } from '../football-intelligence/referee-stats';
import { fetchLineupFromSportMonks } from '../football-intelligence/lineup-injuries';
import { fetchTeamXGFromSportMonks } from '../football-intelligence/xg-provider';

export class SportmonksProvider implements DataProvider {
  name = 'Sportmonks';
  priority = 2; // Bright Data'dan sonra dene
  
  async getFixture(fixtureId: number): Promise<FixtureData | null> {
    const fullData = await getFullFixtureData(fixtureId);
    if (!fullData) return null;
    
    return {
      fixtureId: fullData.fixture.id,
      homeTeam: { id: fullData.homeTeam.id, name: fullData.homeTeam.name },
      awayTeam: { id: fullData.awayTeam.id, name: fullData.awayTeam.name },
      league: { id: fullData.league.id, name: fullData.league.name },
      date: fullData.fixture.starting_at,
      status: fullData.fixture.state_id === 5 ? 'finished' : 
              fullData.fixture.state_id === 1 ? 'scheduled' : 'live',
      score: fullData.scores ? {
        home: fullData.scores.home || 0,
        away: fullData.scores.away || 0
      } : undefined,
      venue: fullData.venue?.name
    };
  }
  
  async getFixturesByDate(date: string, leagueId?: number): Promise<FixtureData[]> {
    // Sportmonks'tan fixtures by date endpoint'i kullan
    // Bu kısım mevcut kodda yoksa eklenebilir
    return [];
  }
  
  async getTeamStats(teamId: number, seasonId?: number): Promise<TeamStats | null> {
    const stats = await getTeamStatsSM(teamId, seasonId);
    if (!stats) return null;
    
    return {
      teamId: stats.teamId,
      teamName: stats.teamName,
      recentForm: stats.recentForm,
      formPoints: stats.formPoints,
      goalsScored: stats.goalsScored,
      goalsConceded: stats.goalsConceded,
      avgGoalsScored: stats.avgGoalsScored,
      avgGoalsConceded: stats.avgGoalsConceded,
      homeWins: stats.homeWins,
      homeDraws: stats.homeDraws,
      homeLosses: stats.homeLosses,
      awayWins: stats.awayWins,
      awayDraws: stats.awayDraws,
      awayLosses: stats.awayLosses,
      bttsPercentage: stats.bttsPercentage,
      over25Percentage: stats.over25Percentage,
      under25Percentage: stats.under25Percentage,
      cleanSheets: stats.cleanSheets,
      failedToScore: stats.failedToScore
    };
  }
  
  async getTeamRecentMatches(teamId: number, limit: number = 10): Promise<MatchData[]> {
    const matches = await getTeamRecentMatchesSM(teamId, limit);
    return matches.map(m => ({
      date: m.date,
      opponent: m.opponent,
      isHome: m.isHome,
      teamScore: m.teamScore,
      opponentScore: m.opponentScore,
      result: m.result,
      totalGoals: m.totalGoals,
      btts: m.btts
    }));
  }
  
  async getTeamInjuries(teamId: number): Promise<Injury[]> {
    return await getTeamInjuriesSM(teamId);
  }
  
  async getHeadToHead(homeTeamId: number, awayTeamId: number): Promise<H2HData | null> {
    const h2h = await getHeadToHeadSM(homeTeamId, awayTeamId);
    if (!h2h) return null;
    
    return {
      totalMatches: h2h.totalMatches,
      homeWins: h2h.team1Wins,
      awayWins: h2h.team2Wins,
      draws: h2h.draws,
      avgGoals: h2h.avgGoals,
      over25Percentage: h2h.over25Percentage,
      bttsPercentage: h2h.bttsPercentage,
      recentMatches: h2h.recentMatches.map((m: any) => ({
        date: m.date,
        opponent: '',
        isHome: false,
        teamScore: m.homeScore || 0,
        opponentScore: m.awayScore || 0,
        result: m.result,
        totalGoals: (m.homeScore || 0) + (m.awayScore || 0),
        btts: (m.homeScore || 0) > 0 && (m.awayScore || 0) > 0
      }))
    };
  }
  
  async getPreMatchOdds(fixtureId: number): Promise<OddsData | null> {
    const odds = await getPreMatchOddsSM(fixtureId);
    if (!odds) return null;
    
    return {
      matchWinner: {
        home: odds.matchWinner?.home || 2.0,
        draw: odds.matchWinner?.draw || 3.0,
        away: odds.matchWinner?.away || 2.5
      },
      overUnder25: {
        over: odds.overUnder?.['2.5']?.over || 1.9,
        under: odds.overUnder?.['2.5']?.under || 1.9
      },
      btts: {
        yes: odds.btts?.yes || 1.8,
        no: odds.btts?.no || 2.0
      }
    };
  }
  
  async getReferee(fixtureId: number): Promise<RefereeData | null> {
    const ref = await fetchRefereeFromSportMonks(fixtureId);
    if (!ref) return null;
    
    return {
      name: ref.name,
      avgYellowCards: ref.avgYellowCards,
      avgRedCards: ref.avgRedCards,
      avgPenalties: ref.avgPenalties,
      homeBias: ref.homeBias || 'neutral'
    };
  }
  
  async getLineup(fixtureId: number): Promise<LineupData | null> {
    const lineup = await fetchLineupFromSportMonks(fixtureId);
    if (!lineup) return null;
    
    return {
      home: {
        formation: lineup.homeLineup?.formation || '4-3-3',
        players: lineup.homeLineup?.players?.map((p: any) => ({
          name: p.name,
          position: p.position
        })) || []
      },
      away: {
        formation: lineup.awayLineup?.formation || '4-4-2',
        players: lineup.awayLineup?.players?.map((p: any) => ({
          name: p.name,
          position: p.position
        })) || []
      }
    };
  }
  
  async getTeamXG(teamId: number): Promise<XGData | null> {
    const xg = await fetchTeamXGFromSportMonks(teamId);
    if (!xg) return null;
    
    return {
      avgXGFor: xg.avgXGFor || 0,
      avgXGAgainst: xg.avgXGAgainst || 0,
      matchHistory: xg.matchXGHistory?.map((m: any) => ({
        date: m.date,
        xgFor: m.xgFor,
        xgAgainst: m.xgAgainst,
        goalsFor: m.goalsFor,
        goalsAgainst: m.goalsAgainst
      })) || []
    };
  }
}

