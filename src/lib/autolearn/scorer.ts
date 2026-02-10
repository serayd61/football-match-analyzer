// ============================================================================
// AUTOLEARN AGENT - Scoring Engine
// Model parametreleriyle AutoLearn skoru hesaplar
// 5 katman birlestirilir: ConfCal, AgentCombo, LeagueSpec, MetaFeature, Temporal
// ============================================================================

import type { MarketFeatures } from './features';

// ============================================================================
// TYPES
// ============================================================================

export interface ModelEntry {
  model_type: string;
  market: string;
  feature_key: string;
  total_matches: number;
  correct_matches: number;
  accuracy: number;
  weight: number;
  metadata: Record<string, any>;
}

export interface ModelParameters {
  confidenceCal: ModelEntry[];
  agentCombo: ModelEntry[];
  leagueSpec: ModelEntry[];
  metaFeature: ModelEntry[];
  temporal: ModelEntry[];
}

export interface ScoreResult {
  market: string;
  prediction: string;
  originalConfidence: number;
  autoLearnScore: number;
  adjustedConfidence: number;
  patternMatch: string;
  patternsUsed: number;
  reliability: 'high' | 'medium' | 'low' | 'insufficient';
  insights: string[];
}

// ============================================================================
// KATMAN AGIRLIKLARI
// ============================================================================

const LAYER_WEIGHTS = {
  confidenceCal: 0.30,   // En onemli: bu confidence araligi gercekte ne kadar basarili?
  agentCombo: 0.25,       // Ajan kombinasyonlari ne kadar basarili?
  leagueSpec: 0.15,       // Bu ligde performans nasil?
  metaFeature: 0.20,      // Agreement, risk, quality nasil etkiliyor?
  temporal: 0.10           // Son zamanki trend nasil?
};

// ============================================================================
// MAIN SCORER
// ============================================================================

