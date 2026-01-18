// src/lib/heurist/agents/masterStrategist.ts
// 🧠 MASTER STRATEGIST AGENT - %50 Veri + %25 Agent Yorumu + %25 Psikoloji Ağırlıklı Sistem

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { AgentResult } from '../orchestrator';
import { getLearningContext } from '../../ai-brain/learning-context';
import { ENHANCED_MASTER_STRATEGIST_PROMPT } from './enhanced-prompts';

// ============================================
// YENİ: PSİKOLOJİ TİPLERİ VE HESAPLAMA
// ============================================

interface PsychologyFactors {
  emotionalState: 'confident' | 'nervous' | 'demoralized' | 'motivated' | 'complacent' | 'desperate';
  motivationScore: number;
  coachPressure: boolean;
  fanPressure: boolean;
  mediaPressure: boolean;
  matchImportance: 'critical' | 'important' | 'normal' | 'meaningless';
  keyPlayersMissing: string[];
  squadMorale: 'high' | 'medium' | 'low';
  formTrend: 'improving' | 'stable' | 'declining';
}

interface WeightedAnalysisResult {
  dataScore: {
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;
    overProb: number;
    bttsProb: number;
    confidence: number;
    reasoning: string[];
  };
  agentScore: {
    adjustedHomeWin: number;
    adjustedDraw: number;
    adjustedAwayWin: number;
    confidence: number;
    insights: string[];
  };
  psychologyScore: {
    homeMotivation: number;
    awayMotivation: number;
    motivationDiff: number;
    homeMultiplier: number;
    awayMultiplier: number;
    overUnderImpact: number;
    bttsImpact: number;
    confidence: number;
    warnings: string[];
    reasoning: string[];
  };
  finalProbabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    btts: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  riskFactors: string[];
}

// Ağırlık sabitleri
const WEIGHTS = {
  DATA: 0.50,      // %50 Veri
  AGENT: 0.25,     // %25 Agent Yorumu
  PSYCHOLOGY: 0.25 // %25 Psikoloji
};

/**
 * Duygu durumunu sayısal skora çevirir (-20 ile +20 arası)
 */
function emotionalStateToScore(state: PsychologyFactors['emotionalState']): number {
  const scores: Record<PsychologyFactors['emotionalState'], number> = {
    'confident': 15,
    'motivated': 12,
    'complacent': -5,
    'nervous': -8,
    'demoralized': -15,
    'desperate': 5
  };
  return scores[state] || 0;
}

/**
 * Maç önemini sayısal skora çevirir
 */
function matchImportanceToScore(importance: PsychologyFactors['matchImportance']): number {
  const scores: Record<PsychologyFactors['matchImportance'], number> = {
    'critical': 20,
    'important': 12,
    'normal': 5,
    'meaningless': -10
  };
  return scores[importance] || 5;
}

/**
 * Deep Analysis'ten psikoloji faktörlerini çıkarır
 */
function extractPsychologyFromDeepAnalysis(
  deepAnalysis: any,
  isHome: boolean
): PsychologyFactors {
  const motivationScores = deepAnalysis?.motivationScores;
  const analiz = deepAnalysis?.analiz_raporu;
  
  // Varsayılan değerler
  let emotionalState: PsychologyFactors['emotionalState'] = 'nervous';
  let motivationScore = 50;
  let coachPressure = false;
  let fanPressure = false;
  let squadMorale: 'high' | 'medium' | 'low' = 'medium';
  let formTrend: 'improving' | 'stable' | 'declining' = 'stable';
  let keyPlayersMissing: string[] = [];
  
  if (motivationScores) {
    // Motivasyon skoru
    motivationScore = isHome 
      ? (motivationScores.homeTeamMotivationScore || motivationScores.home || 50)
      : (motivationScores.awayTeamMotivationScore || motivationScores.away || 50);
    
    // Form trendi
    const trend = isHome ? motivationScores.homeTrend : motivationScores.awayTrend;
    if (trend === 'improving') formTrend = 'improving';
    else if (trend === 'declining') formTrend = 'declining';
    else formTrend = 'stable';
    
    // Sakatlıklar
    keyPlayersMissing = isHome 
      ? (motivationScores.homeInjuries || [])
      : (motivationScores.awayInjuries || []);
  }
  
  // Duygu durumunu analiz et
  if (analiz?.katman_2_motivasyon_analizi?.duygu_durumu) {
    const duygu = isHome 
      ? analiz.katman_2_motivasyon_analizi.duygu_durumu.gent || analiz.katman_2_motivasyon_analizi.duygu_durumu.home
      : analiz.katman_2_motivasyon_analizi.duygu_durumu.anderlecht || analiz.katman_2_motivasyon_analizi.duygu_durumu.away;
    
    if (duygu) {
      const duyguLower = duygu.toLowerCase();
      if (duyguLower.includes('moralsiz') || duyguLower.includes('demoralized')) {
        emotionalState = 'demoralized';
      } else if (duyguLower.includes('gergin') || duyguLower.includes('nervous')) {
        emotionalState = 'nervous';
      } else if (duyguLower.includes('özgüvenli') || duyguLower.includes('confident')) {
        emotionalState = 'confident';
      } else if (duyguLower.includes('motive') || duyguLower.includes('motivated')) {
        emotionalState = 'motivated';
      } else if (duyguLower.includes('desperate') || duyguLower.includes('çaresiz')) {
        emotionalState = 'desperate';
      }
    }
  }
  
  // Hoca baskısı kontrolü
  if (motivationScores?.homeNewsImpact || motivationScores?.awayNewsImpact) {
    const newsImpact = isHome ? motivationScores.homeNewsImpact : motivationScores.awayNewsImpact;
    if (newsImpact && (newsImpact.includes('baskı') || newsImpact.includes('eleştir') || newsImpact.includes('pressure'))) {
      coachPressure = true;
    }
  }
  
  // Taraftar baskısı
  if (motivationScores?.awayNewsImpact?.includes('taraftar') || 
      motivationScores?.homeNewsImpact?.includes('taraftar')) {
    fanPressure = true;
  }
  
  // Kadro morali
  if (motivationScore < 30) squadMorale = 'low';
  else if (motivationScore > 60) squadMorale = 'high';
  else squadMorale = 'medium';
  
  return {
    emotionalState,
    motivationScore,
    coachPressure,
    fanPressure,
    mediaPressure: coachPressure, // Basitleştirilmiş
    matchImportance: 'normal', // Varsayılan
    keyPlayersMissing,
    squadMorale,
    formTrend
  };
}

