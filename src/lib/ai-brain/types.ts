// AI Brain Architecture - Type Definitions
// FootballAnalytics.pro

export type AIModel = 'claude' | 'gpt4' | 'gemini' | 'perplexity';

export type AIRole = 
  | 'tactical'      // Claude - Taktik analizi
  | 'statistical'   // GPT-4 - İstatistik motoru
  | 'pattern'       // Gemini - Pattern recognition
  | 'contextual';   // Perplexity - Haberler ve context

export interface AIBrainConfig {
  model: AIModel;
  role: AIRole;
  weight: number;           // Consensus'taki ağırlık (0-1)
  temperature: number;      // Yaratıcılık seviyesi
  maxTokens: number;
  specialization: string;   // Uzmanlık alanı açıklaması
}

export interface MatchData {
  fixtureId: number;
  homeTeam: TeamData;
  awayTeam: TeamData;
  league: LeagueData;
  odds: OddsData;
  datetime: string;
}

export interface TeamData {
  id: number;
  name: string;
  logo: string;
  form: string;              // "WWDLW"
  formPoints: number;        // Son 5 maç puan
  homeForm?: string;         // Ev sahibi formu
  awayForm?: string;         // Deplasman formu
  lastMatches: MatchResult[];
  stats: TeamStats;
}

export interface TeamStats {
  goalsScored: number;
  goalsConceded: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  cleanSheets: number;
  failedToScore: number;
  bttsYes: number;           // Her iki takım da gol attı
  over25: number;            // 2.5 üstü maç sayısı
  over35: number;
  xG?: number;               // Expected Goals
  xGA?: number;              // Expected Goals Against
  possession?: number;
  shotsOnTarget?: number;
}

export interface MatchResult {
  fixtureId: number;
  opponent: string;
  opponentLogo: string;
  isHome: boolean;
  score: string;             // "2-1"
  result: 'W' | 'D' | 'L';
  date: string;
  goals: number;
  conceded: number;
}

export interface LeagueData {
  id: number;
  name: string;
  country: string;
  logo: string;
  avgGoals: number;          // Lig ortalaması
  homeWinRate: number;
  drawRate: number;
  awayWinRate: number;
}

export interface OddsData {
  home: number;
  draw: number;
  away: number;
  over25: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  // Asian handicap
  homeHandicap?: number;
  awayHandicap?: number;
  handicapLine?: number;
}

export interface H2HData {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  avgGoals: number;
  lastMeetings: MatchResult[];
  homeTeamScored: number;    // Ev sahibi gol attığı maç sayısı
  awayTeamScored: number;
}

// AI-Specific Data Packages
export interface TacticalDataPackage {
  homeForm: {
    momentum: number;        // -10 to +10
    formCurve: number[];     // Son 10 maç trend
    tacticalStyle: string;   // "defensive", "attacking", "balanced"
    pressureIndex: number;
    counterAttackRate: number;
  };
  awayForm: {
    momentum: number;
    formCurve: number[];
    tacticalStyle: string;
    pressureIndex: number;
    counterAttackRate: number;
  };
  matchContext: {
    importance: number;      // 1-10, şampiyonluk, küme düşme vs
    restDays: {
      home: number;
      away: number;
    };
    expectedFormation: {
      home: string;
      away: string;
    };
  };
}

export interface StatisticalDataPackage {
  xGData: {
    homeXG: number;
    awayXG: number;
    homeXGA: number;
    awayXGA: number;
    xGDiff: number;
  };
  historicalStats: {
    homeLast20: TeamStats;
    awayLast20: TeamStats;
    leagueAverages: TeamStats;
  };
  oddsAnalysis: {
    impliedProbHome: number;
    impliedProbDraw: number;
    impliedProbAway: number;
    valueHome: number;       // Edge hesabı
    valueDraw: number;
    valueAway: number;
    oddsMovement: 'stable' | 'drifting' | 'shortening';
  };
  poissonPrediction: {
    homeGoals: number;
    awayGoals: number;
    scoreMatrix: number[][];  // 0-5 x 0-5 olasılık matrisi
  };
}

export interface PatternDataPackage {
  h2h: H2HData;
  seasonalPatterns: {
    homeTeamMonthlyForm: Record<string, number>;
    awayTeamMonthlyForm: Record<string, number>;
    dayOfWeekStats: {
      home: Record<string, number>;
      away: Record<string, number>;
    };
  };
  leaguePatterns: {
    positionGap: number;
    topVsBottom: boolean;
    derbyMatch: boolean;
    rivalryLevel: number;    // 0-10
  };
  streakAnalysis: {
    homeCurrentStreak: string;   // "W3", "D1", "L2"
    awayCurrentStreak: string;
    homeStreakAgainstSimilar: string;
    awayStreakAgainstSimilar: string;
  };
}

export interface ContextualDataPackage {
  injuries: {
    home: PlayerInjury[];
    away: PlayerInjury[];
  };
  suspensions: {
    home: string[];
    away: string[];
  };
  news: NewsItem[];
  weather: {
    temperature: number;
    condition: string;
    windSpeed: number;
  };
  venueInfo: {
    capacity: number;
    attendance: number;
    homeAdvantage: number;   // Historical home advantage
  };
  managerInfo: {
    homeManager: string;
    awayManager: string;
    h2hManagers: string;     // Menajer H2H
  };
}

export interface PlayerInjury {
  name: string;
  position: string;
  type: string;
  expectedReturn: string;
  importance: number;        // 1-10, key player mı?
}

export interface NewsItem {
  title: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  team: 'home' | 'away' | 'both';
  date: string;
  source: string;
}

// AI Analysis Response Types
export interface AIPrediction {
  model: AIModel;
  role: AIRole;
  confidence: number;        // 0-100
  predictions: {
    matchResult: {
      prediction: '1' | 'X' | '2' | '1X' | '12' | 'X2';
      confidence: number;
      reasoning: string;
    };
    goals: {
      over25: boolean;
      over35: boolean;
      exactGoals: number;
      confidence: number;
      reasoning: string;
    };
    btts: {
      prediction: boolean;
      confidence: number;
      reasoning: string;
    };
    correctScore: {
      prediction: string;    // "2-1"
      confidence: number;
    };
  };
  keyInsights: string[];
  riskFactors: string[];
  valuePlay?: {
    market: string;
    odds: number;
    edge: number;
  };
  analysisTimestamp: string;
}

export interface ConsensusPrediction {
  matchId: number;
  predictions: AIPrediction[];
  consensus: {
    matchResult: {
      prediction: string;
      confidence: number;
      agreement: number;     // Kaç AI aynı fikirde (1-4)
    };
    goals: {
      over25: boolean;
      confidence: number;
      agreement: number;
    };
    btts: {
      prediction: boolean;
      confidence: number;
      agreement: number;
    };
    bestValue: {
      market: string;
      odds: number;
      combinedEdge: number;
    };
  };
  overallConfidence: number;
  conflictingViews: string[];
  unanimousInsights: string[];
  generatedAt: string;
}
