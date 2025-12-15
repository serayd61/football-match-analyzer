// src/lib/predictions.ts
// Tahmin kaydetme ve güncelleme fonksiyonları
// ⚠️ Bu dosya sadece veritabanı işlemleri yapar, prompt'lara dokunmaz!
// v2 - Fixed votes string parsing issue ("3/6" → 3)

import { getSupabaseAdmin } from './supabase';

interface PredictionData {
  fixtureId: number;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  
  // Agent sonuçları
  reports: {
    deepAnalysis?: any;
    stats?: any;
    odds?: any;
    strategy?: any;
    weightedConsensus?: any;
  };
  
  // Multi-model sonuçları
  multiModel?: {
    predictions?: any[];
    consensus?: any;
    modelAgreement?: number;
  };
}

/**
 * Parse votes string to integer
 * "3/6" → 3
 * "5/7" → 5
 * 3 → 3
 */
function parseVotes(votes: any): number | null {
  if (votes === null || votes === undefined) return null;
  
  // Eğer zaten number ise direkt döndür
  if (typeof votes === 'number') return votes;
  
  // String ise parse et
  if (typeof votes === 'string') {
    // "3/6" formatı
    if (votes.includes('/')) {
      const parts = votes.split('/');
      const num = parseInt(parts[0], 10);
      return isNaN(num) ? null : num;
    }
    // Sadece sayı
    const num = parseInt(votes, 10);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

/**
 * Parse agreement - handle both number and string formats
 */
function parseAgreement(agreement: any): number | null {
  if (agreement === null || agreement === undefined) return null;
  
  if (typeof agreement === 'number') return agreement;
  
  if (typeof agreement === 'string') {
    // "3/6" formatı → yüzdeye çevir
    if (agreement.includes('/')) {
      const parts = agreement.split('/');
      const numerator = parseInt(parts[0], 10);
      const denominator = parseInt(parts[1], 10);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator > 0) {
        return Math.round((numerator / denominator) * 100);
      }
    }
    // Direkt sayı
    const num = parseInt(agreement, 10);
    return isNaN(num) ? null : num;
  }
  
  return null;
}

/**
 * Tahmin sonuçlarını veritabanına kaydet
 */
export async function savePrediction(data: PredictionData): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { reports, multiModel } = data;
    const deep = reports.deepAnalysis;
    const stats = reports.stats;
    const odds = reports.odds;
    const strategy = reports.strategy;
    const consensus = reports.weightedConsensus;
    
    // Multi-model tahminlerini parse et
    const modelPredictions = multiModel?.predictions || [];
    const llamaPred = modelPredictions.find((p: any) => p.model?.includes('llama-3.3'));
    const nemotronPred = modelPredictions.find((p: any) => p.model?.includes('nemotron'));
    const deepseekPred = modelPredictions.find((p: any) => p.model?.includes('deepseek'));
    const mistralPred = modelPredictions.find((p: any) => p.model?.includes('mistral'));
    
    const predictionRow = {
      fixture_id: data.fixtureId,
      match_date: data.matchDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      home_team: data.homeTeam,
      away_team: data.awayTeam,
      league: data.league || null,
      
      // ═══════════════════════════════════════════════════
      // AGENT TAHMİNLERİ
      // ═══════════════════════════════════════════════════
      
      // Deep Analysis
      deep_over_under: deep?.overUnder?.prediction || null,
      deep_over_under_conf: deep?.overUnder?.confidence || null,
      deep_match_result: deep?.matchResult?.prediction || null,
      deep_match_result_conf: deep?.matchResult?.confidence || null,
      deep_btts: deep?.btts?.prediction || null,
      deep_btts_conf: deep?.btts?.confidence || null,
      deep_score_prediction: deep?.scorePrediction?.score || null,
      
      // Stats Agent
      stats_over_under: stats?.overUnder || null,
      stats_over_under_conf: stats?.overUnderConfidence || stats?.confidence || null,
      stats_match_result: stats?.matchResult || null,
      stats_match_result_conf: stats?.matchResultConfidence || stats?.confidence || null,
      stats_btts: stats?.btts || null,
      stats_btts_conf: stats?.bttsConfidence || stats?.confidence || null,
      
      // Odds Agent
      odds_over_under: odds?.recommendation || null,
      odds_over_under_conf: odds?.confidence || null,
      odds_match_result: odds?.matchWinnerValue || null,
      odds_btts: odds?.bttsValue || null,
      odds_value_bets: odds?.valueBets || null,
      
      // Strategy Agent
      strategy_best_bet_type: strategy?._bestBet?.type || strategy?.recommendedBets?.[0]?.type || null,
      strategy_best_bet_selection: strategy?._bestBet?.selection || strategy?.recommendedBets?.[0]?.selection || null,
      strategy_best_bet_conf: strategy?._bestBet?.confidence || strategy?.recommendedBets?.[0]?.confidence || null,
      strategy_risk_level: strategy?.riskAssessment?.level || strategy?.riskAssessment || null,
      
      // ═══════════════════════════════════════════════════
      // MULTI-MODEL TAHMİNLERİ
      // ═══════════════════════════════════════════════════
      
      llama_over_under: llamaPred?.overUnder || null,
      llama_match_result: llamaPred?.matchResult || null,
      llama_btts: llamaPred?.btts || null,
      
      nemotron_over_under: nemotronPred?.overUnder || null,
      nemotron_match_result: nemotronPred?.matchResult || null,
      nemotron_btts: nemotronPred?.btts || null,
      
      deepseek_over_under: deepseekPred?.overUnder || null,
      deepseek_match_result: deepseekPred?.matchResult || null,
      deepseek_btts: deepseekPred?.btts || null,
      
      mistral_over_under: mistralPred?.overUnder || null,
      mistral_match_result: mistralPred?.matchResult || null,
      mistral_btts: mistralPred?.btts || null,
      
      multi_model_agreement: multiModel?.modelAgreement || null,
      
      // ═══════════════════════════════════════════════════
      // FİNAL CONSENSUS
      // ═══════════════════════════════════════════════════
      
      final_over_under: consensus?.overUnder?.prediction || null,
      final_over_under_conf: consensus?.overUnder?.confidence || null,
      // ✅ FIX: Parse agreement properly (handles "3/6" string format)
      final_over_under_agreement: parseAgreement(consensus?.overUnder?.agreement) || parseVotes(consensus?.overUnder?.votes) || null,
      
      final_match_result: consensus?.matchResult?.prediction || null,
      final_match_result_conf: consensus?.matchResult?.confidence || null,
      // ✅ FIX: Parse agreement properly
      final_match_result_agreement: parseAgreement(consensus?.matchResult?.agreement) || parseVotes(consensus?.matchResult?.votes) || null,
      
      final_btts: consensus?.btts?.prediction || null,
      final_btts_conf: consensus?.btts?.confidence || null,
      // ✅ FIX: Parse agreement properly
      final_btts_agreement: parseAgreement(consensus?.btts?.agreement) || parseVotes(consensus?.btts?.votes) || null,
      
      final_best_bet_type: consensus?.bestBet?.type || null,
      final_best_bet_selection: consensus?.bestBet?.selection || null,
      final_best_bet_conf: consensus?.bestBet?.confidence || null,
      
      final_score_prediction: consensus?.scorePrediction?.score || null,
      final_risk_level: consensus?.riskLevel || null,
      
      // Ham veri (votes dahil tüm raw data burada saklanır)
      raw_data: {
        reports,
        multiModel,
        timestamp: new Date().toISOString(),
        // Votes bilgisi raw_data'da saklanır
        votesRaw: {
          matchResult: consensus?.matchResult?.votes,
          overUnder: consensus?.overUnder?.votes,
          btts: consensus?.btts?.votes,
          bestBet: consensus?.bestBet?.agreement,
        },
      },
    };
    
    // Upsert - aynı fixture_id varsa güncelle
    const { error } = await supabase
      .from('predictions')
      .upsert(predictionRow, { 
        onConflict: 'fixture_id',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error('❌ Prediction save error:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`✅ Prediction saved: ${data.homeTeam} vs ${data.awayTeam} (fixture: ${data.fixtureId})`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Prediction save error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Maç sonucunu güncelle ve doğrulukları hesapla
 */
export async function updatePredictionResult(
  fixtureId: number,
  homeScore: number,
  awayScore: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    const totalGoals = homeScore + awayScore;
    const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
    const actualBtts = (homeScore > 0 && awayScore > 0) ? 'Yes' : 'No';
    const actualMatchResult = homeScore > awayScore ? '1' : (awayScore > homeScore ? '2' : 'X');
    
    // Önce mevcut tahmini al
    const { data: prediction, error: fetchError } = await supabase
      .from('predictions')
      .select('*')
      .eq('fixture_id', fixtureId)
      .single();
    
    if (fetchError || !prediction) {
      return { success: false, error: 'Prediction not found' };
    }
    
    // Doğrulukları hesapla
    const checkOverUnder = (pred: string | null) => {
      if (!pred) return null;
      return pred.toLowerCase() === actualOverUnder.toLowerCase();
    };
    
    const checkMatchResult = (pred: string | null) => {
      if (!pred) return null;
      const p = pred.toUpperCase();
      if (p.includes('HOME') || p === '1') return actualMatchResult === '1';
      if (p.includes('AWAY') || p === '2') return actualMatchResult === '2';
      if (p.includes('DRAW') || p === 'X') return actualMatchResult === 'X';
      return p === actualMatchResult;
    };
    
    const checkBtts = (pred: string | null) => {
      if (!pred) return null;
      const p = pred.toLowerCase();
      if (p.includes('yes') || p.includes('var')) return actualBtts === 'Yes';
      if (p.includes('no') || p.includes('yok')) return actualBtts === 'No';
      return false;
    };
    
    // Best bet doğruluğu
    const checkBestBet = () => {
      const type = prediction.final_best_bet_type?.toLowerCase() || '';
      const selection = prediction.final_best_bet_selection?.toLowerCase() || '';
      
      if (type.includes('over') || type.includes('under')) {
        return checkOverUnder(selection.includes('over') ? 'Over' : 'Under');
      }
      if (type.includes('btts') || type.includes('kg')) {
        return checkBtts(selection);
      }
      if (type.includes('match') || type.includes('result') || type.includes('ms')) {
        return checkMatchResult(selection);
      }
      return null;
    };
    
    const updateData = {
      // Gerçek sonuçlar
      actual_home_score: homeScore,
      actual_away_score: awayScore,
      actual_total_goals: totalGoals,
      actual_over_under: actualOverUnder,
      actual_match_result: actualMatchResult,
      actual_btts: actualBtts,
      match_finished: true,
      result_updated_at: new Date().toISOString(),
      
      // Agent doğrulukları
      deep_over_under_correct: checkOverUnder(prediction.deep_over_under),
      deep_match_result_correct: checkMatchResult(prediction.deep_match_result),
      deep_btts_correct: checkBtts(prediction.deep_btts),
      
      stats_over_under_correct: checkOverUnder(prediction.stats_over_under),
      stats_match_result_correct: checkMatchResult(prediction.stats_match_result),
      stats_btts_correct: checkBtts(prediction.stats_btts),
      
      odds_over_under_correct: checkOverUnder(prediction.odds_over_under),
      odds_match_result_correct: checkMatchResult(prediction.odds_match_result),
      odds_btts_correct: checkBtts(prediction.odds_btts),
      
      // Model doğrulukları
      llama_over_under_correct: checkOverUnder(prediction.llama_over_under),
      nemotron_over_under_correct: checkOverUnder(prediction.nemotron_over_under),
      deepseek_over_under_correct: checkOverUnder(prediction.deepseek_over_under),
      mistral_over_under_correct: checkOverUnder(prediction.mistral_over_under),
      
      // Final doğrulukları
      final_over_under_correct: checkOverUnder(prediction.final_over_under),
      final_match_result_correct: checkMatchResult(prediction.final_match_result),
      final_btts_correct: checkBtts(prediction.final_btts),
      final_best_bet_correct: checkBestBet(),
    };
    
    const { error: updateError } = await supabase
      .from('predictions')
      .update(updateData)
      .eq('fixture_id', fixtureId);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    
    console.log(`✅ Result updated: Fixture ${fixtureId} → ${homeScore}-${awayScore}`);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Result update error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Performans istatistiklerini getir
 */
export async function getPerformanceStats(): Promise<any> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: agentPerf } = await supabase
      .from('agent_performance')
      .select('*')
      .single();
    
    const { data: confPerf } = await supabase
      .from('confidence_performance')
      .select('*');
    
    const { data: modelComp } = await supabase
      .from('model_comparison')
      .select('*');
    
    return {
      agentPerformance: agentPerf,
      confidencePerformance: confPerf,
      modelComparison: modelComp,
    };
    
  } catch (error) {
    console.error('❌ Stats fetch error:', error);
    return null;
  }
}

/**
 * Bekleyen tahminleri getir (sonuç güncellenmemiş)
 */
export async function getPendingPredictions(): Promise<any[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('predictions')
      .select('fixture_id, home_team, away_team, match_date, league')
      .eq('match_finished', false)
      .order('match_date', { ascending: true });
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error('❌ Pending fetch error:', error);
    return [];
  }
}

/**
 * Belirli bir tarihteki tahminleri getir
 */
export async function getPredictionsByDate(date: string): Promise<any[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_date', date)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
    
  } catch (error) {
    console.error('❌ Date fetch error:', error);
    return [];
  }
}

