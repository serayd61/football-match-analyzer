// ============================================================================
// AUTOLEARN AGENT - Core Model
// Train, Update, Predict fonksiyonlari
// Settled maclardan ogrenir, pattern'lari kaydeder, yeni maclar icin skor uretir
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { extractFeatures, type AgentPredictions, type MatchContext } from './features';
import { calculateAutoLearnScore, type ModelParameters } from './scorer';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ============================================================================
// TYPES
// ============================================================================

export interface TrainResult {
  totalPatterns: number;
  confidenceCalPatterns: number;
  agentComboPatterns: number;
  leagueSpecPatterns: number;
  metaFeaturePatterns: number;
  temporalPatterns: number;
  trainingTime: number;
  matchesProcessed: number;
}

export interface PredictResult {
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

// ============================================================================
// NORMALIZATION
// ============================================================================

function normalizeMR(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === '1' || v === 'home' || v.includes('home')) return '1';
  if (v === '2' || v === 'away' || v.includes('away')) return '2';
  if (v === 'x' || v === 'draw' || v.includes('draw')) return 'X';
  return v;
}

function normalizeOU(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v.includes('over') || v.includes('üst') || v === 'o') return 'Over';
  if (v.includes('under') || v.includes('alt') || v === 'u') return 'Under';
  return v;
}

function normalizeBTTS(val: string | null | undefined): string {
  if (!val) return '';
  const v = val.toLowerCase().trim();
  if (v === 'yes' || v === 'evet' || v === 'var' || v === 'y') return 'Yes';
  if (v === 'no' || v === 'hayır' || v === 'yok' || v === 'n') return 'No';
  return v;
}

function getConfRange(conf: number): string {
  const start = Math.floor(conf / 5) * 5;
  return `${start}-${start + 4}`;
}

// ============================================================================
// TRAIN - Tum settled maclardan model olustur
// ============================================================================

