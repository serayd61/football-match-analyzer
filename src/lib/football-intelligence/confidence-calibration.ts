// ============================================================================
// CONFIDENCE CALIBRATION - TARİHSEL DOĞRULUK BAZLI GÜVEN KALİBRASYONU
// Geçmiş tahminlerin başarı oranına göre güven skorlarını ayarlar
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface HistoricalAccuracy {
  model: 'claude' | 'gpt4' | 'gemini' | 'perplexity' | 'deep_analysis' | 'stats' | 'odds' | 'sentiment' | 'strategy' | 'consensus';
  
  // Market bazlı doğruluk oranları
  matchResult: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    avgConfidence: number;
    calibrationError: number;  // Güven - Gerçek Doğruluk farkı
  };
  
  overUnder: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    avgConfidence: number;
    calibrationError: number;
  };
  
  btts: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    avgConfidence: number;
    calibrationError: number;
  };
  
  // Güven aralığı bazlı analiz
  confidenceBands: {
    range: string;  // "50-60", "60-70", "70-80", "80-90"
    predictions: number;
    correct: number;
    accuracy: number;
    isCalibrated: boolean;  // Güven ≈ Doğruluk mu?
  }[];
  
  // Lig bazlı performans
  leaguePerformance: {
    leagueId: string;
    leagueName: string;
    accuracy: number;
    predictions: number;
  }[];
  
  // Zaman bazlı trend
  recentTrend: 'improving' | 'stable' | 'declining';
  last7DaysAccuracy: number;
  last30DaysAccuracy: number;
}

export interface CalibrationAdjustment {
  // Orijinal güven
  originalConfidence: number;
  
  // Kalibre edilmiş güven
  calibratedConfidence: number;
  
  // Ayarlama nedeni
  adjustmentReason: string;
  
  // Model güvenilirliği
  modelReliability: 'high' | 'medium' | 'low' | 'insufficient_data';
  
  // Önerilen minimum maç sayısı
  suggestedMinConfidence: number;
}

// ============================================================================
// SUPABASE CLIENT (Lazy Load)
// ============================================================================

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      console.warn('Supabase credentials not available for confidence calibration');
      return null;
    }
    
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ============================================================================
// TARİHSEL VERİ ÇEKME
// ============================================================================

/**
 * Model için tarihsel doğruluk verisi çek
 */
export async function getHistoricalAccuracy(
  model: string,
  market?: 'match_result' | 'over_under' | 'btts',
  days: number = 90
): Promise<{
  accuracy: number;
  totalPredictions: number;
  avgConfidence: number;
  calibrationError: number;
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let query = supabase
      .from('prediction_records')
      .select('*')
      .eq('model_name', model)
      .eq('status', 'settled')
      .gte('created_at', startDate.toISOString());
    
    if (market) {
      query = query.eq('market', market);
    }
    
    const { data, error } = await query;
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    // Type assertion for Supabase data
    const predictions = data as { is_correct: boolean; confidence: number }[];
    
    const totalPredictions = predictions.length;
    const correctPredictions = predictions.filter(p => p.is_correct).length;
    const accuracy = (correctPredictions / totalPredictions) * 100;
    const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidence || 50), 0) / totalPredictions;
    const calibrationError = avgConfidence - accuracy;
    
    return {
      accuracy: parseFloat(accuracy.toFixed(1)),
      totalPredictions,
      avgConfidence: parseFloat(avgConfidence.toFixed(1)),
      calibrationError: parseFloat(calibrationError.toFixed(1)),
    };
  } catch (error) {
    console.error('Error fetching historical accuracy:', error);
    return null;
  }
}

/**
 * Güven aralığı bazlı doğruluk analizi
 */
