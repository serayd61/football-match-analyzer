// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - PERFORMANCE TRACKING
// Historical Accuracy Tracking & Model Calibration
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AIModel,
  BettingMarket,
  PredictionRecord,
  ModelPerformance,
  ConsensusResult
} from './types';

// =========================
// SUPABASE CLIENT (Lazy Initialization)
// =========================

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Supabase credentials not found - tracking disabled');
    return null;
  }
  
  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
}

// =========================
// TABLE NAMES
// =========================

const TABLES = {
  PREDICTIONS: 'quad_brain_predictions',
  MODEL_PERFORMANCE: 'quad_brain_model_performance',
  DAILY_STATS: 'quad_brain_daily_stats'
};

// =========================
// PREDICTION RECORDING
// =========================

/**
 * Yeni bir tahmin kaydeder
 */
export async function recordPrediction(record: Omit<PredictionRecord, 'id' | 'createdAt'>): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from(TABLES.PREDICTIONS)
      .upsert({
        fixture_id: record.fixtureId,
        home_team: record.homeTeam,
        away_team: record.awayTeam,
        league: record.league,
        match_date: record.matchDate,
        predictions: record.predictions,
        consensus: record.consensus,
        created_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error recording prediction:', error);
      return null;
    }

    console.log(`✅ Prediction recorded/updated: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('❌ Error recording prediction:', error);
    return null;
  }
}

/**
 * Maç sonucunu günceller ve doğruluk hesaplar
 */
export async function settlePrediction(
  fixtureId: number,
  actualResults: PredictionRecord['actualResults']
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !actualResults) return false;

  try {
    // Mevcut prediction'ı bul
    const { data: prediction, error: fetchError } = await supabase
      .from(TABLES.PREDICTIONS)
      .select('*')
      .eq('fixture_id', fixtureId)
      .single();

    if (fetchError || !prediction) {
      console.error('❌ Prediction not found for fixture:', fixtureId);
      return false;
    }

    // Doğruluk hesapla
    const accuracy = calculateAccuracy(prediction, actualResults);

    // Güncelle
    const { error: updateError } = await supabase
      .from(TABLES.PREDICTIONS)
      .update({
        actual_results: actualResults,
        accuracy: accuracy,
        settled_at: new Date().toISOString()
      })
      .eq('fixture_id', fixtureId);

    if (updateError) {
      console.error('❌ Error settling prediction:', updateError);
      return false;
    }

    // Model performanslarını güncelle
    await updateModelPerformance(prediction, accuracy);

    console.log(`✅ Prediction settled: fixture ${fixtureId}`);
    return true;
  } catch (error) {
    console.error('❌ Error settling prediction:', error);
    return false;
  }
}

/**
 * Tahmin doğruluğunu hesaplar
 */
function calculateAccuracy(
  prediction: any,
  actualResults: PredictionRecord['actualResults']
): PredictionRecord['accuracy'] {
  if (!actualResults) return undefined;

  const modelResults: {
    model: AIModel;
    market: BettingMarket;
    correct: boolean;
  }[] = [];

  const consensusResults: {
    market: BettingMarket;
    correct: boolean;
  }[] = [];

  // Her model için doğruluk hesapla
  for (const pred of prediction.predictions || []) {
    const market = pred.market as BettingMarket;
    const isCorrect = checkPredictionCorrect(pred.prediction, market, actualResults);
    
    modelResults.push({
      model: pred.model as AIModel,
      market,
      correct: isCorrect
    });
  }

  // Consensus için doğruluk hesapla
  for (const cons of prediction.consensus || []) {
    const market = cons.market as BettingMarket;
    const isCorrect = checkPredictionCorrect(cons.prediction, market, actualResults);
    
    consensusResults.push({
      market,
      correct: isCorrect
    });
  }

  return { modelResults, consensusResults };
}

/**
 * Tek bir tahminin doğruluğunu kontrol eder
 */
function checkPredictionCorrect(
  prediction: string,
  market: BettingMarket,
  actualResults: NonNullable<PredictionRecord['actualResults']>
): boolean {
  const upper = prediction.toUpperCase();

  switch (market) {
    case 'MATCH_RESULT':
      if (upper.includes('HOME') || upper === '1') {
        return actualResults.matchResult === '1';
      }
      if (upper.includes('AWAY') || upper === '2') {
        return actualResults.matchResult === '2';
      }
      if (upper.includes('DRAW') || upper === 'X') {
        return actualResults.matchResult === 'X';
      }
      return false;

    case 'OVER_UNDER_25':
      if (upper.includes('OVER')) {
        return actualResults.totalGoals > 2.5;
      }
      if (upper.includes('UNDER')) {
        return actualResults.totalGoals < 2.5;
      }
      return false;

    case 'BTTS':
      if (upper.includes('YES') || upper === 'EVET') {
        return actualResults.btts === true;
      }
      if (upper.includes('NO') || upper === 'HAYIR') {
        return actualResults.btts === false;
      }
      return false;

    case 'FIRST_HALF_GOALS':
      if (upper.includes('OVER')) {
        const threshold = parseFloat(upper.match(/\d+\.?\d*/)?.[0] || '0.5');
        return actualResults.firstHalfGoals > threshold;
      }
      if (upper.includes('UNDER')) {
        const threshold = parseFloat(upper.match(/\d+\.?\d*/)?.[0] || '0.5');
        return actualResults.firstHalfGoals < threshold;
      }
      return false;

    default:
      return false;
  }
}

// =========================
// MODEL PERFORMANCE
// =========================

/**
 * Model performanslarını günceller
 */
async function updateModelPerformance(
  prediction: any,
  accuracy: PredictionRecord['accuracy']
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !accuracy) return;

  const models: AIModel[] = ['claude', 'gpt4', 'gemini', 'mistral'];
  const markets: BettingMarket[] = ['MATCH_RESULT', 'OVER_UNDER_25', 'BTTS'];

  for (const model of models) {
    for (const market of markets) {
      const result = accuracy.modelResults.find(
        r => r.model === model && r.market === market
      );
      
      if (!result) continue;

      // Mevcut performansı al veya oluştur
      const { data: existing } = await supabase
        .from(TABLES.MODEL_PERFORMANCE)
        .select('*')
        .eq('model', model)
        .eq('market', market)
        .single();

      if (existing) {
        // Güncelle
        await supabase
          .from(TABLES.MODEL_PERFORMANCE)
          .update({
            total_predictions: existing.total_predictions + 1,
            correct_predictions: existing.correct_predictions + (result.correct ? 1 : 0),
            accuracy: (existing.correct_predictions + (result.correct ? 1 : 0)) / 
                     (existing.total_predictions + 1),
            last_updated: new Date().toISOString()
          })
          .eq('model', model)
          .eq('market', market);
      } else {
        // Yeni kayıt oluştur
        await supabase
          .from(TABLES.MODEL_PERFORMANCE)
          .insert({
            model,
            market,
            total_predictions: 1,
            correct_predictions: result.correct ? 1 : 0,
            accuracy: result.correct ? 1 : 0,
            last_updated: new Date().toISOString()
          });
      }
    }
  }
}

/**
 * Model performansını getirir
 */
export async function getModelPerformance(
  model: AIModel,
  period: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<ModelPerformance | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  
  try {
    let dateFilter: Date | null = null;
    
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - days);
    }

    // Tüm market performanslarını al
    let query = supabase
      .from(TABLES.PREDICTIONS)
      .select('*')
      .not('accuracy', 'is', null);

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.toISOString());
    }

    const { data: predictions, error } = await query;

    if (error || !predictions) {
      console.error('❌ Error fetching performance:', error);
      return null;
    }

    // Performans hesapla
    const byMarket: ModelPerformance['byMarket'] = {};
    const markets: BettingMarket[] = ['MATCH_RESULT', 'OVER_UNDER_25', 'BTTS'];

    let totalPredictions = 0;
    let totalCorrect = 0;
    let totalConfidence = 0;

    for (const market of markets) {
      let marketTotal = 0;
      let marketCorrect = 0;
      let marketConfidenceSum = 0;

      for (const pred of predictions) {
        const modelResult = pred.accuracy?.modelResults?.find(
          (r: any) => r.model === model && r.market === market
        );

        if (modelResult) {
          marketTotal++;
          totalPredictions++;
          
          if (modelResult.correct) {
            marketCorrect++;
            totalCorrect++;
          }

          // Confidence bul
          const predData = pred.predictions?.find(
            (p: any) => p.model === model && p.market === market
          );
          if (predData) {
            marketConfidenceSum += predData.confidence;
            totalConfidence += predData.confidence;
          }
        }
      }

      if (marketTotal > 0) {
        byMarket[market] = {
          totalPredictions: marketTotal,
          correct: marketCorrect,
          accuracy: marketCorrect / marketTotal,
          avgConfidence: marketConfidenceSum / marketTotal,
          calibrationScore: calculateCalibrationScore(marketCorrect / marketTotal, marketConfidenceSum / marketTotal),
          roi: calculateROI(predictions, model, market)
        };
      }
    }

    // Calibration analizi
    const avgAccuracy = totalPredictions > 0 ? totalCorrect / totalPredictions : 0.5;
    const avgConfidenceValue = totalPredictions > 0 ? totalConfidence / totalPredictions : 50;
    
    const calibration = {
      overconfident: avgConfidenceValue > avgAccuracy * 100 + 10,
      underconfident: avgConfidenceValue < avgAccuracy * 100 - 10,
      calibrationAdjustment: avgAccuracy * 100 / avgConfidenceValue
    };

    return {
      model,
      period,
      overall: {
        totalPredictions,
        correct: totalCorrect,
        accuracy: avgAccuracy,
        roi: calculateOverallROI(predictions, model)
      },
      byMarket,
      calibration,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error getting model performance:', error);
    return null;
  }
}

/**
 * Tüm modellerin performansını getirir
 */
export async function getAllModelPerformance(
  period: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<Record<AIModel, ModelPerformance> | null> {
  const models: AIModel[] = ['claude', 'gpt4', 'gemini', 'mistral'];
  const results: Partial<Record<AIModel, ModelPerformance>> = {};

  for (const model of models) {
    const performance = await getModelPerformance(model, period);
    if (performance) {
      results[model] = performance;
    }
  }

  // En az bir model verisi varsa döndür
  if (Object.keys(results).length > 0) {
    return results as Record<AIModel, ModelPerformance>;
  }

  return null;
}

// =========================
// CALIBRATION & ROI
// =========================

/**
 * Calibration score hesaplar (1.0 = perfect)
 */
function calculateCalibrationScore(accuracy: number, avgConfidence: number): number {
  const expectedAccuracy = avgConfidence / 100;
  const diff = Math.abs(accuracy - expectedAccuracy);
  
  // 0 fark = 1.0 score, 0.5 fark = 0 score
  return Math.max(0, 1 - diff * 2);
}

/**
 * Market bazlı ROI hesaplar
 */
function calculateROI(predictions: any[], model: AIModel, market: BettingMarket): number {
  let totalStake = 0;
  let totalReturn = 0;
  
  const avgOdds = 1.9; // Ortalama bahis oranı varsayımı

  for (const pred of predictions) {
    const modelResult = pred.accuracy?.modelResults?.find(
      (r: any) => r.model === model && r.market === market
    );

    if (modelResult) {
      totalStake += 1; // 1 birim stake
      if (modelResult.correct) {
        totalReturn += avgOdds;
      }
    }
  }

  if (totalStake === 0) return 0;
  
  return ((totalReturn - totalStake) / totalStake) * 100;
}

/**
 * Genel ROI hesaplar
 */
function calculateOverallROI(predictions: any[], model: AIModel): number {
  const markets: BettingMarket[] = ['MATCH_RESULT', 'OVER_UNDER_25', 'BTTS'];
  let totalROI = 0;
  let marketCount = 0;

  for (const market of markets) {
    const roi = calculateROI(predictions, model, market);
    if (roi !== 0) {
      totalROI += roi;
      marketCount++;
    }
  }

  return marketCount > 0 ? totalROI / marketCount : 0;
}

// =========================
// STATISTICS & REPORTS
// =========================

/**
 * Günlük istatistikleri hesaplar
 */
export async function getDailyStats(date?: Date): Promise<{
  date: string;
  totalPredictions: number;
  settledPredictions: number;
  overallAccuracy: number;
  byModel: Record<AIModel, { accuracy: number; predictions: number }>;
  byMarket: Record<BettingMarket, { accuracy: number; predictions: number }>;
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  
  try {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: predictions, error } = await supabase
      .from(TABLES.PREDICTIONS)
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    if (error) {
      console.error('❌ Error fetching daily stats:', error);
      return null;
    }

    const settled = predictions?.filter(p => p.accuracy) || [];
    
    const models: AIModel[] = ['claude', 'gpt4', 'gemini', 'mistral'];
    const markets: BettingMarket[] = ['MATCH_RESULT', 'OVER_UNDER_25', 'BTTS'];

    const byModel: Record<AIModel, { accuracy: number; predictions: number }> = {} as any;
    const byMarket: Record<BettingMarket, { accuracy: number; predictions: number }> = {} as any;

    let totalCorrect = 0;
    let totalCount = 0;

    for (const model of models) {
      let correct = 0;
      let count = 0;

      for (const pred of settled) {
        const results = pred.accuracy?.modelResults?.filter((r: any) => r.model === model) || [];
        for (const r of results) {
          count++;
          totalCount++;
          if (r.correct) {
            correct++;
            totalCorrect++;
          }
        }
      }

      byModel[model] = {
        accuracy: count > 0 ? correct / count : 0,
        predictions: count
      };
    }

    for (const market of markets) {
      let correct = 0;
      let count = 0;

      for (const pred of settled) {
        const result = pred.accuracy?.consensusResults?.find((r: any) => r.market === market);
        if (result) {
          count++;
          if (result.correct) correct++;
        }
      }

      byMarket[market] = {
        accuracy: count > 0 ? correct / count : 0,
        predictions: count
      };
    }

    return {
      date: targetDate.toISOString().split('T')[0],
      totalPredictions: predictions?.length || 0,
      settledPredictions: settled.length,
      overallAccuracy: totalCount > 0 ? totalCorrect / totalCount : 0,
      byModel,
      byMarket
    };
  } catch (error) {
    console.error('❌ Error getting daily stats:', error);
    return null;
  }
}

/**
 * Performans raporu formatlar
 */
export function formatPerformanceReport(performance: ModelPerformance): string {
  let report = `\n📊 ${performance.model.toUpperCase()} Performance Report (${performance.period})\n`;
  report += '═'.repeat(50) + '\n\n';

  report += `Overall: ${(performance.overall.accuracy * 100).toFixed(1)}% accuracy (${performance.overall.totalPredictions} predictions)\n`;
  report += `ROI: ${performance.overall.roi.toFixed(1)}%\n\n`;

  report += 'By Market:\n';
  for (const [market, stats] of Object.entries(performance.byMarket)) {
    if (stats) {
      report += `  ${market}: ${(stats.accuracy * 100).toFixed(1)}% (${stats.totalPredictions} preds, ROI: ${stats.roi.toFixed(1)}%)\n`;
    }
  }

  report += '\nCalibration:\n';
  report += `  Overconfident: ${performance.calibration.overconfident ? 'Yes ⚠️' : 'No ✓'}\n`;
  report += `  Underconfident: ${performance.calibration.underconfident ? 'Yes' : 'No ✓'}\n`;
  report += `  Adjustment Factor: ${performance.calibration.calibrationAdjustment.toFixed(2)}\n`;

  return report;
}

// =========================
// DATABASE SCHEMA (SQL)
// =========================

/**
 * Supabase'de gerekli tabloları oluşturmak için SQL
 * Bu SQL'i Supabase SQL Editor'de çalıştırın
 */
export const DATABASE_SCHEMA = `
-- Quad-Brain Predictions Table
CREATE TABLE IF NOT EXISTS quad_brain_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT,
  match_date TIMESTAMP,
  predictions JSONB,
  consensus JSONB,
  actual_results JSONB,
  accuracy JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP,
  UNIQUE(fixture_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_predictions_fixture_id ON quad_brain_predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON quad_brain_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_predictions_settled ON quad_brain_predictions(settled_at);

-- Model Performance Table
CREATE TABLE IF NOT EXISTS quad_brain_model_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL,
  market TEXT NOT NULL,
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy FLOAT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(model, market)
);

-- Daily Stats Table (for caching)
CREATE TABLE IF NOT EXISTS quad_brain_daily_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  stats JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

// =========================
// EXPORTS
// =========================

export {
  TABLES,
  calculateAccuracy,
  checkPredictionCorrect,
  calculateCalibrationScore,
  calculateROI
};

