// ============================================================================
// ADMIN PANEL - SERVICE LAYER
// Tahmin kaydetme, sonuç güncelleme ve istatistik hesaplama
// ============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import {
  PredictionRecord,
  MatchResult,
  SavePredictionRequest,
  SettlePredictionRequest,
  GetStatsRequest,
  AdminDashboardStats,
  ModelPerformanceStats,
  PredictionAccuracy,
} from './types';

// =========================
// PREDICTION SAVING
// =========================

export async function savePrediction(request: SavePredictionRequest): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    // First check if record exists
    const { data: existing } = await supabase
      .from('prediction_records')
      .select('id')
      .eq('fixture_id', request.fixtureId)
      .eq('analysis_type', request.analysisType)
      .maybeSingle();

    const predictionData = {
      fixture_id: request.fixtureId,
      home_team: request.homeTeam,
      away_team: request.awayTeam,
      league: request.league,
      match_date: request.matchDate,
      analysis_type: request.analysisType,
      predictions: request.predictions,
      consensus: request.consensus,
      best_bets: request.bestBets || [],
      risk_level: request.riskLevel || 'medium',
      risk_factors: request.riskFactors || [],
      data_quality_score: request.dataQualityScore || 70,
      user_id: request.userId || null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    };

    let data, error;

    if (existing?.id) {
      // Update existing record
      ({ data, error } = await supabase
        .from('prediction_records')
        .update(predictionData)
        .eq('id', existing.id)
        .select('id')
        .single());
    } else {
      // Insert new record
      ({ data, error } = await supabase
        .from('prediction_records')
        .insert(predictionData)
        .select('id')
        .single());
    }

    if (error) {
      console.error('Error saving prediction:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'No data returned from save operation' };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Error in savePrediction:', err);
    return { success: false, error: err.message };
  }
}

// =========================
// MATCH RESULT SETTLEMENT
// =========================

export async function settleMatchResult(request: SettlePredictionRequest): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Calculate derived values
    const matchResult = request.homeScore > request.awayScore ? '1' : 
                        request.homeScore < request.awayScore ? '2' : 'X';
    const totalGoals = request.homeScore + request.awayScore;
    const btts = request.homeScore > 0 && request.awayScore > 0;
    const firstHalfGoals = (request.htHomeScore || 0) + (request.htAwayScore || 0);
    
    // Insert or update match result
    const { error: resultError } = await supabase
      .from('match_results')
      .upsert({
        fixture_id: request.fixtureId,
        home_score: request.homeScore,
        away_score: request.awayScore,
        match_result: matchResult,
        total_goals: totalGoals,
        btts: btts,
        ht_home_score: request.htHomeScore,
        ht_away_score: request.htAwayScore,
        first_half_goals: firstHalfGoals,
        corners: request.corners,
        yellow_cards: request.yellowCards,
        red_cards: request.redCards,
        match_date: new Date().toISOString(),
        source: 'sportmonks',
      }, {
        onConflict: 'fixture_id'
      });

    if (resultError) {
      console.error('Error saving match result:', resultError);
      return { success: false, error: resultError.message };
    }

    // Get all pending predictions for this fixture
    const { data: predictions, error: fetchError } = await supabase
      .from('prediction_records')
      .select('*')
      .eq('fixture_id', request.fixtureId)
      .eq('status', 'pending');

    if (fetchError) {
      console.error('Error fetching predictions:', fetchError);
      return { success: false, error: fetchError.message };
    }

    // Process each prediction
    for (const prediction of predictions || []) {
      await calculateAndSaveAccuracy(
        supabase,
        prediction,
        {
          matchResult,
          totalGoals,
          btts,
          firstHalfGoals,
        }
      );
    }

    // Update prediction records status
    const { error: updateError } = await supabase
      .from('prediction_records')
      .update({ 
        status: 'settled',
        settled_at: new Date().toISOString()
      })
      .eq('fixture_id', request.fixtureId)
      .eq('status', 'pending');

    if (updateError) {
      console.error('Error updating prediction status:', updateError);
      return { success: false, error: updateError.message };
    }

    // Update model performance stats
    await updateModelPerformanceStats(supabase);

    return { success: true };
  } catch (err: any) {
    console.error('Error in settleMatchResult:', err);
    return { success: false, error: err.message };
  }
}

// =========================
// ACCURACY CALCULATION
// =========================

