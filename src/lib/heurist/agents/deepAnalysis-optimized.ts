// src/lib/heurist/agents/deepAnalysis-optimized.ts
// 🔧 OPTİMİZE EDİLMİŞ DEEP ANALYSIS AGENT
// Daha kısa prompt, daha net talimatlar, daha yüksek doğruluk

import { MatchData } from '../types';
import { aiClient } from '../../ai-client';

// ============================================================================
// SADELEŞTİRİLMİŞ PROMPT - SADECE ÖNEMLİ TAHMİNLERE ODAKLAN
// ============================================================================

const OPTIMIZED_PROMPT = {
  tr: `Sen bir futbol analisti ve bahis uzmanısın. VERİ BAZLI tahmin yap.

⚠️ KRİTİK KURALLAR:
1. EV SAHİBİ için EVDE istatistiklerini kullan
2. DEPLASMAN için DEPLASMANDA istatistiklerini kullan
3. Gol beklentisi 2.5'ten yüksekse OVER, düşükse UNDER
4. Güven %50-75 arasında olmalı (aşırı güvenme!)
5. SADECE JSON döndür, açıklama yazma

📊 HESAPLAMA FORMÜLÜ:
- Beklenen Gol = (Ev Attığı + Dep Yediği) / 2 + (Dep Attığı + Ev Yediği) / 2
- Over 2.5 olasılığı = (Ev Over% + Dep Over% + H2H Over%) / 3
- BTTS olasılığı = Her iki takım da gol atıyorsa Yes

JSON FORMAT (SADECE BU ALANLARI DOLDUR):
{
  "matchResult": { "prediction": "1/X/2", "confidence": 55, "reasoning": "kısa açıklama" },
  "overUnder": { "prediction": "Over/Under", "confidence": 60, "reasoning": "kısa açıklama" },
  "btts": { "prediction": "Yes/No", "confidence": 55, "reasoning": "kısa açıklama" },
  "scorePrediction": { "score": "1-1", "reasoning": "kısa açıklama" },
  "riskLevel": "Low/Medium/High"
}`,

  en: `You are a football analyst and betting expert. Make DATA-BASED predictions.

⚠️ CRITICAL RULES:
1. Use HOME stats for home team
2. Use AWAY stats for away team
3. If expected goals > 2.5 → OVER, else UNDER
4. Confidence must be 50-75% (don't be overconfident!)
5. Return ONLY JSON, no explanations

📊 CALCULATION FORMULA:
- Expected Goals = (Home Scored + Away Conceded) / 2 + (Away Scored + Home Conceded) / 2
- Over 2.5 probability = (Home Over% + Away Over% + H2H Over%) / 3
- BTTS probability = Yes if both teams score regularly

JSON FORMAT (FILL ONLY THESE FIELDS):
{
  "matchResult": { "prediction": "1/X/2", "confidence": 55, "reasoning": "short explanation" },
  "overUnder": { "prediction": "Over/Under", "confidence": 60, "reasoning": "short explanation" },
  "btts": { "prediction": "Yes/No", "confidence": 55, "reasoning": "short explanation" },
  "scorePrediction": { "score": "1-1", "reasoning": "short explanation" },
  "riskLevel": "Low/Medium/High"
}`,

  de: `Du bist Fußballanalyst und Wettexperte. Mache DATENBASIERTE Vorhersagen.

⚠️ KRITISCHE REGELN:
1. Verwende HEIM-Statistiken für Heimteam
2. Verwende AUSWÄRTS-Statistiken für Auswärtsteam
3. Wenn erwartete Tore > 2.5 → OVER, sonst UNDER
4. Konfidenz muss 50-75% sein (nicht übermütig!)
5. Gib NUR JSON zurück, keine Erklärungen

JSON FORMAT:
{
  "matchResult": { "prediction": "1/X/2", "confidence": 55, "reasoning": "kurze Erklärung" },
  "overUnder": { "prediction": "Over/Under", "confidence": 60, "reasoning": "kurze Erklärung" },
  "btts": { "prediction": "Yes/No", "confidence": 55, "reasoning": "kurze Erklärung" },
  "scorePrediction": { "score": "1-1", "reasoning": "kurze Erklärung" },
  "riskLevel": "Low/Medium/High"
}`
};

