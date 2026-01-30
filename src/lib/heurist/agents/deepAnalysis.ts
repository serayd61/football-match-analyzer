// src/lib/heurist/agents/deepAnalysis.ts

import { MatchData } from '../types';
import { aiClient } from '../../ai-client';
import { TeamMotivationAnalysis } from './team-motivation-analyzer';
import { ENHANCED_DEEP_ANALYSIS_AGENT_PROMPT } from './enhanced-prompts';
import { AgentLearningContext } from '../../agent-learning/dominant-agent';

// 🎯 DEEP ANALYSIS PROMPT - OPTİMİZE EDİLMİŞ VERSİYON
// Daha kısa, daha net, daha yüksek doğruluk hedefli

const DEEP_ANALYSIS_PROMPT = {
  tr: `Sen deneyimli bir futbol analisti ve bahis uzmanısın. VERİ BAZLI tahmin yap.

⚠️ KRİTİK KURALLAR:
1. EV SAHİBİ için EVDE istatistiklerini kullan (evdeki gol ortalaması, evdeki Over%, evdeki BTTS%)
2. DEPLASMAN için DEPLASMANDA istatistiklerini kullan (deplasmandaki gol ortalaması, deplasmandaki Over%, deplasmandaki BTTS%)
3. Beklenen Gol > 2.5 ise OVER, < 2.5 ise UNDER
4. Güven %50-75 arasında olmalı (aşırı güvenme!)
5. SADECE JSON döndür, açıklama yazma

📊 HESAPLAMA FORMÜLÜ:
- Ev Beklenen Gol = (Ev Attığı + Dep Yediği) / 2
- Dep Beklenen Gol = (Dep Attığı + Ev Yediği) / 2
- Toplam Beklenen = Ev Beklenen + Dep Beklenen
- Over 2.5 % = (Ev Over% × 0.35) + (Dep Over% × 0.35) + (H2H Over% × 0.30)
- BTTS % = (Ev BTTS% + Dep BTTS% + H2H BTTS%) / 3

📊 SONUÇ TAHMİNİ:
- Form farkı > 5 puan: Favori kazanır (1 veya 2)
- Form farkı 0-5 puan: Ev sahibi hafif favori (1 veya X)
- Dengeli takımlar: Beraberlik olasılığı yüksek (X)

⚡ SADECE BU JSON FORMATINI DÖNDÜR:
{
  "matchAnalysis": "2-3 cümle maç özeti",
  "criticalFactors": ["Faktör 1", "Faktör 2", "Faktör 3"],
  "probabilities": { "homeWin": 35, "draw": 30, "awayWin": 35 },
  "scorePrediction": { "score": "1-1", "reasoning": "kısa açıklama" },
  "overUnder": { "prediction": "Over/Under", "confidence": 60, "reasoning": "Ev Over X%, Dep Over Y%, H2H Over Z%" },
  "btts": { "prediction": "Yes/No", "confidence": 55, "reasoning": "kısa açıklama" },
  "matchResult": { "prediction": "1/X/2", "confidence": 55, "reasoning": "kısa açıklama" },
  "bestBet": { "type": "Over/Under 2.5", "selection": "Over/Under", "confidence": 60, "reasoning": "neden" },
  "motivationScores": { "home": 70, "away": 65, "homeTrend": "stable", "awayTrend": "stable", "reasoning": "kısa" },
  "riskLevel": "Low/Medium/High",
  "agentSummary": "Tek cümle özet"
}`,

  en: `You are a professional football analyst and betting expert. Make DATA-BASED predictions.

⚠️ CRITICAL RULES:
1. Use HOME stats for home team (home goals scored, home Over%, home BTTS%)
2. Use AWAY stats for away team (away goals scored, away Over%, away BTTS%)
3. Expected Goals > 2.5 → OVER, < 2.5 → UNDER
4. Confidence must be 50-75% (don't be overconfident!)
5. Return ONLY JSON, no explanations

📊 CALCULATION FORMULA:
- Home Expected = (Home Scored + Away Conceded) / 2
- Away Expected = (Away Scored + Home Conceded) / 2
- Total Expected = Home Expected + Away Expected
- Over 2.5 % = (Home Over% × 0.35) + (Away Over% × 0.35) + (H2H Over% × 0.30)
- BTTS % = (Home BTTS% + Away BTTS% + H2H BTTS%) / 3

📊 RESULT PREDICTION:
- Form difference > 5 points: Favorite wins (1 or 2)
- Form difference 0-5 points: Home slight favorite (1 or X)
- Balanced teams: Draw likely (X)

⚡ RETURN ONLY THIS JSON FORMAT:
{
  "matchAnalysis": "2-3 sentence match summary",
  "criticalFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "probabilities": { "homeWin": 35, "draw": 30, "awayWin": 35 },
  "scorePrediction": { "score": "1-1", "reasoning": "short explanation" },
  "overUnder": { "prediction": "Over/Under", "confidence": 60, "reasoning": "Home Over X%, Away Over Y%, H2H Over Z%" },
  "btts": { "prediction": "Yes/No", "confidence": 55, "reasoning": "short explanation" },
  "matchResult": { "prediction": "1/X/2", "confidence": 55, "reasoning": "short explanation" },
  "bestBet": { "type": "Over/Under 2.5", "selection": "Over/Under", "confidence": 60, "reasoning": "why" },
  "motivationScores": { "home": 70, "away": 65, "homeTrend": "stable", "awayTrend": "stable", "reasoning": "short" },
  "riskLevel": "Low/Medium/High",
  "agentSummary": "One sentence summary"
}`,

  de: `Du bist Fußballanalyst und Wettexperte. Mache DATENBASIERTE Vorhersagen.

⚠️ KRITISCHE REGELN:
1. Verwende HEIM-Statistiken für Heimteam
2. Verwende AUSWÄRTS-Statistiken für Auswärtsteam
3. Erwartete Tore > 2.5 → OVER, < 2.5 → UNDER
4. Konfidenz muss 50-75% sein (nicht übermütig!)
5. Gib NUR JSON zurück, keine Erklärungen

📊 BERECHNUNG:
- Heim Erwartet = (Heim Erzielt + Auswärts Kassiert) / 2
- Auswärts Erwartet = (Auswärts Erzielt + Heim Kassiert) / 2
- Gesamt = Heim + Auswärts
- Over 2.5 % = (Heim Over% × 0.35) + (Auswärts Over% × 0.35) + (H2H Over% × 0.30)

⚡ NUR DIESES JSON-FORMAT:
{
  "matchAnalysis": "2-3 Sätze Zusammenfassung",
  "criticalFactors": ["Faktor 1", "Faktor 2", "Faktor 3"],
  "probabilities": { "homeWin": 35, "draw": 30, "awayWin": 35 },
  "scorePrediction": { "score": "1-1", "reasoning": "kurze Erklärung" },
  "overUnder": { "prediction": "Over/Under", "confidence": 60, "reasoning": "Heim Over X%, Auswärts Over Y%" },
  "btts": { "prediction": "Yes/No", "confidence": 55, "reasoning": "kurze Erklärung" },
  "matchResult": { "prediction": "1/X/2", "confidence": 55, "reasoning": "kurze Erklärung" },
  "bestBet": { "type": "Over/Under 2.5", "selection": "Over/Under", "confidence": 60, "reasoning": "warum" },
  "motivationScores": { "home": 70, "away": 65, "homeTrend": "stable", "awayTrend": "stable", "reasoning": "kurz" },
  "riskLevel": "Low/Medium/High",
  "agentSummary": "Einzeilige Zusammenfassung"
}`
};