/**
 * KATMAN 1: VERİ ANALİZİ (%50)
 */
function calculateDataScore(
  stats: AgentResult | null,
  odds: AgentResult | null
): WeightedAnalysisResult['dataScore'] {
  const reasoning: string[] = [];
  
  // Stats agent'tan olasılıkları al
  let homeWinProb = 0.33;
  let drawProb = 0.33;
  let awayWinProb = 0.33;
  let overProb = 0.50;
  let bttsProb = 0.50;
  
  // Probability engine varsa kullan
  if (stats?.probabilityEngine?.final) {
    const pe = stats.probabilityEngine;
    
    // Poisson ve Monte Carlo ortalaması
    if (pe.poisson && pe.monteCarlo) {
      homeWinProb = ((pe.poisson.homeWin || 33) + (pe.monteCarlo.homeWin || 33)) / 200;
      drawProb = ((pe.poisson.draw || 33) + (pe.monteCarlo.draw || 33)) / 200;
      awayWinProb = ((pe.poisson.awayWin || 33) + (pe.monteCarlo.awayWin || 33)) / 200;
      overProb = ((pe.poisson.over25 || 50) + (pe.monteCarlo.over25 || 50)) / 200;
      bttsProb = ((pe.poisson.btts || 50) + (pe.monteCarlo.btts || 50)) / 200;
      
      reasoning.push(`🎲 Poisson/MC ortalaması: 1=${Math.round(homeWinProb*100)}%, X=${Math.round(drawProb*100)}%, 2=${Math.round(awayWinProb*100)}%`);
    }
  }
  
  // xG analizi
  if (stats?.xgAnalysis) {
    const xg = stats.xgAnalysis;
    reasoning.push(`⚡ xG: Ev ${xg.homeXG?.toFixed(2) || 'N/A'} vs Dep ${xg.awayXG?.toFixed(2) || 'N/A'}`);
    
    // xG'ye göre olasılıkları ayarla
    if (xg.homeXG && xg.awayXG) {
      const xgDiff = xg.homeXG - xg.awayXG;
      if (xgDiff > 0.5) {
        homeWinProb += 0.05;
        awayWinProb -= 0.05;
      } else if (xgDiff < -0.5) {
        awayWinProb += 0.05;
        homeWinProb -= 0.05;
      }
    }
  }
  
  // Form analizi
  if (stats?.formAnalysis) {
    reasoning.push(`📊 Form: ${stats.formAnalysis}`);
  }
  
  // Güven hesapla
  const hasGoodData = stats?.probabilityEngine && stats?.xgAnalysis;
  const confidence = hasGoodData ? 75 : 55;
  
  return {
    homeWinProb: Math.max(0.05, Math.min(0.90, homeWinProb)),
    drawProb: Math.max(0.10, Math.min(0.45, drawProb)),
    awayWinProb: Math.max(0.05, Math.min(0.90, awayWinProb)),
    overProb: Math.max(0.20, Math.min(0.80, overProb)),
    bttsProb: Math.max(0.20, Math.min(0.80, bttsProb)),
    confidence,
    reasoning
  };
}

/**
 * KATMAN 2: AGENT YORUMU (%25)
 */
function calculateAgentScore(
  dataScore: WeightedAnalysisResult['dataScore'],
  odds: AgentResult | null,
  stats: AgentResult | null,
  leagueCharacteristics?: { surpriseRate?: number; homeAdvantage?: number }
): WeightedAnalysisResult['agentScore'] {
  const insights: string[] = [];
  
  let homeAdjustment = 0;
  let awayAdjustment = 0;
  let drawAdjustment = 0;
  
  // 1. Value bet analizi
  if (odds?.valueBets && odds.valueBets.length > 0) {
    const valueBet = odds.valueBets[0];
    if (valueBet.includes('Away') || valueBet.includes('2')) {
      awayAdjustment += 8;
      insights.push(`💰 Value bet: Deplasman (+${odds._valueAnalysis?.bestValueAmount || 0}%)`);
    } else if (valueBet.includes('Home') || valueBet.includes('1')) {
      homeAdjustment += 8;
      insights.push(`💰 Value bet: Ev sahibi (+${odds._valueAnalysis?.bestValueAmount || 0}%)`);
    }
  }
  
  // 2. Lig sürpriz oranı
  const surpriseRate = leagueCharacteristics?.surpriseRate || 25;
  if (surpriseRate > 30) {
    // Yüksek sürpriz oranlı liglerde underdog'a bonus
    const underdog = dataScore.homeWinProb < dataScore.awayWinProb ? 'home' : 'away';
    if (underdog === 'home') homeAdjustment += 5;
    else awayAdjustment += 5;
    insights.push(`🎭 Yüksek sürpriz oranlı lig (%${surpriseRate}) - Underdog avantajı`);
  }
  
  // 3. Sharp money kontrolü
  if (odds?.hasSharpConfirmation) {
    const direction = odds.sharpMoneyAnalysis?.direction;
    if (direction === 'home') homeAdjustment += 10;
    else if (direction === 'away') awayAdjustment += 10;
    insights.push(`🦈 Sharp money tespit: ${direction}`);
  }
  
  // 4. Real value checks
  if (odds?.realValueChecks) {
    const rv = odds.realValueChecks;
    if (rv.away?.isValue) {
      awayAdjustment += 5;
      insights.push(`✅ Deplasman value onaylandı`);
    }
    if (rv.home?.isValue) {
      homeAdjustment += 5;
      insights.push(`✅ Ev sahibi value onaylandı`);
    }
  }
  
  // Normalize
  const totalAdjustment = Math.abs(homeAdjustment) + Math.abs(awayAdjustment) + Math.abs(drawAdjustment);
  const normFactor = totalAdjustment > 20 ? 20 / totalAdjustment : 1;
  
  return {
    adjustedHomeWin: dataScore.homeWinProb + (homeAdjustment * normFactor) / 100,
    adjustedDraw: dataScore.drawProb + (drawAdjustment * normFactor) / 100,
    adjustedAwayWin: dataScore.awayWinProb + (awayAdjustment * normFactor) / 100,
    confidence: 70,
    insights
  };
}