// ============================================================================
// KISA VE ÖZ CONTEXT BUILDER
// ============================================================================

function buildOptimizedContext(matchData: MatchData): string {
  const { homeTeam, awayTeam, league, homeForm, awayForm, h2h, detailedStats } = matchData as any;
  
  // Ev sahibi istatistikleri
  const homeGoalsScored = parseFloat(detailedStats?.home?.homeAvgGoalsScored || homeForm?.venueAvgScored || homeForm?.avgGoals || '1.2');
  const homeGoalsConceded = parseFloat(detailedStats?.home?.homeAvgGoalsConceded || homeForm?.venueAvgConceded || homeForm?.avgConceded || '1.0');
  const homeOver25 = parseInt(homeForm?.venueOver25Pct || homeForm?.over25Percentage || '50');
  const homeBtts = parseInt(homeForm?.venueBttsPct || homeForm?.bttsPercentage || '50');
  
  // Deplasman istatistikleri
  const awayGoalsScored = parseFloat(detailedStats?.away?.awayAvgGoalsScored || awayForm?.venueAvgScored || awayForm?.avgGoals || '1.0');
  const awayGoalsConceded = parseFloat(detailedStats?.away?.awayAvgGoalsConceded || awayForm?.venueAvgConceded || awayForm?.avgConceded || '1.2');
  const awayOver25 = parseInt(awayForm?.venueOver25Pct || awayForm?.over25Percentage || '50');
  const awayBtts = parseInt(awayForm?.venueBttsPct || awayForm?.bttsPercentage || '50');
  
  // H2H
  const h2hOver25 = parseInt(h2h?.over25Percentage || '50');
  const h2hBtts = parseInt(h2h?.bttsPercentage || '50');
  const h2hAvgGoals = parseFloat(h2h?.avgGoals || '2.5');
  
  // Beklenen goller
  const homeExpected = (homeGoalsScored + awayGoalsConceded) / 2;
  const awayExpected = (awayGoalsScored + homeGoalsConceded) / 2;
  const totalExpected = homeExpected + awayExpected;
  
  // Over/Under hesaplama
  const avgOver25 = (homeOver25 + awayOver25 + h2hOver25) / 3;
  const avgBtts = (homeBtts + awayBtts + h2hBtts) / 3;
  
  // Form analizi
  const homeFormStr = homeForm?.form || 'NNNNN';
  const awayFormStr = awayForm?.form || 'NNNNN';
  const homeWins = (homeFormStr.match(/W/g) || []).length;
  const awayWins = (awayFormStr.match(/W/g) || []).length;
  const homePoints = homeWins * 3 + (homeFormStr.match(/D/g) || []).length;
  const awayPoints = awayWins * 3 + (awayFormStr.match(/D/g) || []).length;
  
  return `
MAÇ: ${homeTeam} vs ${awayTeam} (${league})

📊 EV SAHİBİ (${homeTeam}) - EVDE:
- Gol: ${homeGoalsScored.toFixed(2)} attı, ${homeGoalsConceded.toFixed(2)} yedi
- Over 2.5: %${homeOver25}
- BTTS: %${homeBtts}
- Form: ${homeFormStr} (${homePoints} puan)

📊 DEPLASMAN (${awayTeam}) - DEPLASMANDA:
- Gol: ${awayGoalsScored.toFixed(2)} attı, ${awayGoalsConceded.toFixed(2)} yedi
- Over 2.5: %${awayOver25}
- BTTS: %${awayBtts}
- Form: ${awayFormStr} (${awayPoints} puan)

📊 H2H (${h2h?.totalMatches || 0} maç):
- ${homeTeam}: ${h2h?.homeWins || 0} galibiyet
- Berabere: ${h2h?.draws || 0}
- ${awayTeam}: ${h2h?.awayWins || 0} galibiyet
- Ort. Gol: ${h2hAvgGoals.toFixed(2)}
- Over 2.5: %${h2hOver25}

📊 HESAPLANAN DEĞERLER:
- Beklenen Gol: ${totalExpected.toFixed(2)} (${totalExpected > 2.5 ? 'OVER' : 'UNDER'} eğilimli)
- Over 2.5 Ort: %${avgOver25.toFixed(0)}
- BTTS Ort: %${avgBtts.toFixed(0)}
- Form Farkı: ${homePoints - awayPoints} puan (${homePoints > awayPoints ? homeTeam : awayPoints > homePoints ? awayTeam : 'Eşit'} avantajlı)
`;
}