export async function trainModel(): Promise<TrainResult> {
  const startTime = Date.now();
  const supabase = getSupabase();

  console.log('🧠 AutoLearn: Training started...');

  // Tum settled maclari cek (unified_analysis + analysis_performance)
  const { data: settledMatches, error } = await supabase
    .from('unified_analysis')
    .select(`
      id, fixture_id, home_team, away_team, league, match_date,
      match_result_prediction, match_result_confidence, match_result_correct,
      over_under_prediction, over_under_confidence, over_under_correct,
      btts_prediction, btts_confidence, btts_correct,
      overall_confidence, agreement, risk_level, data_quality,
      analysis
    `)
    .eq('is_settled', true)
    .not('match_result_correct', 'is', null)
    .order('match_date', { ascending: true });

  if (error || !settledMatches) {
    console.error('❌ AutoLearn: Failed to fetch settled matches:', error?.message);
    throw new Error('Failed to fetch training data');
  }

  console.log(`📊 AutoLearn: Found ${settledMatches.length} settled matches for training`);

  // Agent predictions da cek
  const { data: agentPreds } = await supabase
    .from('agent_predictions')
    .select('*')
    .not('match_result_correct', 'is', null);

  // Model parametrelerini hesapla
  const modelEntries: Map<string, ModelEntry> = new Map();

  for (const match of settledMatches) {
    const analysis = match.analysis as any;
    const league = match.league || 'unknown';

    // Her market icin pattern'lari cikart
    const markets = [
      {
        market: 'mr',
        prediction: normalizeMR(match.match_result_prediction),
        confidence: match.match_result_confidence || 0,
        correct: match.match_result_correct
      },
      {
        market: 'ou',
        prediction: normalizeOU(match.over_under_prediction),
        confidence: match.over_under_confidence || 0,
        correct: match.over_under_correct
      },
      {
        market: 'btts',
        prediction: normalizeBTTS(match.btts_prediction),
        confidence: match.btts_confidence || 0,
        correct: match.btts_correct
      }
    ];

    for (const m of markets) {
      if (!m.prediction || m.correct === null || m.correct === undefined) continue;

      // --- Katman 1: Confidence Calibration ---
      const confRange = getConfRange(m.confidence);
      const calKey = `consensus|${confRange}|${m.prediction}`;
      upsertPattern(modelEntries, 'confidence_cal', m.market, calKey, m.correct);

      // --- Katman 2: Agent Combination Patterns ---
      if (analysis?.sources?.agents) {
        const agents = analysis.sources.agents;
        const agentPredictions: Record<string, string> = {};

        // Her ajanin bu market icin tahminini cikart
        if (agents.stats) {
          if (m.market === 'mr') agentPredictions['stats'] = normalizeMR(agents.stats.matchResult);
          if (m.market === 'ou') agentPredictions['stats'] = normalizeOU(agents.stats.overUnder);
          if (m.market === 'btts') agentPredictions['stats'] = normalizeBTTS(agents.stats.btts);
        }
        if (agents.odds) {
          if (m.market === 'mr') agentPredictions['odds'] = normalizeMR(agents.odds.matchWinnerValue || agents.odds.recommendation);
          if (m.market === 'ou') agentPredictions['odds'] = normalizeOU(agents.odds.recommendation);
          if (m.market === 'btts') agentPredictions['odds'] = normalizeBTTS(agents.odds.bttsValue);
        }
        if (agents.deepAnalysis) {
          const deep = agents.deepAnalysis;
          if (m.market === 'mr') {
            const predicted = deep.predicted_outcome?.most_likely_result || '';
            if (predicted.toLowerCase().includes('home') || predicted.includes('1')) agentPredictions['deep'] = '1';
            else if (predicted.toLowerCase().includes('away') || predicted.includes('2')) agentPredictions['deep'] = '2';
            else if (predicted.toLowerCase().includes('draw')) agentPredictions['deep'] = 'X';
          }
          if (m.market === 'ou') {
            const ouRec = deep.betting_insights?.over_2_5_goals?.recommendation || '';
            agentPredictions['deep'] = ouRec.toLowerCase().includes('yes') || ouRec.toLowerCase().includes('over') ? 'Over' : 'Under';
          }
          if (m.market === 'btts') {
            const bttsRec = deep.betting_insights?.both_teams_to_score?.recommendation || '';
            agentPredictions['deep'] = bttsRec.toLowerCase().includes('yes') ? 'Yes' : 'No';
          }
        }

        // Consensus ile ayni yonde mi?
        const agreeing = Object.entries(agentPredictions)
          .filter(([_, pred]) => pred === m.prediction)
          .map(([name]) => name);
        const disagreeing = Object.entries(agentPredictions)
          .filter(([_, pred]) => pred && pred !== m.prediction)
          .map(([name]) => name);

        // Agreement pattern
        const agreeCount = agreeing.length;
        const totalAgents = agreeing.length + disagreeing.length;
        if (totalAgents > 0) {
          const agreeRatio = Math.round((agreeCount / totalAgents) * 100);
          const comboKey = `agree_${agreeRatio >= 75 ? 'strong' : agreeRatio >= 50 ? 'majority' : 'weak'}|${agreeCount}of${totalAgents}`;
          upsertPattern(modelEntries, 'agent_combo', m.market, comboKey, m.correct);

          // Spesifik ajan kombinasyonlari
          if (agreeing.length >= 2) {
            const comboName = agreeing.sort().join('+');
            upsertPattern(modelEntries, 'agent_combo', m.market, `agree|${comboName}`, m.correct);
          }
          if (disagreeing.length >= 1) {
            const disName = `disagree|${disagreeing.sort().join('+')}`;
            upsertPattern(modelEntries, 'agent_combo', m.market, disName, m.correct);
          }
        }
      }

      // --- Katman 3: League Specialization ---
      const leagueKey = `${league}|${m.prediction}`;
      upsertPattern(modelEntries, 'league_spec', m.market, leagueKey, m.correct);

      const leagueConfKey = `${league}|${confRange}`;
      upsertPattern(modelEntries, 'league_spec', m.market, leagueConfKey, m.correct);

      // --- Katman 4: Meta-Feature Patterns ---
      const agreement = match.agreement || 0;
      const riskLevel = match.risk_level || 'medium';
      const dataQuality = match.data_quality || 'minimal';

      // Agreement buckets
      const agreeBucket = agreement >= 80 ? 'high' : agreement >= 50 ? 'medium' : 'low';
      upsertPattern(modelEntries, 'meta_feature', m.market, `agreement|${agreeBucket}`, m.correct);

      // Risk level
      upsertPattern(modelEntries, 'meta_feature', m.market, `risk|${riskLevel}`, m.correct);

      // Data quality
      upsertPattern(modelEntries, 'meta_feature', m.market, `quality|${dataQuality}`, m.correct);

      // Overall confidence bucket
      const overallConf = match.overall_confidence || 0;
      const overallBucket = overallConf >= 70 ? 'high' : overallConf >= 55 ? 'medium' : 'low';
      upsertPattern(modelEntries, 'meta_feature', m.market, `overall_conf|${overallBucket}`, m.correct);

      // Confidence + prediction combo
      upsertPattern(modelEntries, 'meta_feature', m.market, `pred_conf|${m.prediction}|${confRange}`, m.correct);
    }
  }

  // --- Katman 5: Temporal Patterns ---
  // Son 20 ve son 50 maclik performans
  const recentSlices = [
    { name: 'recent_20', count: 20 },
    { name: 'recent_50', count: 50 }
  ];
  
  for (const slice of recentSlices) {
    const recentMatches = settledMatches.slice(-slice.count);
    for (const mkt of ['mr', 'ou', 'btts']) {
      let total = 0;
      let correct = 0;
      for (const match of recentMatches) {
        if (mkt === 'mr' && match.match_result_correct !== null) {
          total++;
          if (match.match_result_correct) correct++;
        } else if (mkt === 'ou' && match.over_under_correct !== null) {
          total++;
          if (match.over_under_correct) correct++;
        } else if (mkt === 'btts' && match.btts_correct !== null) {
          total++;
          if (match.btts_correct) correct++;
        }
      }
      if (total > 0) {
        const acc = Math.round((correct / total) * 1000) / 10;
        const key = `${slice.name}|accuracy`;
        const existing = modelEntries.get(`temporal|${mkt}|${key}`);
        if (!existing) {
          modelEntries.set(`temporal|${mkt}|${key}`, {
            model_type: 'temporal',
            market: mkt,
            feature_key: key,
            total_matches: total,
            correct_matches: correct,
            accuracy: acc,
            weight: 1.0,
            metadata: { slice: slice.name }
          });
        }
      }
    }
  }

  // Accuracy hesapla
  for (const [_, entry] of modelEntries) {
    if (entry.total_matches > 0) {
      entry.accuracy = Math.round((entry.correct_matches / entry.total_matches) * 1000) / 10;
    }
    // Weight: accuracy bazli (50 = 1.0, 70 = 1.4, 30 = 0.6)
    entry.weight = Math.max(0.1, Math.min(2.0, entry.accuracy / 50));
  }

  // Supabase'e kaydet (upsert)
  const entries = Array.from(modelEntries.values());
  
  // Onceki modeli temizle
  console.log(`🧠 AutoLearn: Clearing old model data...`);
  const { error: deleteError, count: deleteCount } = await supabase
    .from('autolearn_model')
    .delete()
    .gte('created_at', '1970-01-01T00:00:00Z')
    .select('id', { count: 'exact', head: true });
  
  if (deleteError) {
    console.error('❌ AutoLearn: Delete error:', deleteError.message, deleteError);
  } else {
    console.log(`🧠 AutoLearn: Deleted old entries`);
  }

  // Batch insert
  console.log(`🧠 AutoLearn: Inserting ${entries.length} patterns...`);
  const batchSize = 100;
  let insertedCount = 0;
  let insertErrors = 0;
  
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize).map(e => ({
      model_type: e.model_type,
      market: e.market,
      feature_key: e.feature_key,
      total_matches: e.total_matches,
      correct_matches: e.correct_matches,
      accuracy: e.accuracy,
      weight: e.weight,
      metadata: e.metadata,
      last_updated: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));

    const { data: insertData, error: insertError } = await supabase
      .from('autolearn_model')
      .upsert(batch, { onConflict: 'model_type,market,feature_key' })
      .select('id');

    if (insertError) {
      console.error(`❌ AutoLearn: Insert error (batch ${Math.floor(i / batchSize) + 1}):`, insertError.message, insertError.details, insertError.hint);
      insertErrors++;
    } else {
      insertedCount += insertData?.length || batch.length;
    }
  }
  
  console.log(`🧠 AutoLearn: Inserted ${insertedCount} patterns, ${insertErrors} batch errors`);

  // Dogrulama: gercekten kaydedildi mi?
  const { count: verifyCount } = await supabase
    .from('autolearn_model')
    .select('id', { count: 'exact', head: true });
  console.log(`🧠 AutoLearn: Verification - ${verifyCount} rows in autolearn_model table`);

  const result: TrainResult = {
    totalPatterns: entries.length,
    confidenceCalPatterns: entries.filter(e => e.model_type === 'confidence_cal').length,
    agentComboPatterns: entries.filter(e => e.model_type === 'agent_combo').length,
    leagueSpecPatterns: entries.filter(e => e.model_type === 'league_spec').length,
    metaFeaturePatterns: entries.filter(e => e.model_type === 'meta_feature').length,
    temporalPatterns: entries.filter(e => e.model_type === 'temporal').length,
    trainingTime: Date.now() - startTime,
    matchesProcessed: settledMatches.length
  };

  console.log(`🧠 AutoLearn: Training complete! ${result.totalPatterns} patterns learned from ${result.matchesProcessed} matches in ${result.trainingTime}ms`);

  return result;
}