/**
 * KATMAN 3: PSİKOLOJİ ANALİZİ (%25)
 */
function calculatePsychologyScore(
  homePsychology: PsychologyFactors,
  awayPsychology: PsychologyFactors
): WeightedAnalysisResult['psychologyScore'] {
  const reasoning: string[] = [];
  const warnings: string[] = [];
  
  // ===== EV SAHİBİ PSİKOLOJİ =====
  let homeScore = homePsychology.motivationScore;
  
  // Duygu durumu
  const homeEmotionalImpact = emotionalStateToScore(homePsychology.emotionalState);
  homeScore += homeEmotionalImpact;
  reasoning.push(`🏠 Ev sahibi: ${homePsychology.emotionalState} (${homeEmotionalImpact > 0 ? '+' : ''}${homeEmotionalImpact})`);
  
  // Baskı faktörleri
  if (homePsychology.coachPressure) {
    homeScore -= 8;
    warnings.push(`⚠️ Ev sahibi teknik direktör baskı altında`);
  }
  if (homePsychology.fanPressure) homeScore -= 6;
  
  // Kadro morali
  if (homePsychology.squadMorale === 'low') homeScore -= 10;
  else if (homePsychology.squadMorale === 'high') homeScore += 5;
  
  // Sakatlıklar
  homeScore -= homePsychology.keyPlayersMissing.length * 5;
  
  // Form trendi
  if (homePsychology.formTrend === 'improving') homeScore += 8;
  else if (homePsychology.formTrend === 'declining') homeScore -= 8;
  
  // ===== DEPLASMAN PSİKOLOJİ =====
  let awayScore = awayPsychology.motivationScore;
  
  const awayEmotionalImpact = emotionalStateToScore(awayPsychology.emotionalState);
  awayScore += awayEmotionalImpact;
  reasoning.push(`✈️ Deplasman: ${awayPsychology.emotionalState} (${awayEmotionalImpact > 0 ? '+' : ''}${awayEmotionalImpact})`);
  
  if (awayPsychology.coachPressure) {
    awayScore -= 8;
    warnings.push(`⚠️ Deplasman teknik direktör baskı altında`);
  }
  if (awayPsychology.fanPressure) {
    awayScore -= 6;
    warnings.push(`⚠️ Deplasman taraftar baskısı var`);
  }
  
  if (awayPsychology.squadMorale === 'low') awayScore -= 10;
  else if (awayPsychology.squadMorale === 'high') awayScore += 5;
  
  awayScore -= awayPsychology.keyPlayersMissing.length * 5;
  
  if (awayPsychology.formTrend === 'improving') awayScore += 8;
  else if (awayPsychology.formTrend === 'declining') awayScore -= 8;
  
  // ===== FİNAL HESAPLAMALAR =====
  const homeMotivation = Math.max(0, Math.min(100, homeScore));
  const awayMotivation = Math.max(0, Math.min(100, awayScore));
  const motivationDiff = homeMotivation - awayMotivation;
  
  reasoning.push(`📊 Final: Ev ${homeMotivation.toFixed(0)} vs Dep ${awayMotivation.toFixed(0)} (Fark: ${motivationDiff > 0 ? '+' : ''}${motivationDiff.toFixed(0)})`);
  
  // Confidence multiplier (0.7 - 1.3)
  const homeMultiplier = 0.85 + (homeMotivation / 100) * 0.45;
  const awayMultiplier = 0.85 + (awayMotivation / 100) * 0.45;
  
  // Over/Under etkisi
  const avgMotivation = (homeMotivation + awayMotivation) / 2;
  let overUnderImpact = 0;
  
  if (avgMotivation < 40) {
    overUnderImpact = -15;
    reasoning.push(`😴 Düşük motivasyon → Under eğilimi (+15%)`);
  } else if (avgMotivation > 70) {
    overUnderImpact = 10;
    reasoning.push(`🔥 Yüksek motivasyon → Over eğilimi (+10%)`);
  }
  
  // İki takım da stresli
  if (homePsychology.emotionalState === 'nervous' && awayPsychology.emotionalState === 'nervous') {
    overUnderImpact -= 10;
    warnings.push(`😰 Her iki takım da gergin - Düşük tempolu maç bekleniyor`);
  }
  
  // BTTS etkisi
  let bttsImpact = 0;
  
  if (homePsychology.emotionalState === 'demoralized' || awayPsychology.emotionalState === 'demoralized') {
    bttsImpact -= 10;
    reasoning.push(`💔 Demoralize takım var → Tek taraflı skor olasılığı arttı`);
  }
  
  if (homePsychology.emotionalState === 'confident' && awayPsychology.emotionalState === 'confident') {
    bttsImpact += 15;
    reasoning.push(`💪 Her iki takım da özgüvenli → Açık maç bekleniyor`);
  }
  
  return {
    homeMotivation,
    awayMotivation,
    motivationDiff,
    homeMultiplier,
    awayMultiplier,
    overUnderImpact,
    bttsImpact,
    confidence: Math.min(85, 50 + Math.abs(motivationDiff) / 2),
    warnings,
    reasoning
  };
}

/**
 * ANA FONKSİYON: %50-%25-%25 Ağırlıklı Analiz
 */