export function calculateAutoLearnScore(
  market: string,
  features: MarketFeatures,
  model: ModelParameters
): ScoreResult {
  const insights: string[] = [];
  let totalWeight = 0;
  let weightedScore = 0;
  let patternsUsed = 0;

  // =========================================================================
  // Katman 1: Confidence Calibration (%30)
  // =========================================================================
  const calScore = scoreConfidenceCalibration(market, features, model.confidenceCal);
  if (calScore !== null) {
    weightedScore += calScore.score * LAYER_WEIGHTS.confidenceCal;
    totalWeight += LAYER_WEIGHTS.confidenceCal;
    patternsUsed += calScore.matchCount;
    if (calScore.insight) insights.push(calScore.insight);
  }

  // =========================================================================
  // Katman 2: Agent Combinations (%25)
  // =========================================================================
  const comboScore = scoreAgentCombinations(market, features, model.agentCombo);
  if (comboScore !== null) {
    weightedScore += comboScore.score * LAYER_WEIGHTS.agentCombo;
    totalWeight += LAYER_WEIGHTS.agentCombo;
    patternsUsed += comboScore.matchCount;
    if (comboScore.insight) insights.push(comboScore.insight);
  }

  // =========================================================================
  // Katman 3: League Specialization (%15)
  // =========================================================================
  const leagueScore = scoreLeagueSpecialization(market, features, model.leagueSpec);
  if (leagueScore !== null) {
    weightedScore += leagueScore.score * LAYER_WEIGHTS.leagueSpec;
    totalWeight += LAYER_WEIGHTS.leagueSpec;
    patternsUsed += leagueScore.matchCount;
    if (leagueScore.insight) insights.push(leagueScore.insight);
  }

  // =========================================================================
  // Katman 4: Meta-Features (%20)
  // =========================================================================
  const metaScore = scoreMetaFeatures(market, features, model.metaFeature);
  if (metaScore !== null) {
    weightedScore += metaScore.score * LAYER_WEIGHTS.metaFeature;
    totalWeight += LAYER_WEIGHTS.metaFeature;
    patternsUsed += metaScore.matchCount;
    if (metaScore.insight) insights.push(metaScore.insight);
  }

  // =========================================================================
  // Katman 5: Temporal (%10)
  // =========================================================================
  const tempScore = scoreTemporalPatterns(market, model.temporal);
  if (tempScore !== null) {
    weightedScore += tempScore.score * LAYER_WEIGHTS.temporal;
    totalWeight += LAYER_WEIGHTS.temporal;
    patternsUsed += tempScore.matchCount;
    if (tempScore.insight) insights.push(tempScore.insight);
  }

  // =========================================================================
  // Final Skor Hesaplama
  // =========================================================================
  let autoLearnScore = features.confidence; // Default: original confidence
  let reliability: 'high' | 'medium' | 'low' | 'insufficient' = 'insufficient';

  if (totalWeight > 0) {
    // Normalize edilmis skor (0-100 arasi)
    const normalizedScore = weightedScore / totalWeight;

    // AutoLearn skoru: original confidence ile pattern-based skoru blend et
    // Pattern datasi arttikca pattern-based skor daha agir basar
    const blendFactor = Math.min(0.7, totalWeight); // Max %70 pattern, min %30 original
    autoLearnScore = Math.round(
      features.confidence * (1 - blendFactor) + normalizedScore * blendFactor
    );

    // Sinirla
    autoLearnScore = Math.max(30, Math.min(95, autoLearnScore));

    // Reliability
    if (patternsUsed >= 50 && totalWeight >= 0.5) reliability = 'high';
    else if (patternsUsed >= 20 && totalWeight >= 0.3) reliability = 'medium';
    else if (patternsUsed >= 5) reliability = 'low';
  }

  // Pattern match description
  let patternMatch = 'Yetersiz veri';
  if (reliability === 'high') patternMatch = `${patternsUsed} pattern eslesti - Yuksek guvenilirlik`;
  else if (reliability === 'medium') patternMatch = `${patternsUsed} pattern eslesti - Orta guvenilirlik`;
  else if (reliability === 'low') patternMatch = `${patternsUsed} pattern eslesti - Dusuk guvenilirlik`;

  return {
    market,
    prediction: features.prediction,
    originalConfidence: features.confidence,
    autoLearnScore,
    adjustedConfidence: autoLearnScore,
    patternMatch,
    patternsUsed,
    reliability,
    insights
  };
}

// ============================================================================
// KATMAN 1: Confidence Calibration
// ============================================================================

function scoreConfidenceCalibration(
  market: string,
  features: MarketFeatures,
  entries: ModelEntry[]
): { score: number; matchCount: number; insight: string | null } | null {
  // Bu confidence range + prediction icin gercek accuracy bul
  const key = `consensus|${features.confRange}|${features.prediction}`;
  const match = entries.find(e => e.market === market && e.feature_key === key);

  if (!match || match.total_matches < 3) return null;

  const insight = match.accuracy > features.confidence + 5
    ? `📈 Bu guven araligi (%${features.confRange}) gercekte %${match.accuracy} basarili (${match.total_matches} mac)`
    : match.accuracy < features.confidence - 5
    ? `📉 Bu guven araligi (%${features.confRange}) gercekte sadece %${match.accuracy} basarili (${match.total_matches} mac)`
    : null;

  return {
    score: match.accuracy,
    matchCount: match.total_matches,
    insight
  };
}

// ============================================================================
// KATMAN 2: Agent Combinations
// ============================================================================

