// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - TYPE DEFINITIONS
// 4 AI Model Consensus Architecture for Football Predictions
// ============================================================================

// =========================
// AI MODEL TYPES
// =========================

export type AIModel = 'claude' | 'gpt4' | 'gemini' | 'mistral';

export type AIRole = 
  | 'tactical'      // Claude - Taktik analizi, momentum, psikoloji
  | 'statistical'   // GPT-4 - İstatistik motoru, xG, Poisson
  | 'pattern'       // Gemini - Pattern recognition, H2H
  | 'contextual';   // Perplexity - Real-time context, haberler

export type BettingMarket = 
  | 'MATCH_RESULT'
  | 'OVER_UNDER_25'
  | 'BTTS'
  | 'FIRST_HALF_GOALS'
  | 'CORNERS'
  | 'CARDS';

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme';

// =========================
// AI MODEL CONFIGURATION
// =========================

export interface AIModelConfig {
  model: AIModel;
  role: AIRole;
  displayName: string;
  baseWeight: number;           // 0-1 arası temel ağırlık
  temperature: number;          // Yaratıcılık seviyesi
  maxTokens: number;
  specialization: string;       // Uzmanlık alanı
  strengths: string[];          // Güçlü yönler
  weaknesses: string[];         // Zayıf yönler
  boostConditions: string[];    // Ağırlık artırma koşulları
  penaltyConditions: string[];  // Ağırlık azaltma koşulları
}

// =========================
// DATA QUALITY
// =========================

export interface DataQualityScore {
  overall: number;              // 0-100
  formData: number;             // 0-100 - Form verisi kalitesi
  h2hData: number;              // 0-100 - H2H verisi kalitesi
  oddsData: number;             // 0-100 - Oran verisi kalitesi
  newsData: number;             // 0-100 - Haber verisi kalitesi
  xgData: number;               // 0-100 - xG verisi kalitesi
  
  flags: {
    hasRichFormData: boolean;
    hasH2HHistory: boolean;
    hasOddsMovement: boolean;
    hasRecentNews: boolean;
    hasXGData: boolean;
    hasTacticalData: boolean;
    lowSampleSize: boolean;
    significantAbsences: boolean;
  };
}

// =========================
// INDIVIDUAL AI PREDICTION
// =========================

export interface MarketPrediction {
  prediction: string;           // "Over 2.5", "1", "Yes", etc.
  confidence: number;           // 50-95
  reasoning: string;            // Detaylı açıklama
  keyFactors: string[];         // Ana faktörler
  riskFactors: string[];        // Risk faktörleri
}

export interface AIPrediction {
  model: AIModel;
  role: AIRole;
  timestamp: string;
  
  predictions: {
    matchResult: MarketPrediction;
    overUnder25: MarketPrediction;
    btts: MarketPrediction;
    firstHalfGoals?: MarketPrediction;
    corners?: MarketPrediction;
    correctScore?: {
      prediction: string;
      confidence: number;
      alternatives: string[];
    };
  };
  
  // Model-specific insights
  specializedInsights: {
    // Claude tactical insights
    momentum?: {
      home: number;
      away: number;
      trend: 'rising' | 'stable' | 'falling';
    };
    tacticalAdvantage?: 'home' | 'away' | 'neutral';
    psychologicalEdge?: string;
    
    // GPT-4 statistical insights
    xgPrediction?: {
      homeXG: number;
      awayXG: number;
      totalXG: number;
    };
    poissonScores?: { score: string; probability: number }[];
    valueBets?: {
      market: string;
      selection: string;
      fairOdds: number;
      edge: number;
    }[];
    
    // Gemini pattern insights
    h2hPattern?: string;
    streakAnalysis?: string;
    regressionRisk?: string;
    anomalyDetected?: boolean;
    
    // Perplexity context insights
    recentNews?: string[];
    confirmedInjuries?: string[];
    expertConsensus?: string;
    lastMinuteFactors?: string[];
  };
  
  overallAnalysis: string;
  confidenceLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  
  // Meta
  responseTime: number;         // ms
  tokensUsed?: number;
  rawResponse?: string;         // Debug için
}

// =========================
// CONFLICT & DEBATE
// =========================