// ============================================================================
// ANA FONKSİYON
// ============================================================================

export async function runOptimizedDeepAnalysis(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  console.log('🔬 Optimized Deep Analysis starting...');
  
  const systemPrompt = OPTIMIZED_PROMPT[language] || OPTIMIZED_PROMPT.en;
  const context = buildOptimizedContext(matchData);
  
  try {
    // Tek bir AI çağrısı yap (fallback zinciri yerine)
    const response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context }
    ], {
      model: 'deepseek', // En hızlı ve ucuz
      temperature: 0.2, // Daha deterministik
      maxTokens: 400, // Kısa yanıt
      timeout: 10000 // 10 saniye
    });
    
    if (!response) {
      console.log('   ⚠️ No AI response, using calculated fallback');
      return calculateFallback(matchData, language);
    }
    
    // JSON parse
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('   ⚠️ No JSON in response, using calculated fallback');
      return calculateFallback(matchData, language);
    }
    
    let result = JSON.parse(jsonMatch[0]);
    
    // Confidence sınırla
    if (result.matchResult?.confidence) {
      result.matchResult.confidence = Math.min(75, Math.max(50, result.matchResult.confidence));
    }
    if (result.overUnder?.confidence) {
      result.overUnder.confidence = Math.min(75, Math.max(50, result.overUnder.confidence));
    }
    if (result.btts?.confidence) {
      result.btts.confidence = Math.min(75, Math.max(50, result.btts.confidence));
    }
    
    // Eksik alanları doldur
    result = enrichResult(result, matchData, language);
    
    console.log(`   ✅ Analysis complete: MR=${result.matchResult?.prediction}, OU=${result.overUnder?.prediction}, BTTS=${result.btts?.prediction}`);
    return result;
    
  } catch (error: any) {
    console.error('   ❌ Error:', error.message);
    return calculateFallback(matchData, language);
  }
}

// ============================================================================
// AKILLI FALLBACK - VERİ BAZLI HESAPLAMA
// ============================================================================