export async function getConfidenceBandAccuracy(
  model: string,
  days: number = 90
): Promise<{
  band: string;
  predictions: number;
  correct: number;
  accuracy: number;
  isCalibrated: boolean;
}[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('prediction_records')
      .select('confidence, is_correct')
      .eq('model_name', model)
      .eq('status', 'settled')
      .gte('created_at', startDate.toISOString());
    
    if (error || !data) return [];
    
    // Type assertion for Supabase data
    const predictions = data as { confidence: number; is_correct: boolean }[];
    
    // Güven aralıklarına göre grupla
    const bands: { [key: string]: { predictions: number; correct: number } } = {
      '50-60': { predictions: 0, correct: 0 },
      '60-70': { predictions: 0, correct: 0 },
      '70-80': { predictions: 0, correct: 0 },
      '80-90': { predictions: 0, correct: 0 },
      '90-100': { predictions: 0, correct: 0 },
    };
    
    for (const prediction of predictions) {
      const conf = prediction.confidence || 50;
      let band: string;
      
      if (conf < 60) band = '50-60';
      else if (conf < 70) band = '60-70';
      else if (conf < 80) band = '70-80';
      else if (conf < 90) band = '80-90';
      else band = '90-100';
      
      bands[band].predictions++;
      if (prediction.is_correct) bands[band].correct++;
    }
    
    return Object.entries(bands).map(([band, stats]) => {
      const accuracy = stats.predictions > 0 ? (stats.correct / stats.predictions) * 100 : 0;
      const bandMidpoint = parseInt(band.split('-')[0]) + 5;  // 55, 65, 75, 85, 95
      const isCalibrated = Math.abs(accuracy - bandMidpoint) < 10;  // ±10% tolerans
      
      return {
        band,
        predictions: stats.predictions,
        correct: stats.correct,
        accuracy: parseFloat(accuracy.toFixed(1)),
        isCalibrated,
      };
    });
  } catch (error) {
    console.error('Error fetching confidence band accuracy:', error);
    return [];
  }
}

/**
 * Lig bazlı performans analizi
 */
export async function getLeaguePerformance(
  model: string,
  days: number = 90
): Promise<{
  leagueId: string;
  leagueName: string;
  accuracy: number;
  predictions: number;
}[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('prediction_records')
      .select('league_id, league_name, is_correct')
      .eq('model_name', model)
      .eq('status', 'settled')
      .gte('created_at', startDate.toISOString());
    
    if (error || !data) return [];
    
    // Type assertion for Supabase data
    const predictions = data as { league_id: string | number | null; league_name: string | null; is_correct: boolean }[];
    
    // Lig bazlı grupla
    const leagues: { [key: string]: { name: string; predictions: number; correct: number } } = {};
    
    for (const prediction of predictions) {
      const leagueId = prediction.league_id?.toString() || 'unknown';
      
      if (!leagues[leagueId]) {
        leagues[leagueId] = {
          name: prediction.league_name || 'Unknown',
          predictions: 0,
          correct: 0,
        };
      }
      
      leagues[leagueId].predictions++;
      if (prediction.is_correct) leagues[leagueId].correct++;
    }
    
    return Object.entries(leagues)
      .map(([leagueId, stats]) => ({
        leagueId,
        leagueName: stats.name,
        accuracy: stats.predictions > 0 ? parseFloat(((stats.correct / stats.predictions) * 100).toFixed(1)) : 0,
        predictions: stats.predictions,
      }))
      .filter(l => l.predictions >= 5)  // En az 5 tahmin
      .sort((a, b) => b.accuracy - a.accuracy);
  } catch (error) {
    console.error('Error fetching league performance:', error);
    return [];
  }
}

// ============================================================================
// KALİBRASYON HESAPLAMALARI
// ============================================================================

/**
 * Güven skorunu tarihsel veriye göre kalibre et
 */
