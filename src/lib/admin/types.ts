// ============================================================================
// ADMIN PANEL - TYPE DEFINITIONS
// ============================================================================

export interface PredictionRecord {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  analysis_type: 'quad-brain' | 'agents' | 'ai-consensus';
  predictions: ModelPredictions;
  consensus: ConsensusPredictions;
  best_bets: BestBet[];
  risk_level: 'low' | 'medium' | 'high' | 'extreme';
  risk_factors: string[];
  data_quality_score: number;
  user_id?: string;
  status: 'pending' | 'settled' | 'cancelled';
  settled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelPredictions {
  claude?: ModelPrediction;
  gpt4?: ModelPrediction;
  gemini?: ModelPrediction;
  mistral?: ModelPrediction;
}

export interface ModelPrediction {
  matchResult: string;
  matchResultConfidence: number;
  over25: string;
  over25Confidence: number;
  btts: string;
  bttsConfidence: number;
  firstHalfGoals?: string;
  firstHalfGoalsConfidence?: number;
}

export interface ConsensusPredictions {
  matchResult: {
    prediction: string;
    confidence: number;
    agreement: number;
  };
  over25: {
    prediction: string;
    confidence: number;
    agreement: number;
  };
  btts: {
    prediction: string;
    confidence: number;
    agreement: number;
  };
  firstHalfGoals?: {
    prediction: string;
    confidence: number;
    agreement: number;
  };
}

export interface BestBet {
  rank: number;
  market: string;
  selection: string;
  confidence: number;
  reasoning: string;
}

export interface MatchResult {
  id: string;
  fixture_id: number;
  home_score: number;
  away_score: number;
  match_result: '1' | 'X' | '2';
  total_goals: number;
  btts: boolean;
  ht_home_score?: number;
  ht_away_score?: number;
  first_half_goals?: number;
  corners?: number;
  yellow_cards?: number;
  red_cards?: number;
  source: string;
  match_date: string;
  created_at: string;
}

export interface PredictionAccuracy {
  id: string;
  prediction_record_id: string;
  fixture_id: number;
  market: string;
  model_predictions: {
    [model: string]: {
      prediction: string;
      confidence: number;
      correct: boolean;
    };
  };
  consensus_prediction: string;
  consensus_confidence: number;
  actual_result: string;
  consensus_correct: boolean;
  analysis_type: string;
  settled_at: string;
}

export interface ModelPerformanceStats {
  id: string;
  model_name: string;
  market: string;
  period: '7d' | '30d' | '90d' | 'all';
  analysis_type: string;
  total_predictions: number;
  correct_predictions: number;
  accuracy_rate: number;
  avg_confidence: number;
  calibration_score: number;
  roi_percentage: number;
  period_start: string;
  period_end: string;
  updated_at: string;
}

export interface DailyPredictionSummary {
  id: string;
  date: string;
  total_predictions: number;
  settled_predictions: number;
  pending_predictions: number;
  match_result_accuracy?: number;
  over25_accuracy?: number;
  btts_accuracy?: number;
  overall_accuracy?: number;
  quad_brain_accuracy?: number;
  agents_accuracy?: number;
  ai_consensus_accuracy?: number;
  best_model?: string;
  best_model_accuracy?: number;
}

// API Request Types
export interface SavePredictionRequest {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  analysisType: 'quad-brain' | 'agents' | 'ai-consensus';
  predictions: ModelPredictions;
  consensus: ConsensusPredictions;
  bestBets?: BestBet[];
  riskLevel?: string;
  riskFactors?: string[];
  dataQualityScore?: number;
  userId?: string;
}

export interface SettlePredictionRequest {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  htHomeScore?: number;
  htAwayScore?: number;
  corners?: number;
  yellowCards?: number;
  redCards?: number;
}

export interface GetStatsRequest {
  period?: '7d' | '30d' | '90d' | 'all';
  analysisType?: 'quad-brain' | 'agents' | 'ai-consensus' | 'all';
  market?: string;
  model?: string;
}

// Dashboard Stats
export interface AdminDashboardStats {
  overview: {
    totalPredictions: number;
    pendingPredictions: number;
    settledPredictions: number;
    overallAccuracy: number;
    todayPredictions: number;
    todayAccuracy: number | null;
  };
  
  byAnalysisType: {
    type: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  
  byMarket: {
    market: string;
    total: number;
    correct: number;
    accuracy: number;
    byModel: {
      model: string;
      total: number;
      correct: number;
      accuracy: number;
    }[];
  }[];
  
  byModel: {
    model: string;
    total: number;
    correct: number;
    accuracy: number;
    avgConfidence: number;
    calibrationScore: number;
  }[];
  
  recentPredictions: PredictionRecord[];
  
  dailyTrend: {
    date: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
}

