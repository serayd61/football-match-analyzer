// ============================================================================
// DYNAMIC PROMPT SYSTEM - Agent'ların prompt'larını performansa göre günceller
// Kötü performans gösterdiğinde prompt'lara özel uyarılar ve öneriler ekler
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

export interface AgentPerformanceMetrics {
  agentName: string;
  league: string | null;
  recentAccuracy: number; // Son 30 maçtaki doğruluk oranı
  totalPredictions: number;
  trend: 'improving' | 'declining' | 'stable';
  weaknesses: string[]; // Zayıf olduğu alanlar (match_result, over_under, btts)
  strengths: string[]; // Güçlü olduğu alanlar
}

/**
 * Agent'ın performans metriklerini getir
 */
export async function getAgentPerformanceMetrics(
  agentName: string,
  league?: string | null
): Promise<AgentPerformanceMetrics | null> {
  try {
    const supabase = getSupabase();

    const { data: performance, error } = await (supabase
      .from('agent_performance') as any)
      .select('*')
      .eq('agent_name', agentName)
      .eq(league ? 'league' : 'league', league || null)
      .single();

    if (error || !performance) {
      return null;
    }

    // Trend hesapla (recent_30_mr_accuracy'ye göre)
    const recentAccuracy = performance.recent_30_mr_accuracy || 0;
    const trend: 'improving' | 'declining' | 'stable' = 
      recentAccuracy >= 60 ? 'improving' :
      recentAccuracy < 45 ? 'declining' : 'stable';

    // Zayıf ve güçlü alanları belirle
    const weaknesses: string[] = [];
    const strengths: string[] = [];

    if (performance.recent_30_mr_accuracy < 50) weaknesses.push('match_result');
    else if (performance.recent_30_mr_accuracy >= 60) strengths.push('match_result');

    if (performance.recent_30_ou_accuracy < 50) weaknesses.push('over_under');
    else if (performance.recent_30_ou_accuracy >= 60) strengths.push('over_under');

    if (performance.recent_30_btts_accuracy < 50) weaknesses.push('btts');
    else if (performance.recent_30_btts_accuracy >= 60) strengths.push('btts');

    return {
      agentName,
      league: performance.league,
      recentAccuracy,
      totalPredictions: performance.total_predictions || 0,
      trend,
      weaknesses,
      strengths
    };
  } catch (error) {
    console.error(`❌ Error getting agent performance metrics for ${agentName}:`, error);
    return null;
  }
}

/**
 * Performansa göre dinamik prompt uyarıları ve önerileri oluştur
 */