export async function calibrateConfidence(
  model: string,
  market: 'match_result' | 'over_under' | 'btts',
  originalConfidence: number,
  leagueId?: string
): Promise<CalibrationAdjustment> {
  // Tarihsel veri çek
  const historicalData = await getHistoricalAccuracy(model, market, 90);
  const confidenceBands = await getConfidenceBandAccuracy(model, 90);
  
  let calibratedConfidence = originalConfidence;
  let adjustmentReason = '';
  let modelReliability: 'high' | 'medium' | 'low' | 'insufficient_data' = 'insufficient_data';
  let suggestedMinConfidence = 50;
  
  // Yeterli veri var mı kontrol et
  if (!historicalData || historicalData.totalPredictions < 20) {
    return {
      originalConfidence,
      calibratedConfidence: Math.min(originalConfidence, 65),  // Veri yoksa güveni düşür
      adjustmentReason: 'Yetersiz tarihsel veri. Güven sınırlandı.',
      modelReliability: 'insufficient_data',
      suggestedMinConfidence: 50,
    };
  }
  
  // Model güvenilirliğini belirle
  if (historicalData.accuracy >= 65 && historicalData.totalPredictions >= 100) {
    modelReliability = 'high';
  } else if (historicalData.accuracy >= 55 && historicalData.totalPredictions >= 50) {
    modelReliability = 'medium';
  } else {
    modelReliability = 'low';
  }
  
  // Kalibrasyon hatası analizi
  const calibrationError = historicalData.calibrationError;
  
  if (calibrationError > 10) {
    // Model aşırı güvenli (overconfident)
    // Güveni gerçek doğruluğa yaklaştır
    const reduction = Math.min(calibrationError * 0.6, 15);
    calibratedConfidence = originalConfidence - reduction;
    adjustmentReason = `Model aşırı güvenli (${calibrationError.toFixed(1)}% kalibrasyon hatası). Güven düşürüldü.`;
  } else if (calibrationError < -10) {
    // Model yetersiz güvenli (underconfident)
    const boost = Math.min(Math.abs(calibrationError) * 0.4, 10);
    calibratedConfidence = originalConfidence + boost;
    adjustmentReason = `Model yetersiz güvenli. Tarihsel veriye göre güven artırıldı.`;
  } else {
    // İyi kalibre edilmiş
    adjustmentReason = 'Model iyi kalibre edilmiş. Minimal ayarlama.';
  }
  
  // Güven aralığı bazlı inceleme
  const currentBand = confidenceBands.find(b => {
    const [min, max] = b.band.split('-').map(Number);
    return originalConfidence >= min && originalConfidence < max;
  });
  
  if (currentBand && currentBand.predictions >= 10) {
    // Bu güven aralığında gerçek doğruluk neymiş?
    const bandMidpoint = parseInt(currentBand.band.split('-')[0]) + 5;
    const actualAccuracy = currentBand.accuracy;
    
    if (actualAccuracy < bandMidpoint - 15) {
      // Bu aralıkta performans çok düşük
      calibratedConfidence = Math.min(calibratedConfidence, actualAccuracy + 5);
      adjustmentReason += ` ${currentBand.band}% aralığında gerçek doğruluk: ${actualAccuracy.toFixed(0)}%.`;
    }
  }
  
  // Sınırla
  calibratedConfidence = Math.max(45, Math.min(90, calibratedConfidence));
  
  // Önerilen minimum güven (bu modelin tutarlı olduğu en düşük güven)
  const calibratedBands = confidenceBands.filter(b => b.isCalibrated && b.predictions >= 10);
  if (calibratedBands.length > 0) {
    suggestedMinConfidence = parseInt(calibratedBands[0].band.split('-')[0]);
  }
  
  return {
    originalConfidence,
    calibratedConfidence: parseFloat(calibratedConfidence.toFixed(1)),
    adjustmentReason,
    modelReliability,
    suggestedMinConfidence,
  };
}

// ============================================================================
// ENSEMBLE KALİBRASYONU
// ============================================================================

/**
 * Birden fazla modelin tahminlerini tarihsel performansa göre ağırlıklandır
 */
export async function calibrateEnsemble(
  predictions: {
    model: string;
    prediction: string;
    confidence: number;
    market: 'match_result' | 'over_under' | 'btts';
  }[]
): Promise<{
  weightedPrediction: string;
  weightedConfidence: number;
  modelWeights: { model: string; weight: number; accuracy: number }[];
  reasoning: string;
}> {
  // Her model için tarihsel veri çek
  const modelData = await Promise.all(
    predictions.map(async (p) => {
      const historical = await getHistoricalAccuracy(p.model, p.market, 90);
      return {
        ...p,
        historical,
      };
    })
  );
  
  // Ağırlıkları hesapla (doğruluk bazlı)
  const totalAccuracy = modelData.reduce((sum, m) => {
    return sum + (m.historical?.accuracy || 50);
  }, 0);
  
  const modelWeights = modelData.map(m => ({
    model: m.model,
    weight: ((m.historical?.accuracy || 50) / totalAccuracy) * predictions.length,
    accuracy: m.historical?.accuracy || 50,
  }));
  
  // Tahminleri grupla ve ağırlıklandır
  const predictionVotes: { [key: string]: number } = {};
  let totalWeightedConfidence = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i].prediction;
    const weight = modelWeights[i].weight;
    const conf = predictions[i].confidence;
    
    predictionVotes[pred] = (predictionVotes[pred] || 0) + weight;
    totalWeightedConfidence += conf * weight;
    totalWeight += weight;
  }
  
  // En yüksek ağırlıklı tahmini bul
  let weightedPrediction = '';
  let maxVotes = 0;
  
  for (const [pred, votes] of Object.entries(predictionVotes)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      weightedPrediction = pred;
    }
  }
  
  const weightedConfidence = totalWeight > 0 ? totalWeightedConfidence / totalWeight : 50;
  
  // Reasoning oluştur
  const topModels = modelWeights
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 2)
    .map(m => `${m.model} (${m.accuracy.toFixed(0)}%)`);
  
  const reasoning = `En güvenilir modeller: ${topModels.join(', ')}. Ağırlıklı konsensüs: ${weightedPrediction}.`;
  
  return {
    weightedPrediction,
    weightedConfidence: parseFloat(weightedConfidence.toFixed(1)),
    modelWeights,
    reasoning,
  };
}

