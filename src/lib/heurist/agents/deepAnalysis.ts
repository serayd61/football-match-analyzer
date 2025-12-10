// src/lib/heurist/agents/deepAnalysis.ts

import { MatchData } from '../types';
import { callHeuristAI } from '../client';

const DEEP_ANALYSIS_PROMPT = {
  tr: `Sen profesyonel bir futbol analisti ve bahis uzmanısın. Çok katmanlı derin analiz yaparak maç tahmini üreteceksin.

GÖREV: Verilen verileri kullanarak kapsamlı analiz yap ve JSON formatında döndür.

ANALİZ KATMANLARI:
1. TAKIM FORMU VE DİNAMİKLERİ
   - Son maç performansları (ev/deplasman ayrımı)
   - Gol beklentisi trendi
   - Mental durum ve motivasyon

2. TAKTİKSEL YAPI
   - Güçlü ve zayıf yönler
   - Rakibin bu zaafları nasıl kullanabileceği

3. TARİHSEL VERİLER
   - H2H karşılaşma geçmişi
   - Psikolojik üstünlük

4. İSTATİSTİKSEL MODELLEME
   - Beklenen gol sayısı
   - Over/Under ve BTTS olasılıkları
   - Sonuç olasılıkları

5. KRİTİK FAKTÖRLER
   - Sakatlıklar
   - Maçın önemi
   - Ev sahibi avantajı

MUTLAKA DÖNDÜR (JSON):
{
  "matchAnalysis": "Maçın genel analizi (2-3 cümle)",
  "criticalFactors": ["Kritik faktör 1", "Kritik faktör 2", "Kritik faktör 3", "Kritik faktör 4", "Kritik faktör 5"],
  "probabilities": {
    "homeWin": 35,
    "draw": 30,
    "awayWin": 35
  },
  "expectedScores": ["1-1", "2-1", "1-2"],
  "scorePrediction": {
    "score": "1-1",
    "reasoning": "Neden bu skor"
  },
  "overUnder": {
    "prediction": "Over veya Under",
    "confidence": 70,
    "reasoning": "Neden bu tahmin"
  },
  "btts": {
    "prediction": "Yes veya No",
    "confidence": 65,
    "reasoning": "Neden bu tahmin"
  },
  "matchResult": {
    "prediction": "1 veya X veya 2",
    "confidence": 55,
    "reasoning": "Neden bu tahmin"
  },
  "bestBet": {
    "type": "Over/Under 2.5 veya BTTS veya Match Result",
    "selection": "Seçim",
    "confidence": 72,
    "reasoning": "Neden en iyi bahis"
  },
  "riskLevel": "Low veya Medium veya High",
  "agentSummary": "Tek cümlelik özet"
}`,

  en: `You are a professional football analyst and betting expert. You will produce match predictions through multi-layered deep analysis.

TASK: Use the provided data to perform comprehensive analysis and return in JSON format.

ANALYSIS LAYERS:
1. TEAM FORM AND DYNAMICS
   - Recent match performances (home/away split)
   - Goal expectancy trend
   - Mental state and motivation

2. TACTICAL STRUCTURE
   - Strengths and weaknesses
   - How opponent can exploit weaknesses

3. HISTORICAL DATA
   - H2H history
   - Psychological advantage

4. STATISTICAL MODELING
   - Expected goals
   - Over/Under and BTTS probabilities
   - Result probabilities

5. CRITICAL FACTORS
   - Injuries
   - Match importance
   - Home advantage

MUST RETURN (JSON):
{
  "matchAnalysis": "Overall match analysis (2-3 sentences)",
  "criticalFactors": ["Critical factor 1", "Critical factor 2", "Critical factor 3", "Critical factor 4", "Critical factor 5"],
  "probabilities": {
    "homeWin": 35,
    "draw": 30,
    "awayWin": 35
  },
  "expectedScores": ["1-1", "2-1", "1-2"],
  "scorePrediction": {
    "score": "1-1",
    "reasoning": "Why this score"
  },
  "overUnder": {
    "prediction": "Over or Under",
    "confidence": 70,
    "reasoning": "Why this prediction"
  },
  "btts": {
    "prediction": "Yes or No",
    "confidence": 65,
    "reasoning": "Why this prediction"
  },
  "matchResult": {
    "prediction": "1 or X or 2",
    "confidence": 55,
    "reasoning": "Why this prediction"
  },
  "bestBet": {
    "type": "Over/Under 2.5 or BTTS or Match Result",
    "selection": "Selection",
    "confidence": 72,
    "reasoning": "Why best bet"
  },
  "riskLevel": "Low or Medium or High",
  "agentSummary": "One sentence summary"
}`,

  de: `Du bist ein professioneller Fußballanalyst und Wettexperte. Du wirst Spielvorhersagen durch mehrschichtige Tiefenanalyse erstellen.

AUFGABE: Verwende die bereitgestellten Daten für eine umfassende Analyse und gib sie im JSON-Format zurück.

ANALYSE-EBENEN:
1. TEAMFORM UND DYNAMIK
2. TAKTISCHE STRUKTUR
3. HISTORISCHE DATEN
4. STATISTISCHE MODELLIERUNG
5. KRITISCHE FAKTOREN

MUSS ZURÜCKGEBEN (JSON):
{
  "matchAnalysis": "Gesamtanalyse des Spiels",
  "criticalFactors": ["Faktor 1", "Faktor 2", "Faktor 3"],
  "probabilities": { "homeWin": 35, "draw": 30, "awayWin": 35 },
  "expectedScores": ["1-1", "2-1"],
  "scorePrediction": { "score": "1-1", "reasoning": "Warum" },
  "overUnder": { "prediction": "Over/Under", "confidence": 70, "reasoning": "Warum" },
  "btts": { "prediction": "Yes/No", "confidence": 65, "reasoning": "Warum" },
  "matchResult": { "prediction": "1/X/2", "confidence": 55, "reasoning": "Warum" },
  "bestBet": { "type": "Typ", "selection": "Auswahl", "confidence": 72, "reasoning": "Warum" },
  "riskLevel": "Low/Medium/High",
  "agentSummary": "Zusammenfassung"
}`
};

