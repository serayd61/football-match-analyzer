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

    // Debug log
    console.log(`🧠 Recording prediction: ${normalizedAgent} for fixture ${fixtureId}, league: ${league}, date: ${matchDate}`);
    console.log(`   MR: ${predictions.matchResult?.prediction}, OU: ${predictions.overUnder?.prediction}, BTTS: ${predictions.btts?.prediction}`);

    // Önce mevcut kaydı kontrol et
    const { data: existing } = await (supabase
      .from('agent_predictions') as any)
      .select('id')
      .eq('fixture_id', fixtureId)
      .eq('agent_name', normalizedAgent)
      .maybeSingle();

    const recordData = {
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
    };

    let result;
    if (existing?.id) {
      // Güncelle
      console.log(`   📝 Updating existing record (id: ${existing.id})`);
      result = await (supabase
        .from('agent_predictions') as any)
        .update(recordData)
        .eq('id', existing.id)
        .select();
    } else {
      // Yeni kayıt oluştur
      console.log(`   📝 Creating new record`);
      result = await (supabase
        .from('agent_predictions') as any)
        .insert(recordData)
        .select();
    }

    if (result.error) {
      console.error(`❌ Error recording agent prediction (${normalizedAgent}):`, result.error.message, result.error.code, result.error.details);
      return false;
    }

    console.log(`✅ Agent prediction recorded: ${normalizedAgent} for fixture ${fixtureId}`, result.data ? `(id: ${result.data[0]?.id})` : '');
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
    const { data: predictions, error: fetchError } = await (supabase
      .from('agent_predictions') as any)
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
      const { error: updateError } = await (supabase
        .from('agent_predictions') as any)
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
        
        // 🆕 LEARNING LOG: Ajan öğrenme kaydı oluştur
        try {
          // Match Result log
          if (pred.match_result_prediction) {
            await (supabase.from('agent_learning_log') as any).insert({
              fixture_id: fixtureId,
              agent_name: pred.agent_name,
              prediction_type: 'matchResult',
              prediction: pred.match_result_prediction,
              confidence: pred.match_result_confidence,
              actual_result: actualResult.matchResult,
              was_correct: matchResultCorrect,
              learning_context: {
                league: pred.league,
                homeGoals: actualResult.homeGoals,
                awayGoals: actualResult.awayGoals,
              },
            });
          }
          
          // Over/Under log
          if (pred.over_under_prediction) {
            await (supabase.from('agent_learning_log') as any).insert({
              fixture_id: fixtureId,
              agent_name: pred.agent_name,
              prediction_type: 'overUnder',
              prediction: pred.over_under_prediction,
              confidence: pred.over_under_confidence,
              actual_result: actualResult.totalGoals > 2.5 ? 'Over' : 'Under',
              was_correct: overUnderCorrect,
              learning_context: {
                league: pred.league,
                totalGoals: actualResult.totalGoals,
              },
            });
          }
          
          // BTTS log
          if (pred.btts_prediction) {
            await (supabase.from('agent_learning_log') as any).insert({
              fixture_id: fixtureId,
              agent_name: pred.agent_name,
              prediction_type: 'btts',
              prediction: pred.btts_prediction,
              confidence: pred.btts_confidence,
              actual_result: actualResult.btts ? 'Yes' : 'No',
              was_correct: bttsCorrect,
              learning_context: {
                league: pred.league,
                homeGoals: actualResult.homeGoals,
                awayGoals: actualResult.awayGoals,
              },
            });
          }
          
          console.log(`   📝 Learning logs created for ${pred.agent_name}`);
        } catch (logError) {
          console.warn(`   ⚠️ Could not create learning log: ${logError}`);
        }
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
    const { data, error } = await (supabase.rpc as any)('get_agent_weights', {
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

// ============================================================================
// AGENT SELF-PROFILE (Ajan Öz-Farkındalık)
// Her ajanın kendi performans profilini bilmesi için
// ============================================================================

export interface AgentSelfProfile {
  agentName: string;
  league: string;
  mrAccuracy: number;
  ouAccuracy: number;
  bttsAccuracy: number;
  overallAccuracy: number;
  totalMatches: number;
  trend: 'improving' | 'declining' | 'stable';
  strongMarket: 'mr' | 'ou' | 'btts' | 'none';
  weakMarket: 'mr' | 'ou' | 'btts' | 'none';
  currentWeight: number;
  recentForm: number; // Son 5 maç başarı oranı
}

export async function getAgentSelfProfile(agentName: string, league?: string): Promise<AgentSelfProfile | null> {
  try {
    const supabase = getSupabase();
    const normalizedAgent = normalizeAgentName(agentName);

    let query = (supabase
      .from('agent_performance') as any)
      .select('*')
      .eq('agent_name', normalizedAgent);

    if (league) {
      query = query.eq('league', league);
    } else {
      query = query.is('league', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return null;
    }

    const mrAcc = parseFloat(data.recent_match_result_accuracy || data.match_result_accuracy) || 0;
    const ouAcc = parseFloat(data.recent_over_under_accuracy || data.over_under_accuracy) || 0;
    const bttsAcc = parseFloat(data.recent_btts_accuracy || data.btts_accuracy) || 0;

    // Güçlü/zayıf market
    const accuracies = { mr: mrAcc, ou: ouAcc, btts: bttsAcc };
    const sorted = Object.entries(accuracies).sort((a, b) => b[1] - a[1]);
    const strongMarket = sorted[0][1] > 0 ? sorted[0][0] as 'mr' | 'ou' | 'btts' : 'none';
    const weakMarket = sorted[2][1] > 0 ? sorted[2][0] as 'mr' | 'ou' | 'btts' : 'none';

    return {
      agentName: normalizedAgent,
      league: league || 'genel',
      mrAccuracy: Math.round(mrAcc * 10) / 10,
      ouAccuracy: Math.round(ouAcc * 10) / 10,
      bttsAccuracy: Math.round(bttsAcc * 10) / 10,
      overallAccuracy: Math.round(((mrAcc + ouAcc + bttsAcc) / 3) * 10) / 10,
      totalMatches: data.total_matches || 0,
      trend: data.trend_direction || 'stable',
      strongMarket,
      weakMarket,
      currentWeight: parseFloat(data.current_weight) || 1.0,
      recentForm: parseFloat(data.recent_5_accuracy) || 0,
    };
  } catch (error) {
    console.warn(`⚠️ Could not get self-profile for ${agentName}:`, error);
    return null;
  }
}

// Tüm ajanların profillerini tek seferde al
export async function getAllAgentProfiles(league?: string): Promise<Record<string, AgentSelfProfile>> {
  const agents = ['stats', 'odds', 'deepAnalysis', 'masterStrategist', 'geniusAnalyst'];
  const profiles: Record<string, AgentSelfProfile> = {};

  try {
    const supabase = getSupabase();
    
    let query = (supabase
      .from('agent_performance') as any)
      .select('*')
      .in('agent_name', agents);

    if (league) {
      query = query.eq('league', league);
    } else {
      query = query.is('league', null);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn('⚠️ Could not fetch agent profiles:', error?.message);
      return profiles;
    }

    for (const row of data) {
      const mrAcc = parseFloat(row.recent_match_result_accuracy || row.match_result_accuracy) || 0;
      const ouAcc = parseFloat(row.recent_over_under_accuracy || row.over_under_accuracy) || 0;
      const bttsAcc = parseFloat(row.recent_btts_accuracy || row.btts_accuracy) || 0;

      const accuracies = { mr: mrAcc, ou: ouAcc, btts: bttsAcc };
      const sorted = Object.entries(accuracies).sort((a, b) => b[1] - a[1]);

      profiles[row.agent_name] = {
        agentName: row.agent_name,
        league: league || 'genel',
        mrAccuracy: Math.round(mrAcc * 10) / 10,
        ouAccuracy: Math.round(ouAcc * 10) / 10,
        bttsAccuracy: Math.round(bttsAcc * 10) / 10,
        overallAccuracy: Math.round(((mrAcc + ouAcc + bttsAcc) / 3) * 10) / 10,
        totalMatches: row.total_matches || 0,
        trend: row.trend_direction || 'stable',
        strongMarket: sorted[0][1] > 0 ? sorted[0][0] as 'mr' | 'ou' | 'btts' : 'none',
        weakMarket: sorted[2][1] > 0 ? sorted[2][0] as 'mr' | 'ou' | 'btts' : 'none',
        currentWeight: parseFloat(row.current_weight) || 1.0,
        recentForm: parseFloat(row.recent_5_accuracy) || 0,
      };
    }

    return profiles;
  } catch (error) {
    console.warn('⚠️ Could not fetch agent profiles:', error);
    return profiles;
  }
}

// Agent performans özetini getir
export async function getAgentPerformanceSummary(league?: string): Promise<any[]> {
  try {
    const supabase = getSupabase();

    let query = (supabase
      .from('agent_performance') as any)
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