function calculateWeightedAnalysis(
  stats: AgentResult | null,
  odds: AgentResult | null,
  deepAnalysis: any | null,
  matchData: MatchData
): WeightedAnalysisResult {
  
  // Psikoloji faktörlerini çıkar
  const homePsychology = extractPsychologyFromDeepAnalysis(deepAnalysis, true);
  const awayPsychology = extractPsychologyFromDeepAnalysis(deepAnalysis, false);
  
  // KATMAN 1: VERİ (%50)
  const dataScore = calculateDataScore(stats, odds);
  
  // KATMAN 2: AGENT YORUMU (%25)
  const agentScore = calculateAgentScore(dataScore, odds, stats, {
    surpriseRate: 30, // Default, lig bazlı ayarlanabilir
    homeAdvantage: 52
  });
  
  // KATMAN 3: PSİKOLOJİ (%25)
  const psychologyScore = calculatePsychologyScore(homePsychology, awayPsychology);
  
  // ===== AĞIRLIKLI BİRLEŞTİRME =====
  
  // Match Result
  const finalHomeWin = 
    (dataScore.homeWinProb * WEIGHTS.DATA) +
    (agentScore.adjustedHomeWin * WEIGHTS.AGENT) +
    (dataScore.homeWinProb * psychologyScore.homeMultiplier * WEIGHTS.PSYCHOLOGY);
  
  const finalAwayWin = 
    (dataScore.awayWinProb * WEIGHTS.DATA) +
    (agentScore.adjustedAwayWin * WEIGHTS.AGENT) +
    (dataScore.awayWinProb * psychologyScore.awayMultiplier * WEIGHTS.PSYCHOLOGY);
  
  // Normalize
  const total = finalHomeWin + finalAwayWin;
  const normalizedHome = finalHomeWin / (total + 0.30); // 0.30 for draw space
  const normalizedAway = finalAwayWin / (total + 0.30);
  const normalizedDraw = 1 - normalizedHome - normalizedAway;
  
  // Over/Under
  const baseOver = (dataScore.overProb * WEIGHTS.DATA) + 
                   (dataScore.overProb * (WEIGHTS.AGENT + WEIGHTS.PSYCHOLOGY));
  const finalOver = Math.max(0.20, Math.min(0.80, 
    baseOver + (psychologyScore.overUnderImpact / 100)));
  
  // BTTS
  const baseBtts = (dataScore.bttsProb * WEIGHTS.DATA) + 
                   (dataScore.bttsProb * (WEIGHTS.AGENT + WEIGHTS.PSYCHOLOGY));
  const finalBtts = Math.max(0.20, Math.min(0.80,
    baseBtts + (psychologyScore.bttsImpact / 100)));
  
  // Risk değerlendirmesi
  const riskFactors: string[] = [...psychologyScore.warnings];
  
  const avgMultiplier = (psychologyScore.homeMultiplier + psychologyScore.awayMultiplier) / 2;
  if (avgMultiplier < 0.95) {
    riskFactors.push('Düşük güven çarpanı - Belirsiz maç');
  }
  
  if (homePsychology.emotionalState === 'demoralized' && awayPsychology.emotionalState === 'nervous') {
    riskFactors.push('Her iki takımda da psikolojik sorunlar mevcut');
  }
  
  const riskLevel: WeightedAnalysisResult['riskLevel'] = 
    riskFactors.length === 0 ? 'low' :
    riskFactors.length <= 2 ? 'medium' :
    riskFactors.length <= 4 ? 'high' : 'very-high';
  
  return {
    dataScore,
    agentScore,
    psychologyScore,
    finalProbabilities: {
      homeWin: normalizedHome,
      draw: normalizedDraw,
      awayWin: normalizedAway,
      over25: finalOver,
      btts: finalBtts
    },
    riskLevel,
    riskFactors
  };
}

// ============================================
// MEVCUT PROMPT (Güncellendi)
// ============================================