function buildDeepAnalysisContext(matchData: MatchData): string {
  const { homeTeam, awayTeam, league, homeForm, awayForm, h2h, odds, detailedStats, professionalCalc } = matchData;
  
  let context = `
═══════════════════════════════════════════════════════════════
MAÇ: ${homeTeam} vs ${awayTeam}
LİG: ${league || 'Unknown'}
═══════════════════════════════════════════════════════════════

📊 EV SAHİBİ: ${homeTeam}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Genel Form: ${homeForm?.form || 'N/A'}
• Ev Sahibi Form: ${homeForm?.venueForm || homeForm?.form || 'N/A'}
• Ev Sahibi Gol Ortalaması: ${homeForm?.venueAvgScored || homeForm?.avgGoals || 'N/A'} attı, ${homeForm?.venueAvgConceded || homeForm?.avgConceded || 'N/A'} yedi
• Ev Sahibi Over 2.5: %${homeForm?.venueOver25Pct || homeForm?.over25Percentage || 'N/A'}
• Ev Sahibi BTTS: %${homeForm?.venueBttsPct || homeForm?.bttsPercentage || 'N/A'}
• Clean Sheet: %${homeForm?.cleanSheetPercentage || 'N/A'}

📊 DEPLASMAN: ${awayTeam}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Genel Form: ${awayForm?.form || 'N/A'}
• Deplasman Form: ${awayForm?.venueForm || awayForm?.form || 'N/A'}
• Deplasman Gol Ortalaması: ${awayForm?.venueAvgScored || awayForm?.avgGoals || 'N/A'} attı, ${awayForm?.venueAvgConceded || awayForm?.avgConceded || 'N/A'} yedi
• Deplasman Over 2.5: %${awayForm?.venueOver25Pct || awayForm?.over25Percentage || 'N/A'}
• Deplasman BTTS: %${awayForm?.venueBttsPct || awayForm?.bttsPercentage || 'N/A'}
• Clean Sheet: %${awayForm?.cleanSheetPercentage || 'N/A'}

🔄 KAFA KAFAYA (H2H)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Toplam Maç: ${h2h?.totalMatches || 0}
• ${homeTeam} Kazandı: ${h2h?.homeWins || 0}
• Berabere: ${h2h?.draws || 0}
• ${awayTeam} Kazandı: ${h2h?.awayWins || 0}
• H2H Ortalama Gol: ${h2h?.avgGoals || 'N/A'}
• H2H Over 2.5: %${h2h?.over25Percentage || 'N/A'}
• H2H BTTS: %${h2h?.bttsPercentage || 'N/A'}
`;

  // Odds bilgisi
  if (odds?.matchWinner?.home) {
    context += `
💰 ORANLAR (ODDS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 1X2: ${odds.matchWinner.home} / ${odds.matchWinner.draw} / ${odds.matchWinner.away}
• Over 2.5: ${odds.overUnder?.['2.5']?.over || 'N/A'} | Under 2.5: ${odds.overUnder?.['2.5']?.under || 'N/A'}
• BTTS Yes: ${odds.btts?.yes || 'N/A'} | BTTS No: ${odds.btts?.no || 'N/A'}
`;
  }

  // Profesyonel hesaplama
  if (professionalCalc?.overUnder) {
    context += `
🎯 PROFESYONEL HESAPLAMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Ağırlıklı Over 2.5: %${professionalCalc.overUnder.breakdown?.weightedOver || 'N/A'}
• Beklenen Toplam Gol: ${professionalCalc.overUnder.breakdown?.expectedTotal || 'N/A'}
• Sistem Tahmini: ${professionalCalc.overUnder.prediction} (%${professionalCalc.overUnder.confidence} güven)
`;
  }

  // Sakatlıklar
  if (detailedStats?.injuries) {
    const homeInjuries = detailedStats.injuries.home || [];
    const awayInjuries = detailedStats.injuries.away || [];
    
    if (homeInjuries.length > 0 || awayInjuries.length > 0) {
      context += `
🏥 SAKATLIKLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ${homeTeam}: ${homeInjuries.length > 0 ? homeInjuries.map((i: any) => i.player).join(', ') : 'Yok'}
• ${awayTeam}: ${awayInjuries.length > 0 ? awayInjuries.map((i: any) => i.player).join(', ') : 'Yok'}
`;
    }
  }

  // Son maçlar
  if (homeForm?.matches && homeForm.matches.length > 0) {
    context += `
📋 ${homeTeam} SON MAÇLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    homeForm.matches.slice(0, 5).forEach((m: any) => {
      context += `• ${m.isHome ? '🏠' : '🚌'} vs ${m.opponent}: ${m.score} (${m.result})\n`;
    });
  }

  if (awayForm?.matches && awayForm.matches.length > 0) {
    context += `
📋 ${awayTeam} SON MAÇLAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    awayForm.matches.slice(0, 5).forEach((m: any) => {
      context += `• ${m.isHome ? '🏠' : '🚌'} vs ${m.opponent}: ${m.score} (${m.result})\n`;
    });
  }

  return context;
}