async function calculateAndSaveAccuracy(
  supabase: any,
  prediction: PredictionRecord,
  actualResults: {
    matchResult: string;
    totalGoals: number;
    btts: boolean;
    firstHalfGoals: number;
  }
) {
  const markets = ['matchResult', 'over25', 'btts'];
  const consensus = prediction.consensus as any;
  const predictions = prediction.predictions as any;
  
  for (const market of markets) {
    let actualResult: string;
    let consensusPrediction: string;
    let consensusConfidence: number;
    
    switch (market) {
      case 'matchResult':
        actualResult = actualResults.matchResult;
        consensusPrediction = consensus.matchResult?.prediction || '';
        consensusConfidence = consensus.matchResult?.confidence || 0;
        break;
      case 'over25':
        actualResult = actualResults.totalGoals > 2.5 ? 'Over' : 'Under';
        consensusPrediction = consensus.over25?.prediction || '';
        consensusConfidence = consensus.over25?.confidence || 0;
        break;
      case 'btts':
        actualResult = actualResults.btts ? 'Yes' : 'No';
        consensusPrediction = consensus.btts?.prediction || '';
        consensusConfidence = consensus.btts?.confidence || 0;
        break;
      default:
        continue;
    }

    // Check model predictions
    const modelResults: any = {};
    const modelNames = ['claude', 'gpt4', 'gemini', 'perplexity'];
    
    for (const model of modelNames) {
      if (predictions[model]) {
        let modelPrediction: string;
        let modelConfidence: number;
        
        switch (market) {
          case 'matchResult':
            modelPrediction = predictions[model].matchResult || '';
            modelConfidence = predictions[model].matchResultConfidence || 0;
            break;
          case 'over25':
            modelPrediction = predictions[model].over25 || '';
            modelConfidence = predictions[model].over25Confidence || 0;
            break;
          case 'btts':
            modelPrediction = predictions[model].btts || '';
            modelConfidence = predictions[model].bttsConfidence || 0;
            break;
          default:
            continue;
        }

        const isCorrect = isMatchingPrediction(modelPrediction, actualResult);
        
        modelResults[model] = {
          prediction: modelPrediction,
          confidence: modelConfidence,
          correct: isCorrect,
        };
      }
    }

    const consensusCorrect = isMatchingPrediction(consensusPrediction, actualResult);

    // Save accuracy record
    await supabase
      .from('prediction_accuracy')
      .insert({
        prediction_record_id: prediction.id,
        fixture_id: prediction.fixture_id,
        market: market,
        model_predictions: modelResults,
        consensus_prediction: consensusPrediction,
        consensus_confidence: consensusConfidence,
        actual_result: actualResult,
        consensus_correct: consensusCorrect,
        analysis_type: prediction.analysis_type,
        settled_at: new Date().toISOString(),
      });
  }
}

function isMatchingPrediction(prediction: string, actual: string): boolean {
  const normalizedPred = prediction.toString().toLowerCase().trim();
  const normalizedActual = actual.toString().toLowerCase().trim();
  
  // Direct match
  if (normalizedPred === normalizedActual) return true;
  
  // Match result normalization
  if (normalizedPred === 'home' && normalizedActual === '1') return true;
  if (normalizedPred === 'draw' && normalizedActual === 'x') return true;
  if (normalizedPred === 'away' && normalizedActual === '2') return true;
  if (normalizedPred === '1' && normalizedActual === 'home') return true;
  if (normalizedPred === 'x' && normalizedActual === 'draw') return true;
  if (normalizedPred === '2' && normalizedActual === 'away') return true;
  
  // Over/Under normalization
  if (normalizedPred.includes('over') && normalizedActual === 'over') return true;
  if (normalizedPred.includes('under') && normalizedActual === 'under') return true;
  
  // BTTS normalization
  if (normalizedPred === 'evet' && normalizedActual === 'yes') return true;
  if (normalizedPred === 'hayır' && normalizedActual === 'no') return true;
  
  return false;
}

// =========================
// PERFORMANCE STATS
// =========================

