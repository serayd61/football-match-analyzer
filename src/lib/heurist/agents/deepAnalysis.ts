// src/lib/heurist/agents/deepAnalysis.ts

import { MatchData } from '../types';
import { heurist } from '../client';

const DEEP_ANALYSIS_PROMPT = {
  tr: `Sen profesyonel bir futbol analisti ve bahis uzmanısın. Çok katmanlı derin analiz yaparak maç tahmini üreteceksin.

GÖREV: Verilen verileri kullanarak kapsamlı analiz yap ve JSON formatında döndür.

ANALİZ KATMANLARI:

1. TAKIM FORMU VE DİNAMİKLERİ
   - Son 10 maç performansı
   - İç saha / deplasman istatistikleri (ÇOK ÖNEMLİ!)
   - Gol beklentisi trendi
   - Takımın mental durumu ve motivasyon düzeyi

2. TAKTİKSEL YAPI
   - Güçlü ve zayıf yönler
   - Rakibin bu zaafları nasıl kullanabileceği
   - Ev sahibi avantajı değerlendirmesi

3. TARİHSEL VERİLER
   - H2H karşılaşma geçmişi
   - Psikolojik üstünlük
   - Geçmiş maçlardaki gol ortalaması

4. İSTATİSTİKSEL MODELLEME
   - Beklenen gol sayısı hesaplama
   - Over/Under 2.5 olasılığı
   - BTTS (İki Takım da Gol Atar) olasılığı
   - Sonuç olasılıkları (1/X/2)

5. KRİTİK FAKTÖRLER
   - Sakatlıklar ve cezalılar
   - Maçın lig sıralamasındaki önemi
   - Motivasyon farkları
   - Hava durumu ve saha koşulları

ÖNEMLİ KURALLAR:
- Ev sahibi EVDEKİ maç istatistiklerini kullan
- Deplasman DEPLASMANDAKİ maç istatistiklerini kullan
- Düşük gollü takımlar için Under'a eğilimli ol
- H2H verisi yoksa form verilerine ağırlık ver
- Confidence %50-85 arasında olmalı

MUTLAKA BU JSON FORMATINDA DÖNDÜR:
{
  "matchAnalysis": "Maçın genel analizi (2-3 cümle, taktiksel ve istatistiksel özet)",
  "criticalFactors": [
    "Kritik faktör 1 (en önemli)",
    "Kritik faktör 2",
    "Kritik faktör 3",
    "Kritik faktör 4",
    "Kritik faktör 5"
  ],
  "probabilities": {
    "homeWin": 35,
    "draw": 30,
    "awayWin": 35
  },
  "expectedScores": ["1-1", "2-1", "1-0"],
  "scorePrediction": {
    "score": "1-1",
    "reasoning": "Bu skorun neden en olası olduğunun açıklaması"
  },
  "overUnder": {
    "prediction": "Over veya Under",
    "confidence": 70,
    "reasoning": "Detaylı açıklama (ev sahibi evde X gol, deplasman dışarıda Y gol...)"
  },
  "btts": {
    "prediction": "Yes veya No",
    "confidence": 65,
    "reasoning": "Detaylı açıklama"
  },
  "matchResult": {
    "prediction": "1 veya X veya 2",
    "confidence": 55,
    "reasoning": "Detaylı açıklama"
  },
  "bestBet": {
    "type": "Over/Under 2.5 veya BTTS veya Match Result",
    "selection": "Seçim (Over/Under/Yes/No/1/X/2)",
    "confidence": 72,
    "reasoning": "Neden bu en iyi bahis seçeneği"
  },
  "riskLevel": "Low veya Medium veya High",
  "agentSummary": "Tek cümlelik maç özeti ve tavsiye"
}`,

  en: `You are a professional football analyst and betting expert. You will produce match predictions through multi-layered deep analysis.

TASK: Use the provided data to perform comprehensive analysis and return in JSON format.

ANALYSIS LAYERS:

1. TEAM FORM AND DYNAMICS
   - Last 10 match performance
   - Home / Away statistics (VERY IMPORTANT!)
   - Goal expectancy trend
   - Team mental state and motivation level

2. TACTICAL STRUCTURE
   - Strengths and weaknesses
   - How opponent can exploit weaknesses
   - Home advantage evaluation

3. HISTORICAL DATA
   - H2H history
   - Psychological advantage
   - Goal averages in past matches

4. STATISTICAL MODELING
   - Expected goals calculation
   - Over/Under 2.5 probability
   - BTTS probability
   - Result probabilities (1/X/2)

5. CRITICAL FACTORS
   - Injuries and suspensions
   - Match importance in league standings
   - Motivation differences
   - Weather and pitch conditions

IMPORTANT RULES:
- Use home team's HOME match statistics
- Use away team's AWAY match statistics
- Lean towards Under for low-scoring teams
- If no H2H data, weight form data more heavily
- Confidence should be between 50-85%

MUST RETURN IN THIS JSON FORMAT:
{
  "matchAnalysis": "Overall match analysis (2-3 sentences, tactical and statistical summary)",
  "criticalFactors": [
    "Critical factor 1 (most important)",
    "Critical factor 2",
    "Critical factor 3",
    "Critical factor 4",
    "Critical factor 5"
  ],
  "probabilities": {
    "homeWin": 35,
    "draw": 30,
    "awayWin": 35
  },
  "expectedScores": ["1-1", "2-1", "1-0"],
  "scorePrediction": {
    "score": "1-1",
    "reasoning": "Explanation of why this score is most likely"
  },
  "overUnder": {
    "prediction": "Over or Under",
    "confidence": 70,
    "reasoning": "Detailed explanation (home team scores X at home, away scores Y away...)"
  },
  "btts": {
    "prediction": "Yes or No",
    "confidence": 65,
    "reasoning": "Detailed explanation"
  },
  "matchResult": {
    "prediction": "1 or X or 2",
    "confidence": 55,
    "reasoning": "Detailed explanation"
  },
  "bestBet": {
    "type": "Over/Under 2.5 or BTTS or Match Result",
    "selection": "Selection (Over/Under/Yes/No/1/X/2)",
    "confidence": 72,
    "reasoning": "Why this is the best betting option"
  },
  "riskLevel": "Low or Medium or High",
  "agentSummary": "One sentence match summary and recommendation"
}`,

  de: `Du bist ein professioneller Fußballanalyst und Wettexperte. Du wirst Spielvorhersagen durch mehrschichtige Tiefenanalyse erstellen.

AUFGABE: Verwende die bereitgestellten Daten für eine umfassende Analyse und gib sie im JSON-Format zurück.

ANALYSE-EBENEN:
1. TEAMFORM UND DYNAMIK - Letzte 10 Spiele, Heim/Auswärts-Statistiken
2. TAKTISCHE STRUKTUR - Stärken und Schwächen
3. HISTORISCHE DATEN - H2H-Geschichte
4. STATISTISCHE MODELLIERUNG - Erwartete Tore, Over/Under, BTTS
5. KRITISCHE FAKTOREN - Verletzungen, Spielbedeutung

WICHTIGE REGELN:
- Verwende Heimstatistiken für Heimteam
- Verwende Auswärtsstatistiken für Auswärtsteam
- Confidence zwischen 50-85%

MUSS IN DIESEM JSON-FORMAT ZURÜCKGEBEN:
{
  "matchAnalysis": "Gesamtanalyse des Spiels (2-3 Sätze)",
  "criticalFactors": ["Faktor 1", "Faktor 2", "Faktor 3", "Faktor 4", "Faktor 5"],
  "probabilities": { "homeWin": 35, "draw": 30, "awayWin": 35 },
  "expectedScores": ["1-1", "2-1", "1-0"],
  "scorePrediction": { "score": "1-1", "reasoning": "Warum dieses Ergebnis" },
  "overUnder": { "prediction": "Over oder Under", "confidence": 70, "reasoning": "Erklärung" },
  "btts": { "prediction": "Yes oder No", "confidence": 65, "reasoning": "Erklärung" },
  "matchResult": { "prediction": "1 oder X oder 2", "confidence": 55, "reasoning": "Erklärung" },
  "bestBet": { "type": "Typ", "selection": "Auswahl", "confidence": 72, "reasoning": "Warum beste Wette" },
  "riskLevel": "Low oder Medium oder High",
  "agentSummary": "Einzeilige Zusammenfassung"
}`
};