export async function runDeepAnalysisAgent(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  console.log('🔬 Deep Analysis Agent starting...');
  
  const systemPrompt = DEEP_ANALYSIS_PROMPT[language] || DEEP_ANALYSIS_PROMPT.en;
  const context = buildDeepAnalysisContext(matchData);
  
  const userMessage = `${context}

Bu verileri kullanarak çok katmanlı derin analiz yap. JSON formatında döndür.`;

  try {
    const response = await callHeuristAI(systemPrompt, userMessage, 'deepAnalysis');
    
    // JSON parse
    let result;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('❌ Deep Analysis JSON parse error:', parseError);
      result = getDefaultDeepAnalysis(matchData);
    }

    console.log(`✅ Deep Analysis complete: ${result.bestBet?.type} → ${result.bestBet?.selection}`);
    
    return result;
  } catch (error: any) {
    console.error('❌ Deep Analysis Agent error:', error);
    return getDefaultDeepAnalysis(matchData);
  }
}

function getDefaultDeepAnalysis(matchData: MatchData): any {
  return {
    matchAnalysis: `${matchData.homeTeam} vs ${matchData.awayTeam} maçı analiz edildi.`,
    criticalFactors: [
      'Form durumu',
      'Ev sahibi avantajı',
      'H2H geçmiş',
      'Gol ortalamaları',
      'Savunma performansı'
    ],
    probabilities: { homeWin: 35, draw: 30, awayWin: 35 },
    expectedScores: ['1-1', '2-1', '1-0'],
    scorePrediction: { score: '1-1', reasoning: 'Dengeli maç beklentisi' },
    overUnder: { prediction: 'Under', confidence: 55, reasoning: 'Yeterli veri yok' },
    btts: { prediction: 'No', confidence: 55, reasoning: 'Yeterli veri yok' },
    matchResult: { prediction: 'X', confidence: 50, reasoning: 'Yeterli veri yok' },
    bestBet: { type: 'Over/Under 2.5', selection: 'Under', confidence: 55, reasoning: 'Veri yetersiz' },
    riskLevel: 'High',
    agentSummary: 'Yeterli veri olmadığından düşük güvenli tahmin.'
  };
}