export interface ConflictAnalysis {
  hasConflict: boolean;
  conflictLevel: 'none' | 'minor' | 'significant' | 'major';
  
  conflicts: {
    market: BettingMarket;
    predictions: {
      model: AIModel;
      prediction: string;
      confidence: number;
    }[];
    confidenceGap: number;
    variance: number;
  }[];
  
  triggerDebate: boolean;
  debateReason?: string;
}

export interface DebateInput {
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    fixtureId: number;
  };
  market: BettingMarket;
  predictions: {
    model: AIModel;
    prediction: string;
    confidence: number;
    reasoning: string;
    keyFactors: string[];
  }[];
  dataQuality: DataQualityScore;
}

export interface DebateResult {
  market: BettingMarket;
  arbitrator: AIModel;
  
  originalConflict: {
    predictions: { model: AIModel; prediction: string }[];
    confidenceGap: number;
  };
  
  resolution: {
    finalPrediction: string;
    finalConfidence: number;
    reasoning: string;
    weightAdjustments: { model: AIModel; adjustment: number }[];
    winningArguments: string[];
    dismissedArguments: string[];
  };
  
  debateTimestamp: string;
  debateDuration: number;
}

// =========================
// WEIGHTED CONSENSUS
// =========================

export interface DynamicWeight {
  model: AIModel;
  baseWeight: number;
  adjustedWeight: number;
  adjustments: {
    reason: string;
    amount: number;
  }[];
  finalWeight: number;
}

export interface ConsensusResult {
  market: BettingMarket;
  
  prediction: string;
  confidence: number;
  
  votes: {
    model: AIModel;
    prediction: string;
    confidence: number;
    weight: number;
  }[];
  
  agreement: {
    unanimous: boolean;
    majoritySize: number;
    totalModels: number;
    weightedAgreement: number;  // 0-100
  };
  
  reasoning: string[];
  
  // Debate sonucu (varsa)
  debateResult?: DebateResult;
}

// =========================
// PERFORMANCE TRACKING
// =========================

export interface PredictionRecord {
  id: string;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  
  predictions: {
    model: AIModel;
    market: BettingMarket;
    prediction: string;
    confidence: number;
    weight: number;
  }[];
  
  consensus: {
    market: BettingMarket;
    prediction: string;
    confidence: number;
    hadDebate: boolean;
  }[];
  
  // Maç sonucu (sonradan doldurulur)
  actualResults?: {
    matchResult: string;        // "1", "X", "2"
    totalGoals: number;
    btts: boolean;
    firstHalfGoals: number;
    corners?: number;
    score: string;              // "2-1"
  };
  
  // Doğruluk analizi (sonradan doldurulur)
  accuracy?: {
    modelResults: {
      model: AIModel;
      market: BettingMarket;
      correct: boolean;
    }[];
    consensusResults: {
      market: BettingMarket;
      correct: boolean;
    }[];
  };
  
  createdAt: string;
  settledAt?: string;
}

export interface ModelPerformance {
  model: AIModel;
  period: '7d' | '30d' | '90d' | 'all';
  
  overall: {
    totalPredictions: number;
    correct: number;
    accuracy: number;
    roi: number;
  };
  
  byMarket: {
    [market in BettingMarket]?: {
      totalPredictions: number;
      correct: number;
      accuracy: number;
      avgConfidence: number;
      calibrationScore: number;  // 1.0 = perfect
      roi: number;
    };
  };
  
  // Confidence calibration
  calibration: {
    overconfident: boolean;
    underconfident: boolean;
    calibrationAdjustment: number;  // Multiply confidence by this
  };
  
  lastUpdated: string;
}

// =========================
// QUAD-BRAIN RESULT
// =========================

