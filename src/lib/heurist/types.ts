// src/lib/heurist/types.ts

export type Language = 'tr' | 'en' | 'de';

export interface MatchData {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  date: string;
  odds?: OddsData;
  homeForm?: FormData;
  awayForm?: FormData;
  h2h?: H2HData;
  // 🆕 Detailed stats for agents (venue-specific, timing patterns, etc.)
  detailedStats?: {
    home?: any;
    away?: any;
  };
}

export interface OddsData {
  matchWinner?: { home?: number; draw?: number; away?: number };
  overUnder?: { '1.5'?: any; '2.5'?: any; '3.5'?: any };
  btts?: { yes?: number; no?: number };
  doubleChance?: { homeOrDraw?: number; awayOrDraw?: number; homeOrAway?: number };
  halfTime?: { home?: number; draw?: number; away?: number };
}

export interface FormData {
  form: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  avgGoals: string;
  avgConceded: string;
  over25Percentage: string;
  bttsPercentage: string;
  cleanSheetPercentage: string;
  matches: { opponent: string; score: string; result: string }[];
  // Venue-specific stats (ÖNEMLİ: Ev sahibi için EVDEKİ, deplasman için DEPLASMANDAKİ)
  venueAvgScored?: string;
  venueAvgConceded?: string;
}

export interface H2HData {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  avgGoals: string;
  over25Percentage: string;
  bttsPercentage: string;
  matches: { home: string; away: string; score: string }[];
}

// Agent Outputs
export interface ScoutReport {
  injuries: { team: string; player: string; status: string; impact: string }[];
  suspensions: { team: string; player: string; reason: string }[];
  news: { headline: string; impact: 'positive' | 'negative' | 'neutral'; team: string }[];
  lineupChanges: { team: string; change: string; impact: string }[];
  weather?: { condition: string; impact: string };
  summary: string;
}

export interface StatsReport {
  homeStrength: number; // 0-100
  awayStrength: number;
  formComparison: string;
  goalExpectancy: { home: number; away: number; total: number };
  keyStats: { stat: string; home: string; away: string; advantage: string }[];
  patterns: string[];
  summary: string;
}

export interface OddsReport {
  valuesBets: { market: string; selection: string; odds: number; fairOdds: number; value: number; confidence: number }[];
  oddsMovement: { market: string; direction: 'up' | 'down' | 'stable'; significance: string }[];
  bookmakerConsensus: { market: string; consensus: string; confidence: number }[];
  sharpMoney: { market: string; side: string; indicator: string }[];
  summary: string;
}

export interface StrategyReport {
  recommendedBets: {
    type: string;
    selection: string;
    confidence: number;
    stake: number; // 1-5 units
    reasoning: string;
    expectedValue: number;
  }[];
  riskAssessment: { level: 'low' | 'medium' | 'high'; factors: string[] };
  bankrollAdvice: string;
  avoidBets: { type: string; reason: string }[];
  summary: string;
}

export interface ConsensusReport {
  matchResult: { prediction: string; confidence: number; unanimous: boolean };
  overUnder25: { prediction: string; confidence: number; unanimous: boolean };
  btts: { prediction: string; confidence: number; unanimous: boolean };
  doubleChance: { prediction: string; confidence: number };
  halfTimeResult: { prediction: string; confidence: number };
  correctScore: { first: string; second: string; third: string };
  bestBet: { type: string; selection: string; confidence: number; stake: number; reasoning: string };
  riskLevel: 'low' | 'medium' | 'high';
  overallAnalysis: string;
  keyFactors: string[];
  warnings: string[];
}

export interface LiveBetSignal {
  fixtureId: number;
  minute: number;
  signal: 'BET_NOW' | 'WAIT' | 'AVOID';
  market: string;
  selection: string;
  odds: number;
  confidence: number;
  reasoning: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface ArbitrageOpportunity {
  fixtureId: number;
  match: string;
  market: string;
  bookmaker1: { name: string; selection: string; odds: number };
  bookmaker2: { name: string; selection: string; odds: number };
  profit: number; // percentage
  stake1: number;
  stake2: number;
  expires: string;
}

export interface LearningUpdate {
  date: string;
  predictions: number;
  correct: number;
  accuracy: number;
  profitLoss: number;
  bestPerforming: { market: string; accuracy: number }[];
  worstPerforming: { market: string; accuracy: number }[];
  leaguePerformance: { league: string; accuracy: number; profit: number }[];
  adjustments: string[];
}
