// ============================================================================
// DATA PROVIDER ABSTRACTION LAYER
// Sportmonks ve Bright Data gibi farklı veri kaynaklarını destekler
// ============================================================================

export interface DataProvider {
  name: string;
  priority: number; // Düşük sayı = yüksek öncelik
  
  // Fixture/maç verileri
  getFixture(fixtureId: number): Promise<FixtureData | null>;
  getFixturesByDate(date: string, leagueId?: number): Promise<FixtureData[]>;
  
  // Takım verileri
  getTeamStats(teamId: number, seasonId?: number): Promise<TeamStats | null>;
  getTeamRecentMatches(teamId: number, limit?: number): Promise<MatchData[]>;
  getTeamInjuries(teamId: number): Promise<Injury[]>;
  
  // H2H verileri
  getHeadToHead(homeTeamId: number, awayTeamId: number): Promise<H2HData | null>;
  
  // Odds verileri
  getPreMatchOdds(fixtureId: number): Promise<OddsData | null>;
  
  // Hakem verileri
  getReferee(fixtureId: number): Promise<RefereeData | null>;
  
  // Lineup verileri
  getLineup(fixtureId: number): Promise<LineupData | null>;
  
  // xG verileri
  getTeamXG(teamId: number): Promise<XGData | null>;
}

export interface FixtureData {
  fixtureId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  league: { id: number; name: string };
  date: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
  score?: { home: number; away: number };
  venue?: string;
}

export interface TeamStats {
  teamId: number;
  teamName: string;
  recentForm: string; // "WWDLW"
  formPoints: number;
  goalsScored: number;
  goalsConceded: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  // 🆕 VENUE-SPESİFİK GOL ORTALAMALARI (ÖNEMLİ!)
  homeAvgGoalsScored: number;    // Ev maçlarında attığı gol ortalaması
  homeAvgGoalsConceded: number;  // Ev maçlarında yediği gol ortalaması
  awayAvgGoalsScored: number;    // Deplasman maçlarında attığı gol ortalaması
  awayAvgGoalsConceded: number;  // Deplasman maçlarında yediği gol ortalaması
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  bttsPercentage: number;
  over25Percentage: number;
  under25Percentage: number;
  cleanSheets: number;
  failedToScore: number;
}

export interface MatchData {
  date: string;
  opponent: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  result: 'W' | 'D' | 'L';
  totalGoals: number;
  btts: boolean;
}

export interface Injury {
  playerName: string;
  reason: string;
  expectedReturn?: string;
}

export interface H2HData {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  avgGoals: number;
  over25Percentage: number;
  bttsPercentage: number;
  recentMatches: MatchData[];
}

export interface OddsData {
  matchWinner: { home: number; draw: number; away: number };
  overUnder25: { over: number; under: number };
  btts: { yes: number; no: number };
}

export interface RefereeData {
  name: string;
  avgYellowCards: number;
  avgRedCards: number;
  avgPenalties: number;
  homeBias: 'neutral' | 'slight_home' | 'slight_away';
}

export interface LineupData {
  home: {
    formation: string;
    players: Array<{ name: string; position: string }>;
  };
  away: {
    formation: string;
    players: Array<{ name: string; position: string }>;
  };
}

export interface XGData {
  avgXGFor: number;
  avgXGAgainst: number;
  matchHistory: Array<{
    date: string;
    xgFor: number;
    xgAgainst: number;
    goalsFor: number;
    goalsAgainst: number;
  }>;
}