export interface QuadBrainResult {
  success: boolean;
  
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    fixtureId: number;
    matchDate?: string;
  };
  
  // Veri kalitesi
  dataQuality: DataQualityScore;
  
  // Bireysel AI tahminleri
  individualPredictions: {
    claude?: AIPrediction;
    gpt4?: AIPrediction;
    gemini?: AIPrediction;
    perplexity?: AIPrediction;
  };
  
  // Conflict analizi
  conflictAnalysis: ConflictAnalysis;
  
  // Debate sonuçları (varsa)
  debates: DebateResult[];
  
  // Dinamik ağırlıklar
  dynamicWeights: DynamicWeight[];
  
  // Final consensus
  consensus: {
    matchResult: ConsensusResult;
    overUnder25: ConsensusResult;
    btts: ConsensusResult;
    firstHalfGoals?: ConsensusResult;
    corners?: ConsensusResult;
  };
  
  // En iyi bahisler
  bestBets: {
    rank: number;
    market: BettingMarket;
    selection: string;
    confidence: number;
    weightedAgreement: number;
    consensusStrength: 'strong' | 'moderate' | 'weak';
    reasoning: string;
    valueBet: boolean;
    edge?: number;
  }[];
  
  // Risk değerlendirmesi
  riskAssessment: {
    overall: RiskLevel;
    factors: string[];
    warnings: string[];
  };
  
  // Meta
  modelsUsed: AIModel[];
  totalModels: number;
  timing: {
    dataFetch: number;
    aiCalls: number;
    conflictDetection: number;
    debate?: number;
    consensus: number;
    total: number;
  };
  
  analyzedAt: string;
  version: string;
}

// =========================
// REAL-TIME NEWS
// =========================

export interface NewsContext {
  homeTeam: {
    injuries: {
      player: string;
      position: string;
      status: 'out' | 'doubtful' | 'questionable';
      source: string;
    }[];
    news: {
      headline: string;
      summary: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      impact: 'high' | 'medium' | 'low';
      source: string;
      publishedAt: string;
    }[];
    managerQuotes?: string[];
  };
  
  awayTeam: {
    injuries: {
      player: string;
      position: string;
      status: 'out' | 'doubtful' | 'questionable';
      source: string;
    }[];
    news: {
      headline: string;
      summary: string;
      sentiment: 'positive' | 'negative' | 'neutral';
      impact: 'high' | 'medium' | 'low';
      source: string;
      publishedAt: string;
    }[];
    managerQuotes?: string[];
  };
  
  matchPreview: {
    expertPredictions: string[];
    keyBattles: string[];
    weatherConditions?: {
      temperature: number;
      condition: string;
      impact: string;
    };
  };
  
  fetchedAt: string;
  sources: string[];
}

// =========================
// MATCH DATA (Enhanced)
// =========================

export interface EnhancedMatchData {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  league: string;
  leagueId?: number;
  matchDate?: string;
  
  // Form verileri
  homeForm: {
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
    venueForm?: string;
    venueAvgScored?: string;
    venueAvgConceded?: string;
    venueOver25Pct?: string;
    venueBttsPct?: string;
    matches?: any[];
    record?: string;
    matchCount?: number;
  };
  
  awayForm: {
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
    venueForm?: string;
    venueAvgScored?: string;
    venueAvgConceded?: string;
    venueOver25Pct?: string;
    venueBttsPct?: string;
    matches?: any[];
    record?: string;
    matchCount?: number;
  };
  
  // H2H verileri
  h2h?: {
    totalMatches: number;
    homeWins: number;
    awayWins: number;
    draws: number;
    avgGoals?: string;
    over25Percentage?: string;
    bttsPercentage?: string;
    recentMatches?: any[];
  };
  
  // Oran verileri
  odds?: {
    matchWinner?: {
      home: number;
      draw: number;
      away: number;
    };
    overUnder?: {
      '2.5'?: { over: number; under: number };
    };
    btts?: {
      yes: number;
      no: number;
    };
  };
  
  // Oran hareketleri
  oddsHistory?: {
    homeWin?: { opening: number; current: number };
    draw?: { opening: number; current: number };
    awayWin?: { opening: number; current: number };
    over25?: { opening: number; current: number };
  };
  
  // Real-time context
  newsContext?: NewsContext;
  
  // Detaylı istatistikler
  detailedStats?: {
    home?: any;
    away?: any;
    h2h?: any;
    injuries?: any;
  };
}

// =========================
// API RESPONSE
// =========================

export interface QuadBrainAPIResponse {
  success: boolean;
  result?: QuadBrainResult;
  error?: string;
  cached?: boolean;
  cachedAt?: string;
}