// ============================================================================
// PREDICT - Yeni bir analiz icin AutoLearn skoru uret
// ============================================================================

export async function predict(
  agentPredictions: AgentPredictions,
  context: MatchContext
): Promise<PredictResult[]> {
  const supabase = getSupabase();

  // Model parametrelerini yukle
  const { data: modelData, error } = await supabase
    .from('autolearn_model')
    .select('*')
    .gte('total_matches', 3); // En az 3 mac olan pattern'lar

  if (error || !modelData || modelData.length === 0) {
    console.warn('⚠️ AutoLearn: No model data available');
    return [];
  }

  // Model parametrelerini organize et
  const modelParams: ModelParameters = {
    confidenceCal: modelData.filter(m => m.model_type === 'confidence_cal'),
    agentCombo: modelData.filter(m => m.model_type === 'agent_combo'),
    leagueSpec: modelData.filter(m => m.model_type === 'league_spec'),
    metaFeature: modelData.filter(m => m.model_type === 'meta_feature'),
    temporal: modelData.filter(m => m.model_type === 'temporal')
  };

  // Feature extraction
  const features = extractFeatures(agentPredictions, context);

  // Her market icin skor hesapla
  const results: PredictResult[] = [];

  for (const market of ['mr', 'ou', 'btts'] as const) {
    const marketFeatures = features[market];
    if (!marketFeatures || !marketFeatures.prediction) continue;

    const score = calculateAutoLearnScore(market, marketFeatures, modelParams);
    results.push(score);
  }

  return results;
}