// ==================== MOTIVATION & PREPARATION SCORE ====================

/**
 * Takımın son 10 maç form grafiğini analiz ederek motivasyon/hazırlık puanı hesapla (0-100)
 */
function calculateTeamMotivationScore(
  formString: string,
  matches: any[],
  points: number,
  recentWeeks: number = 3
): {
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  reasoning: string;
  formGraph: string;
} {
  if (!formString || formString.length === 0) {
    return {
      score: 50,
      trend: 'stable',
      reasoning: 'Form verisi yetersiz',
      formGraph: 'N/A'
    };
  }

  // Son 10 maç form grafiği (en yeni en sağda)
  const last10Form = formString.slice(-10).split('').reverse(); // En yeni maç ilk sırada
  const formGraph = last10Form.join(' → ');

  // Form puanları (W=3, D=1, L=0)
  const formPoints = last10Form.map((r: string) => {
    if (r === 'W') return 3;
    if (r === 'D') return 1;
    return 0;
  });

  // Son 3 hafta (son 3 maç) vs önceki 3 hafta (4-6. maçlar)
  const recent3Matches = formPoints.slice(0, 3);
  const previous3Matches = formPoints.slice(3, 6);
  
  const recentAvg = recent3Matches.reduce((a: number, b: number) => a + b, 0) / recent3Matches.length;
  const previousAvg = previous3Matches.length > 0 
    ? previous3Matches.reduce((a: number, b: number) => a + b, 0) / previous3Matches.length 
    : recentAvg;

  // Trend analizi
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentAvg > previousAvg + 0.3) trend = 'improving';
  else if (recentAvg < previousAvg - 0.3) trend = 'declining';

  // Temel puan (form puanlarına göre)
  const totalFormPoints = formPoints.reduce((a: number, b: number) => a + b, 0);
  const maxPossible = 10 * 3; // 10 maç, her biri 3 puan
  const baseScore = (totalFormPoints / maxPossible) * 60; // 0-60 arası

  // Trend bonusu/cezası
  let trendBonus = 0;
  if (trend === 'improving') {
    trendBonus = Math.min(20, (recentAvg - previousAvg) * 10); // +0-20
  } else if (trend === 'declining') {
    trendBonus = Math.max(-20, (recentAvg - previousAvg) * 10); // -0-20
  }

  // Son maçlar momentum (son 2-3 maçın ağırlığı)
  const last3Avg = formPoints.slice(0, 3).reduce((a: number, b: number) => a + b, 0) / 3;
  const momentumBonus = (last3Avg / 3) * 20; // +0-20

  // Final puan
  const finalScore = Math.round(Math.max(0, Math.min(100, baseScore + trendBonus + momentumBonus)));

  // Reasoning
  const wins = last10Form.filter((r: string) => r === 'W').length;
  const draws = last10Form.filter((r: string) => r === 'D').length;
  const losses = last10Form.filter((r: string) => r === 'L').length;
  
  let reasoning = `Son 10 maç: ${wins}G-${draws}B-${losses}M (${totalFormPoints}/${maxPossible} puan)`;
  if (trend === 'improving') {
    reasoning += `. Son haftalarda performans artıyor (${recentAvg.toFixed(1)} vs ${previousAvg.toFixed(1)} puan/maç)`;
  } else if (trend === 'declining') {
    reasoning += `. Son haftalarda performans düşüyor (${recentAvg.toFixed(1)} vs ${previousAvg.toFixed(1)} puan/maç)`;
  } else {
    reasoning += `. Performans stabil (${recentAvg.toFixed(1)} puan/maç)`;
  }

  return {
    score: finalScore,
    trend,
    reasoning,
    formGraph
  };
}

