// ============================================================================
// ADVANCED AGENT WEIGHTING SYSTEM (MDAW)
// Multi-Dimensional Adaptive Weighting - TypeScript Implementation
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

// ============================================================================
// TYPES
// ============================================================================

export interface AgentPerformanceData {
  agent_name: string;
  league: string | null;
  total_matches: number;
  correct_predictions: number;
  recent_match_result_accuracy: number;
  recent_over_under_accuracy: number;
  recent_btts_accuracy: number;
  recent_5_accuracy: number;
  calibration_score: number;
  roi_score: number;
  performance_score: number;
  momentum_factor: number;
  maturity_ratio: number;
  current_weight: number;
  market_accuracies: {
    matchResult: number;
    overUnder: number;
    btts: number;
  };
}

export interface AdvancedWeight {
  agent_name: string;
  weight: number;
  performanceScore: number;
  performanceMultiplier: number;
  specializationBonus: number;
  momentumFactor: number;
  calibrationFactor: number;
  minWeight: number;
  maxWeight: number;
  matchCount: number;
  breakdown: {
    accuracy: number;
    calibration: number;
    roi: number;
  };
}

export type MarketType = 'matchResult' | 'overUnder' | 'btts';

// ============================================================================
// MDAW FORMULA COMPONENTS
// ============================================================================

/**
 * Performance Score hesapla (0-100 arası)
 * Formula: (0.4 × AccuracyScore) + (0.3 × CalibrationScore) + (0.3 × ROIScore)
 */
export function calculatePerformanceScore(
  accuracy: number,
  calibration: number,
  roi: number
): number {
  const score = (0.4 * (accuracy || 50)) + (0.3 * (calibration || 50)) + (0.3 * (roi || 50));
  return Math.max(0, Math.min(100, score));
}

/**
 * Performance Multiplier hesapla (dinamik aralık)
 * Performance Score'a göre 0.2x - 3.5x arası
 */
export function calculatePerformanceMultiplier(performanceScore: number): number {
  let baseMult: number;
  let rangeMult: number;

  if (performanceScore >= 75) {
    // Elit: 2.5x - 3.5x
    baseMult = 2.5;
    rangeMult = ((performanceScore - 75) / 25) * 1.0;
  } else if (performanceScore >= 65) {
    // Çok İyi: 1.8x - 2.5x
    baseMult = 1.8;
    rangeMult = ((performanceScore - 65) / 10) * 0.7;
  } else if (performanceScore >= 55) {
    // İyi: 1.2x - 1.8x
    baseMult = 1.2;
    rangeMult = ((performanceScore - 55) / 10) * 0.6;
  } else if (performanceScore >= 45) {
    // Ortalama: 0.8x - 1.2x
    baseMult = 0.8;
    rangeMult = ((performanceScore - 45) / 10) * 0.4;
  } else if (performanceScore >= 35) {
    // Zayıf: 0.4x - 0.8x
    baseMult = 0.4;
    rangeMult = ((performanceScore - 35) / 10) * 0.4;
  } else {
    // Çok Zayıf: 0.2x - 0.4x
    baseMult = 0.2;
    rangeMult = (performanceScore / 35) * 0.2;
  }

  return baseMult + rangeMult;
}

/**
 * Specialization Bonus hesapla
 * Formula: 1.0 + (LeagueExpertise × 0.3) + (MarketExpertise × 0.2)
 */
export function calculateSpecializationBonus(
  leagueAccuracy: number,
  globalAccuracy: number,
  marketAccuracy: number
): number {
  // League expertise: (league_accuracy - global_accuracy) / 10
  const leagueExpertise = Math.max(-2, Math.min(2, 
    ((leagueAccuracy || globalAccuracy) - (globalAccuracy || 50)) / 10
  ));

  // Market expertise: (market_accuracy - global_accuracy) / 10
  const marketExpertise = Math.max(-2, Math.min(2, 
    ((marketAccuracy || globalAccuracy) - (globalAccuracy || 50)) / 10
  ));

  // Final bonus: 1.0 + (league × 0.3) + (market × 0.2)
  const bonus = 1.0 + (leagueExpertise * 0.3) + (marketExpertise * 0.2);
  return Math.max(0.5, Math.min(2.0, bonus));
}

