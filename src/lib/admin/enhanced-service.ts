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
  ht_home?: number;
  ht_away?: number;
  corners_home?: number;
  corners_away?: number;
  cards_home?: number;
  cards_away?: number;
  first_goal_team?: 'home' | 'away' | 'none';
  first_goal_minute?: number;
  result_source: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFESSIONAL MARKET PREDICTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ProfessionalMarketPrediction {
  fixture_id: number;
  home_team: string;
  away_team: string;
  league?: string;
  match_date: string;
  
  // Core Markets
  match_result_selection?: string;
  match_result_confidence?: number;
  over_under_25_selection?: string;
  over_under_25_confidence?: number;
  over_under_15_selection?: string;
  over_under_15_confidence?: number;
  over_under_35_selection?: string;
  over_under_35_confidence?: number;
  btts_selection?: string;
  btts_confidence?: number;
  
  // First Half Markets
  fh_result_selection?: string;
  fh_result_confidence?: number;
  fh_over_05_selection?: string;
  fh_over_05_confidence?: number;
  fh_over_15_selection?: string;
  fh_over_15_confidence?: number;
  fh_btts_selection?: string;
  fh_btts_confidence?: number;
  
  // Special Markets
  htft_selection?: string;
  htft_confidence?: number;
  asian_hc_selection?: string;
  asian_hc_confidence?: number;
  first_goal_selection?: string;
  first_goal_confidence?: number;
  
  // Team Goals
  home_over_05_selection?: string;
  home_over_05_confidence?: number;
  away_over_05_selection?: string;
  away_over_05_confidence?: number;
  home_over_15_selection?: string;
  home_over_15_confidence?: number;
  away_over_15_selection?: string;
  away_over_15_confidence?: number;
  
  // Combo Bets
  home_and_over_15_selection?: string;
  home_and_over_15_confidence?: number;
  away_and_over_15_selection?: string;
  away_and_over_15_confidence?: number;
  draw_and_under_25_selection?: string;
  draw_and_under_25_confidence?: number;
  btts_and_over_25_selection?: string;
  btts_and_over_25_confidence?: number;
  
  // Corners & Cards
  corners_selection?: string;
  corners_confidence?: number;
  cards_selection?: string;
  cards_confidence?: number;
  exact_goals_selection?: string;
  exact_goals_confidence?: number;
  
  // Safe Bets
  safe_bet_1_market?: string;
  safe_bet_1_selection?: string;
  safe_bet_1_confidence?: number;
  safe_bet_2_market?: string;
  safe_bet_2_selection?: string;
  safe_bet_2_confidence?: number;
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
  console.log('📊 getOverallStats: Starting...');
  
  const { data: sessions, error, count } = await supabase
    .from('prediction_sessions')
    .select('*', { count: 'exact' });

  console.log('📊 getOverallStats: Query result:', {
    error: error ? error.message : null,
    dataLength: sessions?.length || 0,
    count
  });

  if (error) {
    console.error('❌ getOverallStats Error:', error);
    return {
      total_predictions: 0,
      settled_predictions: 0,
      pending_predictions: 0,
      btts: { total: 0, correct: 0, accuracy: '0' },
      over_under: { total: 0, correct: 0, accuracy: '0' },
      match_result: { total: 0, correct: 0, accuracy: '0' }
    };
  }

  if (!sessions || sessions.length === 0) {
    console.log('⚠️ getOverallStats: No sessions found');
    return {
      total_predictions: 0,
      settled_predictions: 0,
      pending_predictions: 0,
      btts: { total: 0, correct: 0, accuracy: '0' },
      over_under: { total: 0, correct: 0, accuracy: '0' },
      match_result: { total: 0, correct: 0, accuracy: '0' }
    };
  }

  console.log('✅ getOverallStats: Found', sessions.length, 'sessions');

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
// PROFESSIONAL MARKET PREDICTIONS - SAVE
// ═══════════════════════════════════════════════════════════════════════════

export async function saveProfessionalMarketPrediction(
  prediction: ProfessionalMarketPrediction
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Check for duplicate
    const { data: existing } = await supabase
      .from('professional_market_predictions')
      .select('id')
      .eq('fixture_id', prediction.fixture_id)
      .single();

    if (existing) {
      console.log(`⚠️ Professional market prediction already exists for fixture ${prediction.fixture_id}`);
      return { success: false, error: 'Duplicate prediction' };
    }

    // Insert prediction
    const { data, error } = await supabase
      .from('professional_market_predictions')
      .insert(prediction)
      .select('id')
      .single();

    if (error) {
      console.error('Error saving professional market prediction:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Professional market prediction saved for ${prediction.home_team} vs ${prediction.away_team}`);
    return { success: true, id: data.id };

  } catch (error) {
    console.error('Error in saveProfessionalMarketPrediction:', error);
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFESSIONAL MARKET PREDICTIONS - SETTLE
// ═══════════════════════════════════════════════════════════════════════════

export async function settleProfessionalMarketPrediction(
  fixtureId: number,
  result: MatchResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const { 
      home_score, 
      away_score, 
      ht_home = null, 
      ht_away = null,
      corners_home = null,
      corners_away = null,
      cards_home = null,
      cards_away = null,
      first_goal_team = null,
      first_goal_minute = null,
      result_source 
    } = result;

    const total_goals = home_score + away_score;
    const ht_total = (ht_home !== null && ht_away !== null) ? ht_home + ht_away : null;
    const total_corners = (corners_home !== null && corners_away !== null) ? corners_home + corners_away : null;
    const total_cards = (cards_home !== null && cards_away !== null) ? cards_home + cards_away : null;

    // Get the prediction
    const { data: prediction, error: fetchError } = await supabase
      .from('professional_market_predictions')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('is_settled', false)
      .single();

    if (fetchError || !prediction) {
      return { success: false, error: 'No pending prediction found' };
    }

    // Calculate correctness for each market
    const updates: Record<string, any> = {
      actual_home_score: home_score,
      actual_away_score: away_score,
      actual_ht_home: ht_home,
      actual_ht_away: ht_away,
      actual_corners_home: corners_home,
      actual_corners_away: corners_away,
      actual_cards_home: cards_home,
      actual_cards_away: cards_away,
      first_goal_team,
      first_goal_minute,
      is_settled: true,
      settled_at: new Date().toISOString(),
      result_source
    };

    // Match Result
    if (prediction.match_result_selection) {
      const actual = home_score > away_score ? '1' : home_score < away_score ? '2' : 'X';
      updates.match_result_correct = prediction.match_result_selection === actual;
    }

    // Over/Under 2.5
    if (prediction.over_under_25_selection) {
      const isOver = total_goals > 2.5;
      updates.over_under_25_correct = prediction.over_under_25_selection.toLowerCase().includes('over') === isOver;
    }

    // Over/Under 1.5
    if (prediction.over_under_15_selection) {
      const isOver = total_goals > 1.5;
      updates.over_under_15_correct = prediction.over_under_15_selection.toLowerCase().includes('over') === isOver;
    }

    // Over/Under 3.5
    if (prediction.over_under_35_selection) {
      const isOver = total_goals > 3.5;
      updates.over_under_35_correct = prediction.over_under_35_selection.toLowerCase().includes('over') === isOver;
    }

    // BTTS
    if (prediction.btts_selection) {
      const bttsActual = home_score > 0 && away_score > 0;
      const bttsPredicted = prediction.btts_selection.toLowerCase().includes('yes') || 
                           prediction.btts_selection.toLowerCase().includes('var');
      updates.btts_correct = bttsActual === bttsPredicted;
    }

    // First Half Result
    if (prediction.fh_result_selection && ht_home !== null && ht_away !== null) {
      const htActual = ht_home > ht_away ? '1' : ht_home < ht_away ? '2' : 'X';
      updates.fh_result_correct = prediction.fh_result_selection === htActual;
    }

    // First Half Over 0.5
    if (prediction.fh_over_05_selection && ht_total !== null) {
      const isOver = ht_total > 0.5;
      updates.fh_over_05_correct = prediction.fh_over_05_selection.toLowerCase().includes('over') === isOver;
    }

    // First Half Over 1.5
    if (prediction.fh_over_15_selection && ht_total !== null) {
      const isOver = ht_total > 1.5;
      updates.fh_over_15_correct = prediction.fh_over_15_selection.toLowerCase().includes('over') === isOver;
    }

    // First Half BTTS
    if (prediction.fh_btts_selection && ht_home !== null && ht_away !== null) {
      const htBttsActual = ht_home > 0 && ht_away > 0;
      const htBttsPredicted = prediction.fh_btts_selection.toLowerCase().includes('yes') ||
                              prediction.fh_btts_selection.toLowerCase().includes('var');
      updates.fh_btts_correct = htBttsActual === htBttsPredicted;
    }

    // HT/FT
    if (prediction.htft_selection && ht_home !== null && ht_away !== null) {
      const htResult = ht_home > ht_away ? '1' : ht_home < ht_away ? '2' : 'X';
      const ftResult = home_score > away_score ? '1' : home_score < away_score ? '2' : 'X';
      const actualHtFt = `${htResult}/${ftResult}`;
      updates.htft_correct = prediction.htft_selection === actualHtFt;
    }

    // Home Over 0.5
    if (prediction.home_over_05_selection) {
      const isOver = home_score > 0.5;
      updates.home_over_05_correct = prediction.home_over_05_selection.toLowerCase().includes('over') === isOver;
    }

    // Away Over 0.5
    if (prediction.away_over_05_selection) {
      const isOver = away_score > 0.5;
      updates.away_over_05_correct = prediction.away_over_05_selection.toLowerCase().includes('over') === isOver;
    }

    // Home Over 1.5
    if (prediction.home_over_15_selection) {
      const isOver = home_score > 1.5;
      updates.home_over_15_correct = prediction.home_over_15_selection.toLowerCase().includes('over') === isOver;
    }

    // Away Over 1.5
    if (prediction.away_over_15_selection) {
      const isOver = away_score > 1.5;
      updates.away_over_15_correct = prediction.away_over_15_selection.toLowerCase().includes('over') === isOver;
    }

    // First Goal
    if (prediction.first_goal_selection && first_goal_team) {
      const predictedFirst = prediction.first_goal_selection.toLowerCase();
      updates.first_goal_correct = 
        (predictedFirst.includes('home') && first_goal_team === 'home') ||
        (predictedFirst.includes('away') && first_goal_team === 'away') ||
        (predictedFirst.includes('no') && first_goal_team === 'none');
    }

    // Corners
    if (prediction.corners_selection && total_corners !== null) {
      const match = prediction.corners_selection.match(/[\d.]+/);
      if (match) {
        const line = parseFloat(match[0]);
        const isOver = prediction.corners_selection.toLowerCase().includes('over');
        updates.corners_correct = isOver ? total_corners > line : total_corners < line;
      }
    }

    // Cards
    if (prediction.cards_selection && total_cards !== null) {
      const match = prediction.cards_selection.match(/[\d.]+/);
      if (match) {
        const line = parseFloat(match[0]);
        const isOver = prediction.cards_selection.toLowerCase().includes('over');
        updates.cards_correct = isOver ? total_cards > line : total_cards < line;
      }
    }

    // Combo: Home & Over 1.5
    if (prediction.home_and_over_15_selection) {
      const homeWin = home_score > away_score;
      const over15 = total_goals > 1.5;
      updates.home_and_over_15_correct = homeWin && over15;
    }

    // Combo: Away & Over 1.5
    if (prediction.away_and_over_15_selection) {
      const awayWin = home_score < away_score;
      const over15 = total_goals > 1.5;
      updates.away_and_over_15_correct = awayWin && over15;
    }

    // Combo: Draw & Under 2.5
    if (prediction.draw_and_under_25_selection) {
      const isDraw = home_score === away_score;
      const under25 = total_goals < 2.5;
      updates.draw_and_under_25_correct = isDraw && under25;
    }

    // Combo: BTTS & Over 2.5
    if (prediction.btts_and_over_25_selection) {
      const btts = home_score > 0 && away_score > 0;
      const over25 = total_goals > 2.5;
      updates.btts_and_over_25_correct = btts && over25;
    }

    // Safe Bets
    if (prediction.safe_bet_1_market && prediction.safe_bet_1_selection) {
      updates.safe_bet_1_correct = checkMarketCorrect(
        prediction.safe_bet_1_market,
        prediction.safe_bet_1_selection,
        { home_score, away_score, ht_home, ht_away, total_corners, total_cards, first_goal_team }
      );
    }

    if (prediction.safe_bet_2_market && prediction.safe_bet_2_selection) {
      updates.safe_bet_2_correct = checkMarketCorrect(
        prediction.safe_bet_2_market,
        prediction.safe_bet_2_selection,
        { home_score, away_score, ht_home, ht_away, total_corners, total_cards, first_goal_team }
      );
    }

    // Update the prediction
    const { error: updateError } = await supabase
      .from('professional_market_predictions')
      .update(updates)
      .eq('id', prediction.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    console.log(`✅ Professional market prediction settled for fixture ${fixtureId}`);
    return { success: true };

  } catch (error) {
    console.error('Error settling professional market prediction:', error);
    return { success: false, error: String(error) };
  }
}

function checkMarketCorrect(
  market: string,
  selection: string,
  results: {
    home_score: number;
    away_score: number;
    ht_home: number | null;
    ht_away: number | null;
    total_corners: number | null;
    total_cards: number | null;
    first_goal_team: string | null;
  }
): boolean | null {
  const marketLower = market.toLowerCase();
  const selectionLower = selection.toLowerCase();
  const total_goals = results.home_score + results.away_score;

  // Match Result
  if (marketLower.includes('sonucu') || marketLower.includes('result') || marketLower.includes('winner')) {
    const actual = results.home_score > results.away_score ? '1' : 
                   results.home_score < results.away_score ? '2' : 'x';
    return selectionLower.includes(actual);
  }

  // Over/Under 2.5
  if (marketLower.includes('2.5')) {
    const isOver = total_goals > 2.5;
    return selectionLower.includes('over') === isOver || selectionLower.includes('üst') === isOver;
  }

  // BTTS
  if (marketLower.includes('btts') || marketLower.includes('karşılıklı') || marketLower.includes('kg')) {
    const btts = results.home_score > 0 && results.away_score > 0;
    const predictedYes = selectionLower.includes('yes') || selectionLower.includes('var');
    return btts === predictedYes;
  }

  // Home Over 0.5
  if ((marketLower.includes('home') || marketLower.includes('ev')) && marketLower.includes('0.5')) {
    return results.home_score > 0;
  }

  // Away Over 0.5
  if ((marketLower.includes('away') || marketLower.includes('deplasman')) && marketLower.includes('0.5')) {
    return results.away_score > 0;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFESSIONAL MARKET STATS
// ═══════════════════════════════════════════════════════════════════════════

export async function getProfessionalMarketStats(): Promise<{
  overview: Record<string, any>;
  markets: Record<string, { total: number; correct: number; accuracy: string; avgConfidence: string }>;
  recent: any[];
}> {
  // Get all predictions
  const { data: predictions } = await supabase
    .from('professional_market_predictions')
    .select('*')
    .order('created_at', { ascending: false });

  if (!predictions || predictions.length === 0) {
    return {
      overview: {
        total: 0,
        settled: 0,
        pending: 0
      },
      markets: {},
      recent: []
    };
  }

  const settled = predictions.filter(p => p.is_settled);
  const pending = predictions.filter(p => !p.is_settled);

  // Calculate stats for each market
  const marketStats: Record<string, { total: number; correct: number; totalConfidence: number }> = {};

  const marketFields = [
    { field: 'match_result', conf: 'match_result_confidence' },
    { field: 'over_under_25', conf: 'over_under_25_confidence' },
    { field: 'over_under_15', conf: 'over_under_15_confidence' },
    { field: 'over_under_35', conf: 'over_under_35_confidence' },
    { field: 'btts', conf: 'btts_confidence' },
    { field: 'fh_result', conf: 'fh_result_confidence' },
    { field: 'fh_over_05', conf: 'fh_over_05_confidence' },
    { field: 'fh_over_15', conf: 'fh_over_15_confidence' },
    { field: 'fh_btts', conf: 'fh_btts_confidence' },
    { field: 'htft', conf: 'htft_confidence' },
    { field: 'asian_hc', conf: 'asian_hc_confidence' },
    { field: 'first_goal', conf: 'first_goal_confidence' },
    { field: 'home_over_05', conf: 'home_over_05_confidence' },
    { field: 'away_over_05', conf: 'away_over_05_confidence' },
    { field: 'home_over_15', conf: 'home_over_15_confidence' },
    { field: 'away_over_15', conf: 'away_over_15_confidence' },
    { field: 'home_and_over_15', conf: 'home_and_over_15_confidence' },
    { field: 'away_and_over_15', conf: 'away_and_over_15_confidence' },
    { field: 'draw_and_under_25', conf: 'draw_and_under_25_confidence' },
    { field: 'btts_and_over_25', conf: 'btts_and_over_25_confidence' },
    { field: 'corners', conf: 'corners_confidence' },
    { field: 'cards', conf: 'cards_confidence' },
    { field: 'safe_bet_1', conf: 'safe_bet_1_confidence' },
    { field: 'safe_bet_2', conf: 'safe_bet_2_confidence' },
  ];

  for (const pred of settled) {
    for (const { field, conf } of marketFields) {
      const correctField = `${field}_correct`;
      if (pred[correctField] !== null && pred[correctField] !== undefined) {
        if (!marketStats[field]) {
          marketStats[field] = { total: 0, correct: 0, totalConfidence: 0 };
        }
        marketStats[field].total++;
        if (pred[correctField]) marketStats[field].correct++;
        if (pred[conf]) marketStats[field].totalConfidence += pred[conf];
      }
    }
  }

  // Format market stats
  const formattedMarkets: Record<string, { total: number; correct: number; accuracy: string; avgConfidence: string }> = {};
  
  for (const [market, stats] of Object.entries(marketStats)) {
    formattedMarkets[market] = {
      total: stats.total,
      correct: stats.correct,
      accuracy: stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : '0',
      avgConfidence: stats.total > 0 ? (stats.totalConfidence / stats.total).toFixed(1) : '0'
    };
  }

  return {
    overview: {
      total: predictions.length,
      settled: settled.length,
      pending: pending.length
    },
    markets: formattedMarkets,
    recent: predictions.slice(0, 50).map(p => ({
      id: p.id,
      fixture_id: p.fixture_id,
      home_team: p.home_team,
      away_team: p.away_team,
      league: p.league,
      match_date: p.match_date,
      is_settled: p.is_settled,
      actual_home_score: p.actual_home_score,
      actual_away_score: p.actual_away_score,
      // Core predictions
      match_result: { selection: p.match_result_selection, confidence: p.match_result_confidence, correct: p.match_result_correct },
      over_under_25: { selection: p.over_under_25_selection, confidence: p.over_under_25_confidence, correct: p.over_under_25_correct },
      btts: { selection: p.btts_selection, confidence: p.btts_confidence, correct: p.btts_correct },
      // Safe bets
      safe_bet_1: { market: p.safe_bet_1_market, selection: p.safe_bet_1_selection, confidence: p.safe_bet_1_confidence, correct: p.safe_bet_1_correct },
      safe_bet_2: { market: p.safe_bet_2_market, selection: p.safe_bet_2_selection, confidence: p.safe_bet_2_confidence, correct: p.safe_bet_2_correct },
      created_at: p.created_at
    }))
  };
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
  getDailyStats,
  // Professional Markets
  saveProfessionalMarketPrediction,
  settleProfessionalMarketPrediction,
  getProfessionalMarketStats
};