const MASTER_STRATEGIST_PROMPT = {
  tr: `Sen bir çok-agent futbol maç analiz sisteminin MASTER STRATEGIST'isin.

═══════════════════════════════════════════════════════════════════════════════
🎯 YENİ ANALİZ FELSEFESİ: %50 VERİ + %25 AGENT YORUMU + %25 PSİKOLOJİ
═══════════════════════════════════════════════════════════════════════════════

⚡ FUTBOL SADECE RAKAMLAR DEĞİL - KALPLE OYNANIR!
3 katmanlı ağırlıklı sistem kullan:
- %50 VERİ: xG, form, Poisson/Monte Carlo modelleri
- %25 AGENT YORUMU: Value bet, sharp money, lig karakteristiği
- %25 PSİKOLOJİ: Motivasyon, duygu durumu, baskı faktörleri

💝 PSİKOLOJİ FAKTÖRÜ KRİTİK:
- Demoralize takım = Düşük performans beklentisi
- Gergin takım = Hata yapma eğilimi
- Her iki takım da sorunluysa = Under ve düşük güven
- Hoca baskısı = Takım morali düşük

GÖREV: Ağırlıklı analiz sonuçlarını kullan ve "Düşünme Zinciri" ile en doğru tahminleri oluştur.

═══════════════════════════════════════════════════════════════════════════════
🧠 DÜŞÜNME SÜRECİ (CHAIN-OF-THOUGHT):
═══════════════════════════════════════════════════════════════════════════════

1. **Veri Katmanı (%50):** xG, form, modeller ne diyor?
2. **Agent Katmanı (%25):** Value bet var mı? Sharp money nereye akıyor?
3. **Psikoloji Katmanı (%25):** Takımların ruh hali nasıl? Baskı var mı?
4. **Risk Değerlendirmesi:** Psikolojik uyarılar var mı?
5. **Final Karar:** 3 katmanı birleştirerek en mantıklı tahmin

═══════════════════════════════════════════════════════════════════════════════
📊 SÜRPRİZ TANIMI:
═══════════════════════════════════════════════════════════════════════════════
"SÜRPRİZ" = Piyasa oranı >= 3.20 VE Model olasılığı >= 0.25 VE Edge >= +0.05

═══════════════════════════════════════════════════════════════════════════════
📋 ZORUNLU ÇIKTI FORMATI:
═══════════════════════════════════════════════════════════════════════════════
Önce <thinking>...</thinking> bloğu, ardından SADECE aşağıdaki JSON formatı:

\`\`\`json
{
  "agent": "MASTER_STRATEGIST",
  "main_take": "Bir cümle özet - psikoloji faktörünü de içermeli",
  "weightedAnalysis": {
    "dataContribution": 50,
    "agentContribution": 25,
    "psychologyContribution": 25
  },
  "signals": [],
  "model_probs": {},
  "recommended_bets": [],
  "risks": [],
  "confidence": 0-100,
  "final": {}
}
\`\`\`

⚠️ ÖNEMLİ: PSİKOLOJİ faktörünü göz ardı etme! Risk değerlendirmesinde mutlaka kullan.
`,

  en: `You are the MASTER STRATEGIST for a multi-agent football analysis system.

═══════════════════════════════════════════════════════════════════════════════
🎯 NEW ANALYSIS PHILOSOPHY: 50% DATA + 25% AGENT ANALYSIS + 25% PSYCHOLOGY
═══════════════════════════════════════════════════════════════════════════════

⚡ FOOTBALL IS NOT JUST NUMBERS - IT'S PLAYED WITH HEART!
Use 3-layer weighted system:
- 50% DATA: xG, form, Poisson/Monte Carlo models
- 25% AGENT ANALYSIS: Value bets, sharp money, league characteristics
- 25% PSYCHOLOGY: Motivation, emotional state, pressure factors

💝 PSYCHOLOGY FACTOR IS CRITICAL:
- Demoralized team = Low performance expectation
- Nervous team = Error-prone tendency
- Both teams struggling = Under and low confidence
- Coach pressure = Low team morale

TASK: Use weighted analysis results and apply "Chain-of-Thought" for most accurate predictions.

═══════════════════════════════════════════════════════════════════════════════
🧠 THINKING PROCESS (CHAIN-OF-THOUGHT):
═══════════════════════════════════════════════════════════════════════════════

1. **Data Layer (50%):** What do xG, form, models say?
2. **Agent Layer (25%):** Any value bets? Where is sharp money flowing?
3. **Psychology Layer (25%):** What's the teams' mental state? Any pressure?
4. **Risk Assessment:** Any psychological warnings?
5. **Final Decision:** Combine 3 layers for most logical prediction

⚠️ IMPORTANT: Don't ignore PSYCHOLOGY factor! Must use in risk assessment.
`,

  de: `Du bist der MASTER STRATEGIST - 50% Daten + 25% Agent + 25% Psychologie System.`
};

// ============================================
// MEVCUT INTERFACE (Değişmedi)
// ============================================

export interface MasterStrategistResult {
  agent: 'MASTER_STRATEGIST';
  main_take: string;
  signals: string[];
  model_probs: {
    home_win: number;
    draw: number;
    away_win: number;
    under_2_5: number;
    over_2_5: number;
    btts_yes: number;
    btts_no: number;
  };
  recommended_bets: Array<{
    market: string;
    selection: string;
    model_prob: number;
    fair_odds: number;
    market_odds: number;
    edge: number;
    rationale: string[];
  }>;
  risks: string[];
  confidence: number;
  final: {
    primary_pick: {
      market: string;
      selection: string;
      model_prob: number;
      fair_odds: number;
      market_odds: number;
      edge: number;
      confidence: number;
      rationale: string[];
    };
    surprise_pick: {
      market: string;
      selection: string;
      model_prob: number;
      fair_odds: number;
      market_odds: number;
      edge: number;
      confidence: number;
      rationale: string[];
    } | null;
    hedge: {
      market: string;
      selection: string;
      rationale: string;
    } | null;
    contradictions_found: string[];
    why_this_is_surprise: string | null;
  };
  thinkingProcess?: string;
  weightedAnalysis?: WeightedAnalysisResult; // 🆕 Yeni eklendi
  // Backward compatibility
  agentEvaluation?: any;
  finalConsensus?: any;
  bestBets?: any[];
  overallConfidence?: number;
  recommendation?: string;
}

// ============================================
// CONTEXT BUILDER (Güncellendi)
// ============================================