/**
 * Lig bazında performans getir
 */
export async function getLeaguePerformance(): Promise<any[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('predictions')
      .select('league, final_over_under_correct, final_match_result_correct, final_btts_correct')
      .eq('match_finished', true);
    
    if (error) throw error;
    
    // Lig bazında grupla
    const leagueStats: Record<string, { total: number; overUnder: number; matchResult: number; btts: number }> = {};
    
    (data || []).forEach((p: any) => {
      const league = p.league || 'Unknown';
      if (!leagueStats[league]) {
        leagueStats[league] = { total: 0, overUnder: 0, matchResult: 0, btts: 0 };
      }
      leagueStats[league].total++;
      if (p.final_over_under_correct) leagueStats[league].overUnder++;
      if (p.final_match_result_correct) leagueStats[league].matchResult++;
      if (p.final_btts_correct) leagueStats[league].btts++;
    });
    
    return Object.entries(leagueStats).map(([league, stats]) => ({
      league,
      total: stats.total,
      overUnderAccuracy: Math.round((stats.overUnder / stats.total) * 100),
      matchResultAccuracy: Math.round((stats.matchResult / stats.total) * 100),
      bttsAccuracy: Math.round((stats.btts / stats.total) * 100),
    })).sort((a, b) => b.total - a.total);
    
  } catch (error) {
    console.error('❌ League stats error:', error);
    return [];
  }
}