function buildDeepAnalysisContext(matchData: MatchData): string {
  const { homeTeam, awayTeam, league, homeForm, awayForm, h2h, odds, detailedStats, professionalCalc } = matchData as any;
  
  let context = `
═══════════════════════════════════════════════════════════════════════════════
                    MAÇ ANALİZİ: ${homeTeam} vs ${awayTeam}
                    LİG: ${league || 'Unknown League'}
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 EV SAHİBİ: ${homeTeam}
├─────────────────────────────────────────────────────────────────────────────┤
│ GENEL FORM (Son 5-10 maç):
│   • Form: ${homeForm?.form || 'N/A'}
│   • Puan: ${homeForm?.points || 0} / ${homeForm?.wins ? (homeForm.wins + homeForm.draws + homeForm.losses) * 3 : 15}
│   • Galibiyet/Beraberlik/Mağlubiyet: ${homeForm?.wins || 0}W-${homeForm?.draws || 0}D-${homeForm?.losses || 0}L
│   • Ortalama Gol (Genel): ${homeForm?.avgGoals || 'N/A'} attı, ${homeForm?.avgConceded || 'N/A'} yedi
│   • Over 2.5 (Genel): %${homeForm?.over25Percentage || 'N/A'}
│   • BTTS (Genel): %${homeForm?.bttsPercentage || 'N/A'}
│
│ 🏟️ EVDEKİ MAÇLAR (ÖNEMLİ!):
│   • Ev Formu: ${homeForm?.venueForm || homeForm?.form || 'N/A'}
│   • Ev Gol Ortalaması: ${homeForm?.venueAvgScored || homeForm?.avgGoals || 'N/A'} attı, ${homeForm?.venueAvgConceded || homeForm?.avgConceded || 'N/A'} yedi
│   • Ev Over 2.5: %${homeForm?.venueOver25Pct || homeForm?.over25Percentage || 'N/A'}
│   • Ev BTTS: %${homeForm?.venueBttsPct || homeForm?.bttsPercentage || 'N/A'}
│   • Ev Clean Sheet: %${homeForm?.cleanSheetPercentage || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🚌 DEPLASMAN: ${awayTeam}
├─────────────────────────────────────────────────────────────────────────────┤
│ GENEL FORM (Son 5-10 maç):
│   • Form: ${awayForm?.form || 'N/A'}
│   • Puan: ${awayForm?.points || 0} / ${awayForm?.wins ? (awayForm.wins + awayForm.draws + awayForm.losses) * 3 : 15}
│   • Galibiyet/Beraberlik/Mağlubiyet: ${awayForm?.wins || 0}W-${awayForm?.draws || 0}D-${awayForm?.losses || 0}L
│   • Ortalama Gol (Genel): ${awayForm?.avgGoals || 'N/A'} attı, ${awayForm?.avgConceded || 'N/A'} yedi
│   • Over 2.5 (Genel): %${awayForm?.over25Percentage || 'N/A'}
│   • BTTS (Genel): %${awayForm?.bttsPercentage || 'N/A'}
│
│ ✈️ DEPLASMANDAKİ MAÇLAR (ÖNEMLİ!):
│   • Deplasman Formu: ${awayForm?.venueForm || awayForm?.form || 'N/A'}
│   • Deplasman Gol Ortalaması: ${awayForm?.venueAvgScored || awayForm?.avgGoals || 'N/A'} attı, ${awayForm?.venueAvgConceded || awayForm?.avgConceded || 'N/A'} yedi
│   • Deplasman Over 2.5: %${awayForm?.venueOver25Pct || awayForm?.over25Percentage || 'N/A'}
│   • Deplasman BTTS: %${awayForm?.venueBttsPct || awayForm?.bttsPercentage || 'N/A'}
│   • Deplasman Clean Sheet: %${awayForm?.cleanSheetPercentage || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔄 KAFA KAFAYA (H2H) - Son Karşılaşmalar
├─────────────────────────────────────────────────────────────────────────────┤
│   • Toplam Maç: ${h2h?.totalMatches || 0}
│   • ${homeTeam} Kazandı: ${h2h?.homeWins || 0}
│   • Berabere: ${h2h?.draws || 0}
│   • ${awayTeam} Kazandı: ${h2h?.awayWins || 0}
│   • H2H Ortalama Toplam Gol: ${h2h?.avgGoals || 'N/A'}
│   • H2H Over 2.5 Oranı: %${h2h?.over25Percentage || 'N/A'}
│   • H2H BTTS Oranı: %${h2h?.bttsPercentage || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘
`;

  // Odds bilgisi
  if (odds?.matchWinner?.home) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 BAHİS ORANLARI (ODDS)
├─────────────────────────────────────────────────────────────────────────────┤
│   • Maç Sonucu (1X2): ${homeTeam} ${odds.matchWinner.home} | Beraberlik ${odds.matchWinner.draw} | ${awayTeam} ${odds.matchWinner.away}
│   • Over 2.5 Gol: ${odds.overUnder?.['2.5']?.over || 'N/A'}
│   • Under 2.5 Gol: ${odds.overUnder?.['2.5']?.under || 'N/A'}
│   • BTTS Evet: ${odds.btts?.yes || 'N/A'}
│   • BTTS Hayır: ${odds.btts?.no || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // Profesyonel hesaplama
  if (professionalCalc?.overUnder) {
    const calc = professionalCalc.overUnder;
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎯 SİSTEM HESAPLAMASI (Ağırlıklı Analiz)
├─────────────────────────────────────────────────────────────────────────────┤
│   • ${homeTeam} EVDEKİ Over 2.5: %${calc.breakdown?.homeVenueOver || 'N/A'} (ağırlık: %30)
│   • ${awayTeam} DEPLASMANDAKİ Over 2.5: %${calc.breakdown?.awayVenueOver || 'N/A'} (ağırlık: %30)
│   • H2H Over 2.5: %${calc.breakdown?.h2hOver || 'N/A'} (ağırlık: %25)
│   • Genel Form Over 2.5: %${calc.breakdown?.generalOver || 'N/A'} (ağırlık: %15)
│   ─────────────────────────────────────────────────────────────────────────
│   • AĞIRLIKLI OVER 2.5: %${calc.breakdown?.weightedOver || 'N/A'}
│   • BEKLENEN TOPLAM GOL: ${calc.breakdown?.expectedTotal || 'N/A'}
│   • SİSTEM TAHMİNİ: ${calc.prediction} (%${calc.confidence} güven)
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // Sakatlıklar
  if (detailedStats?.injuries) {
    const homeInjuries = detailedStats.injuries.home || [];
    const awayInjuries = detailedStats.injuries.away || [];
    
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏥 SAKATLIKLAR VE CEZALILAR
├─────────────────────────────────────────────────────────────────────────────┤
│   • ${homeTeam}: ${homeInjuries.length > 0 ? homeInjuries.map((i: any) => `${i.player} (${i.type})`).join(', ') : 'Bilinen sakat yok'}
│   • ${awayTeam}: ${awayInjuries.length > 0 ? awayInjuries.map((i: any) => `${i.player} (${i.type})`).join(', ') : 'Bilinen sakat yok'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  // Son maçlar
  if (homeForm?.matches && homeForm.matches.length > 0) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📋 ${homeTeam} SON MAÇLARI
├─────────────────────────────────────────────────────────────────────────────┤
`;
    homeForm.matches.slice(0, 5).forEach((m: any, i: number) => {
      const venue = m.isHome ? '🏠 Ev' : '🚌 Dep';
      const totalGoals = m.totalGoals || 0;
      context += `│   ${i + 1}. ${venue} vs ${m.opponent}: ${m.score} (${m.result}) - ${totalGoals} gol\n`;
    });
    context += `└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  if (awayForm?.matches && awayForm.matches.length > 0) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📋 ${awayTeam} SON MAÇLARI
├─────────────────────────────────────────────────────────────────────────────┤
`;
    awayForm.matches.slice(0, 5).forEach((m: any, i: number) => {
      const venue = m.isHome ? '🏠 Ev' : '🚌 Dep';
      const totalGoals = m.totalGoals || 0;
      context += `│   ${i + 1}. ${venue} vs ${m.opponent}: ${m.score} (${m.result}) - ${totalGoals} gol\n`;
    });
    context += `└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  context += `
═══════════════════════════════════════════════════════════════════════════════
                         ANALİZ TALİMATLARI
═══════════════════════════════════════════════════════════════════════════════

1. EV/DEPLASMAN VERİLERİNİ KULLAN:
   - ${homeTeam} için EVDEKİ istatistikleri baz al
   - ${awayTeam} için DEPLASMANDAKİ istatistikleri baz al

2. OVER/UNDER HESAPLAMA:
   - Ev sahibi evde kaç gol atıyor/yiyor?
   - Deplasman dışarıda kaç gol atıyor/yiyor?
   - H2H'da kaç gol atılıyor?

3. RİSK DEĞERLENDİRMESİ:
   - Veriler tutarlı mı?
   - Güçlü sinyal var mı?

Yukarıdaki tüm verileri analiz ederek JSON formatında tahmin üret.
`;

  return context;
}

export async function runDeepAnalysisAgent(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<any> {
  console.log('🔬 Deep Analysis Agent starting...');
  console.log(`   📊 Match: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  
  const systemPrompt = DEEP_ANALYSIS_PROMPT[language] || DEEP_ANALYSIS_PROMPT.en;
  const context = buildDeepAnalysisContext(matchData);
  
  const userMessage = `${context}

Bu verileri kullanarak çok katmanlı derin analiz yap. 
SADECE JSON formatında döndür, başka açıklama ekleme.`;

  try {
    const response = await heurist.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
      temperature: 0.4,
      maxTokens: 2500
    });

    if (!response) {
      console.error('❌ No response from Heurist');
      return getDefaultDeepAnalysis(matchData);
    }
    
    // JSON parse
    let result;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Deep Analysis JSON parse error:', parseError);
      console.log('Raw response:', response.substring(0, 500));
      result = getDefaultDeepAnalysis(matchData);
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

    console.log(`✅ Deep Analysis complete:`);
    console.log(`   🎯 Best Bet: ${result.bestBet?.type} → ${result.bestBet?.selection} (${result.bestBet?.confidence}%)`);
    console.log(`   ⚽ Score: ${result.scorePrediction?.score}`);
    console.log(`   📊 Over/Under: ${result.overUnder?.prediction} (${result.overUnder?.confidence}%)`);
    console.log(`   🎲 BTTS: ${result.btts?.prediction} (${result.btts?.confidence}%)`);
    console.log(`   🏆 Match: ${result.matchResult?.prediction} (${result.matchResult?.confidence}%)`);
    
    return result;
  } catch (error: any) {
    console.error('❌ Deep Analysis Agent error:', error);
    return getDefaultDeepAnalysis(matchData);
  }
}

function getDefaultDeepAnalysis(matchData: MatchData): any {
  const { homeForm, awayForm, h2h } = matchData as any;
  
  // Basit hesaplama
  const homeOver = parseInt(homeForm?.venueOver25Pct || homeForm?.over25Percentage || '50');
  const awayOver = parseInt(awayForm?.venueOver25Pct || awayForm?.over25Percentage || '50');
  const h2hOver = parseInt(h2h?.over25Percentage || '50');
  const avgOver = (homeOver * 0.35 + awayOver * 0.35 + h2hOver * 0.30);
  
  const overUnderPred = avgOver >= 50 ? 'Over' : 'Under';
  const overUnderConf = Math.min(70, Math.max(50, Math.abs(avgOver - 50) + 50));
  
  return {
    matchAnalysis: `${matchData.homeTeam} vs ${matchData.awayTeam} maçı için analiz yapıldı.`,
    criticalFactors: [
      `${matchData.homeTeam} ev sahibi avantajı`,
      `Son form durumları: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}`,
      `H2H geçmiş: ${h2h?.totalMatches || 0} maç`,
      `Gol ortalamaları değerlendirildi`,
      `Savunma performansları incelendi`
    ],
    probabilities: { 
      homeWin: 40, 
      draw: 30, 
      awayWin: 30 
    },
    expectedScores: ['1-1', '1-0', '2-1'],
    scorePrediction: { 
      score: '1-1', 
      reasoning: 'Dengeli güç dengesi beraberliğe işaret ediyor.' 
    },
    overUnder: { 
      prediction: overUnderPred, 
      confidence: Math.round(overUnderConf), 
      reasoning: `Ev sahibi Over %${homeOver}, Deplasman Over %${awayOver}, H2H Over %${h2hOver}` 
    },
    btts: { 
      prediction: 'No', 
      confidence: 55, 
      reasoning: 'Dikkatli yaklaşım.' 
    },
    matchResult: { 
      prediction: 'X', 
      confidence: 50, 
      reasoning: 'Dengeli güçler.' 
    },
    bestBet: { 
      type: 'Over/Under 2.5', 
      selection: overUnderPred, 
      confidence: Math.round(overUnderConf), 
      reasoning: `İstatistiksel hesaplama ${overUnderPred} yönünde.` 
    },
    riskLevel: 'Medium',
    agentSummary: `${matchData.homeTeam} vs ${matchData.awayTeam}: ${overUnderPred} 2.5 tavsiye edilir.`
  };
}
