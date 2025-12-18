import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PredictionSession {
  id?: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league?: string;
  match_date: string;
  prediction_source: 'quad_brain' | 'ai_agents' | 'consensus' | 'daily_coupon';
  session_type?: 'manual' | 'daily_coupon' | 'auto';
  
  // Consensus predictions
  consensus_btts?: 'yes' | 'no';
  consensus_btts_confidence?: number;
  consensus_over_under?: 'over' | 'under';
  consensus_over_under_line?: number;
  consensus_over_under_confidence?: number;
  consensus_match_result?: 'home' | 'draw' | 'away';
  consensus_match_result_confidence?: number;
  
  // Best bets
  best_bet_1_market?: string;
  best_bet_1_selection?: string;
  best_bet_1_confidence?: number;
  best_bet_2_market?: string;
  best_bet_2_selection?: string;
  best_bet_2_confidence?: number;
  best_bet_3_market?: string;
  best_bet_3_selection?: string;
  best_bet_3_confidence?: number;
  
  risk_level?: 'low' | 'medium' | 'high';
}

export interface ModelPrediction {
  session_id: string;
  model_name: string;
  model_type: 'llm' | 'agent' | 'ensemble';
  model_version?: string;
  
  btts_prediction?: 'yes' | 'no';
  btts_confidence?: number;
  btts_reasoning?: string;
  
  over_under_prediction?: 'over' | 'under';
  over_under_line?: number;
  over_under_confidence?: number;
  over_under_reasoning?: string;
  
  match_result_prediction?: 'home' | 'draw' | 'away';
  match_result_confidence?: number;
  match_result_reasoning?: string;
  
  primary_recommendation_market?: string;
  primary_recommendation_selection?: string;
  primary_recommendation_confidence?: number;
  
  response_time_ms?: number;
  tokens_used?: number;
  raw_response?: object;
}

export interface MatchResult {
  fixture_id: number;
  home_score: number;
  away_score: number;
  result_source: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DUPLICATE CHECK
// ═══════════════════════════════════════════════════════════════════════════

export async function checkDuplicatePrediction(
  fixtureId: number,
  source: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('prediction_sessions')
    .select('id')
    .eq('fixture_id', fixtureId)
    .eq('prediction_source', source)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking duplicate:', error);
  }

