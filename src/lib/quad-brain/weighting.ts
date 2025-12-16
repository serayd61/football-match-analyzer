// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - DYNAMIC WEIGHTING
// Adaptive Weight Calculation Based on Data Quality & Model Performance
// ============================================================================

import {
  AIModel,
  BettingMarket,
  DataQualityScore,
  DynamicWeight,
  ModelPerformance,
  EnhancedMatchData
} from './types';

import {
  AI_MODEL_CONFIGS,
  MARKET_SPECIALISTS,
  WEIGHT_ADJUSTMENTS,
  getDefaultWeights,
  normalizeWeights
} from './config';

// =========================
// DATA QUALITY ASSESSMENT
// =========================

/**
 * Match verilerinden data quality score hesaplar
 */
export function assessDataQuality(matchData: EnhancedMatchData): DataQualityScore {
  const scores = {
    formData: 0,
    h2hData: 0,
    oddsData: 0,
    newsData: 0,
    xgData: 0
  };

  // Form Data Quality
  const homeFormMatches = matchData.homeForm?.matches?.length || 0;
  const awayFormMatches = matchData.awayForm?.matches?.length || 0;
  scores.formData = Math.min(100, (homeFormMatches + awayFormMatches) * 5);
  
  // Venue-specific form bonus
  if (matchData.homeForm?.venueForm && matchData.awayForm?.venueForm) {
    scores.formData = Math.min(100, scores.formData + 15);
  }

  // H2H Data Quality
  const h2hMatches = matchData.h2h?.totalMatches || 0;
  scores.h2hData = Math.min(100, h2hMatches * 10);
  if (h2hMatches >= 5) scores.h2hData = Math.min(100, scores.h2hData + 20);

  // Odds Data Quality
  if (matchData.odds?.matchWinner?.home) {
    scores.oddsData += 40;
  }
  if (matchData.odds?.overUnder?.['2.5']) {
    scores.oddsData += 30;
  }
  if (matchData.oddsHistory?.homeWin?.opening) {
    scores.oddsData += 30; // Oran hareketi verisi bonus
  }

  // News Data Quality
  if (matchData.newsContext) {
    const homeNews = matchData.newsContext.homeTeam.news?.length || 0;
    const awayNews = matchData.newsContext.awayTeam.news?.length || 0;
    const homeInjuries = matchData.newsContext.homeTeam.injuries?.length || 0;
    const awayInjuries = matchData.newsContext.awayTeam.injuries?.length || 0;
    
    scores.newsData = Math.min(100, (homeNews + awayNews) * 15 + (homeInjuries + awayInjuries) * 10);
  }

  // xG Data Quality (from detailedStats if available)
  if (matchData.detailedStats?.home?.xG || matchData.detailedStats?.away?.xG) {
    scores.xgData = 80;
  } else if (matchData.homeForm?.avgGoals && matchData.awayForm?.avgGoals) {
    scores.xgData = 50; // Simulated xG from goal averages
  }

  // Overall score
  const overall = Math.round(
    scores.formData * 0.30 +
    scores.h2hData * 0.20 +
    scores.oddsData * 0.25 +
    scores.newsData * 0.10 +
    scores.xgData * 0.15
  );

  // Flags
  const flags = {
    hasRichFormData: scores.formData >= 60,
    hasH2HHistory: scores.h2hData >= 40 && (matchData.h2h?.totalMatches || 0) >= 3,
    hasOddsMovement: !!matchData.oddsHistory?.homeWin?.opening,
    hasRecentNews: scores.newsData >= 30,
    hasXGData: scores.xgData >= 50,
    hasTacticalData: scores.formData >= 50 && !!matchData.homeForm?.venueForm,
    lowSampleSize: homeFormMatches < 5 || awayFormMatches < 5,
    significantAbsences: (
      (matchData.newsContext?.homeTeam.injuries?.some(i => i.status === 'out') || false) ||
      (matchData.newsContext?.awayTeam.injuries?.some(i => i.status === 'out') || false)
    )
  };

  return {
    overall,
    formData: scores.formData,
    h2hData: scores.h2hData,
    oddsData: scores.oddsData,
    newsData: scores.newsData,
    xgData: scores.xgData,
    flags
  };
}

// =========================
// DYNAMIC WEIGHT CALCULATION
// =========================

/**
 * Tüm modeller için dinamik ağırlıkları hesaplar
 */