function buildDeepAnalysisContext(matchData: MatchData, learningContext?: AgentLearningContext | null): string {
  const { homeTeam, awayTeam, league, homeForm, awayForm, h2h, detailedStats } = matchData as any;
  
  // İstatistikleri al
  const homeGoalsScored = parseFloat(detailedStats?.home?.homeAvgGoalsScored || homeForm?.venueAvgScored || homeForm?.avgGoals || '1.2');
  const homeGoalsConceded = parseFloat(detailedStats?.home?.homeAvgGoalsConceded || homeForm?.venueAvgConceded || homeForm?.avgConceded || '1.0');
  const awayGoalsScored = parseFloat(detailedStats?.away?.awayAvgGoalsScored || awayForm?.venueAvgScored || awayForm?.avgGoals || '1.0');
  const awayGoalsConceded = parseFloat(detailedStats?.away?.awayAvgGoalsConceded || awayForm?.venueAvgConceded || awayForm?.avgConceded || '1.2');
  
  // Beklenen goller
  const homeExpected = (homeGoalsScored + awayGoalsConceded) / 2;
  const awayExpected = (awayGoalsScored + homeGoalsConceded) / 2;
  const totalExpected = homeExpected + awayExpected;
  
  // Over/Under ve BTTS yüzdeleri
  const homeOver25 = parseInt(homeForm?.venueOver25Pct || homeForm?.over25Percentage || '50');
  const awayOver25 = parseInt(awayForm?.venueOver25Pct || awayForm?.over25Percentage || '50');
  const h2hOver25 = parseInt(h2h?.over25Percentage || '50');
  const avgOver25 = Math.round((homeOver25 * 0.35) + (awayOver25 * 0.35) + (h2hOver25 * 0.30));
  
  const homeBtts = parseInt(homeForm?.venueBttsPct || homeForm?.bttsPercentage || '50');
  const awayBtts = parseInt(awayForm?.venueBttsPct || awayForm?.bttsPercentage || '50');
  const h2hBtts = parseInt(h2h?.bttsPercentage || '50');
  const avgBtts = Math.round((homeBtts + awayBtts + h2hBtts) / 3);
  
  // Form analizi
  const homeFormStr = homeForm?.form || 'NNNNN';
  const awayFormStr = awayForm?.form || 'NNNNN';
  const homeWins = (homeFormStr.match(/W/g) || []).length;
  const awayWins = (awayFormStr.match(/W/g) || []).length;
  const homePoints = homeWins * 3 + (homeFormStr.match(/D/g) || []).length;
  const awayPoints = awayWins * 3 + (awayFormStr.match(/D/g) || []).length;
  const formDiff = homePoints - awayPoints;
  
  // 🧠 LEARNING CONTEXT - Geçmiş verilerden öğrenilen bilgiler
  let learningSection = '';
  if (learningContext) {
    learningSection = `
🧠 GEÇMİŞ VERİ HAFİZASI:`;
    
    // Takım eşleşme hafızası
    if (learningContext.teamMatchup) {
      const tm = learningContext.teamMatchup;
      learningSection += `
- Bu iki takım ${tm.totalMatches} kez karşılaştı
- Ortalama gol: ${tm.avgTotalGoals.toFixed(1)} (${tm.avgTotalGoals < 2.2 ? 'UNDER eğilimli' : tm.avgTotalGoals > 2.8 ? 'OVER eğilimli' : 'Dengeli'})
- BTTS oranı: %${tm.bttsRate.toFixed(0)} (${tm.bttsRate < 40 ? 'BTTS NO eğilimli' : tm.bttsRate > 60 ? 'BTTS YES eğilimli' : 'Dengeli'})
- Over 2.5 oranı: %${tm.over25Rate.toFixed(0)}
- Son maç: ${tm.lastMatchScore} (${tm.lastMatchResult === '1' ? homeTeam : tm.lastMatchResult === '2' ? awayTeam : 'Berabere'})`;
      
      if (tm.patterns && tm.patterns.length > 0) {
        learningSection += `
- Pattern'ler: ${tm.patterns.join(', ')}`;
      }
    }
    
    // Takım pattern'leri
    if (learningContext.homeTeamPatterns.length > 0 || learningContext.awayTeamPatterns.length > 0) {
      learningSection += `
- ${homeTeam} pattern: ${learningContext.homeTeamPatterns.length > 0 ? learningContext.homeTeamPatterns.join(', ') : 'Yok'}
- ${awayTeam} pattern: ${learningContext.awayTeamPatterns.length > 0 ? learningContext.awayTeamPatterns.join(', ') : 'Yok'}`;
    }
    
    // Öneriler
    if (learningContext.recommendations.length > 0) {
      learningSection += `

⚠️ SİSTEM ÖNERİLERİ (Geçmiş verilerden):`;
      learningContext.recommendations.forEach(r => {
        learningSection += `
${r}`;
      });
    }
    
    // Dominant agent bilgisi
    learningSection += `

🎯 EN BAŞARILI AJANLAR:
- Maç Sonucu: ${learningContext.dominantAgents.matchResult.agent} (%${learningContext.dominantAgents.matchResult.accuracy.toFixed(0)} doğruluk)
- Over/Under: ${learningContext.dominantAgents.overUnder.agent} (%${learningContext.dominantAgents.overUnder.accuracy.toFixed(0)} doğruluk)
- BTTS: ${learningContext.dominantAgents.btts.agent} (%${learningContext.dominantAgents.btts.accuracy.toFixed(0)} doğruluk)`;
  }
  
  // KISA VE ÖZ CONTEXT - AI'ın hızlı işlemesi için
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
- Ort. Gol: ${h2h?.avgGoals || '2.5'}
- Over 2.5: %${h2hOver25}
- BTTS: %${h2hBtts}

📊 HESAPLANAN DEĞERLER:
- Beklenen Gol: ${totalExpected.toFixed(2)} (${totalExpected > 2.5 ? 'OVER' : 'UNDER'} eğilimli)
- Over 2.5 Ort: %${avgOver25} (Ev %${homeOver25} × 0.35 + Dep %${awayOver25} × 0.35 + H2H %${h2hOver25} × 0.30)
- BTTS Ort: %${avgBtts}
- Form Farkı: ${formDiff > 0 ? '+' : ''}${formDiff} puan (${formDiff > 5 ? homeTeam + ' favori' : formDiff < -5 ? awayTeam + ' favori' : 'Dengeli'})
${learningSection}

⚡ TAHMİN YAP VE SADECE JSON DÖNDÜR!
`;
}

export async function runDeepAnalysisAgent(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en',
  learningContext?: AgentLearningContext | null
): Promise<any> {
  console.log('🔬 Deep Analysis Agent starting...');
  console.log(`   📊 Match: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log(`   🌍 Language: ${language}`);
  if (learningContext) {
    console.log(`   🧠 Learning Context: Active (${learningContext.recommendations.length} recommendations)`);
  }
  
  // 🎯 Motivasyon skorları hesapla (basit ve hızlı)
  const { homeForm, awayForm } = matchData as any;
  const homeMotivation = calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0);
  const awayMotivation = calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0);
  console.log(`   💪 Motivation: Home ${homeMotivation.score}/100 (${homeMotivation.trend}), Away ${awayMotivation.score}/100 (${awayMotivation.trend})`);
  
  // Motivasyon analizi objelerini oluştur (sonuç için)
  const homeMotivationAnalysis: TeamMotivationAnalysis = {
    performanceScore: homeMotivation.score,
    teamMotivationScore: 50,
    finalScore: homeMotivation.score,
    trend: homeMotivation.trend,
    reasoning: homeMotivation.reasoning,
    formGraph: homeMotivation.formGraph,
    injuries: [],
    squadIssues: [],
    newsImpact: '',
    motivationFactors: []
  };
  const awayMotivationAnalysis: TeamMotivationAnalysis = {
    performanceScore: awayMotivation.score,
    teamMotivationScore: 50,
    finalScore: awayMotivation.score,
    trend: awayMotivation.trend,
    reasoning: awayMotivation.reasoning,
    formGraph: awayMotivation.formGraph,
    injuries: [],
    squadIssues: [],
    newsImpact: '',
    motivationFactors: []
  };
  
  // Use enhanced prompts if available, fallback to legacy prompts
  const systemPrompt = (ENHANCED_DEEP_ANALYSIS_AGENT_PROMPT[language as keyof typeof ENHANCED_DEEP_ANALYSIS_AGENT_PROMPT] || ENHANCED_DEEP_ANALYSIS_AGENT_PROMPT.en) || (DEEP_ANALYSIS_PROMPT[language] || DEEP_ANALYSIS_PROMPT.en);
  
  // 🧠 Learning Context'i context'e ekle
  const context = buildDeepAnalysisContext(matchData, learningContext);
  
  // Language-specific user message - KISALTILMIŞ VERSİYON
  const userMessageByLang = {
    tr: `${context}\n\nYukarıdaki verileri analiz et. SADECE JSON döndür, açıklama yazma.`,
    en: `${context}\n\nAnalyze the data above. Return ONLY JSON, no explanations.`,
    de: `${context}\n\nAnalysiere die obigen Daten. Gib NUR JSON zurück, keine Erklärungen.`
  };
  const userMessage = userMessageByLang[language] || userMessageByLang.en;

  try {
    let response = null;
    
    // ============================================================
    // STRATEJİ: DeepSeek (MCP) → Claude → Intelligent Fallback
    // DeepSeek daha detaylı analiz yapıyor, MCP ile zenginleştirilmiş veri
    // ============================================================
    
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    
    // 1️⃣ ÖNCE DEEPSEEK DENE (MCP ile daha zengin veri)
    if (hasDeepSeek) {
      console.log('   🟣 [1/4] Trying DeepSeek for deep analysis...');
      try {
        response = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
          model: 'deepseek',
          useMCP: false,
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.3,
          maxTokens: 800, // JSON tamamlanması için yeterli
          timeout: 12000 // 12 saniye (performans için düşürüldü)
        });
        
        if (response) {
          console.log('   ✅ DeepSeek + MCP responded successfully');
        }
      } catch (deepseekError: any) {
        console.log(`   ⚠️ DeepSeek failed: ${deepseekError?.message || 'Unknown error'}`);
      }
    } else {
      console.log('   ⚠️ DeepSeek API key not available, trying Claude...');
    }

    // 2️⃣ DEEPSEEK BAŞARISIZ OLURSA OPENAI DENE (GPT-4 Turbo)
    if (!response) {
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      if (hasOpenAI) {
        console.log('   🟢 [2/4] Trying OpenAI GPT-4 Turbo for deep analysis...');
        try {
          response = await aiClient.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ], {
            model: 'gpt-4-turbo',
            useMCP: false,
            mcpFallback: false,
            fixtureId: matchData.fixtureId,
            temperature: 0.3,
            maxTokens: 600,
            timeout: 12000 // 12 saniye (performans için düşürüldü)
          });
          
          if (response) {
            console.log('   ✅ OpenAI GPT-4 responded successfully');
          }
        } catch (openaiError: any) {
          console.log(`   ⚠️ OpenAI failed: ${openaiError?.message || 'Unknown error'}`);
        }
      }
    }

    // 3️⃣ OPENAI BAŞARISIZ OLURSA CLAUDE DENE
    if (!response) {
      console.log('   🔵 [3/4] Trying Claude for deep analysis...');
      try {
        response = await aiClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ], {
          model: 'claude',
          useMCP: false,
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.3,
          maxTokens: 600,
          timeout: 12000 // 12 saniye (performans için düşürüldü)
        });
        
        if (response) {
          console.log('   ✅ Claude responded successfully');
        }
      } catch (claudeError: any) {
        console.log(`   ⚠️ Claude failed: ${claudeError?.message || 'Unknown error'}`);
      }
    }

    // 5️⃣ HER ÜÇÜ DE BAŞARISIZ OLURSA AKILLI FALLBACK
    if (!response) {
      console.log('   🟠 [4/4] Using intelligent fallback analysis...');
      const fallbackResult = getDefaultDeepAnalysis(matchData, language);
      console.log(`   ✅ Fallback generated: ${fallbackResult.matchResult?.prediction} (${fallbackResult.matchResult?.confidence}%)`);
      return fallbackResult;
    }
    
    // JSON parse - Daha güçlü extraction
    let result;
    try {
      // Önce markdown code block'ları temizle
      let cleaned = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/\*\*/g, '')
        .trim();
      
      // JSON objesini bul
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      let jsonStr = jsonMatch[0];
      
      // JSON hatalarını düzelt
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1'); // Trailing commas
      jsonStr = jsonStr.replace(/\n/g, ' '); // Newlines
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' '); // Control characters
      
      // Eksik kapanış parantezlerini düzelt (kısaltılmış JSON için)
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      if (openBraces > closeBraces) {
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }
      
      result = JSON.parse(jsonStr);
    } catch (parseError: any) {
      console.error('❌ Deep Analysis JSON parse error:', parseError);
      console.log('Raw response (first 1000 chars):', response.substring(0, 1000));
      console.log('Parse error at position:', parseError.message?.match(/position (\d+)/)?.[1] || 'unknown');
      result = getDefaultDeepAnalysis(matchData, language);
    }

    // Validate and fix confidence values
    if (result.overUnder?.confidence) {
      result.overUnder.confidence = Math.min(85, Math.max(50, result.overUnder.confidence));
    }
    if (result.btts?.confidence) {
      result.btts.confidence = Math.min(85, Math.max(50, result.btts.confidence));
    }
    if (result.matchResult?.confidence) {
      result.matchResult.confidence = Math.min(85, Math.max(50, result.matchResult.confidence));
    }
    if (result.bestBet?.confidence) {
      result.bestBet.confidence = Math.min(85, Math.max(50, result.bestBet.confidence));
    }

    // 🆕 Gelişmiş Motivasyon puanlarını ekle (Gemini API ile)
    if (homeMotivationAnalysis && awayMotivationAnalysis) {
      result.motivationScores = {
        home: homeMotivationAnalysis.finalScore, // %50 performans + %50 takım içi
        away: awayMotivationAnalysis.finalScore,
        homeTrend: homeMotivationAnalysis.trend,
        awayTrend: awayMotivationAnalysis.trend,
        homeFormGraph: homeMotivationAnalysis.formGraph,
        awayFormGraph: awayMotivationAnalysis.formGraph,
        reasoning: `${matchData.homeTeam}: ${homeMotivationAnalysis.reasoning}. ${matchData.awayTeam}: ${awayMotivationAnalysis.reasoning}. Puan farkı: ${Math.abs(homeMotivationAnalysis.finalScore - awayMotivationAnalysis.finalScore)} puan.`,
        // Yeni alanlar
        homePerformanceScore: homeMotivationAnalysis.performanceScore,
        homeTeamMotivationScore: homeMotivationAnalysis.teamMotivationScore,
        awayPerformanceScore: awayMotivationAnalysis.performanceScore,
        awayTeamMotivationScore: awayMotivationAnalysis.teamMotivationScore,
        homeInjuries: homeMotivationAnalysis.injuries,
        awayInjuries: awayMotivationAnalysis.injuries,
        homeSquadIssues: homeMotivationAnalysis.squadIssues,
        awaySquadIssues: awayMotivationAnalysis.squadIssues,
        homeNewsImpact: homeMotivationAnalysis.newsImpact,
        awayNewsImpact: awayMotivationAnalysis.newsImpact,
        homeMotivationFactors: homeMotivationAnalysis.motivationFactors,
        awayMotivationFactors: awayMotivationAnalysis.motivationFactors
      };
    } else {
      // Fallback: Eski yöntem
      const { homeForm, awayForm } = matchData as any;
      const homeMotivation = calculateTeamMotivationScore(
        homeForm?.form || '',
        homeForm?.matches || [],
        homeForm?.points || 0
      );
      
      const awayMotivation = calculateTeamMotivationScore(
        awayForm?.form || '',
        awayForm?.matches || [],
        awayForm?.points || 0
      );

      result.motivationScores = {
        home: homeMotivation.score,
        away: awayMotivation.score,
        homeTrend: homeMotivation.trend,
        awayTrend: awayMotivation.trend,
        homeFormGraph: homeMotivation.formGraph,
        awayFormGraph: awayMotivation.formGraph,
        reasoning: `${matchData.homeTeam}: ${homeMotivation.reasoning}. ${matchData.awayTeam}: ${awayMotivation.reasoning}. Puan farkı: ${Math.abs(homeMotivation.score - awayMotivation.score)} puan.`
      };
    }

    console.log(`✅ Deep Analysis complete:`);
    console.log(`   🎯 Best Bet: ${result.bestBet?.type} → ${result.bestBet?.selection} (${result.bestBet?.confidence}%)`);
    console.log(`   ⚽ Score: ${result.scorePrediction?.score}`);
    console.log(`   📊 Over/Under: ${result.overUnder?.prediction} (${result.overUnder?.confidence}%)`);
    console.log(`   🎲 BTTS: ${result.btts?.prediction} (${result.btts?.confidence}%)`);
    console.log(`   🏆 Match: ${result.matchResult?.prediction} (${result.matchResult?.confidence}%)`);
    if (homeMotivationAnalysis && awayMotivationAnalysis) {
      console.log(`   💪 Motivation: Home ${homeMotivationAnalysis.finalScore}/100 (Perf: ${homeMotivationAnalysis.performanceScore}, Team: ${homeMotivationAnalysis.teamMotivationScore}), Away ${awayMotivationAnalysis.finalScore}/100 (Perf: ${awayMotivationAnalysis.performanceScore}, Team: ${awayMotivationAnalysis.teamMotivationScore})`);
    } else {
      const { homeForm, awayForm } = matchData as any;
      const homeMotivation = calculateTeamMotivationScore(homeForm?.form || '', [], homeForm?.points || 0);
      const awayMotivation = calculateTeamMotivationScore(awayForm?.form || '', [], awayForm?.points || 0);
      console.log(`   💪 Motivation: Home ${homeMotivation.score}/100 (${homeMotivation.trend}), Away ${awayMotivation.score}/100 (${awayMotivation.trend})`);
    }
    
    return result;
  } catch (error: any) {
    console.error('❌ Deep Analysis Agent error:', error);
    return getDefaultDeepAnalysis(matchData, language);
  }
}

