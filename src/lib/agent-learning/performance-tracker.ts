// ============================================================================
// AGENT PERFORMANCE TRACKER
// Öğrenen agent sistemi - performans takibi ve otomatik ağırlık ayarlama
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

// Agent adlarını normalize et
function normalizeAgentName(agentName: string): string {
  const mapping: Record<string, string> = {
    'stats': 'stats',
    'statsAgent': 'stats',
    'odds': 'odds',
    'oddsAgent': 'odds',
    'deepAnalysis': 'deepAnalysis',
    'deepAnalysisAgent': 'deepAnalysis',
    'masterStrategist': 'masterStrategist',
    'masterStrategistAgent': 'masterStrategist',
    'devilsAdvocate': 'devilsAdvocate',
    'geniusAnalyst': 'geniusAnalyst',
  };
  return mapping[agentName] || agentName.toLowerCase();
}

// Agent tahminini kaydet
export async function recordAgentPrediction(
  fixtureId: number,
  agentName: string,
  predictions: {
    matchResult?: { prediction: string; confidence: number };
    overUnder?: { prediction: string; confidence: number };
    btts?: { prediction: string; confidence: number };
  },
  league?: string,
  matchDate?: string
): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const normalizedAgent = normalizeAgentName(agentName);

    const { error } = await supabase
      .from('agent_predictions')
      .upsert({
        fixture_id: fixtureId,
        agent_name: normalizedAgent,
        league: league || null,
        match_date: matchDate || new Date().toISOString().split('T')[0],
        match_result_prediction: predictions.matchResult?.prediction || null,
        match_result_confidence: predictions.matchResult?.confidence || null,
        over_under_prediction: predictions.overUnder?.prediction || null,
        over_under_confidence: predictions.overUnder?.confidence || null,
        btts_prediction: predictions.btts?.prediction || null,
        btts_confidence: predictions.btts?.confidence || null,
      }, {
        onConflict: 'agent_name,fixture_id'
      });

    if (error) {
      console.error(`❌ Error recording agent prediction (${normalizedAgent}):`, error);
      return false;
    }

    console.log(`✅ Agent prediction recorded: ${normalizedAgent} for fixture ${fixtureId}`);
    return true;
  } catch (error) {
    console.error(`❌ Exception recording agent prediction:`, error);
    return false;
  }
}

// Maç sonuçlandığında agent tahminlerini settle et
export async function settleAgentPredictions(
  fixtureId: number,
  actualResult: {
    homeGoals: number;
    awayGoals: number;
    matchResult: '1' | 'X' | '2';
    totalGoals: number;
    btts: boolean;
  }
): Promise<boolean> {
  try {
    const supabase = getSupabase();

    // Bu fixture için tüm agent tahminlerini bul
    const { data: predictions, error: fetchError } = await supabase
      .from('agent_predictions')
      .select('*')
      .eq('fixture_id', fixtureId)
      .is('settled_at', null);

    if (fetchError) {
      console.error('❌ Error fetching agent predictions:', fetchError);
      return false;
    }

    if (!predictions || predictions.length === 0) {
      console.log(`⚠️ No agent predictions found for fixture ${fixtureId}`);
      return false;
    }

    // Her tahmini doğrula ve güncelle
    for (const pred of predictions) {
      // Match Result doğruluğu
      const matchResultCorrect = pred.match_result_prediction 
        ? normalizeMatchResult(pred.match_result_prediction) === actualResult.matchResult
        : null;

      // Over/Under doğruluğu
      const overUnderCorrect = pred.over_under_prediction
        ? (pred.over_under_prediction.toLowerCase() === 'over' && actualResult.totalGoals > 2.5) ||
          (pred.over_under_prediction.toLowerCase() === 'under' && actualResult.totalGoals < 2.5)
        : null;

      // BTTS doğruluğu
      const bttsCorrect = pred.btts_prediction
        ? (pred.btts_prediction.toLowerCase() === 'yes' && actualResult.btts) ||
          (pred.btts_prediction.toLowerCase() === 'no' && !actualResult.btts)
        : null;

      // Güncelle
      const { error: updateError } = await supabase
        .from('agent_predictions')
        .update({
          match_result_correct: matchResultCorrect,
          over_under_correct: overUnderCorrect,
          btts_correct: bttsCorrect,
          actual_match_result: actualResult.matchResult,
          actual_home_goals: actualResult.homeGoals,
          actual_away_goals: actualResult.awayGoals,
          actual_total_goals: actualResult.totalGoals,
          actual_btts: actualResult.btts,
          settled_at: new Date().toISOString(),
        })
        .eq('id', pred.id);

      if (updateError) {
        console.error(`❌ Error settling prediction ${pred.id}:`, updateError);
      } else {
        console.log(`✅ Settled prediction for ${pred.agent_name} (MR: ${matchResultCorrect}, OU: ${overUnderCorrect}, BTTS: ${bttsCorrect})`);
      }
    }

    // Trigger otomatik olarak agent_performance'ı güncelleyecek
    return true;
  } catch (error) {
    console.error('❌ Exception settling agent predictions:', error);
    return false;
  }
}

// Match result'ı normalize et
function normalizeMatchResult(pred: string): '1' | 'X' | '2' {
  const normalized = String(pred).toLowerCase().trim();
  if (normalized === 'home' || normalized === '1') return '1';
  if (normalized === 'away' || normalized === '2') return '2';
  return 'X';
}

// Agent ağırlıklarını getir (unified consensus için)
export async function getAgentWeights(league?: string): Promise<Record<string, number>> {
  try {
    const supabase = getSupabase();

    // Supabase function'ı çağır
    const { data, error } = await supabase.rpc('get_agent_weights', {
      p_league: league || null
    });

    if (error) {
      console.warn('⚠️ Error getting agent weights, using defaults:', error);
      return getDefaultWeights();
    }

    // Agent ağırlıklarını map'e çevir
    const weights: Record<string, number> = {};
    if (data && Array.isArray(data)) {
      data.forEach((row: any) => {
        weights[row.agent_name] = parseFloat(row.weight) || 1.0;
      });
    }

    // Eksik agent'lar için default değerler
    const defaultWeights = getDefaultWeights();
    Object.keys(defaultWeights).forEach(agent => {
      if (!weights[agent]) {
        weights[agent] = defaultWeights[agent];
      }
    });

    console.log(`📊 Agent weights loaded:`, weights);
    return weights;
  } catch (error) {
    console.error('❌ Exception getting agent weights:', error);
    return getDefaultWeights();
  }
}

// Default ağırlıklar (yeni agent'lar için)
function getDefaultWeights(): Record<string, number> {
  return {
    stats: 1.0,
    odds: 1.0,
    deepAnalysis: 1.0,
    masterStrategist: 1.0,
    devilsAdvocate: 1.0,
    geniusAnalyst: 1.0,
  };
}

// Agent performans özetini getir
export async function getAgentPerformanceSummary(league?: string): Promise<any[]> {
  try {
    const supabase = getSupabase();

    let query = supabase
      .from('agent_performance')
      .select('*')
      .order('current_weight', { ascending: false });

    if (league) {
      query = query.eq('league', league);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error getting agent performance:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Exception getting agent performance:', error);
    return [];
  }
}