function scoreAgentCombinations(
  market: string,
  features: MarketFeatures,
  entries: ModelEntry[]
): { score: number; matchCount: number; insight: string | null } | null {
  const scores: { score: number; weight: number; count: number }[] = [];

  // 1. Agreement pattern
  const agreeKey = `agree_${features.agentAgreement}|${features.agreeCount}of${features.totalAgents}`;
  const agreeMatch = entries.find(e => e.market === market && e.feature_key === agreeKey);
  if (agreeMatch && agreeMatch.total_matches >= 3) {
    scores.push({ score: agreeMatch.accuracy, weight: 2, count: agreeMatch.total_matches });
  }

  // 2. Spesifik ajan kombinasyonu
  if (features.agreeingAgents.length >= 2) {
    const comboName = features.agreeingAgents.sort().join('+');
    const comboKey = `agree|${comboName}`;
    const comboMatch = entries.find(e => e.market === market && e.feature_key === comboKey);
    if (comboMatch && comboMatch.total_matches >= 3) {
      scores.push({ score: comboMatch.accuracy, weight: 3, count: comboMatch.total_matches });
    }
  }

  // 3. Disagreeing ajanlar
  if (features.disagreeingAgents.length >= 1) {
    const disKey = `disagree|${features.disagreeingAgents.sort().join('+')}`;
    const disMatch = entries.find(e => e.market === market && e.feature_key === disKey);
    if (disMatch && disMatch.total_matches >= 3) {
      // Disagreeing pattern -> accuracy daha dusuk olabilir
      scores.push({ score: disMatch.accuracy, weight: 1, count: disMatch.total_matches });
    }
  }

  if (scores.length === 0) return null;

  // Weighted average
  let totalW = 0;
  let totalS = 0;
  let totalCount = 0;
  for (const s of scores) {
    totalW += s.weight;
    totalS += s.score * s.weight;
    totalCount += s.count;
  }

  const avgScore = totalS / totalW;

  let insight: string | null = null;
  if (features.agentAgreement === 'strong') {
    insight = `🤝 Guclu ajan mutabakati (${features.agreeCount}/${features.totalAgents}) - Bu pattern %${Math.round(avgScore)} basarili`;
  } else if (features.agentAgreement === 'weak') {
    insight = `⚠️ Zayif ajan mutabakati - Bu pattern %${Math.round(avgScore)} basarili`;
  }

  return { score: avgScore, matchCount: totalCount, insight };
}

// ============================================================================
// KATMAN 3: League Specialization
// ============================================================================

function scoreLeagueSpecialization(
  market: string,
  features: MarketFeatures,
  entries: ModelEntry[]
): { score: number; matchCount: number; insight: string | null } | null {
  const scores: { score: number; weight: number; count: number }[] = [];

  // 1. League + prediction
  const lpKey = `${features.league}|${features.prediction}`;
  const lpMatch = entries.find(e => e.market === market && e.feature_key === lpKey);
  if (lpMatch && lpMatch.total_matches >= 3) {
    scores.push({ score: lpMatch.accuracy, weight: 2, count: lpMatch.total_matches });
  }

  // 2. League + confidence range
  const lcKey = `${features.league}|${features.confRange}`;
  const lcMatch = entries.find(e => e.market === market && e.feature_key === lcKey);
  if (lcMatch && lcMatch.total_matches >= 3) {
    scores.push({ score: lcMatch.accuracy, weight: 1, count: lcMatch.total_matches });
  }

  if (scores.length === 0) return null;

  let totalW = 0;
  let totalS = 0;
  let totalCount = 0;
  for (const s of scores) {
    totalW += s.weight;
    totalS += s.score * s.weight;
    totalCount += s.count;
  }

  const avgScore = totalS / totalW;

  const insight = Math.abs(avgScore - features.confidence) > 10
    ? `🏟️ ${features.league} liginde bu tahmin %${Math.round(avgScore)} basarili (${totalCount} mac)`
    : null;

  return { score: avgScore, matchCount: totalCount, insight };
}

// ============================================================================
// KATMAN 4: Meta-Features
// ============================================================================