/**
 * Momentum Factor hesapla
 * Formula: 1.0 + ((RecentAccuracy - HistoricalAccuracy) / 50)
 * Sınırlar: 0.7x - 1.3x
 */
export function calculateMomentumFactor(
  recentAccuracy: number,
  historicalAccuracy: number
): number {
  const momentum = 1.0 + (((recentAccuracy || 50) - (historicalAccuracy || 50)) / 50);
  return Math.max(0.7, Math.min(1.3, momentum));
}

/**
 * Confidence Calibration Factor hesapla
 * Agent'ın verdiği confidence ile gerçek hit rate arasındaki uyum
 */
export function calculateCalibrationFactor(
  avgConfidence: number,
  actualHitRate: number
): number {
  const calibrationError = Math.abs((avgConfidence || 50) - (actualHitRate || 50));

  if (calibrationError < 5) return 1.1;
  if (calibrationError < 10) return 1.0;
  if (calibrationError < 20) return 0.9;
  return 0.8;
}

/**
 * Dinamik ağırlık aralığı hesapla (maturity'ye göre)
 * MinMatches = 10, MaxMatches = 100
 */
export function calculateWeightBounds(matchCount: number): { minWeight: number; maxWeight: number } {
  // Maturity ratio: 0 (yeni) - 1 (deneyimli)
  const maturityRatio = Math.min(1.0, Math.max(0, (matchCount - 10) / 90));

  // MinWeight: 0.5 → 0.2 (maturity arttıkça düşer - daha agresif cezalandırma)
  const minWeight = 0.5 - (maturityRatio * 0.3);

  // MaxWeight: 2.0 → 3.5 (maturity arttıkça artar - daha yüksek ödül)
  const maxWeight = 2.0 + (maturityRatio * 1.5);

  return { minWeight, maxWeight };
}

/**
 * Calibration Score hesapla
 * Formula: 100 - (|predicted_confidence - actual_hit_rate| × 2)
 */
export function calculateCalibrationScore(
  avgConfidence: number,
  actualHitRate: number
): number {
  const error = Math.abs((avgConfidence || 50) - (actualHitRate || 50));
  return Math.max(0, Math.min(100, 100 - (error * 2)));
}

// ============================================================================
// MAIN ADVANCED WEIGHT CALCULATION
// ============================================================================

/**
 * Ana gelişmiş ağırlık hesaplama fonksiyonu (MDAW)
 * Formula: BaseWeight × PerformanceMultiplier × SpecializationBonus × MomentumFactor × CalibrationFactor
 */
