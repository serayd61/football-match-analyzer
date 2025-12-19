// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - CONFIGURATION
// AI Model Configurations & Market-Specific Specialists
// ============================================================================

import { AIModel, AIModelConfig, BettingMarket } from './types';

// =========================
// AI MODEL CONFIGURATIONS
// =========================

export const AI_MODEL_CONFIGS: Record<AIModel, AIModelConfig> = {
  claude: {
    model: 'claude',
    role: 'tactical',
    displayName: 'Claude Tactical',
    baseWeight: 0.28,
    temperature: 0.3,
    maxTokens: 2500,
    specialization: 'Tactical Analysis - Momentum, playing styles, psychological factors, team dynamics',
    strengths: [
      'Momentum and form trajectory analysis',
      'Psychological edge detection',
      'Tactical matchup evaluation',
      'Nuanced reasoning with context',
      'Long-term pattern recognition'
    ],
    weaknesses: [
      'May overthink simple statistical patterns',
      'Less precise on pure mathematical calculations'
    ],
    boostConditions: [
      'form_data_rich',
      'tactical_matchup_relevant',
      'psychological_factors_present',
      'team_in_crisis_or_high_form'
    ],
    penaltyConditions: [
      'insufficient_form_data',
      'no_tactical_context',
      'purely_statistical_decision'
    ]
  },

  gpt4: {
    model: 'gpt4',
    role: 'statistical',
    displayName: 'GPT-4 Statistical',
    baseWeight: 0.30,
    temperature: 0.2,
    maxTokens: 2500,
    specialization: 'Statistical Engine - xG analysis, Poisson distribution, odds value calculation, mathematical modeling',
    strengths: [
      'Expected Goals (xG) calculations',
      'Poisson distribution modeling',
      'Odds value and edge detection',
      'Statistical pattern recognition',
      'Precise mathematical reasoning'
    ],
    weaknesses: [
      'May miss contextual factors',
      'Less intuitive on psychological aspects'
    ],
    boostConditions: [
      'xg_data_available',
      'odds_movement_significant',
      'large_sample_size',
      'clear_statistical_edge'
    ],
    penaltyConditions: [
      'low_sample_size',
      'insufficient_odds_data',
      'no_statistical_basis'
    ]
  },

  gemini: {
    model: 'gemini',
    role: 'pattern',
    displayName: 'Gemini Pattern',
    baseWeight: 0.25,
    temperature: 0.4,
    maxTokens: 2000,
    specialization: 'Pattern Recognition - H2H history, seasonal trends, streak analysis, anomaly detection',
    strengths: [
      'Head-to-head pattern detection',
      'Seasonal and cyclical trends',
      'Streak analysis and regression',
      'Anomaly detection',
      'Multi-source synthesis'
    ],
    weaknesses: [
      'Needs historical data to be effective',
      'May overfit to small H2H samples'
    ],
    boostConditions: [
      'h2h_data_available',
      'recurring_pattern_detected',
      'seasonal_trend_present',
      'clear_streak_pattern'
    ],
    penaltyConditions: [
      'no_h2h_history',
      'first_meeting',
      'insufficient_historical_data'
    ]
  },

  mistral: {
    model: 'mistral',
    role: 'contextual',
    displayName: 'Mistral Context',
    baseWeight: 0.17,
    temperature: 0.5,
    maxTokens: 1800,
    specialization: 'Contextual Analysis - Team dynamics, external factors, balanced perspective',
    strengths: [
      'Balanced analysis perspective',
      'Team dynamics assessment',
      'Injury impact evaluation',
      'Contextual reasoning',
      'Multi-factor synthesis'
    ],
    weaknesses: [
      'Less specialized than domain models',
      'May need more context for edge cases'
    ],
    boostConditions: [
      'recent_news_impact',
      'injury_uncertainty',
      'manager_change',
      'significant_external_factors'
    ],
    penaltyConditions: [
      'news_irrelevant',
      'api_timeout',
      'no_recent_news',
      'stable_situation'
    ]
  }
};