function scoreMetaFeatures(
  market: string,
  features: MarketFeatures,
  entries: ModelEntry[]
): { score: number; matchCount: number; insight: string | null } | null {
  const scores: { score: number; weight: number; count: number }[] = [];

  // 1. Agreement level
  const agreeBucket = features.agreement >= 80 ? 'high' : features.agreement >= 50 ? 'medium' : 'low';
  const agreeMatch = entries.find(e => e.market === market && e.feature_key === `agreement|${agreeBucket}`);
  if (agreeMatch && agreeMatch.total_matches >= 3) {
    scores.push({ score: agreeMatch.accuracy, weight: 2, count: agreeMatch.total_matches });
  }

  // 2. Risk level
  const riskMatch = entries.find(e => e.market === market && e.feature_key === `risk|${features.riskLevel}`);
  if (riskMatch && riskMatch.total_matches >= 3) {
    scores.push({ score: riskMatch.accuracy, weight: 1, count: riskMatch.total_matches });
  }

  // 3. Data quality
  const qualMatch = entries.find(e => e.market === market && e.feature_key === `quality|${features.dataQuality}`);
  if (qualMatch && qualMatch.total_matches >= 3) {
    scores.push({ score: qualMatch.accuracy, weight: 1, count: qualMatch.total_matches });
  }

  // 4. Overall confidence bucket
  const overallBucket = features.overallConfidence >= 70 ? 'high' : features.overallConfidence >= 55 ? 'medium' : 'low';
  const ocMatch = entries.find(e => e.market === market && e.feature_key === `overall_conf|${overallBucket}`);
  if (ocMatch && ocMatch.total_matches >= 3) {
    scores.push({ score: ocMatch.accuracy, weight: 1.5, count: ocMatch.total_matches });
  }

  // 5. Prediction + confidence combo
  const pcKey = `pred_conf|${features.prediction}|${features.confRange}`;
  const pcMatch = entries.find(e => e.market === market && e.feature_key === pcKey);
  if (pcMatch && pcMatch.total_matches >= 3) {
    scores.push({ score: pcMatch.accuracy, weight: 2, count: pcMatch.total_matches });
  }

  if (scores.length === 0) return null;

  let totalW = 0;
  let totalS = 0;
  let totalCount = 0;
  for (const s of scores) {
    totalW += s.weight;
    totalS += s.score * s.weight;
    totalCount += s.count;
  }

  const avgScore = totalS / totalW;

  let insight: string | null = null;
  if (agreeBucket === 'high' && avgScore > 60) {
    insight = `✅ Yuksek mutabakat + bu meta-pattern %${Math.round(avgScore)} basarili`;
  } else if (features.riskLevel === 'high' && avgScore < 50) {
    insight = `🚨 Yuksek risk seviyesi ile bu pattern sadece %${Math.round(avgScore)} basarili`;
  }

  return { score: avgScore, matchCount: totalCount, insight };
}

// ============================================================================
// KATMAN 5: Temporal Patterns
// ============================================================================

function scoreTemporalPatterns(
  market: string,
  entries: ModelEntry[]
): { score: number; matchCount: number; insight: string | null } | null {
  const recent20 = entries.find(e => e.market === market && e.feature_key === 'recent_20|accuracy');
  const recent50 = entries.find(e => e.market === market && e.feature_key === 'recent_50|accuracy');

  if (!recent20 && !recent50) return null;

  let score = 0;
  let totalCount = 0;
  let insight: string | null = null;

  if (recent20 && recent50) {
    // Agirlikli: son 20 mac daha onemli
    score = recent20.accuracy * 0.6 + recent50.accuracy * 0.4;
    totalCount = recent20.total_matches + recent50.total_matches;

    // Momentum analizi
    const diff = recent20.accuracy - recent50.accuracy;
    if (diff > 5) {
      insight = `📈 Sistem yukseliste! Son 20 mac: %${recent20.accuracy} vs Son 50: %${recent50.accuracy}`;
    } else if (diff < -5) {
      insight = `📉 Sistem dususte! Son 20 mac: %${recent20.accuracy} vs Son 50: %${recent50.accuracy}`;
    }
  } else if (recent20) {
    score = recent20.accuracy;
    totalCount = recent20.total_matches;
  } else if (recent50) {
    score = recent50.accuracy;
    totalCount = recent50.total_matches;
  }

  return { score, matchCount: totalCount, insight };
}