export async function calculateAdvancedWeight(
  agentName: string,
  league?: string | null,
  market: MarketType = 'matchResult'
): Promise<AdvancedWeight> {
  try {
    const supabase = getSupabase();

    // Agent performans verisini al
    let query = (supabase.from('agent_performance') as any)
      .select('*')
      .eq('agent_name', agentName);

    if (league) {
      query = query.eq('league', league);
    } else {
      query = query.is('league', null);
    }

    const { data: perfData, error } = await query.maybeSingle();

    if (error || !perfData) {
      console.warn(`⚠️ No performance data for ${agentName}, using defaults`);
      return getDefaultAdvancedWeight(agentName);
    }

    const perf = perfData as AgentPerformanceData;

    // Global accuracy (tüm ligler için)
    const { data: globalData } = await (supabase.from('agent_performance') as any)
      .select('recent_match_result_accuracy')
      .eq('agent_name', agentName);

    const globalAccuracy = globalData && globalData.length > 0
      ? globalData.reduce((sum: number, r: any) => sum + (r.recent_match_result_accuracy || 50), 0) / globalData.length
      : 50;

    // Market accuracy
    const marketAccuracy = market === 'matchResult' 
      ? perf.recent_match_result_accuracy
      : market === 'overUnder'
        ? perf.recent_over_under_accuracy
        : perf.recent_btts_accuracy;

    // Average confidence (son tahminlerden)
    const { data: confidenceData } = await (supabase.from('agent_predictions') as any)
      .select('match_result_confidence, predicted_confidence')
      .eq('agent_name', agentName)
      .not('settled_at', 'is', null)
      .order('settled_at', { ascending: false })
      .limit(30);

    const avgConfidence = confidenceData && confidenceData.length > 0
      ? confidenceData.reduce((sum: number, r: any) => 
          sum + (r.predicted_confidence || r.match_result_confidence || 50), 0) / confidenceData.length
      : 50;

    // 1. Performance Score
    const accuracy = perf.recent_match_result_accuracy || 50;
    const calibration = perf.calibration_score || calculateCalibrationScore(avgConfidence, accuracy);
    const roi = perf.roi_score || accuracy; // ROI şimdilik accuracy ile aynı

    const performanceScore = calculatePerformanceScore(accuracy, calibration, roi);

    // 2. Performance Multiplier
    const performanceMultiplier = calculatePerformanceMultiplier(performanceScore);

    // 3. Specialization Bonus
    const specializationBonus = calculateSpecializationBonus(
      accuracy,
      globalAccuracy,
      marketAccuracy || accuracy
    );

    // 4. Momentum Factor
    const recent5Accuracy = perf.recent_5_accuracy || accuracy;
    const momentumFactor = calculateMomentumFactor(recent5Accuracy, accuracy);

    // 5. Calibration Factor
    const calibrationFactor = calculateCalibrationFactor(avgConfidence, accuracy);

    // 6. Dinamik ağırlık aralığı
    const { minWeight, maxWeight } = calculateWeightBounds(perf.total_matches || 0);

    // 7. Final Weight hesapla
    // Formula: BaseWeight × PerformanceMultiplier × SpecializationBonus × MomentumFactor × CalibrationFactor
    let finalWeight = 1.0 * performanceMultiplier * specializationBonus * momentumFactor * calibrationFactor;

    // Sınırları uygula
    finalWeight = Math.max(minWeight, Math.min(maxWeight, finalWeight));

    console.log(`📊 MDAW Weight for ${agentName} (${league || 'global'}, ${market}):`);
    console.log(`   Performance Score: ${performanceScore.toFixed(1)} → Multiplier: ${performanceMultiplier.toFixed(2)}x`);
    console.log(`   Specialization: ${specializationBonus.toFixed(2)}x | Momentum: ${momentumFactor.toFixed(2)}x | Calibration: ${calibrationFactor.toFixed(2)}x`);
    console.log(`   Final Weight: ${finalWeight.toFixed(2)}x (bounds: ${minWeight.toFixed(2)} - ${maxWeight.toFixed(2)})`);

    return {
      agent_name: agentName,
      weight: Math.round(finalWeight * 100) / 100,
      performanceScore,
      performanceMultiplier,
      specializationBonus,
      momentumFactor,
      calibrationFactor,
      minWeight,
      maxWeight,
      matchCount: perf.total_matches || 0,
      breakdown: {
        accuracy,
        calibration,
        roi,
      },
    };
  } catch (error) {
    console.error(`❌ Error calculating advanced weight for ${agentName}:`, error);
    return getDefaultAdvancedWeight(agentName);
  }
}

/**
 * Default ağırlık (veri yoksa)
 */
function getDefaultAdvancedWeight(agentName: string): AdvancedWeight {
  return {
    agent_name: agentName,
    weight: 1.0,
    performanceScore: 50,
    performanceMultiplier: 1.0,
    specializationBonus: 1.0,
    momentumFactor: 1.0,
    calibrationFactor: 1.0,
    minWeight: 0.5,
    maxWeight: 2.0,
    matchCount: 0,
    breakdown: {
      accuracy: 50,
      calibration: 50,
      roi: 50,
    },
  };
}