async function updateModelPerformanceStats(supabase: any) {
  const periods: ('7d' | '30d' | '90d' | 'all')[] = ['7d', '30d', '90d', 'all'];
  const models = ['claude', 'gpt4', 'gemini', 'perplexity', 'consensus'];
  const markets = ['matchResult', 'over25', 'btts'];
  
  for (const period of periods) {
    const periodStart = getPeriodStartDate(period);
    const periodEnd = new Date().toISOString().split('T')[0];
    
    for (const model of models) {
      for (const market of markets) {
        let query = supabase
          .from('prediction_accuracy')
          .select('*')
          .eq('market', market);
        
        if (period !== 'all') {
          query = query.gte('settled_at', periodStart);
        }

        const { data: accuracyData } = await query;
        
        if (!accuracyData || accuracyData.length === 0) continue;
        
        let total = 0;
        let correct = 0;
        let totalConfidence = 0;
        
        for (const record of accuracyData) {
          if (model === 'consensus') {
            total++;
            if (record.consensus_correct) correct++;
            totalConfidence += record.consensus_confidence || 0;
          } else if (record.model_predictions && record.model_predictions[model]) {
            total++;
            if (record.model_predictions[model].correct) correct++;
            totalConfidence += record.model_predictions[model].confidence || 0;
          }
        }
        
        if (total === 0) continue;
        
        const accuracyRate = (correct / total) * 100;
        const avgConfidence = totalConfidence / total;
        const calibrationScore = avgConfidence > 0 ? accuracyRate / avgConfidence : 1;
        
        // Upsert stats
        await supabase
          .from('model_performance_stats')
          .upsert({
            model_name: model,
            market: market,
            period: period,
            analysis_type: 'all',
            total_predictions: total,
            correct_predictions: correct,
            accuracy_rate: accuracyRate,
            avg_confidence: avgConfidence,
            calibration_score: Math.min(calibrationScore, 2),
            roi_percentage: 0, // Can be calculated if odds are tracked
            period_start: periodStart,
            period_end: periodEnd,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'model_name,market,period,analysis_type,period_start'
          });
      }
    }
  }
}

function getPeriodStartDate(period: '7d' | '30d' | '90d' | 'all'): string {
  const now = new Date();
  switch (period) {
    case '7d':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      break;
    case 'all':
      now.setFullYear(2020, 0, 1);
      break;
  }
  return now.toISOString().split('T')[0];
}

// =========================
// GET STATS
// =========================