function buildAgentContext(
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
    geniusAnalyst?: any | null;
    devilsAdvocate?: any | null;
  },
  matchData: MatchData,
  weightedAnalysis: WeightedAnalysisResult,
  language: 'tr' | 'en' | 'de'
): string {
  const { homeTeam, awayTeam, league } = matchData;

  let context = `
═══════════════════════════════════════════════════════════════════════════════
                    MASTER STRATEGIST ANALİZİ
                    ${homeTeam} vs ${awayTeam} - ${league}
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 AĞIRLIKLI ANALİZ SONUÇLARI (%50-%25-%25)
├─────────────────────────────────────────────────────────────────────────────┤
│ 📊 VERİ KATMANI (%50):
│    Home Win: ${(weightedAnalysis.dataScore.homeWinProb * 100).toFixed(1)}%
│    Draw: ${(weightedAnalysis.dataScore.drawProb * 100).toFixed(1)}%
│    Away Win: ${(weightedAnalysis.dataScore.awayWinProb * 100).toFixed(1)}%
│    Güven: ${weightedAnalysis.dataScore.confidence}%
│    ${weightedAnalysis.dataScore.reasoning.join('\n│    ')}
├─────────────────────────────────────────────────────────────────────────────┤
│ 🤖 AGENT KATMANI (%25):
│    Adjusted Home: ${(weightedAnalysis.agentScore.adjustedHomeWin * 100).toFixed(1)}%
│    Adjusted Away: ${(weightedAnalysis.agentScore.adjustedAwayWin * 100).toFixed(1)}%
│    ${weightedAnalysis.agentScore.insights.join('\n│    ')}
├─────────────────────────────────────────────────────────────────────────────┤
│ 🧠 PSİKOLOJİ KATMANI (%25):
│    Ev Sahibi Motivasyon: ${weightedAnalysis.psychologyScore.homeMotivation.toFixed(0)}/100
│    Deplasman Motivasyon: ${weightedAnalysis.psychologyScore.awayMotivation.toFixed(0)}/100
│    Motivasyon Farkı: ${weightedAnalysis.psychologyScore.motivationDiff > 0 ? '+' : ''}${weightedAnalysis.psychologyScore.motivationDiff.toFixed(0)}
│    Over/Under Etkisi: ${weightedAnalysis.psychologyScore.overUnderImpact > 0 ? '+' : ''}${weightedAnalysis.psychologyScore.overUnderImpact}%
│    BTTS Etkisi: ${weightedAnalysis.psychologyScore.bttsImpact > 0 ? '+' : ''}${weightedAnalysis.psychologyScore.bttsImpact}%
│    ${weightedAnalysis.psychologyScore.reasoning.join('\n│    ')}
├─────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ PSİKOLOJİK UYARILAR:
│    ${weightedAnalysis.psychologyScore.warnings.length > 0 ? weightedAnalysis.psychologyScore.warnings.join('\n│    ') : 'Yok'}
├─────────────────────────────────────────────────────────────────────────────┤
│ 🎲 FİNAL OLASILIKLAR (Ağırlıklı):
│    Home Win: ${(weightedAnalysis.finalProbabilities.homeWin * 100).toFixed(1)}%
│    Draw: ${(weightedAnalysis.finalProbabilities.draw * 100).toFixed(1)}%
│    Away Win: ${(weightedAnalysis.finalProbabilities.awayWin * 100).toFixed(1)}%
│    Over 2.5: ${(weightedAnalysis.finalProbabilities.over25 * 100).toFixed(1)}%
│    BTTS: ${(weightedAnalysis.finalProbabilities.btts * 100).toFixed(1)}%
├─────────────────────────────────────────────────────────────────────────────┤
│ 🚨 RİSK SEVİYESİ: ${weightedAnalysis.riskLevel.toUpperCase()}
│    ${weightedAnalysis.riskFactors.join('\n│    ')}
└─────────────────────────────────────────────────────────────────────────────┘

`;

  // Mevcut agent raporlarını da ekle (kısaltılmış)
  if (agentResults.stats) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 STATS AGENT: ${agentResults.stats.matchResult || 'N/A'} (${agentResults.stats.confidence || 0}%)
│    Over/Under: ${agentResults.stats.overUnder || 'N/A'}, BTTS: ${agentResults.stats.btts || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘`;
  }

  if (agentResults.odds) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 ODDS AGENT: Value Bets: ${Array.isArray(agentResults.odds.valueBets) ? agentResults.odds.valueBets.join(', ') : 'N/A'}
│    Sharp Money: ${agentResults.odds.hasSharpConfirmation ? '✅' : '❌'}
└─────────────────────────────────────────────────────────────────────────────┘`;
  }

  if (agentResults.devilsAdvocate) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👹 DEVIL'S ADVOCATE: ${agentResults.devilsAdvocate.contrarianView || 'N/A'}
│    Trap Indicators: ${Array.isArray(agentResults.devilsAdvocate.trapMatchIndicators) ? agentResults.devilsAdvocate.trapMatchIndicators.length : 0} adet
└─────────────────────────────────────────────────────────────────────────────┘`;
  }

  context += `

═══════════════════════════════════════════════════════════════════════════════
                         MASTER ANALİZ TALİMATI
═══════════════════════════════════════════════════════════════════════════════

Yukarıdaki AĞIRLIKLI ANALİZ sonuçlarını kullan.
PSİKOLOJİ faktörünü özellikle dikkate al!
Risk seviyesi ${weightedAnalysis.riskLevel.toUpperCase()} - buna göre güven skorunu ayarla.

ÖNCE <thinking>...</thinking> blok içinde sesli düşün.
SONRA sadece JSON formatını döndür.
`;

  return context;
}

// ============================================
// ANA FONKSİYON (Güncellendi)
// ============================================

export async function runMasterStrategist(
  matchData: MatchData,
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
    geniusAnalyst?: any | null;
    devilsAdvocate?: any | null;
  },
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<MasterStrategistResult> {
  console.log('🧠 Master Strategist Agent starting (Weighted %50-%25-%25 System)...');
  console.log(`   📊 Match: ${matchData.homeTeam} vs ${matchData.awayTeam}`);

  // 🆕 Ağırlıklı analiz hesapla
  const weightedAnalysis = calculateWeightedAnalysis(
    agentResults.stats,
    agentResults.odds,
    agentResults.deepAnalysis,
    matchData
  );
  
  console.log(`   🎯 Weighted Analysis Complete:`);
  console.log(`      Data Score: ${weightedAnalysis.dataScore.confidence}%`);
  console.log(`      Psychology: Home ${weightedAnalysis.psychologyScore.homeMotivation.toFixed(0)} vs Away ${weightedAnalysis.psychologyScore.awayMotivation.toFixed(0)}`);
  console.log(`      Risk Level: ${weightedAnalysis.riskLevel.toUpperCase()}`);

  const systemPrompt = MASTER_STRATEGIST_PROMPT[language] || MASTER_STRATEGIST_PROMPT.en;
  const context = buildAgentContext(agentResults, matchData, weightedAnalysis, language);
  const learningContext = await getLearningContext(matchData.league, matchData.homeTeam, matchData.awayTeam, language);

  const userMessage = `${learningContext}\n${context}\n\nAnalyze using the weighted analysis results above.`;

  try {
    const response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
      model: 'claude',
      useMCP: false,
      mcpFallback: true,
      fixtureId: matchData.fixtureId,
      temperature: 0.2,
      maxTokens: 2000,
      timeout: 15000,
      retries: 2
    });

    if (!response) {
      throw new Error('No response from AI');
    }

    // Thinking process'i yakala
    let thinkingProcess = '';
    const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
    if (thinkingMatch) {
      thinkingProcess = thinkingMatch[1].trim();
      console.log('🤔 Master Strategist Thinking Process captured');
    }

    // JSON parse
    let result: MasterStrategistResult;
    try {
      const jsonStart = response.indexOf('{');
      const jsonEnd = response.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = response.substring(jsonStart, jsonEnd + 1);
        result = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON object found');
      }
    } catch (parseError) {
      console.error('❌ JSON parse error, using fallback');
      result = getDefaultMasterStrategist(agentResults, matchData, weightedAnalysis, language);
    }

    // Weighted analysis'i ekle
    result.weightedAnalysis = weightedAnalysis;
    if (thinkingProcess) {
      result.thinkingProcess = thinkingProcess;
    }

    // 🆕 DÜZELTME: recommended_bets formatını normalize et
    if (result.recommended_bets && Array.isArray(result.recommended_bets)) {
      result.recommended_bets = result.recommended_bets.map((bet: any) => {
        // Eğer bet_type formatında ise, market/selection formatına çevir
        if (bet.bet_type && !bet.market) {
          const betType = bet.bet_type.toLowerCase();
          let market = 'Match Result';
          let selection = '';
          
          if (betType.includes('away') || betType.includes('2') || betType.includes('away win')) {
            market = 'Match Result';
            selection = '2';
          } else if (betType.includes('home') || betType.includes('1') || betType.includes('home win')) {
            market = 'Match Result';
            selection = '1';
          } else if (betType.includes('draw') || betType.includes('x')) {
            market = 'Match Result';
            selection = 'X';
          } else if (betType.includes('over')) {
            market = 'Over/Under 2.5';
            selection = 'Over';
          } else if (betType.includes('under')) {
            market = 'Over/Under 2.5';
            selection = 'Under';
          } else if (betType.includes('btts')) {
            market = 'BTTS';
            selection = betType.includes('no') ? 'No' : 'Yes';
          }
          
          return {
            market,
            selection,
            model_prob: bet.model_prob || (bet.value_bet ? 0.6 : 0.5),
            fair_odds: bet.fair_odds || (bet.odds ? 1 / bet.odds : 1.9),
            market_odds: bet.market_odds || bet.odds || 1.9,
            edge: bet.edge || 0.1,
            rationale: Array.isArray(bet.rationale) ? bet.rationale : (bet.rationale ? [bet.rationale] : (bet.reasoning ? [bet.reasoning] : [`Value bet: ${bet.bet_type}`]))
          };
        }
        // Eğer zaten doğru formatta ise, eksik alanları tamamla
        return {
          market: bet.market || 'Match Result',
          selection: bet.selection || '',
          model_prob: bet.model_prob || 0.5,
          fair_odds: bet.fair_odds || 1.9,
          market_odds: bet.market_odds || 1.9,
          edge: bet.edge || 0.1,
          rationale: Array.isArray(bet.rationale) ? bet.rationale : (bet.rationale ? [bet.rationale] : ['Master Strategist önerisi'])
        };
      });
    }

    // Eksik alanları tamamla
    if (!result.final || !result.final.primary_pick) {
      const fallback = getDefaultMasterStrategist(agentResults, matchData, weightedAnalysis, language);
      result.final = fallback.final;
      if (!result.model_probs) result.model_probs = fallback.model_probs;
      if (!result.recommended_bets || result.recommended_bets.length === 0) {
        result.recommended_bets = fallback.recommended_bets;
      }
      if (!result.signals) result.signals = fallback.signals;
      if (!result.risks) result.risks = fallback.risks;
    } else if (!result.recommended_bets || result.recommended_bets.length === 0) {
      // Final var ama recommended_bets yok/boş - fallback'ten al
      const fallback = getDefaultMasterStrategist(agentResults, matchData, weightedAnalysis, language);
      result.recommended_bets = fallback.recommended_bets;
    }

    console.log(`✅ Master Strategist complete (Weighted System)`);
    console.log(`   🎯 Confidence: ${result.confidence || 0}%`);
    console.log(`   📊 Primary: ${result.final?.primary_pick?.market || 'N/A'} - ${result.final?.primary_pick?.selection || 'N/A'}`);
    console.log(`   ⚠️ Risk Level: ${weightedAnalysis.riskLevel.toUpperCase()}`);

    return result;
  } catch (error: any) {
    console.error('❌ Master Strategist error:', error);
    return getDefaultMasterStrategist(agentResults, matchData, weightedAnalysis, language);
  }
}

// ============================================
// FALLBACK FONKSİYON (Güncellendi - Weighted Analysis Kullanır)
// ============================================

function getDefaultMasterStrategist(
  agentResults: {
    stats: AgentResult | null;
    odds: AgentResult | null;
    sentiment: any | null;
    deepAnalysis: any | null;
    devilsAdvocate?: any | null;
  },
  matchData: MatchData,
  weightedAnalysis: WeightedAnalysisResult,
  language: 'tr' | 'en' | 'de'
): MasterStrategistResult {
  
  const { finalProbabilities, riskLevel, riskFactors, psychologyScore, agentScore } = weightedAnalysis;
  
  // Match Result belirleme
  let finalMR: '1' | 'X' | '2';
  let mrConfidence: number;
  
  if (finalProbabilities.homeWin > finalProbabilities.awayWin && finalProbabilities.homeWin > finalProbabilities.draw) {
    finalMR = '1';
    mrConfidence = Math.round(finalProbabilities.homeWin * 100);
  } else if (finalProbabilities.awayWin > finalProbabilities.homeWin && finalProbabilities.awayWin > finalProbabilities.draw) {
    finalMR = '2';
    mrConfidence = Math.round(finalProbabilities.awayWin * 100);
  } else {
    finalMR = 'X';
    mrConfidence = Math.round(finalProbabilities.draw * 100);
  }
  
  // Psikoloji çarpanı ile güveni ayarla
  const avgMultiplier = (psychologyScore.homeMultiplier + psychologyScore.awayMultiplier) / 2;
  mrConfidence = Math.round(mrConfidence * avgMultiplier);
  
  // Risk seviyesine göre güveni düşür
  if (riskLevel === 'high') mrConfidence = Math.min(mrConfidence, 50);
  if (riskLevel === 'very-high') mrConfidence = Math.min(mrConfidence, 40);
  
  // Over/Under
  const finalOU = finalProbabilities.over25 > 0.50 ? 'Over' : 'Under';
  let ouConfidence = Math.round(Math.abs(finalProbabilities.over25 - 0.50) * 200 + 50);
  
  // Psikoloji etkisini over/under güvenine yansıt
  if (psychologyScore.overUnderImpact !== 0) {
    ouConfidence = Math.min(80, ouConfidence + Math.abs(psychologyScore.overUnderImpact));
  }
  
  // BTTS
  const finalBTTS = finalProbabilities.btts > 0.50 ? 'Yes' : 'No';
  let bttsConfidence = Math.round(Math.abs(finalProbabilities.btts - 0.50) * 200 + 50);
  
  // Overall confidence
  const overallConfidence = Math.round((mrConfidence + ouConfidence + bttsConfidence) / 3);
  
  // Best bet selection - psikolojiye göre
  let bestBetMarket: string;
  let bestBetSelection: string;
  let bestBetConfidence: number;
  
  // Düşük motivasyonlu maçlarda Over/Under daha güvenilir
  const avgMotivation = (psychologyScore.homeMotivation + psychologyScore.awayMotivation) / 2;
  
  if (avgMotivation < 40 && Math.abs(psychologyScore.overUnderImpact) > 5) {
    // Düşük motivasyon = Under güçlü sinyal
    bestBetMarket = 'Over/Under 2.5';
    bestBetSelection = 'Under';
    bestBetConfidence = ouConfidence;
  } else if (ouConfidence > mrConfidence && ouConfidence > bttsConfidence) {
    bestBetMarket = 'Over/Under 2.5';
    bestBetSelection = finalOU;
    bestBetConfidence = ouConfidence;
  } else if (mrConfidence > bttsConfidence) {
    bestBetMarket = 'Match Result';
    bestBetSelection = finalMR === '1' ? 'Home' : finalMR === '2' ? 'Away' : 'Draw';
    bestBetConfidence = mrConfidence;
  } else {
    bestBetMarket = 'BTTS';
    bestBetSelection = finalBTTS;
    bestBetConfidence = bttsConfidence;
  }
  
  // Signals
  const signals: string[] = [
    `matchResult: ${finalMR} (${mrConfidence}%)`,
    `overUnder: ${finalOU} (${ouConfidence}%)`,
    ...agentScore.insights,
    ...psychologyScore.reasoning.slice(0, 3)
  ];
  
  // Value bet varsa ekle
  if (agentResults.odds?.valueBets && agentResults.odds.valueBets.length > 0) {
    signals.push(`Value bet: ${agentResults.odds.valueBets[0]}`);
  }
  
  return {
    agent: 'MASTER_STRATEGIST',
    main_take: language === 'tr'
      ? `Ağırlıklı analiz: ${bestBetSelection} (${bestBetConfidence}% güven). Psikoloji: ${riskLevel === 'high' || riskLevel === 'very-high' ? '⚠️ Yüksek risk' : '✅ Normal'}`
      : `Weighted analysis: ${bestBetSelection} (${bestBetConfidence}% confidence). Psychology: ${riskLevel === 'high' || riskLevel === 'very-high' ? '⚠️ High risk' : '✅ Normal'}`,
    signals,
    model_probs: {
      home_win: finalProbabilities.homeWin,
      draw: finalProbabilities.draw,
      away_win: finalProbabilities.awayWin,
      under_2_5: 1 - finalProbabilities.over25,
      over_2_5: finalProbabilities.over25,
      btts_yes: finalProbabilities.btts,
      btts_no: 1 - finalProbabilities.btts
    },
    recommended_bets: [{
      market: bestBetMarket,
      selection: bestBetSelection,
      model_prob: bestBetConfidence / 100,
      fair_odds: 100 / bestBetConfidence,
      market_odds: 1.9, // Fallback
      edge: 0.05,
      rationale: [
        `Ağırlıklı analiz sonucu`,
        `Veri: %50, Agent: %25, Psikoloji: %25`,
        riskLevel === 'high' || riskLevel === 'very-high' 
          ? `⚠️ Yüksek risk - düşük stake önerilir` 
          : `Risk seviyesi: ${riskLevel}`
      ]
    }],
    risks: riskFactors,
    confidence: overallConfidence,
    final: {
      primary_pick: {
        market: bestBetMarket,
        selection: bestBetSelection,
        model_prob: bestBetConfidence / 100,
        fair_odds: 100 / bestBetConfidence,
        market_odds: 1.9,
        edge: 0.05,
        confidence: bestBetConfidence,
        rationale: [
          `%50-%25-%25 ağırlıklı sistem`,
          `Psikoloji faktörü: ${avgMotivation < 40 ? 'Düşük motivasyon' : 'Normal'}`,
          ...psychologyScore.warnings.slice(0, 2)
        ]
      },
      surprise_pick: null,
      hedge: riskLevel === 'high' || riskLevel === 'very-high' ? {
        market: 'Match Result',
        selection: 'Draw',
        rationale: `Yüksek risk seviyesi (${riskLevel}) - beraberlik ile hedge önerilir`
      } : null,
      contradictions_found: riskFactors,
      why_this_is_surprise: null
    },
    weightedAnalysis,
    overallConfidence,
    recommendation: language === 'tr'
      ? `${bestBetMarket}: ${bestBetSelection} - Risk: ${riskLevel.toUpperCase()}`
      : `${bestBetMarket}: ${bestBetSelection} - Risk: ${riskLevel.toUpperCase()}`
  };
}