// ============================================================================
// BATCH WEIGHT RETRIEVAL
// ============================================================================

/**
 * Tüm agent'ların gelişmiş ağırlıklarını getir
 */
export async function getAdvancedAgentWeights(
  league?: string | null,
  market: MarketType = 'matchResult'
): Promise<Record<string, AdvancedWeight>> {
  const agents = ['stats', 'odds', 'deepAnalysis', 'masterStrategist', 'devilsAdvocate', 'geniusAnalyst'];
  const weights: Record<string, AdvancedWeight> = {};

  // Paralel olarak tüm agent'ların ağırlıklarını hesapla
  const results = await Promise.all(
    agents.map(agent => calculateAdvancedWeight(agent, league, market))
  );

  results.forEach(result => {
    weights[result.agent_name] = result;
  });

  return weights;
}

/**
 * Basit ağırlık map'i döndür (mevcut sistemle uyumluluk için)
 */
export async function getAdvancedWeightsSimple(
  league?: string | null,
  market: MarketType = 'matchResult'
): Promise<Record<string, number>> {
  const advancedWeights = await getAdvancedAgentWeights(league, market);
  const simpleWeights: Record<string, number> = {};

  Object.entries(advancedWeights).forEach(([agent, data]) => {
    simpleWeights[agent] = data.weight;
  });

  return simpleWeights;
}

// ============================================================================
// MARKET-SPECIFIC WEIGHTS
// ============================================================================

/**
 * Her market için ayrı ağırlıklar getir
 */
export async function getMarketSpecificWeights(
  league?: string | null
): Promise<{
  matchResult: Record<string, number>;
  overUnder: Record<string, number>;
  btts: Record<string, number>;
}> {
  const [mrWeights, ouWeights, bttsWeights] = await Promise.all([
    getAdvancedWeightsSimple(league, 'matchResult'),
    getAdvancedWeightsSimple(league, 'overUnder'),
    getAdvancedWeightsSimple(league, 'btts'),
  ]);

  return {
    matchResult: mrWeights,
    overUnder: ouWeights,
    btts: bttsWeights,
  };
}

// ============================================================================
// PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Agent performans analizi (debug/dashboard için)
 */
export async function analyzeAgentPerformance(
  agentName: string,
  league?: string | null
): Promise<{
  current: AdvancedWeight;
  history: any[];
  recommendations: string[];
}> {
  const current = await calculateAdvancedWeight(agentName, league);
  const supabase = getSupabase();

  // Ağırlık geçmişini al
  let query = (supabase.from('agent_performance') as any)
    .select('weight_history')
    .eq('agent_name', agentName);

  if (league) {
    query = query.eq('league', league);
  }

  const { data } = await query.maybeSingle();
  const history = data?.weight_history || [];

  // Öneriler oluştur
  const recommendations: string[] = [];

  if (current.performanceScore < 45) {
    recommendations.push('⚠️ Performans düşük. Bu agent\'ın tahminlerine dikkat edin.');
  }

  if (current.calibrationFactor < 0.9) {
    recommendations.push('📊 Overconfident tahminler yapıyor. Confidence değerlerini düşürmeyi düşünün.');
  }

  if (current.momentumFactor > 1.2) {
    recommendations.push('🔥 Son maçlarda iyi performans! Ağırlığı artırılabilir.');
  } else if (current.momentumFactor < 0.8) {
    recommendations.push('📉 Son maçlarda düşüş var. Dikkatli olun.');
  }

  if (current.matchCount < 20) {
    recommendations.push('📈 Daha fazla veri gerekli. Ağırlık henüz tam güvenilir değil.');
  }

  return {
    current,
    history,
    recommendations,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  getSupabase,
};