export function calculateDynamicWeights(
  market: BettingMarket,
  dataQuality: DataQualityScore,
  modelPerformance?: Record<AIModel, ModelPerformance>
): DynamicWeight[] {
  const models: AIModel[] = ['claude', 'gpt4', 'gemini', 'perplexity'];
  const weights: DynamicWeight[] = [];

  // Market-specific base weights
  const marketWeights = MARKET_SPECIALISTS[market].weights;

  for (const model of models) {
    const config = AI_MODEL_CONFIGS[model];
    const baseWeight = marketWeights[model];
    
    const adjustments: { reason: string; amount: number }[] = [];
    let adjustedWeight = baseWeight;

    // 1. DATA QUALITY ADJUSTMENTS
    const qualityAdjustments = calculateQualityAdjustments(model, dataQuality);
    for (const adj of qualityAdjustments) {
      adjustments.push(adj);
      adjustedWeight += adj.amount;
    }

    // 2. CONDITION-BASED ADJUSTMENTS
    const conditionAdjustments = calculateConditionAdjustments(model, config, dataQuality);
    for (const adj of conditionAdjustments) {
      adjustments.push(adj);
      adjustedWeight += adj.amount;
    }

    // 3. HISTORICAL PERFORMANCE ADJUSTMENTS
    if (modelPerformance && modelPerformance[model]) {
      const perfAdjustments = calculatePerformanceAdjustments(model, market, modelPerformance[model]);
      for (const adj of perfAdjustments) {
        adjustments.push(adj);
        adjustedWeight += adj.amount;
      }
    }

    // Apply min/max bounds
    const finalWeight = Math.max(
      WEIGHT_ADJUSTMENTS.MIN_WEIGHT,
      Math.min(WEIGHT_ADJUSTMENTS.MAX_WEIGHT, adjustedWeight)
    );

    weights.push({
      model,
      baseWeight,
      adjustedWeight,
      adjustments,
      finalWeight
    });
  }

  // Normalize weights to sum to 1.0
  const totalWeight = weights.reduce((sum, w) => sum + w.finalWeight, 0);
  for (const w of weights) {
    w.finalWeight = w.finalWeight / totalWeight;
  }

  return weights;
}

/**
 * Veri kalitesine göre ağırlık ayarlamaları
 */
function calculateQualityAdjustments(
  model: AIModel,
  dataQuality: DataQualityScore
): { reason: string; amount: number }[] {
  const adjustments: { reason: string; amount: number }[] = [];

  switch (model) {
    case 'claude':
      // Claude için form verisi önemli
      if (dataQuality.flags.hasRichFormData && dataQuality.flags.hasTacticalData) {
        adjustments.push({
          reason: 'Rich tactical data available',
          amount: WEIGHT_ADJUSTMENTS.RICH_DATA_BOOST
        });
      } else if (dataQuality.formData < 40) {
        adjustments.push({
          reason: 'Insufficient form data for tactical analysis',
          amount: WEIGHT_ADJUSTMENTS.POOR_DATA_PENALTY
        });
      }
      break;

    case 'gpt4':
      // GPT-4 için istatistik ve odds verisi önemli
      if (dataQuality.flags.hasXGData && dataQuality.flags.hasOddsMovement) {
        adjustments.push({
          reason: 'xG and odds data available for statistical modeling',
          amount: WEIGHT_ADJUSTMENTS.RICH_DATA_BOOST
        });
      }
      if (dataQuality.flags.lowSampleSize) {
        adjustments.push({
          reason: 'Low sample size limits statistical reliability',
          amount: WEIGHT_ADJUSTMENTS.POOR_DATA_PENALTY
        });
      }
      break;

    case 'gemini':
      // Gemini için H2H verisi önemli
      if (dataQuality.flags.hasH2HHistory) {
        adjustments.push({
          reason: 'H2H history available for pattern recognition',
          amount: WEIGHT_ADJUSTMENTS.RICH_DATA_BOOST
        });
      } else if (dataQuality.h2hData < 20) {
        adjustments.push({
          reason: 'No H2H history - pattern analysis limited',
          amount: WEIGHT_ADJUSTMENTS.POOR_DATA_PENALTY * 1.5
        });
      }
      break;

    case 'perplexity':
      // Perplexity için haber verisi önemli
      if (dataQuality.flags.hasRecentNews || dataQuality.flags.significantAbsences) {
        adjustments.push({
          reason: 'Recent news/injuries affect match outcome',
          amount: WEIGHT_ADJUSTMENTS.RICH_DATA_BOOST * 1.5
        });
      } else if (dataQuality.newsData < 20) {
        adjustments.push({
          reason: 'No significant news - context limited',
          amount: WEIGHT_ADJUSTMENTS.POOR_DATA_PENALTY
        });
      }
      break;
  }

  return adjustments;
}

/**
 * Koşul bazlı ağırlık ayarlamaları (boost/penalty conditions from config)
 */