export async function getAdminDashboardStats(request: GetStatsRequest = {}): Promise<AdminDashboardStats> {
  const supabase = getSupabaseAdmin();
  const period = request.period || '30d';
  const periodStart = getPeriodStartDate(period);

  // Overview stats
  const { data: allPredictions } = await supabase
    .from('prediction_records')
    .select('status, created_at')
    .gte('created_at', periodStart);

  const { data: todayPredictions } = await supabase
    .from('prediction_records')
    .select('status')
    .gte('created_at', new Date().toISOString().split('T')[0]);

  const totalPredictions = allPredictions?.length || 0;
  const settledPredictions = allPredictions?.filter(p => p.status === 'settled').length || 0;
  const pendingPredictions = allPredictions?.filter(p => p.status === 'pending').length || 0;

  // Overall accuracy
  const { data: accuracyData } = await supabase
    .from('prediction_accuracy')
    .select('consensus_correct')
    .gte('settled_at', periodStart);

  const correctCount = accuracyData?.filter(a => a.consensus_correct).length || 0;
  const totalAccuracy = accuracyData?.length || 0;
  const overallAccuracy = totalAccuracy > 0 ? (correctCount / totalAccuracy) * 100 : 0;

  // By analysis type
  const { data: byTypeData } = await supabase
    .from('prediction_accuracy')
    .select('analysis_type, consensus_correct')
    .gte('settled_at', periodStart);

  const typeStats: { [key: string]: { total: number; correct: number } } = {};
  byTypeData?.forEach(record => {
    if (!typeStats[record.analysis_type]) {
      typeStats[record.analysis_type] = { total: 0, correct: 0 };
    }
    typeStats[record.analysis_type].total++;
    if (record.consensus_correct) typeStats[record.analysis_type].correct++;
  });

  const byAnalysisType = Object.entries(typeStats).map(([type, stats]) => ({
    type,
    total: stats.total,
    correct: stats.correct,
    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
  }));

  // By market
  const { data: byMarketData } = await supabase
    .from('prediction_accuracy')
    .select('market, model_predictions, consensus_correct')
    .gte('settled_at', periodStart);

  const marketStats: { [key: string]: { total: number; correct: number; models: { [m: string]: { total: number; correct: number } } } } = {};
  
  byMarketData?.forEach(record => {
    if (!marketStats[record.market]) {
      marketStats[record.market] = { total: 0, correct: 0, models: {} };
    }
    marketStats[record.market].total++;
    if (record.consensus_correct) marketStats[record.market].correct++;

    // Process model predictions
    if (record.model_predictions) {
      Object.entries(record.model_predictions as any).forEach(([model, data]: [string, any]) => {
        if (!marketStats[record.market].models[model]) {
          marketStats[record.market].models[model] = { total: 0, correct: 0 };
        }
        marketStats[record.market].models[model].total++;
        if (data.correct) marketStats[record.market].models[model].correct++;
      });
    }
  });

  const byMarket = Object.entries(marketStats).map(([market, stats]) => ({
    market,
    total: stats.total,
    correct: stats.correct,
    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    byModel: Object.entries(stats.models).map(([model, mStats]) => ({
      model,
      total: mStats.total,
      correct: mStats.correct,
      accuracy: mStats.total > 0 ? (mStats.correct / mStats.total) * 100 : 0,
    })),
  }));

  // By model (overall)
  const modelStats: { [key: string]: { total: number; correct: number; totalConfidence: number } } = {};
  
  byMarketData?.forEach(record => {
    if (record.model_predictions) {
      Object.entries(record.model_predictions as any).forEach(([model, data]: [string, any]) => {
        if (!modelStats[model]) {
          modelStats[model] = { total: 0, correct: 0, totalConfidence: 0 };
        }
        modelStats[model].total++;
        if (data.correct) modelStats[model].correct++;
        modelStats[model].totalConfidence += data.confidence || 0;
      });
    }
  });

  const byModel = Object.entries(modelStats).map(([model, stats]) => ({
    model,
    total: stats.total,
    correct: stats.correct,
    accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    avgConfidence: stats.total > 0 ? stats.totalConfidence / stats.total : 0,
    calibrationScore: stats.total > 0 && stats.totalConfidence > 0 
      ? ((stats.correct / stats.total) * 100) / (stats.totalConfidence / stats.total)
      : 1,
  }));

  // Recent predictions
  const { data: recentPredictions } = await supabase
    .from('prediction_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // Daily trend (last 14 days)
  const dailyTrend: { date: string; total: number; correct: number; accuracy: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const { data: dayData } = await supabase
      .from('prediction_accuracy')
      .select('consensus_correct')
      .gte('settled_at', dateStr)
      .lt('settled_at', new Date(date.getTime() + 86400000).toISOString().split('T')[0]);
    
    const dayTotal = dayData?.length || 0;
    const dayCorrect = dayData?.filter(d => d.consensus_correct).length || 0;
    
    dailyTrend.push({
      date: dateStr,
      total: dayTotal,
      correct: dayCorrect,
      accuracy: dayTotal > 0 ? (dayCorrect / dayTotal) * 100 : 0,
    });
  }

  // Today's accuracy
  const todayAccuracyData = dailyTrend[dailyTrend.length - 1];
  const todayAccuracy = todayAccuracyData?.total > 0 ? todayAccuracyData.accuracy : null;

  return {
    overview: {
      totalPredictions,
      pendingPredictions,
      settledPredictions,
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
      todayPredictions: todayPredictions?.length || 0,
      todayAccuracy: todayAccuracy !== null ? Math.round(todayAccuracy * 100) / 100 : null,
    },
    byAnalysisType,
    byMarket,
    byModel,
    recentPredictions: recentPredictions || [],
    dailyTrend,
  };
}

// =========================
// GET PREDICTIONS LIST
// =========================

export async function getPredictions(options: {
  page?: number;
  limit?: number;
  status?: 'pending' | 'settled' | 'all';
  analysisType?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<{ data: PredictionRecord[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('prediction_records')
    .select('*', { count: 'exact' });

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  if (options.analysisType && options.analysisType !== 'all') {
    query = query.eq('analysis_type', options.analysisType);
  }

  if (options.fromDate) {
    query = query.gte('match_date', options.fromDate);
  }

  if (options.toDate) {
    query = query.lte('match_date', options.toDate);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching predictions:', error);
    return { data: [], total: 0 };
  }

  return { data: data || [], total: count || 0 };
}

// =========================
// GET MODEL STATS
// =========================

export async function getModelStats(period: '7d' | '30d' | '90d' | 'all' = '30d'): Promise<ModelPerformanceStats[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('model_performance_stats')
    .select('*')
    .eq('period', period)
    .order('accuracy_rate', { ascending: false });

  if (error) {
    console.error('Error fetching model stats:', error);
    return [];
  }

  return data || [];
}

// =========================
// GET ACCURACY DETAILS
// =========================

export async function getAccuracyDetails(fixtureId: number): Promise<PredictionAccuracy[]> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('prediction_accuracy')
    .select('*')
    .eq('fixture_id', fixtureId);

  if (error) {
    console.error('Error fetching accuracy details:', error);
    return [];
  }

  return data || [];
}

// =========================
// DETAILED MODEL STATISTICS
// Model x Market x Period Matrix
// =========================

export interface DetailedModelStats {
  model: string;
  markets: {
    market: string;
    periods: {
      period: 'daily' | 'weekly' | 'monthly' | 'all';
      total: number;
      correct: number;
      accuracy: number;
      avgConfidence: number;
      confidenceThresholds: {
        threshold: number;
        total: number;
        correct: number;
        accuracy: number;
      }[];
    }[];
  }[];
}

export interface ConfidenceThresholdAnalysis {
  model: string;
  market: string;
  thresholds: {
    minConfidence: number;
    maxConfidence: number;
    total: number;
    correct: number;
    accuracy: number;
    recommendedBet: boolean;
  }[];
}

export async function getDetailedModelStatistics(): Promise<{
  modelStats: DetailedModelStats[];
  confidenceAnalysis: ConfidenceThresholdAnalysis[];
  periodComparison: any;
}> {
  const supabase = getSupabaseAdmin();
  
  // Get all accuracy data
  const { data: allAccuracy } = await supabase
    .from('prediction_accuracy')
    .select('*')
    .order('settled_at', { ascending: false });

  if (!allAccuracy || allAccuracy.length === 0) {
    return {
      modelStats: [],
      confidenceAnalysis: [],
      periodComparison: null,
    };
  }

  const models = ['claude', 'gpt4', 'gemini', 'perplexity', 'consensus'];
  const markets = ['matchResult', 'over25', 'btts'];
  const confidenceThresholds = [50, 60, 70, 80, 90];

  // Calculate period boundaries
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const modelStats: DetailedModelStats[] = [];
  const confidenceAnalysis: ConfidenceThresholdAnalysis[] = [];

  for (const model of models) {
    const modelData: DetailedModelStats = {
      model,
      markets: [],
    };

    for (const market of markets) {
      const marketData = allAccuracy.filter(a => a.market === market);
      
      // Daily (today)
      const dailyData = marketData.filter(a => a.settled_at >= todayStart);
      // Weekly (last 7 days)
      const weeklyData = marketData.filter(a => a.settled_at >= weekStart);
      // Monthly (last 30 days)
      const monthlyData = marketData.filter(a => a.settled_at >= monthStart);
      
      const periods = [
        { period: 'daily' as const, data: dailyData },
        { period: 'weekly' as const, data: weeklyData },
        { period: 'monthly' as const, data: monthlyData },
        { period: 'all' as const, data: marketData },
      ];

      const periodStats = periods.map(({ period, data }) => {
        let total = 0;
        let correct = 0;
        let totalConfidence = 0;

        const thresholdStats: { [key: number]: { total: number; correct: number } } = {};
        confidenceThresholds.forEach(t => {
          thresholdStats[t] = { total: 0, correct: 0 };
        });

        data.forEach(record => {
          if (model === 'consensus') {
            total++;
            totalConfidence += record.consensus_confidence || 0;
            if (record.consensus_correct) correct++;

            // Threshold analysis
            const conf = record.consensus_confidence || 0;
            confidenceThresholds.forEach(threshold => {
              if (conf >= threshold) {
                thresholdStats[threshold].total++;
                if (record.consensus_correct) thresholdStats[threshold].correct++;
              }
            });
          } else if (record.model_predictions && record.model_predictions[model]) {
            total++;
            totalConfidence += record.model_predictions[model].confidence || 0;
            if (record.model_predictions[model].correct) correct++;

            // Threshold analysis
            const conf = record.model_predictions[model].confidence || 0;
            confidenceThresholds.forEach(threshold => {
              if (conf >= threshold) {
                thresholdStats[threshold].total++;
                if (record.model_predictions[model].correct) thresholdStats[threshold].correct++;
              }
            });
          }
        });

        return {
          period,
          total,
          correct,
          accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
          avgConfidence: total > 0 ? Math.round(totalConfidence / total * 10) / 10 : 0,
          confidenceThresholds: confidenceThresholds.map(threshold => ({
            threshold,
            total: thresholdStats[threshold].total,
            correct: thresholdStats[threshold].correct,
            accuracy: thresholdStats[threshold].total > 0 
              ? Math.round((thresholdStats[threshold].correct / thresholdStats[threshold].total) * 1000) / 10 
              : 0,
          })),
        };
      });

      modelData.markets.push({
        market,
        periods: periodStats,
      });

      // Build confidence analysis for this model-market combo
      const allPeriodData = marketData;
      const ranges = [
        { min: 50, max: 60 },
        { min: 60, max: 70 },
        { min: 70, max: 80 },
        { min: 80, max: 90 },
        { min: 90, max: 100 },
      ];

      const thresholds = ranges.map(range => {
        let total = 0;
        let correct = 0;

        allPeriodData.forEach(record => {
          let conf = 0;
          let isCorrect = false;

          if (model === 'consensus') {
            conf = record.consensus_confidence || 0;
            isCorrect = record.consensus_correct;
          } else if (record.model_predictions && record.model_predictions[model]) {
            conf = record.model_predictions[model].confidence || 0;
            isCorrect = record.model_predictions[model].correct;
          }

          if (conf >= range.min && conf < range.max) {
            total++;
            if (isCorrect) correct++;
          }
        });

        const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
        return {
          minConfidence: range.min,
          maxConfidence: range.max,
          total,
          correct,
          accuracy,
          recommendedBet: accuracy >= 60 && total >= 5,
        };
      });

      confidenceAnalysis.push({
        model,
        market,
        thresholds,
      });
    }

    modelStats.push(modelData);
  }

  // Period comparison (day by day for last 14 days)
  const periodComparison = {
    labels: [] as string[],
    models: {} as { [model: string]: number[] },
  };

  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    periodComparison.labels.push(dateStr);

    const dayData = allAccuracy.filter(a => 
      a.settled_at && a.settled_at.startsWith(dateStr)
    );

    models.forEach(model => {
      if (!periodComparison.models[model]) {
        periodComparison.models[model] = [];
      }

      let total = 0;
      let correct = 0;

      dayData.forEach(record => {
        if (model === 'consensus') {
          total++;
          if (record.consensus_correct) correct++;
        } else if (record.model_predictions && record.model_predictions[model]) {
          total++;
          if (record.model_predictions[model].correct) correct++;
        }
      });

      periodComparison.models[model].push(
        total > 0 ? Math.round((correct / total) * 1000) / 10 : 0
      );
    });
  }

  return {
    modelStats,
    confidenceAnalysis,
    periodComparison,
  };
}

// =========================
// GET WEEKLY/MONTHLY BREAKDOWN
// =========================

export interface WeeklyBreakdown {
  weekStart: string;
  weekEnd: string;
  models: {
    model: string;
    markets: {
      market: string;
      total: number;
      correct: number;
      accuracy: number;
    }[];
    overallAccuracy: number;
  }[];
}

export async function getWeeklyBreakdown(weeks: number = 8): Promise<WeeklyBreakdown[]> {
  const supabase = getSupabaseAdmin();
  const result: WeeklyBreakdown[] = [];

  for (let w = 0; w < weeks; w++) {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - (w * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);

    const { data: weekData } = await supabase
      .from('prediction_accuracy')
      .select('*')
      .gte('settled_at', weekStart.toISOString())
      .lt('settled_at', weekEnd.toISOString());

    if (!weekData || weekData.length === 0) continue;

    const models = ['claude', 'gpt4', 'gemini', 'perplexity', 'consensus'];
    const markets = ['matchResult', 'over25', 'btts'];

    const weekBreakdown: WeeklyBreakdown = {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      models: [],
    };

    for (const model of models) {
      let overallTotal = 0;
      let overallCorrect = 0;

      const marketStats = markets.map(market => {
        const marketData = weekData.filter(d => d.market === market);
        let total = 0;
        let correct = 0;

        marketData.forEach(record => {
          if (model === 'consensus') {
            total++;
            if (record.consensus_correct) correct++;
          } else if (record.model_predictions && record.model_predictions[model]) {
            total++;
            if (record.model_predictions[model].correct) correct++;
          }
        });

        overallTotal += total;
        overallCorrect += correct;

        return {
          market,
          total,
          correct,
          accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
        };
      });

      weekBreakdown.models.push({
        model,
        markets: marketStats,
        overallAccuracy: overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 1000) / 10 : 0,
      });
    }

    result.push(weekBreakdown);
  }

  return result;
}