  return !!data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE PREDICTION SESSION
// ═══════════════════════════════════════════════════════════════════════════

export async function savePredictionSession(
  session: PredictionSession,
  modelPredictions: ModelPrediction[]
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    // Check for duplicate
    const isDuplicate = await checkDuplicatePrediction(
      session.fixture_id,
      session.prediction_source
    );

    if (isDuplicate) {
      console.log(`⚠️ Duplicate prediction for fixture ${session.fixture_id} from ${session.prediction_source}`);
      return { 
        success: false, 
        error: `Duplicate prediction exists for fixture ${session.fixture_id}` 
      };
    }

    // Insert session
    const { data: sessionData, error: sessionError } = await supabase
      .from('prediction_sessions')
      .insert(session)
      .select('id')
      .single();

    if (sessionError) {
      console.error('Error saving session:', sessionError);
      return { success: false, error: sessionError.message };
    }

    const sessionId = sessionData.id;

    // Insert model predictions
    if (modelPredictions.length > 0) {
      const predictionsWithSession = modelPredictions.map(p => ({
        ...p,
        session_id: sessionId
      }));

      const { error: predError } = await supabase
        .from('ai_model_predictions')
        .insert(predictionsWithSession);

      if (predError) {
        console.error('Error saving model predictions:', predError);
        // Don't fail the whole operation, session was saved
      }
    }

    // Update daily summary
    await updateDailySummary(modelPredictions.map(p => p.model_name));

    console.log(`✅ Prediction saved: ${session.home_team} vs ${session.away_team} (${session.prediction_source})`);
    return { success: true, sessionId };

  } catch (error) {
    console.error('Error in savePredictionSession:', error);
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE DAILY SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

async function updateDailySummary(modelNames: string[]): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  for (const modelName of modelNames) {
    await supabase
      .from('daily_model_summary')
      .upsert({
        summary_date: today,
        model_name: modelName,
        predictions_made: 1,
        predictions_pending: 1
      }, {
        onConflict: 'summary_date,model_name'
      });

    // Increment if exists - wrapped in try-catch since RPC might not exist
    try {
      await supabase.rpc('increment_daily_predictions', {
        p_date: today,
        p_model: modelName
      });
    } catch {
      // RPC might not exist, ignore
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTLE PREDICTION
// ═══════════════════════════════════════════════════════════════════════════

export async function settlePrediction(
  fixtureId: number,
  result: MatchResult
): Promise<{ success: boolean; settled: number; error?: string }> {
  try {
    const { home_score, away_score, result_source } = result;

    // Calculate actual results
    const actual_btts = (home_score > 0 && away_score > 0) ? 'yes' : 'no';
    const total_goals = home_score + away_score;
    const actual_over_under = total_goals > 2.5 ? 'over' : 'under';
    const actual_match_result = home_score > away_score ? 'home' : 
                                 home_score < away_score ? 'away' : 'draw';

    // Get all pending sessions for this fixture
    const { data: sessions, error: fetchError } = await supabase
      .from('prediction_sessions')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('is_settled', false);

    if (fetchError || !sessions || sessions.length === 0) {
      return { success: false, settled: 0, error: 'No pending predictions found' };
    }

    let settledCount = 0;

    for (const session of sessions) {
      // Calculate correctness
      const btts_correct = session.consensus_btts === actual_btts;
      const over_under_correct = session.consensus_over_under === actual_over_under;
      const match_result_correct = session.consensus_match_result === actual_match_result;

      // Calculate best bet correctness
      const best_bet_1_correct = checkBestBetCorrect(
        session.best_bet_1_market,
        session.best_bet_1_selection,
        { actual_btts, actual_over_under, actual_match_result }
      );
      const best_bet_2_correct = checkBestBetCorrect(
        session.best_bet_2_market,
        session.best_bet_2_selection,
        { actual_btts, actual_over_under, actual_match_result }
      );
      const best_bet_3_correct = checkBestBetCorrect(
        session.best_bet_3_market,
        session.best_bet_3_selection,
        { actual_btts, actual_over_under, actual_match_result }
      );

      // Update session
      const { error: updateError } = await supabase
        .from('prediction_sessions')
        .update({
          actual_home_score: home_score,
          actual_away_score: away_score,
          actual_btts,
          actual_over_under,
          actual_match_result,
          is_settled: true,
          settled_at: new Date().toISOString(),
          result_source,
          btts_correct,
          over_under_correct,
          match_result_correct,
          best_bet_1_correct,
          best_bet_2_correct,
          best_bet_3_correct
        })
        .eq('id', session.id);

      if (!updateError) {
        settledCount++;

        // Update individual model predictions
        await settleModelPredictions(session.id, {
          actual_btts,
          actual_over_under,
          actual_match_result
        });
      }
    }

    console.log(`✅ Settled ${settledCount} predictions for fixture ${fixtureId}`);
    return { success: true, settled: settledCount };

  } catch (error) {
    console.error('Error settling prediction:', error);
    return { success: false, settled: 0, error: String(error) };
  }
}

function checkBestBetCorrect(
  market: string | null,
  selection: string | null,
  actuals: { actual_btts: string; actual_over_under: string; actual_match_result: string }
): boolean | null {
  if (!market || !selection) return null;

  const marketLower = market.toLowerCase();
  const selectionLower = selection.toLowerCase();

  if (marketLower.includes('btts') || marketLower.includes('kg')) {
    return selectionLower.includes('yes') ? actuals.actual_btts === 'yes' : actuals.actual_btts === 'no';
  }
  
  if (marketLower.includes('over') || marketLower.includes('under') || marketLower.includes('2.5')) {
    return selectionLower.includes('over') ? actuals.actual_over_under === 'over' : actuals.actual_over_under === 'under';
  }
  
  if (marketLower.includes('result') || marketLower.includes('winner') || marketLower.includes('ms')) {
    if (selectionLower.includes('home') || selectionLower === '1') return actuals.actual_match_result === 'home';
    if (selectionLower.includes('away') || selectionLower === '2') return actuals.actual_match_result === 'away';
    if (selectionLower.includes('draw') || selectionLower === 'x') return actuals.actual_match_result === 'draw';
  }

  return null;
}

async function settleModelPredictions(
  sessionId: string,
  actuals: { actual_btts: string; actual_over_under: string; actual_match_result: string }
): Promise<void> {
  const { data: predictions } = await supabase
    .from('ai_model_predictions')
    .select('*')
    .eq('session_id', sessionId);

  if (!predictions) return;

  for (const pred of predictions) {
    const btts_correct = pred.btts_prediction ? pred.btts_prediction === actuals.actual_btts : null;
    const over_under_correct = pred.over_under_prediction ? pred.over_under_prediction === actuals.actual_over_under : null;
    const match_result_correct = pred.match_result_prediction ? pred.match_result_prediction === actuals.actual_match_result : null;

    await supabase
      .from('ai_model_predictions')
      .update({
        btts_correct,
        over_under_correct,
        match_result_correct
      })
      .eq('id', pred.id);

    // Update daily summary
    await updateDailySummaryAfterSettle(pred.model_name, {
      btts_correct,
      over_under_correct,
      match_result_correct
    });
  }
}

async function updateDailySummaryAfterSettle(
  modelName: string,
  results: { btts_correct: boolean | null; over_under_correct: boolean | null; match_result_correct: boolean | null }
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const correctCount = [
    results.btts_correct,
    results.over_under_correct,
    results.match_result_correct
  ].filter(r => r === true).length;

  const totalCount = [
    results.btts_correct,
    results.over_under_correct,
    results.match_result_correct
  ].filter(r => r !== null).length;

  if (totalCount === 0) return;

  await supabase
    .from('daily_model_summary')
    .upsert({
      summary_date: today,
      model_name: modelName,
      predictions_settled: 1,
      predictions_correct: correctCount > 0 ? 1 : 0,
      predictions_pending: 0
    }, {
      onConflict: 'summary_date,model_name'
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

export async function getOverallStats(): Promise<object> {
  const { data: sessions } = await supabase
    .from('prediction_sessions')
    .select('*');

  if (!sessions) return {};

  const total = sessions.length;
  const settled = sessions.filter(s => s.is_settled).length;
  const pending = total - settled;

  const settledSessions = sessions.filter(s => s.is_settled);
  
  const bttsCorrect = settledSessions.filter(s => s.btts_correct).length;
  const ouCorrect = settledSessions.filter(s => s.over_under_correct).length;
  const mrCorrect = settledSessions.filter(s => s.match_result_correct).length;

  return {
    total_predictions: total,
    settled_predictions: settled,
    pending_predictions: pending,
    btts: {
      total: settled,
      correct: bttsCorrect,
      accuracy: settled > 0 ? ((bttsCorrect / settled) * 100).toFixed(1) : '0'
    },
    over_under: {
      total: settled,
      correct: ouCorrect,
      accuracy: settled > 0 ? ((ouCorrect / settled) * 100).toFixed(1) : '0'
    },
    match_result: {
      total: settled,
      correct: mrCorrect,
      accuracy: settled > 0 ? ((mrCorrect / settled) * 100).toFixed(1) : '0'
    }
  };
}

export async function getModelStats(): Promise<object[]> {
  const { data: predictions } = await supabase
    .from('ai_model_predictions')
    .select('*');

  if (!predictions) return [];

  const modelMap = new Map<string, {
    total: number;
    btts_total: number;
    btts_correct: number;
    ou_total: number;
    ou_correct: number;
    mr_total: number;
    mr_correct: number;
    total_confidence: number;
    confidence_count: number;
  }>();

  for (const pred of predictions) {
    if (!modelMap.has(pred.model_name)) {
      modelMap.set(pred.model_name, {
        total: 0,
        btts_total: 0,
        btts_correct: 0,
        ou_total: 0,
        ou_correct: 0,
        mr_total: 0,
        mr_correct: 0,
        total_confidence: 0,
        confidence_count: 0
      });
    }

    const stats = modelMap.get(pred.model_name)!;
    stats.total++;

    if (pred.btts_correct !== null) {
      stats.btts_total++;
      if (pred.btts_correct) stats.btts_correct++;
    }

    if (pred.over_under_correct !== null) {
      stats.ou_total++;
      if (pred.over_under_correct) stats.ou_correct++;
    }

    if (pred.match_result_correct !== null) {
      stats.mr_total++;
      if (pred.match_result_correct) stats.mr_correct++;
    }

    // Average confidence
    const avgConf = [
      pred.btts_confidence,
      pred.over_under_confidence,
      pred.match_result_confidence
    ].filter(c => c !== null);
    
    if (avgConf.length > 0) {
      stats.total_confidence += avgConf.reduce((a, b) => a + b, 0) / avgConf.length;
      stats.confidence_count++;
    }
  }

  const results: object[] = [];
  
  modelMap.forEach((stats, modelName) => {
    const totalSettled = stats.btts_total + stats.ou_total + stats.mr_total;
    const totalCorrect = stats.btts_correct + stats.ou_correct + stats.mr_correct;

    results.push({
      model_name: modelName,
      total_predictions: stats.total,
      btts: {
        total: stats.btts_total,
        correct: stats.btts_correct,
        accuracy: stats.btts_total > 0 ? ((stats.btts_correct / stats.btts_total) * 100).toFixed(1) : '0'
      },
      over_under: {
        total: stats.ou_total,
        correct: stats.ou_correct,
        accuracy: stats.ou_total > 0 ? ((stats.ou_correct / stats.ou_total) * 100).toFixed(1) : '0'
      },
      match_result: {
        total: stats.mr_total,
        correct: stats.mr_correct,
        accuracy: stats.mr_total > 0 ? ((stats.mr_correct / stats.mr_total) * 100).toFixed(1) : '0'
      },
      overall: {
        total: totalSettled,
        correct: totalCorrect,
        accuracy: totalSettled > 0 ? ((totalCorrect / totalSettled) * 100).toFixed(1) : '0'
      },
      avg_confidence: stats.confidence_count > 0 
        ? (stats.total_confidence / stats.confidence_count).toFixed(1) 
        : '0'
    });
  });

  return results.sort((a: any, b: any) => 
    parseFloat(b.overall.accuracy) - parseFloat(a.overall.accuracy)
  );
}

export async function getRecentPredictions(limit: number = 50): Promise<object[]> {
  const { data } = await supabase
    .from('prediction_sessions')
    .select(`
      *,
      ai_model_predictions (*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getDailyStats(days: number = 7): Promise<object[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('daily_model_summary')
    .select('*')
    .gte('summary_date', startDate.toISOString().split('T')[0])
    .order('summary_date', { ascending: false });

  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  checkDuplicatePrediction,
  savePredictionSession,
  settlePrediction,
  getOverallStats,
  getModelStats,
  getRecentPredictions,
  getDailyStats
};