// =========================
// MARKET-SPECIFIC SPECIALISTS
// =========================

export interface MarketSpecialization {
  primary: AIModel;
  secondary: AIModel;
  weights: Record<AIModel, number>;
  description: string;
}

export const MARKET_SPECIALISTS: Record<BettingMarket, MarketSpecialization> = {
  MATCH_RESULT: {
    primary: 'claude',
    secondary: 'gemini',
    weights: {
      claude: 0.35,   // Momentum, psikoloji önemli
      gemini: 0.30,   // H2H patterns kritik
      gpt4: 0.25,     // İstatistiksel destek
      mistral: 0.10   // Context eklentisi
    },
    description: 'Match result requires tactical insight, H2H psychology, and momentum analysis'
  },

  OVER_UNDER_25: {
    primary: 'gpt4',
    secondary: 'claude',
    weights: {
      gpt4: 0.40,     // xG, Poisson en önemli
      claude: 0.30,   // Tactical style (attacking vs defensive)
      gemini: 0.20,   // H2H goal patterns
      mistral: 0.10   // Injury impact on goals
    },
    description: 'Over/Under relies heavily on statistical modeling and goal expectancy'
  },

  BTTS: {
    primary: 'gpt4',
    secondary: 'gemini',
    weights: {
      gpt4: 0.35,     // Scoring rates, clean sheet %
      gemini: 0.30,   // H2H BTTS patterns
      claude: 0.25,   // Defensive style analysis
      mistral: 0.10   // Defensive injuries
    },
    description: 'BTTS needs scoring/defensive stats plus historical patterns'
  },

  FIRST_HALF_GOALS: {
    primary: 'gemini',
    secondary: 'gpt4',
    weights: {
      gemini: 0.40,   // Timing patterns
      gpt4: 0.30,     // Half-time statistics
      claude: 0.20,   // Tactical approach (fast start vs slow build)
      mistral: 0.10   // Team news
    },
    description: 'First half goals depend on timing patterns and tactical approach'
  },

  CORNERS: {
    primary: 'gpt4',
    secondary: 'claude',
    weights: {
      gpt4: 0.40,     // Corner statistics
      claude: 0.35,   // Tactical style (wide play, crossing)
      gemini: 0.15,   // H2H corner patterns
      mistral: 0.10   // Weather, pitch conditions
    },
    description: 'Corners require statistical modeling plus tactical style analysis'
  },

  CARDS: {
    primary: 'gemini',
    secondary: 'mistral',
    weights: {
      gemini: 0.35,   // H2H discipline patterns
      mistral: 0.30,  // Referee info, rivalry context
      claude: 0.20,   // Match intensity, pressure situations
      gpt4: 0.15      // Historical card averages
    },
    description: 'Cards depend on rivalry intensity, referee, and historical discipline'
  }
};

// =========================
// CONFIDENCE THRESHOLDS
// =========================

export const CONFIDENCE_THRESHOLDS = {
  MINIMUM: 50,
  LOW: 55,
  MEDIUM: 65,
  HIGH: 75,
  VERY_HIGH: 85,
  MAXIMUM: 95
};

// =========================
// CONFLICT DETECTION
// =========================

export const CONFLICT_CONFIG = {
  // Conflict level thresholds
  MINOR_CONFLICT_THRESHOLD: 15,      // 15% confidence gap
  SIGNIFICANT_CONFLICT_THRESHOLD: 25, // 25% confidence gap
  MAJOR_CONFLICT_THRESHOLD: 35,       // 35% confidence gap

  // Debate trigger conditions
  TRIGGER_DEBATE_ON_SPLIT_VOTE: true,
  TRIGGER_DEBATE_ON_LOW_CONSENSUS: true,
  MIN_CONSENSUS_FOR_NO_DEBATE: 0.65,  // 65% weighted agreement

  // Arbitration
  DEFAULT_ARBITRATOR: 'claude' as AIModel,
  ARBITRATOR_WEIGHT_BOOST: 0.1  // Bonus weight to arbitrator
};