function calculateFallback(matchData: MatchData, language: 'tr' | 'en' | 'de'): any {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h, detailedStats } = matchData as any;
  
  // İstatistikleri al
  const homeGoalsScored = parseFloat(detailedStats?.home?.homeAvgGoalsScored || homeForm?.venueAvgScored || homeForm?.avgGoals || '1.2');
  const homeGoalsConceded = parseFloat(detailedStats?.home?.homeAvgGoalsConceded || homeForm?.venueAvgConceded || homeForm?.avgConceded || '1.0');
  const awayGoalsScored = parseFloat(detailedStats?.away?.awayAvgGoalsScored || awayForm?.venueAvgScored || awayForm?.avgGoals || '1.0');
  const awayGoalsConceded = parseFloat(detailedStats?.away?.awayAvgGoalsConceded || awayForm?.venueAvgConceded || awayForm?.avgConceded || '1.2');
  
  // Beklenen goller
  const homeExpected = (homeGoalsScored + awayGoalsConceded) / 2;
  const awayExpected = (awayGoalsScored + homeGoalsConceded) / 2;
  const totalExpected = homeExpected + awayExpected;
  
  // Over/Under
  const homeOver25 = parseInt(homeForm?.venueOver25Pct || homeForm?.over25Percentage || '50');
  const awayOver25 = parseInt(awayForm?.venueOver25Pct || awayForm?.over25Percentage || '50');
  const h2hOver25 = parseInt(h2h?.over25Percentage || '50');
  const avgOver25 = (homeOver25 + awayOver25 + h2hOver25) / 3;
  
  // BTTS
  const homeBtts = parseInt(homeForm?.venueBttsPct || homeForm?.bttsPercentage || '50');
  const awayBtts = parseInt(awayForm?.venueBttsPct || awayForm?.bttsPercentage || '50');
  const h2hBtts = parseInt(h2h?.bttsPercentage || '50');
  const avgBtts = (homeBtts + awayBtts + h2hBtts) / 3;
  
  // Form analizi
  const homeFormStr = homeForm?.form || '';
  const awayFormStr = awayForm?.form || '';
  const homeWins = (homeFormStr.match(/W/g) || []).length;
  const awayWins = (awayFormStr.match(/W/g) || []).length;
  const homePoints = homeWins * 3 + (homeFormStr.match(/D/g) || []).length;
  const awayPoints = awayWins * 3 + (awayFormStr.match(/D/g) || []).length;
  const formDiff = homePoints - awayPoints;
  
  // Maç sonucu tahmini
  let matchResultPred: string;
  let matchResultConf: number;
  
  if (formDiff > 5) {
    matchResultPred = '1';
    matchResultConf = Math.min(70, 55 + formDiff);
  } else if (formDiff < -5) {
    matchResultPred = '2';
    matchResultConf = Math.min(70, 55 + Math.abs(formDiff));
  } else {
    // Dengeli durumda ev sahibine hafif avantaj
    if (formDiff >= 0) {
      matchResultPred = homeExpected > awayExpected + 0.3 ? '1' : 'X';
    } else {
      matchResultPred = awayExpected > homeExpected + 0.3 ? '2' : 'X';
    }
    matchResultConf = 55;
  }
  
  // Over/Under tahmini
  const overUnderPred = totalExpected > 2.5 || avgOver25 > 55 ? 'Over' : 'Under';
  const overUnderConf = Math.min(70, 50 + Math.abs(avgOver25 - 50) * 0.4);
  
  // BTTS tahmini
  const bttsPred = avgBtts > 55 || (homeGoalsScored > 1 && awayGoalsScored > 0.8) ? 'Yes' : 'No';
  const bttsConf = Math.min(70, 50 + Math.abs(avgBtts - 50) * 0.4);
  
  // Skor tahmini
  const homeGoals = Math.round(homeExpected);
  const awayGoals = Math.round(awayExpected);
  const scorePred = `${homeGoals}-${awayGoals}`;
  
  const messages = {
    tr: {
      mrReasoning: `Form: ${homeTeam} ${homePoints}p vs ${awayTeam} ${awayPoints}p. ${formDiff > 0 ? 'Ev sahibi' : formDiff < 0 ? 'Deplasman' : 'Dengeli'} avantajlı.`,
      ouReasoning: `Beklenen gol: ${totalExpected.toFixed(2)}. Over 2.5 ort: %${avgOver25.toFixed(0)}.`,
      bttsReasoning: `BTTS ort: %${avgBtts.toFixed(0)}. ${homeTeam} ${homeGoalsScored.toFixed(2)} attı, ${awayTeam} ${awayGoalsScored.toFixed(2)} attı.`,
      scoreReasoning: `Beklenen: ${homeTeam} ${homeExpected.toFixed(1)} gol, ${awayTeam} ${awayExpected.toFixed(1)} gol.`
    },
    en: {
      mrReasoning: `Form: ${homeTeam} ${homePoints}p vs ${awayTeam} ${awayPoints}p. ${formDiff > 0 ? 'Home' : formDiff < 0 ? 'Away' : 'Balanced'} advantage.`,
      ouReasoning: `Expected goals: ${totalExpected.toFixed(2)}. Over 2.5 avg: ${avgOver25.toFixed(0)}%.`,
      bttsReasoning: `BTTS avg: ${avgBtts.toFixed(0)}%. ${homeTeam} scores ${homeGoalsScored.toFixed(2)}, ${awayTeam} scores ${awayGoalsScored.toFixed(2)}.`,
      scoreReasoning: `Expected: ${homeTeam} ${homeExpected.toFixed(1)} goals, ${awayTeam} ${awayExpected.toFixed(1)} goals.`
    },
    de: {
      mrReasoning: `Form: ${homeTeam} ${homePoints}p vs ${awayTeam} ${awayPoints}p. ${formDiff > 0 ? 'Heim' : formDiff < 0 ? 'Auswärts' : 'Ausgeglichen'} Vorteil.`,
      ouReasoning: `Erwartete Tore: ${totalExpected.toFixed(2)}. Over 2.5 Durchschnitt: ${avgOver25.toFixed(0)}%.`,
      bttsReasoning: `BTTS Durchschnitt: ${avgBtts.toFixed(0)}%. ${homeTeam} erzielt ${homeGoalsScored.toFixed(2)}, ${awayTeam} erzielt ${awayGoalsScored.toFixed(2)}.`,
      scoreReasoning: `Erwartet: ${homeTeam} ${homeExpected.toFixed(1)} Tore, ${awayTeam} ${awayExpected.toFixed(1)} Tore.`
    }
  };
  
  const msg = messages[language] || messages.en;
  
  return enrichResult({
    matchResult: {
      prediction: matchResultPred,
      confidence: Math.round(matchResultConf),
      reasoning: msg.mrReasoning
    },
    overUnder: {
      prediction: overUnderPred,
      confidence: Math.round(overUnderConf),
      reasoning: msg.ouReasoning
    },
    btts: {
      prediction: bttsPred,
      confidence: Math.round(bttsConf),
      reasoning: msg.bttsReasoning
    },
    scorePrediction: {
      score: scorePred,
      reasoning: msg.scoreReasoning
    },
    riskLevel: Math.abs(formDiff) > 5 ? 'Low' : 'Medium'
  }, matchData, language);
}

