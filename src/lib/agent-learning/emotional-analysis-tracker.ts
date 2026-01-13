// ============================================================================
// EMOTIONAL ANALYSIS TRACKER
// Agent'ların duygusal analiz skorlarını ölçer ve veritabanında saklar
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

export interface EmotionalAnalysisScore {
  agentName: string;
  fixtureId: number;
  emotionalScore: number; // 0-100: Duygusal analizin tahmin başarısına katkısı
  dataScore: number; // 0-100: Veri analizinin tahmin başarısına katkısı
  emotionalWeight: number; // 0-1: Duygusal analizin ağırlığı (hedef: 0.5)
  dataWeight: number; // 0-1: Veri analizinin ağırlığı (hedef: 0.5)
  predictionCorrect: boolean | null; // Tahmin doğru mu?
  emotionalFactors: string[]; // Kullanılan duygusal faktörler
  timestamp: string;
}

/**
 * Agent'ın duygusal analiz skorunu kaydet
 */
export async function recordEmotionalAnalysis(
  agentName: string,
  fixtureId: number,
  emotionalScore: number,
  dataScore: number,
  emotionalWeight: number,
  dataWeight: number,
  emotionalFactors: string[],
  predictionCorrect: boolean | null = null
): Promise<boolean> {
  try {
    const supabase = getSupabase();

    const { error } = await (supabase as any)
      .from('agent_emotional_analysis')
      .upsert({
        agent_name: agentName,
        fixture_id: fixtureId,
        emotional_score: emotionalScore,
        data_score: dataScore,
        emotional_weight: emotionalWeight,
        data_weight: dataWeight,
        emotional_factors: emotionalFactors,
        prediction_correct: predictionCorrect,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'agent_name,fixture_id'
      });

    if (error) {
      console.error(`❌ Error recording emotional analysis for ${agentName}:`, error);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`❌ Error recording emotional analysis:`, error.message);
    return false;
  }
}

/**
 * Agent'ın duygusal analiz performansını getir
 */
export async function getEmotionalAnalysisPerformance(
  agentName: string,
  league?: string,
  daysBack: number = 30
): Promise<{
  totalPredictions: number;
  emotionalAccuracy: number; // Duygusal analiz kullanıldığında doğruluk
  dataAccuracy: number; // Veri analizi kullanıldığında doğruluk
  combinedAccuracy: number; // Kombine kullanımda doğruluk
  avgEmotionalWeight: number;
  avgDataWeight: number;
  emotionalSuccessRate: number; // Duygusal faktörlerin başarı oranı
} | null> {
  try {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    let query = (supabase as any)
      .from('agent_emotional_analysis')
      .select('*')
      .eq('agent_name', agentName)
      .not('prediction_correct', 'is', null)
      .gte('created_at', cutoffDate.toISOString());

    if (league) {
      // League bilgisi için unified_analysis ile join gerekebilir
      // Şimdilik basit tutuyoruz
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }

    const total = data.length;
    const emotionalPredictions = data.filter((d: any) => d.emotional_weight >= 0.4);
    const dataPredictions = data.filter((d: any) => d.data_weight >= 0.4);
    const combinedPredictions = data.filter((d: any) => 
      d.emotional_weight >= 0.3 && d.data_weight >= 0.3
    );

    const emotionalCorrect = emotionalPredictions.filter((d: any) => d.prediction_correct).length;
    const dataCorrect = dataPredictions.filter((d: any) => d.prediction_correct).length;
    const combinedCorrect = combinedPredictions.filter((d: any) => d.prediction_correct).length;

    const avgEmotionalWeight = data.reduce((sum: number, d: any) => sum + d.emotional_weight, 0) / total;
    const avgDataWeight = data.reduce((sum: number, d: any) => sum + d.data_weight, 0) / total;

    // Duygusal faktörlerin başarı oranı
    const emotionalSuccessRate = emotionalPredictions.length > 0
      ? (emotionalCorrect / emotionalPredictions.length) * 100
      : 0;

    return {
      totalPredictions: total,
      emotionalAccuracy: emotionalPredictions.length > 0
        ? (emotionalCorrect / emotionalPredictions.length) * 100
        : 0,
      dataAccuracy: dataPredictions.length > 0
        ? (dataCorrect / dataPredictions.length) * 100
        : 0,
      combinedAccuracy: combinedPredictions.length > 0
        ? (combinedCorrect / combinedPredictions.length) * 100
        : 0,
      avgEmotionalWeight: avgEmotionalWeight * 100,
      avgDataWeight: avgDataWeight * 100,
      emotionalSuccessRate
    };
  } catch (error: any) {
    console.error(`❌ Error getting emotional analysis performance:`, error.message);
    return null;
  }
}