export async function generateDynamicPromptGuidance(
  agentName: string,
  league: string | null,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<string> {
  try {
    const metrics = await getAgentPerformanceMetrics(agentName, league);

    if (!metrics || metrics.totalPredictions < 10) {
      // Yeterli veri yoksa, standart prompt kullan
      return '';
    }

    let guidance = '';

    if (language === 'tr') {
      guidance += `\n═══════════════════════════════════════════════════════════════\n`;
      guidance += `🎯 PERFORMANS TABANLI PROMPT GÜNCELLEMESİ\n`;
      guidance += `═══════════════════════════════════════════════════════════════\n`;
      guidance += `Senin son ${metrics.totalPredictions} tahmindeki performans analizi:\n\n`;

      // Genel performans
      if (metrics.recentAccuracy >= 60) {
        guidance += `✅ İYİ PERFORMANS: Son 30 maçta %${metrics.recentAccuracy} doğruluk oranı.\n`;
        guidance += `   → Mevcut yaklaşımını koru, başarılı stratejini sürdür.\n\n`;
      } else if (metrics.recentAccuracy < 45) {
        guidance += `⚠️ DÜŞÜK PERFORMANS: Son 30 maçta sadece %${metrics.recentAccuracy} doğruluk oranı.\n`;
        guidance += `   → YAKLAŞIMINI DEĞİŞTİR! Mevcut metodun yeterince etkili değil.\n\n`;
      } else {
        guidance += `📊 ORTA PERFORMANS: Son 30 maçta %${metrics.recentAccuracy} doğruluk oranı.\n`;
        guidance += `   → İyileştirme fırsatı var, daha dikkatli analiz yap.\n\n`;
      }

      // Trend analizi
      if (metrics.trend === 'declining') {
        guidance += `📉 DÜŞÜŞ TRENDİ: Performansın son dönemde kötüleşiyor.\n`;
        guidance += `   → Daha konservatif tahminler yap, risk almak yerine güvenli seçeneklere yönel.\n`;
        guidance += `   → Veri kalitesini daha sıkı kontrol et, eksik verilerle tahmin yapma.\n\n`;
      } else if (metrics.trend === 'improving') {
        guidance += `📈 YÜKSELİŞ TRENDİ: Performansın son dönemde iyileşiyor.\n`;
        guidance += `   → Mevcut yaklaşımını sürdür, başarılı olduğun yöntemleri kullanmaya devam et.\n\n`;
      }

      // Zayıf alanlar
      if (metrics.weaknesses.length > 0) {
        guidance += `❌ ZAYIF OLDUĞUN ALANLAR:\n`;
        metrics.weaknesses.forEach(weakness => {
          if (weakness === 'match_result') {
            guidance += `   - Maç Sonucu Tahmini: Son dönemde maç sonucu tahminlerinde başarısız oldun.\n`;
            guidance += `     → Daha fazla form analizi yap, H2H verilerini daha dikkatli değerlendir.\n`;
            guidance += `     → Ev sahibi avantajını daha fazla dikkate al.\n`;
          } else if (weakness === 'over_under') {
            guidance += `   - Over/Under Tahmini: Son dönemde gol tahminlerinde başarısız oldun.\n`;
            guidance += `     → xG verilerini daha fazla kullan, takım saldırı/defans istatistiklerini daha detaylı analiz et.\n`;
            guidance += `     → Lig ortalamalarını daha fazla dikkate al.\n`;
          } else if (weakness === 'btts') {
            guidance += `   - BTTS Tahmini: Son dönemde karşılıklı gol tahminlerinde başarısız oldun.\n`;
            guidance += `     → Her iki takımın da gol atma/ye me oranlarını daha detaylı incele.\n`;
            guidance += `     → Clean sheet istatistiklerini daha fazla dikkate al.\n`;
          }
        });
        guidance += `\n`;
      }

      // Güçlü alanlar
      if (metrics.strengths.length > 0) {
        guidance += `✅ GÜÇLÜ OLDUĞUN ALANLAR:\n`;
        metrics.strengths.forEach(strength => {
          if (strength === 'match_result') {
            guidance += `   - Maç Sonucu Tahmini: Bu alanda başarılısın, mevcut yaklaşımını sürdür.\n`;
          } else if (strength === 'over_under') {
            guidance += `   - Over/Under Tahmini: Bu alanda başarılısın, mevcut metodunu kullanmaya devam et.\n`;
          } else if (strength === 'btts') {
            guidance += `   - BTTS Tahmini: Bu alanda başarılısın, analiz yöntemini koru.\n`;
          }
        });
        guidance += `\n`;
      }

      // Özel öneriler
      if (metrics.recentAccuracy < 45 && metrics.weaknesses.length >= 2) {
        guidance += `🚨 KRİTİK UYARI: Performansın kritik seviyede düşük.\n`;
        guidance += `   → Tüm tahmin yöntemlerini gözden geçir.\n`;
        guidance += `   → Daha fazla veri topla, eksik bilgilerle tahmin yapma.\n`;
        guidance += `   → Konservatif yaklaşım benimse, yüksek güven seviyesi olmayan tahminler yapma.\n`;
        guidance += `   → Diğer agent'ların sonuçlarını daha fazla dikkate al.\n\n`;
      }

      guidance += `═══════════════════════════════════════════════════════════════\n`;
      guidance += `Bu performans analizini kullanarak tahmin kaliteni artır.\n`;
      guidance += `Geçmiş hatalarından öğren ve aynı hataları tekrarlama.\n`;
      guidance += `═══════════════════════════════════════════════════════════════\n`;

    } else if (language === 'en') {
      guidance += `\n═══════════════════════════════════════════════════════════════\n`;
      guidance += `🎯 PERFORMANCE-BASED PROMPT UPDATE\n`;
      guidance += `═══════════════════════════════════════════════════════════════\n`;
      guidance += `Your performance analysis from the last ${metrics.totalPredictions} predictions:\n\n`;

      // General performance
      if (metrics.recentAccuracy >= 60) {
        guidance += `✅ GOOD PERFORMANCE: ${metrics.recentAccuracy}% accuracy in last 30 matches.\n`;
        guidance += `   → Maintain your current approach, continue your successful strategy.\n\n`;
      } else if (metrics.recentAccuracy < 45) {
        guidance += `⚠️ LOW PERFORMANCE: Only ${metrics.recentAccuracy}% accuracy in last 30 matches.\n`;
        guidance += `   → CHANGE YOUR APPROACH! Your current method is not effective enough.\n\n`;
      } else {
        guidance += `📊 AVERAGE PERFORMANCE: ${metrics.recentAccuracy}% accuracy in last 30 matches.\n`;
        guidance += `   → Room for improvement, be more careful in your analysis.\n\n`;
      }

      // Trend analysis
      if (metrics.trend === 'declining') {
        guidance += `📉 DECLINING TREND: Your performance has been worsening recently.\n`;
        guidance += `   → Make more conservative predictions, prefer safe options over risky ones.\n`;
        guidance += `   → Check data quality more strictly, don't predict with incomplete data.\n\n`;
      } else if (metrics.trend === 'improving') {
        guidance += `📈 IMPROVING TREND: Your performance has been improving recently.\n`;
        guidance += `   → Continue your current approach, keep using methods that work.\n\n`;
      }

      // Weaknesses
      if (metrics.weaknesses.length > 0) {
        guidance += `❌ YOUR WEAK AREAS:\n`;
        metrics.weaknesses.forEach(weakness => {
          if (weakness === 'match_result') {
            guidance += `   - Match Result Prediction: You've been unsuccessful in match result predictions recently.\n`;
            guidance += `     → Do more form analysis, evaluate H2H data more carefully.\n`;
            guidance += `     → Consider home advantage more.\n`;
          } else if (weakness === 'over_under') {
            guidance += `   - Over/Under Prediction: You've been unsuccessful in goal predictions recently.\n`;
            guidance += `     → Use xG data more, analyze team attack/defense stats in more detail.\n`;
            guidance += `     → Consider league averages more.\n`;
          } else if (weakness === 'btts') {
            guidance += `   - BTTS Prediction: You've been unsuccessful in both teams to score predictions recently.\n`;
            guidance += `     → Examine both teams' goal scoring/conceding rates in more detail.\n`;
            guidance += `     → Consider clean sheet statistics more.\n`;
          }
        });
        guidance += `\n`;
      }

      // Strengths
      if (metrics.strengths.length > 0) {
        guidance += `✅ YOUR STRONG AREAS:\n`;
        metrics.strengths.forEach(strength => {
          if (strength === 'match_result') {
            guidance += `   - Match Result Prediction: You're successful in this area, maintain your current approach.\n`;
          } else if (strength === 'over_under') {
            guidance += `   - Over/Under Prediction: You're successful in this area, continue using your current method.\n`;
          } else if (strength === 'btts') {
            guidance += `   - BTTS Prediction: You're successful in this area, keep your analysis method.\n`;
          }
        });
        guidance += `\n`;
      }

      // Special recommendations
      if (metrics.recentAccuracy < 45 && metrics.weaknesses.length >= 2) {
        guidance += `🚨 CRITICAL WARNING: Your performance is critically low.\n`;
        guidance += `   → Review all prediction methods.\n`;
        guidance += `   → Collect more data, don't predict with incomplete information.\n`;
        guidance += `   → Adopt a conservative approach, don't make predictions without high confidence.\n`;
        guidance += `   → Consider other agents' results more.\n\n`;
      }

      guidance += `═══════════════════════════════════════════════════════════════\n`;
      guidance += `Use this performance analysis to improve your prediction quality.\n`;
      guidance += `Learn from past mistakes and don't repeat the same errors.\n`;
      guidance += `═══════════════════════════════════════════════════════════════\n`;

    } else {
      // German version (similar structure)
      guidance += `\n═══════════════════════════════════════════════════════════════\n`;
      guidance += `🎯 LEISTUNGSBASIERTE PROMPT-AKTUALISIERUNG\n`;
      guidance += `═══════════════════════════════════════════════════════════════\n`;
      // ... (German translations)
    }

    return guidance;
  } catch (error) {
    console.error(`❌ Error generating dynamic prompt guidance:`, error);
    return '';
  }
}