// ============================================================================
// UPDATE - Incremental model update (yeni settled maclar icin)
// ============================================================================

export async function updateModel(fixtureIds?: number[]): Promise<{ updated: number }> {
  // Basitce full retrain yapalim - veri seti kucuk
  // Ileride incremental update eklenebilir
  const result = await trainModel();
  return { updated: result.matchesProcessed };
}

// ============================================================================
// GET MODEL STATS
// ============================================================================

export async function getModelStats(): Promise<any> {
  const supabase = getSupabase();

  // Debug: count first
  const { count: totalCount, error: countError } = await supabase
    .from('autolearn_model')
    .select('id', { count: 'exact', head: true });
  
  console.log(`🧠 AutoLearn Stats: totalCount=${totalCount}, countError=${countError?.message || 'none'}`);

  const { data: stats, error: statsError } = await supabase
    .from('autolearn_model')
    .select('model_type, market, total_matches, correct_matches, accuracy');

  console.log(`🧠 AutoLearn Stats: stats rows=${stats?.length || 0}, error=${statsError?.message || 'none'}`);

  if (!stats || stats.length === 0) {
    return { trained: false, patterns: 0, message: 'Model henuz egitilmedi', _debug: { totalCount, countError: countError?.message, statsError: statsError?.message } };
  }

  const byType: Record<string, { count: number; avgAccuracy: number; totalMatches: number }> = {};
  const byMarket: Record<string, { count: number; avgAccuracy: number }> = {};

  for (const row of stats) {
    // Type bazli
    if (!byType[row.model_type]) {
      byType[row.model_type] = { count: 0, avgAccuracy: 0, totalMatches: 0 };
    }
    byType[row.model_type].count++;
    byType[row.model_type].avgAccuracy += row.accuracy;
    byType[row.model_type].totalMatches += row.total_matches;

    // Market bazli
    if (!byMarket[row.market]) {
      byMarket[row.market] = { count: 0, avgAccuracy: 0 };
    }
    byMarket[row.market].count++;
    byMarket[row.market].avgAccuracy += row.accuracy;
  }

  // Ortalama hesapla
  for (const key of Object.keys(byType)) {
    byType[key].avgAccuracy = Math.round((byType[key].avgAccuracy / byType[key].count) * 10) / 10;
  }
  for (const key of Object.keys(byMarket)) {
    byMarket[key].avgAccuracy = Math.round((byMarket[key].avgAccuracy / byMarket[key].count) * 10) / 10;
  }

  return {
    trained: true,
    totalPatterns: stats.length,
    byType,
    byMarket,
    lastUpdated: new Date().toISOString()
  };
}

// ============================================================================
// HELPER
// ============================================================================

function upsertPattern(
  map: Map<string, ModelEntry>,
  modelType: string,
  market: string,
  featureKey: string,
  correct: boolean
) {
  const key = `${modelType}|${market}|${featureKey}`;
  const existing = map.get(key);
  if (existing) {
    existing.total_matches++;
    if (correct) existing.correct_matches++;
  } else {
    map.set(key, {
      model_type: modelType,
      market,
      feature_key: featureKey,
      total_matches: 1,
      correct_matches: correct ? 1 : 0,
      accuracy: 0,
      weight: 1.0,
      metadata: {}
    });
  }
}