// ============================================================================
// RESULT ENRICHMENT - EKSİK ALANLARI DOLDUR
// ============================================================================

function enrichResult(result: any, matchData: MatchData, language: string): any {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h } = matchData as any;
  
  // Motivasyon skorları
  const homeFormStr = homeForm?.form || '';
  const awayFormStr = awayForm?.form || '';
  const homeWins = (homeFormStr.match(/W/g) || []).length;
  const awayWins = (awayFormStr.match(/W/g) || []).length;
  const homeScore = Math.min(100, 30 + homeWins * 10);
  const awayScore = Math.min(100, 30 + awayWins * 10);
  
  // Eksik alanları ekle
  if (!result.motivationScores) {
    result.motivationScores = {
      home: homeScore,
      away: awayScore,
      homeTrend: homeWins >= 3 ? 'improving' : homeWins <= 1 ? 'declining' : 'stable',
      awayTrend: awayWins >= 3 ? 'improving' : awayWins <= 1 ? 'declining' : 'stable',
      homeFormGraph: homeFormStr.split('').join(' → '),
      awayFormGraph: awayFormStr.split('').join(' → '),
      reasoning: `${homeTeam}: ${homeScore}/100, ${awayTeam}: ${awayScore}/100`
    };
  }
  
  if (!result.matchAnalysis) {
    result.matchAnalysis = `${homeTeam} vs ${awayTeam} analizi.`;
  }
  
  if (!result.criticalFactors) {
    result.criticalFactors = [
      `${homeTeam} ev sahibi avantajı`,
      `Form: ${homeFormStr} vs ${awayFormStr}`,
      `H2H: ${h2h?.totalMatches || 0} maç`
    ];
  }
  
  if (!result.bestBet) {
    // En yüksek güvenli tahmini seç
    const bets = [
      { type: 'Match Result', selection: result.matchResult?.prediction, confidence: result.matchResult?.confidence || 50 },
      { type: 'Over/Under 2.5', selection: result.overUnder?.prediction, confidence: result.overUnder?.confidence || 50 },
      { type: 'BTTS', selection: result.btts?.prediction, confidence: result.btts?.confidence || 50 }
    ];
    const best = bets.sort((a, b) => b.confidence - a.confidence)[0];
    result.bestBet = {
      type: best.type,
      selection: best.selection,
      confidence: best.confidence,
      reasoning: `En yüksek güven: ${best.confidence}%`
    };
  }
  
  if (!result.agentSummary) {
    result.agentSummary = `${homeTeam} vs ${awayTeam}: ${result.bestBet?.type} → ${result.bestBet?.selection} (${result.bestBet?.confidence}%)`;
  }
  
  return result;
}