// =========================
// DYNAMIC WEIGHT ADJUSTMENTS
// =========================

export const WEIGHT_ADJUSTMENTS = {
  // Data quality impacts
  RICH_DATA_BOOST: 0.05,
  POOR_DATA_PENALTY: -0.08,

  // Historical performance impacts
  HIGH_ACCURACY_BOOST: 0.05,
  LOW_ACCURACY_PENALTY: -0.05,

  // Condition-based adjustments
  CONDITION_BOOST: 0.03,
  CONDITION_PENALTY: -0.03,

  // Confidence calibration
  OVERCONFIDENT_PENALTY: -0.05,
  UNDERCONFIDENT_BOOST: 0.03,

  // Minimum and maximum weights
  MIN_WEIGHT: 0.05,
  MAX_WEIGHT: 0.50
};

// =========================
// PROMPT TEMPLATES
// =========================

export const PROMPT_LANGUAGE = {
  tr: {
    tactical: 'taktik analiz',
    statistical: 'istatistiksel analiz',
    pattern: 'pattern analizi',
    contextual: 'bağlamsal analiz',
    confidence: 'güven',
    reasoning: 'gerekçe',
    prediction: 'tahmin'
  },
  en: {
    tactical: 'tactical analysis',
    statistical: 'statistical analysis',
    pattern: 'pattern analysis',
    contextual: 'contextual analysis',
    confidence: 'confidence',
    reasoning: 'reasoning',
    prediction: 'prediction'
  },
  de: {
    tactical: 'taktische Analyse',
    statistical: 'statistische Analyse',
    pattern: 'Musteranalyse',
    contextual: 'Kontextanalyse',
    confidence: 'Konfidenz',
    reasoning: 'Begründung',
    prediction: 'Vorhersage'
  }
};

// =========================
// API ENDPOINTS
// =========================

export const API_ENDPOINTS = {
  ANTHROPIC: 'https://api.anthropic.com/v1/messages',
  OPENAI: 'https://api.openai.com/v1/chat/completions',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  OPENROUTER: 'https://openrouter.ai/api/v1/chat/completions'
};

// =========================
// MODEL VERSIONS
// =========================

export const MODEL_VERSIONS = {
  claude: 'claude-3-5-haiku-20241022', // En ucuz Claude modeli
  gpt4: 'gpt-4o-mini', // En ucuz GPT-4 modeli
  gemini: 'gemini-2.0-flash', // En ucuz Gemini modeli
  mistral: 'mistralai/mistral-small' // En ucuz Mistral modeli
};

// =========================
// CACHE CONFIG
// =========================

export const CACHE_CONFIG = {
  ANALYSIS_TTL_MINUTES: 30,
  NEWS_TTL_MINUTES: 15,
  PERFORMANCE_TTL_MINUTES: 60
};

// =========================
// HELPER FUNCTIONS
// =========================

export function getModelConfig(model: AIModel): AIModelConfig {
  return AI_MODEL_CONFIGS[model];
}

export function getMarketWeights(market: BettingMarket): Record<AIModel, number> {
  return MARKET_SPECIALISTS[market].weights;
}

export function getDefaultWeights(): Record<AIModel, number> {
  return {
    claude: AI_MODEL_CONFIGS.claude.baseWeight,
    gpt4: AI_MODEL_CONFIGS.gpt4.baseWeight,
    gemini: AI_MODEL_CONFIGS.gemini.baseWeight,
    mistral: AI_MODEL_CONFIGS.mistral.baseWeight
  };
}

export function normalizeWeights(weights: Record<AIModel, number>): Record<AIModel, number> {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const normalized: Record<AIModel, number> = {} as Record<AIModel, number>;
  
  for (const [model, weight] of Object.entries(weights)) {
    normalized[model as AIModel] = weight / total;
  }
  
  return normalized;
}