function calculateConditionAdjustments(
  model: AIModel,
  config: typeof AI_MODEL_CONFIGS.claude,
  dataQuality: DataQualityScore
): { reason: string; amount: number }[] {
  const adjustments: { reason: string; amount: number }[] = [];

  // Boost conditions
  for (const condition of config.boostConditions) {
    if (checkCondition(condition, dataQuality)) {
      adjustments.push({
        reason: `Boost: ${condition.replace(/_/g, ' ')}`,
        amount: WEIGHT_ADJUSTMENTS.CONDITION_BOOST
      });
    }
  }

  // Penalty conditions
  for (const condition of config.penaltyConditions) {
    if (checkCondition(condition, dataQuality)) {
      adjustments.push({
        reason: `Penalty: ${condition.replace(/_/g, ' ')}`,
        amount: WEIGHT_ADJUSTMENTS.CONDITION_PENALTY
      });
    }
  }

  return adjustments;
}

/**
 * Koşul kontrolü
 */
function checkCondition(condition: string, dataQuality: DataQualityScore): boolean {
  switch (condition) {
    // Boost conditions
    case 'form_data_rich':
      return dataQuality.flags.hasRichFormData;
    case 'tactical_matchup_relevant':
      return dataQuality.flags.hasTacticalData;
    case 'psychological_factors_present':
      return dataQuality.flags.significantAbsences; // Sakatlıklar psikolojik faktör
    case 'team_in_crisis_or_high_form':
      return dataQuality.formData >= 60; // Form verisi varsa anlayabiliriz
    case 'xg_data_available':
      return dataQuality.flags.hasXGData;
    case 'odds_movement_significant':
      return dataQuality.flags.hasOddsMovement;
    case 'large_sample_size':
      return !dataQuality.flags.lowSampleSize;
    case 'clear_statistical_edge':
      return dataQuality.oddsData >= 70;
    case 'h2h_data_available':
      return dataQuality.flags.hasH2HHistory;
    case 'recurring_pattern_detected':
      return dataQuality.h2hData >= 60;
    case 'seasonal_trend_present':
      return dataQuality.formData >= 50;
    case 'clear_streak_pattern':
      return dataQuality.formData >= 70;
    case 'recent_news_impact':
      return dataQuality.flags.hasRecentNews;
    case 'injury_uncertainty':
      return dataQuality.flags.significantAbsences;
    case 'manager_change':
      return dataQuality.newsData >= 50; // Haber verisi varsa fark edilir
    case 'significant_external_factors':
      return dataQuality.newsData >= 40;

    // Penalty conditions
    case 'insufficient_form_data':
      return dataQuality.formData < 40;
    case 'no_tactical_context':
      return !dataQuality.flags.hasTacticalData;
    case 'purely_statistical_decision':
      return dataQuality.formData < 30 && dataQuality.oddsData >= 60;
    case 'low_sample_size':
      return dataQuality.flags.lowSampleSize;
    case 'insufficient_odds_data':
      return dataQuality.oddsData < 30;
    case 'no_statistical_basis':
      return dataQuality.oddsData < 20 && dataQuality.formData < 30;
    case 'no_h2h_history':
      return !dataQuality.flags.hasH2HHistory;
    case 'first_meeting':
      return dataQuality.h2hData === 0;
    case 'insufficient_historical_data':
      return dataQuality.h2hData < 30;
    case 'news_irrelevant':
      return dataQuality.newsData < 20;
    case 'api_timeout':
      return false; // Runtime'da belirlenir
    case 'no_recent_news':
      return !dataQuality.flags.hasRecentNews;
    case 'stable_situation':
      return dataQuality.newsData < 30 && !dataQuality.flags.significantAbsences;

    default:
      return false;
  }
}

/**
 * Tarihsel performansa göre ağırlık ayarlamaları
 */
function calculatePerformanceAdjustments(
  model: AIModel,
  market: BettingMarket,
  performance: ModelPerformance
): { reason: string; amount: number }[] {
  const adjustments: { reason: string; amount: number }[] = [];

  const marketPerf = performance.byMarket[market];
  if (!marketPerf || marketPerf.totalPredictions < 10) {
    // Yeterli veri yok
    return adjustments;
  }

  // Accuracy-based adjustment
  if (marketPerf.accuracy >= 0.65) {
    adjustments.push({
      reason: `High historical accuracy (${Math.round(marketPerf.accuracy * 100)}%)`,
      amount: WEIGHT_ADJUSTMENTS.HIGH_ACCURACY_BOOST
    });
  } else if (marketPerf.accuracy < 0.50) {
    adjustments.push({
      reason: `Low historical accuracy (${Math.round(marketPerf.accuracy * 100)}%)`,
      amount: WEIGHT_ADJUSTMENTS.LOW_ACCURACY_PENALTY
    });
  }

  // Calibration-based adjustment
  if (performance.calibration.overconfident) {
    adjustments.push({
      reason: 'Model tends to be overconfident',
      amount: WEIGHT_ADJUSTMENTS.OVERCONFIDENT_PENALTY
    });
  } else if (performance.calibration.underconfident) {
    adjustments.push({
      reason: 'Model is well-calibrated/underconfident',
      amount: WEIGHT_ADJUSTMENTS.UNDERCONFIDENT_BOOST
    });
  }

  return adjustments;
}