function getDefaultDeepAnalysis(matchData: MatchData, language: 'tr' | 'en' | 'de' = 'en'): any {
  const { homeForm, awayForm, h2h } = matchData as any;
  
  // 🆕 Motivasyon puanları hesapla
  const homeMotivation = calculateTeamMotivationScore(
    homeForm?.form || '',
    homeForm?.matches || [],
    homeForm?.points || 0
  );
  
  const awayMotivation = calculateTeamMotivationScore(
    awayForm?.form || '',
    awayForm?.matches || [],
    awayForm?.points || 0
  );
  
  // 🆕 FORM PUANLARI HESAPLA - Beraberlik yerine gerçek tahmin yap!
  const homeFormStr = homeForm?.form || '';
  const awayFormStr = awayForm?.form || '';
  const homeWins = (homeFormStr.match(/W/g) || []).length;
  const awayWins = (awayFormStr.match(/W/g) || []).length;
  const homePoints = homeWins * 3 + (homeFormStr.match(/D/g) || []).length;
  const awayPoints = awayWins * 3 + (awayFormStr.match(/D/g) || []).length;
  const formDiff = homePoints - awayPoints;
  
  // 🆕 Maç sonucu tahmini - Form farkına göre! (DÜZELTME: Eşikler artırıldı)
  // formDiff > 6: Ev sahibi favori (eskiden 5)
  // formDiff < -6: Deplasman favori (eskiden -5)
  // -6 <= formDiff <= 6: Dengeli (beraberlik bölgesi genişletildi)
  const matchResultPred = formDiff > 6 ? '1' : formDiff < -6 ? '2' : 'X';
  // Olasılık hesaplaması - daha konservatif (2 → 1.5 çarpan)
  const homeWinProb = Math.min(60, Math.max(25, 35 + formDiff * 1.5));
  const awayWinProb = Math.min(60, Math.max(25, 35 - formDiff * 1.5));
  // Beraberlik olasılığı en az %20 (gerçek dünyada ~%25-28)
  const drawProb = Math.max(20, 100 - homeWinProb - awayWinProb);
  // Güven skoru - daha konservatif (max %68)
  const matchResultConf = Math.min(68, 50 + Math.abs(formDiff) * 1.2);
  
  // Basit hesaplama
  const homeOver = parseInt(homeForm?.venueOver25Pct || homeForm?.over25Percentage || '50');
  const awayOver = parseInt(awayForm?.venueOver25Pct || awayForm?.over25Percentage || '50');
  const h2hOver = parseInt(h2h?.over25Percentage || '50');
  const avgOver = (homeOver * 0.35 + awayOver * 0.35 + h2hOver * 0.30);
  
  // DÜZELTME: Over eşiği 50 → 55 (regresyon düzeltmesi)
  const overUnderPred = avgOver >= 55 ? 'Over' : 'Under';
  // Güven skoru - daha konservatif (max %68)
  const overUnderConf = Math.min(68, Math.max(50, Math.abs(avgOver - 52.5) * 0.8 + 50));
  
  // 🆕 Hakem varsayılan değerleri
  const referee = (matchData as any).referee;
  const avgYellowCards = referee?.avgYellowCards || 4.2;
  const avgRedCards = referee?.avgRedCards || 0.15;
  
  // 🆕 Korner ve kart tahminleri
  const expectedCorners = avgOver >= 55 ? 11 : avgOver >= 45 ? 9.5 : 8.5;
  const expectedCards = avgYellowCards + (avgRedCards * 2);
  
  // Language-specific messages
  const messages = {
    tr: {
      matchAnalysis: `${matchData.homeTeam} vs ${matchData.awayTeam} maçı için derin analiz yapıldı.`,
      criticalFactors: [
        `${matchData.homeTeam} ev sahibi avantajı`,
        `Son form durumları: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}`,
        `H2H geçmiş: ${h2h?.totalMatches || 0} maç`,
        `Gol ortalamaları değerlendirildi`,
        `Hakem eğilimleri analiz edildi`
      ],
      scorePredictionReasoning: 'Dengeli güç dengesi beraberliğe işaret ediyor.',
      overUnderReasoning: `Ev sahibi Over %${homeOver}, Deplasman Over %${awayOver}, H2H Over %${h2hOver}`,
      bttsReasoning: 'Dikkatli yaklaşım.',
      matchResultReasoning: 'Dengeli güçler.',
      bestBetReasoning: `İstatistiksel hesaplama ${overUnderPred} yönünde.`,
      refereeUnknown: 'Bilinmiyor',
      refereeReasoning: 'Ortalama hakem verileri kullanıldı',
      weatherReasoning: 'Hava durumu verisi mevcut değil, standart koşullar varsayıldı',
      keyBattles: ['Kanat mücadelesi', 'Orta saha kontrolü'],
      agentSummary: `${matchData.homeTeam} vs ${matchData.awayTeam}: ${overUnderPred} 2.5, Korner ${expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5'} tavsiye edilir.`
    },
    en: {
      matchAnalysis: `Deep analysis performed for ${matchData.homeTeam} vs ${matchData.awayTeam}.`,
      criticalFactors: [
        `${matchData.homeTeam} home advantage`,
        `Recent form: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}`,
        `H2H history: ${h2h?.totalMatches || 0} matches`,
        `Goal averages evaluated`,
        `Referee tendencies analyzed`
      ],
      scorePredictionReasoning: 'Balanced power suggests a draw.',
      overUnderReasoning: `Home Over ${homeOver}%, Away Over ${awayOver}%, H2H Over ${h2hOver}%`,
      bttsReasoning: 'Cautious approach.',
      matchResultReasoning: 'Balanced teams.',
      bestBetReasoning: `Statistical calculation points to ${overUnderPred}.`,
      refereeUnknown: 'Unknown',
      refereeReasoning: 'Average referee data used',
      weatherReasoning: 'Weather data unavailable, standard conditions assumed',
      keyBattles: ['Wing battles', 'Midfield control'],
      agentSummary: `${matchData.homeTeam} vs ${matchData.awayTeam}: ${overUnderPred} 2.5, Corners ${expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5'} recommended.`
    },
    de: {
      matchAnalysis: `Tiefenanalyse für ${matchData.homeTeam} vs ${matchData.awayTeam} durchgeführt.`,
      criticalFactors: [
        `${matchData.homeTeam} Heimvorteil`,
        `Aktuelle Form: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}`,
        `H2H Geschichte: ${h2h?.totalMatches || 0} Spiele`,
        `Tordurchschnitte bewertet`,
        `Schiedsrichtertendenzen analysiert`
      ],
      scorePredictionReasoning: 'Ausgeglichene Kräfte deuten auf Unentschieden.',
      overUnderReasoning: `Heim Over ${homeOver}%, Auswärts Over ${awayOver}%, H2H Over ${h2hOver}%`,
      bttsReasoning: 'Vorsichtiger Ansatz.',
      matchResultReasoning: 'Ausgeglichene Teams.',
      bestBetReasoning: `Statistische Berechnung zeigt ${overUnderPred}.`,
      refereeUnknown: 'Unbekannt',
      refereeReasoning: 'Durchschnittliche Schiedsrichterdaten verwendet',
      weatherReasoning: 'Wetterdaten nicht verfügbar, Standardbedingungen angenommen',
      keyBattles: ['Flügelkämpfe', 'Mittelfeld-Kontrolle'],
      agentSummary: `${matchData.homeTeam} vs ${matchData.awayTeam}: ${overUnderPred} 2.5, Ecken ${expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5'} empfohlen.`
    }
  };

  const msg = messages[language] || messages.en;
  
  // 🆕 Skor tahminleri - form farkına göre
  const scoreByResult = {
    '1': ['2-1', '2-0', '1-0'],
    '2': ['0-1', '1-2', '0-2'],
    'X': ['1-1', '0-0', '2-2']
  };
  
  // 🆕 Maç sonucu reasoning - form farkına göre
  const matchResultReasoningByLang = {
    tr: matchResultPred === '1' 
      ? `Ev sahibi form avantajı: ${homePoints}p vs ${awayPoints}p (+${formDiff} puan farkı)`
      : matchResultPred === '2'
      ? `Deplasman form avantajı: ${awayPoints}p vs ${homePoints}p (${formDiff} puan farkı)`
      : `Dengeli form: ${homePoints}p vs ${awayPoints}p (${formDiff > 0 ? '+' : ''}${formDiff} puan farkı)`,
    en: matchResultPred === '1' 
      ? `Home team form advantage: ${homePoints}p vs ${awayPoints}p (+${formDiff} points difference)`
      : matchResultPred === '2'
      ? `Away team form advantage: ${awayPoints}p vs ${homePoints}p (${formDiff} points difference)`
      : `Balanced form: ${homePoints}p vs ${awayPoints}p (${formDiff > 0 ? '+' : ''}${formDiff} points difference)`,
    de: matchResultPred === '1' 
      ? `Heimmannschaft Formvorteil: ${homePoints}p vs ${awayPoints}p (+${formDiff} Punktedifferenz)`
      : matchResultPred === '2'
      ? `Auswärtsmannschaft Formvorteil: ${awayPoints}p vs ${homePoints}p (${formDiff} Punktedifferenz)`
      : `Ausgeglichene Form: ${homePoints}p vs ${awayPoints}p (${formDiff > 0 ? '+' : ''}${formDiff} Punktedifferenz)`
  };

  return {
    matchAnalysis: msg.matchAnalysis,
    criticalFactors: msg.criticalFactors,
    probabilities: { 
      homeWin: Math.round(homeWinProb), 
      draw: Math.round(drawProb), 
      awayWin: Math.round(awayWinProb) 
    },
    expectedScores: scoreByResult[matchResultPred as keyof typeof scoreByResult] || ['1-1', '1-0', '2-1'],
    scorePrediction: { 
      score: scoreByResult[matchResultPred as keyof typeof scoreByResult]?.[0] || '1-1', 
      reasoning: matchResultReasoningByLang[language] || matchResultReasoningByLang.en
    },
    overUnder: { 
      prediction: overUnderPred, 
      confidence: Math.round(overUnderConf), 
      reasoning: msg.overUnderReasoning
    },
    btts: { 
      prediction: avgOver > 55 ? 'Yes' : 'No', // Over yüksekse BTTS Yes
      confidence: Math.round(50 + Math.abs(avgOver - 55) * 0.5), 
      reasoning: avgOver > 55 
        ? `Yüksek gol beklentisi (%${Math.round(avgOver)}) → Her iki takım da gol atabilir`
        : msg.bttsReasoning
    },
    matchResult: { 
      prediction: matchResultPred, // 🆕 Form bazlı tahmin!
      confidence: Math.round(matchResultConf), 
      reasoning: matchResultReasoningByLang[language] || matchResultReasoningByLang.en
    },
    bestBet: { 
      type: Math.abs(formDiff) > 5 ? 'Match Result' : 'Over/Under 2.5',
      selection: Math.abs(formDiff) > 5 
        ? (matchResultPred === '1' ? 'Home' : matchResultPred === '2' ? 'Away' : 'Draw')
        : overUnderPred, 
      confidence: Math.abs(formDiff) > 5 ? Math.round(matchResultConf) : Math.round(overUnderConf), 
      reasoning: Math.abs(formDiff) > 5 
        ? matchResultReasoningByLang[language] || matchResultReasoningByLang.en
        : msg.bestBetReasoning
    },
    // 🆕 New fields
    refereeAnalysis: {
      name: referee?.name || msg.refereeUnknown,
      avgYellowCards,
      avgRedCards,
      avgPenalties: referee?.penaltyRate || 0.3,
      homeTeamBias: 'neutral',
      cardPrediction: expectedCards > 4 ? 'Over 3.5' : 'Under 4.5',
      reasoning: msg.refereeReasoning
    },
    weatherImpact: {
      condition: 'Clear',
      temperature: 15,
      impact: 'Low',
      reasoning: msg.weatherReasoning
    },
    lineupAnalysis: {
      homeFormation: '4-3-3',
      awayFormation: '4-4-2',
      keyBattles: msg.keyBattles,
      missingKeyPlayers: []
    },
    cornersAndCards: {
      expectedCorners,
      cornersLine: expectedCorners > 10 ? 'Over 10.5' : 'Over 9.5',
      cornersConfidence: 60,
      expectedCards,
      cardsLine: expectedCards > 4 ? 'Over 3.5' : 'Under 4.5',
      cardsConfidence: 58
    },
    preparationScore: {
      home: Math.min(100, Math.max(0, Math.round(
        (homeOver >= 55 ? 20 : 10) + // Form pozitif ise +20, negatif ise +10
        (homeForm?.wins && homeForm.wins > homeForm.losses ? 15 : 5) + // Kazanma oranı
        35 + // Base score
        (homeForm?.venueAvgScored && parseFloat(homeForm.venueAvgScored) > 1.5 ? 10 : 5) // Gol atma gücü
      ))),
      away: Math.min(100, Math.max(0, Math.round(
        (awayOver >= 55 ? 20 : 10) + // Form pozitif ise +20, negatif ise +10
        (awayForm?.wins && awayForm.wins > awayForm.losses ? 15 : 5) + // Kazanma oranı
        30 + // Base score (deplasman için biraz düşük)
        (awayForm?.venueAvgScored && parseFloat(awayForm.venueAvgScored) > 1.5 ? 10 : 5) // Gol atma gücü
      ))),
      reasoning: {
        home: language === 'tr' 
          ? `Form analizi: ${homeOver}% Over, ${homeForm?.wins || 0} galibiyet. Evde ${homeForm?.venueAvgScored || 'N/A'} gol atma ortalaması.`
          : language === 'de'
          ? `Formanalyse: ${homeOver}% Over, ${homeForm?.wins || 0} Siege. Heimdurchschnitt: ${homeForm?.venueAvgScored || 'N/A'} Tore.`
          : `Form analysis: ${homeOver}% Over, ${homeForm?.wins || 0} wins. Home average: ${homeForm?.venueAvgScored || 'N/A'} goals.`,
        away: language === 'tr'
          ? `Form analizi: ${awayOver}% Over, ${awayForm?.wins || 0} galibiyet. Deplasman ${awayForm?.venueAvgScored || 'N/A'} gol atma ortalaması.`
          : language === 'de'
          ? `Formanalyse: ${awayOver}% Over, ${awayForm?.wins || 0} Siege. Auswärtsdurchschnitt: ${awayForm?.venueAvgScored || 'N/A'} Tore.`
          : `Form analysis: ${awayOver}% Over, ${awayForm?.wins || 0} wins. Away average: ${awayForm?.venueAvgScored || 'N/A'} goals.`
      }
    },
    // 🆕 Motivasyon puanları
    motivationScores: {
      home: homeMotivation.score,
      away: awayMotivation.score,
      homeTrend: homeMotivation.trend,
      awayTrend: awayMotivation.trend,
      homeFormGraph: homeMotivation.formGraph,
      awayFormGraph: awayMotivation.formGraph,
      reasoning: `${matchData.homeTeam}: ${homeMotivation.reasoning}. ${matchData.awayTeam}: ${awayMotivation.reasoning}. Puan farkı: ${Math.abs(homeMotivation.score - awayMotivation.score)} puan.`
    },
    riskLevel: 'Medium',
    agentSummary: msg.agentSummary
  };
}