// ============================================================================
// RİSK DEĞERLENDİRME
// ============================================================================

/**
 * Tahmin risk seviyesini değerlendir
 */
export function assessPredictionRisk(
  calibratedConfidence: number,
  modelReliability: 'high' | 'medium' | 'low' | 'insufficient_data',
  marketType: 'match_result' | 'over_under' | 'btts',
  additionalFactors: {
    isHighStakes?: boolean;  // Derbi, şampiyonluk, küme düşme
    hasInjuryConcerns?: boolean;
    isUnpredictableLeague?: boolean;
    oddsValue?: number;  // Oran değeri (value bet analizi)
  }
): {
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskScore: number;  // 0-100
  recommendation: 'strong_bet' | 'normal_bet' | 'small_bet' | 'skip';
  stakeSuggestion: number;  // % of bankroll
  reasoning: string;
} {
  let riskScore = 50;  // Başlangıç
  const reasons: string[] = [];
  
  // Güven bazlı risk
  if (calibratedConfidence >= 75) {
    riskScore -= 20;
    reasons.push('Yüksek güven');
  } else if (calibratedConfidence >= 65) {
    riskScore -= 10;
  } else if (calibratedConfidence < 55) {
    riskScore += 15;
    reasons.push('Düşük güven');
  }
  
  // Model güvenilirliği
  switch (modelReliability) {
    case 'high':
      riskScore -= 15;
      reasons.push('Güvenilir model');
      break;
    case 'medium':
      riskScore -= 5;
      break;
    case 'low':
      riskScore += 15;
      reasons.push('Düşük güvenilirlik');
      break;
    case 'insufficient_data':
      riskScore += 25;
      reasons.push('Yetersiz veri');
      break;
  }
  
  // Market tipi bazlı risk
  if (marketType === 'match_result') {
    riskScore += 10;  // MS tahmin etmek daha zor
  }
  
  // Ek faktörler
  if (additionalFactors.isHighStakes) {
    riskScore += 15;
    reasons.push('Yüksek riskli maç');
  }
  if (additionalFactors.hasInjuryConcerns) {
    riskScore += 10;
    reasons.push('Sakatlık endişesi');
  }
  if (additionalFactors.isUnpredictableLeague) {
    riskScore += 10;
    reasons.push('Değişken lig');
  }
  if (additionalFactors.oddsValue && additionalFactors.oddsValue > 10) {
    riskScore -= 10;
    reasons.push('Value bet');
  }
  
  // Sınırla
  riskScore = Math.max(5, Math.min(95, riskScore));
  
  // Risk seviyesi
  let riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  let recommendation: 'strong_bet' | 'normal_bet' | 'small_bet' | 'skip';
  let stakeSuggestion: number;
  
  if (riskScore < 25) {
    riskLevel = 'very_low';
    recommendation = 'strong_bet';
    stakeSuggestion = 5;
  } else if (riskScore < 40) {
    riskLevel = 'low';
    recommendation = 'normal_bet';
    stakeSuggestion = 3;
  } else if (riskScore < 60) {
    riskLevel = 'medium';
    recommendation = 'normal_bet';
    stakeSuggestion = 2;
  } else if (riskScore < 80) {
    riskLevel = 'high';
    recommendation = 'small_bet';
    stakeSuggestion = 1;
  } else {
    riskLevel = 'very_high';
    recommendation = 'skip';
    stakeSuggestion = 0;
  }
  
  return {
    riskLevel,
    riskScore,
    recommendation,
    stakeSuggestion,
    reasoning: reasons.join('. ') + '.',
  };
}

// ============================================================================
// TYPES ARE EXPORTED AT THEIR DEFINITION
// ============================================================================