// =========================
// WEIGHT APPLICATION
// =========================

/**
 * Ağırlıklı consensus hesaplar
 */
export function applyWeights<T extends { confidence: number }>(
  predictions: { model: AIModel; prediction: string; data: T }[],
  weights: DynamicWeight[]
): {
  prediction: string;
  confidence: number;
  weightedAgreement: number;
  votes: { model: AIModel; prediction: string; weight: number; confidence: number }[];
} {
  // Tahminleri grupla
  const groups: Record<string, {
    totalWeight: number;
    totalConfidence: number;
    models: AIModel[];
    count: number;
  }> = {};

  for (const pred of predictions) {
    const weight = weights.find(w => w.model === pred.model)?.finalWeight || 0.25;
    
    if (!groups[pred.prediction]) {
      groups[pred.prediction] = {
        totalWeight: 0,
        totalConfidence: 0,
        models: [],
        count: 0
      };
    }
    
    groups[pred.prediction].totalWeight += weight;
    groups[pred.prediction].totalConfidence += pred.data.confidence * weight;
    groups[pred.prediction].models.push(pred.model);
    groups[pred.prediction].count++;
  }

  // En yüksek ağırlıklı tahmini bul
  let winner = '';
  let maxWeight = 0;
  
  for (const [prediction, data] of Object.entries(groups)) {
    if (data.totalWeight > maxWeight) {
      maxWeight = data.totalWeight;
      winner = prediction;
    }
  }

  const winnerData = groups[winner];
  const avgConfidence = Math.round(winnerData.totalConfidence / winnerData.totalWeight);
  const weightedAgreement = Math.round(winnerData.totalWeight * 100);

  // Votes detayı
  const votes = predictions.map(pred => ({
    model: pred.model,
    prediction: pred.prediction,
    weight: weights.find(w => w.model === pred.model)?.finalWeight || 0.25,
    confidence: pred.data.confidence
  }));

  return {
    prediction: winner,
    confidence: avgConfidence,
    weightedAgreement,
    votes
  };
}

// =========================
// UTILITY FUNCTIONS
// =========================

/**
 * Debug için ağırlık özeti
 */
export function formatWeightsSummary(weights: DynamicWeight[]): string {
  let summary = '📊 Dynamic Weights:\n';
  
  for (const w of weights) {
    const arrow = w.finalWeight > w.baseWeight ? '↑' : 
                  w.finalWeight < w.baseWeight ? '↓' : '→';
    const change = ((w.finalWeight - w.baseWeight) * 100).toFixed(1);
    
    summary += `  ${w.model}: ${(w.baseWeight * 100).toFixed(0)}% → ${(w.finalWeight * 100).toFixed(0)}% ${arrow}\n`;
    
    if (w.adjustments.length > 0) {
      for (const adj of w.adjustments) {
        const sign = adj.amount >= 0 ? '+' : '';
        summary += `    ${sign}${(adj.amount * 100).toFixed(1)}%: ${adj.reason}\n`;
      }
    }
  }
  
  return summary;
}

/**
 * Data quality özeti
 */
export function formatDataQualitySummary(quality: DataQualityScore): string {
  let summary = `📈 Data Quality: ${quality.overall}/100\n`;
  summary += `  Form: ${quality.formData}/100\n`;
  summary += `  H2H: ${quality.h2hData}/100\n`;
  summary += `  Odds: ${quality.oddsData}/100\n`;
  summary += `  News: ${quality.newsData}/100\n`;
  summary += `  xG: ${quality.xgData}/100\n`;
  summary += `\n  Flags:\n`;
  
  for (const [flag, value] of Object.entries(quality.flags)) {
    summary += `    ${flag}: ${value ? '✓' : '✗'}\n`;
  }
  
  return summary;
}

// =========================
// EXPORTS
// =========================

export {
  checkCondition,
  calculateQualityAdjustments,
  calculateConditionAdjustments,
  calculatePerformanceAdjustments
};

