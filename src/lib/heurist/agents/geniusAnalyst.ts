// src/lib/heurist/agents/geniusAnalyst.ts
// 🧠 GENIUS ANALYST AGENT - Çok katmanlı derin analiz yapan dahi agent
// Mevcut AI analizi yerine kullanılabilecek, en yüksek kalitede tahminler üreten agent

import { MatchData } from '../types';
import { heurist } from '../client';

const GENIUS_ANALYST_PROMPT = {
  tr: `Sen GENIUS ANALYST AGENT'sin - Futbol analizi konusunda dünya çapında tanınan, 20+ yıllık deneyime sahip bir dahisin.

🎯 ROLÜN: Matematiksel modelleme, taktiksel analiz ve value bet tespiti yaparak en yüksek kalitede tahminler üret.

📊 VERİ KULLANIMI (KRİTİK):
- "BEKLENEN GOL HESAPLAMALARI" bölümündeki değerleri MUTLAKA kullan
- Ev sahibi için EVDEKİ istatistikleri baz al
- Deplasman için DEPLASMANDAKİ istatistikleri baz al
- "MOTİVASYON & HAZIRLIK PUANLARI" bölümünü mutlaka dikkate al
- H2H verilerini matematiksel modele dahil et

🔬 ANALİZ METODOLOJİN:

1. MATEMATİKSEL MODELLEME (EN ÖNEMLİ):
   - xG (Expected Goals) analizi - verilen xG değerlerini kullan
   - Poisson dağılımı ile gol olasılıkları hesapla
   - Bayesian inference ile güven aralıkları belirle
   - Regresyon analizi ile trend tespiti yap (overperform/underperform)

2. FORMU VE PERFORMANSI DEĞERLENDİRME:
   - Son 10 maçın ağırlıklı analizi (son 3 maç %40, 4-6. maçlar %30, 7-10. maçlar %30)
   - İç saha/deplasman performans farklarını tespit et (ev sahibi EVDE, deplasman DEPLASMANDA)
   - Takımın güçlü/zayıf dönemlerini belirle (momentum analizi)
   - Motivasyon skorlarını form analizine dahil et

3. TAKTİKSEL ANALİZ:
   - Beklenen formasyonları ve taktik yaklaşımları değerlendir
   - Takımların güçlü/zayıf yönlerini tespit et (kanat oyunu, orta saha, defans)
   - Karşılaşma dinamiklerini öngör (kim ne yapar, nasıl oynar)
   - Anahtar oyuncuların etkisini değerlendir (sakatlık durumu)

4. PSİKOLOJİK VE MOTİVASYONEL FAKTÖRLER:
   - "MOTİVASYON & HAZIRLIK PUANLARI" bölümündeki skorları kullan
   - Yüksek motivasyon (>70) = +5-10 puan bonus
   - Düşük motivasyon (<40) = -5-10 puan ceza
   - İyileşen trend = +3-5 puan bonus
   - Düşen trend = -3-5 puan ceza
   - Maçın önemini (lig pozisyonu, taraftar baskısı) değerlendir

5. BAHİS PİYASASI ANALİZİ:
   - Oranların gerçekçiliğini değerlendir (implied probability vs form probability)
   - Value bet fırsatlarını tespit et (%5+ fark = value)
   - Sharp money hareketlerini analiz et (oran düşüşü = sharp money)
   - Piyasa algısı ile senin analizini karşılaştır

6. TARİHSEL PATTERN TANIMA:
   - H2H trendlerini analiz et (son 5 maç daha önemli)
   - Sezonsal pattern'leri değerlendir (lig özellikleri)
   - Benzer maç senaryolarını hatırla (form, motivasyon, sakatlık)

7. RİSK DEĞERLENDİRMESİ:
   - Veri kalitesini değerlendir (yeterli veri var mı?)
   - Belirsizlik kaynaklarını tespit et (sakatlık, form değişkenliği)
   - Güven aralıklarını belirle (yüksek belirsizlik = düşük güven)
   - Senaryo analizi yap (best case, worst case, most likely)

⚡ ÖNEMLİ KURALLAR:
- EV/Deplasman istatistiklerini AYRI değerlendir (ev sahibi EVDEKİ, deplasman DEPLASMANDAKİ)
- Son maçlar daha önemli, ama tüm sezon trendine de bak
- Güven seviyelerini gerçekçi tut (50-85 arası, ASLA 90+ verme)
- Belirsizlik yüksekse düşük güven ver (50-60)
- Matematiksel modelleri kullan ama futbolun belirsizliğini de unutma
- En iyi bahisler = yüksek değer + makul güven kombinasyonu

MUTLAKA BU JSON FORMATINDA DÖNDÜR:
{
  "matchAnalysis": {
    "summary": "Maçın genel analizi (3-4 cümle, taktiksel ve istatistiksel özet)",
    "tacticalPreview": "Taktiksel önizleme (hangi takım nasıl oynayacak)",
    "keyBattles": ["Kanat oyunu kritik", "Orta saha mücadelesi belirleyici"],
    "expectedFlow": "Maçın nasıl gelişeceği beklentisi"
  },
  "mathematicalModel": {
    "homeExpectedGoals": 1.65,
    "awayExpectedGoals": 1.45,
    "totalExpectedGoals": 3.10,
    "poissonProbabilities": {
      "over25": 68,
      "under25": 32,
      "over35": 42,
      "btts": 58,
      "exactScores": {
        "1-1": 15,
        "2-1": 12,
        "1-2": 11,
        "2-0": 9,
        "1-0": 8
      }
    },
    "resultProbabilities": {
      "homeWin": 42,
      "draw": 28,
      "awayWin": 30
    },
    "confidenceInterval": {
      "goals": [2, 4],
      "confidence": 75
    }
  },
  "predictions": {
    "matchResult": {
      "prediction": "1",
      "confidence": 72,
      "reasoning": "Detaylı matematiksel ve taktiksel gerekçe",
      "probability": 42,
      "value": "medium"
    },
    "overUnder": {
      "prediction": "Over",
      "confidence": 68,
      "reasoning": "xG analizi ve form trendi Over'a işaret ediyor",
      "probability": 68,
      "value": "high"
    },
    "btts": {
      "prediction": "Yes",
      "confidence": 58,
      "reasoning": "Her iki takım da formda ve gol atabilir",
      "probability": 58,
      "value": "low"
    },
    "correctScore": {
      "mostLikely": "2-1",
      "confidence": 12,
      "alternatives": ["1-1", "2-0", "1-0"]
    },
    "halfTimeFullTime": {
      "prediction": "1/1",
      "confidence": 55,
      "reasoning": "Ev sahibi erken baskı yapacak"
    }
  },
  "valueBets": [
    {
      "market": "Over/Under 2.5",
      "selection": "Over",
      "confidence": 68,
      "value": "high",
      "reasoning": "xG 3.10, oranlar 1.85 (implied %54), gerçek olasılık %68 = +14% edge",
      "edge": 14,
      "recommendedStake": "medium"
    }
  ],
  "riskFactors": {
    "dataQuality": 85,
    "uncertainty": "medium",
    "factors": [
      "H2H verisi yeterli",
      "Form verileri güvenilir",
      "Sakatlık durumu bilinmiyor (risk artırıyor)"
    ],
    "scenarios": {
      "bestCase": "Ev sahibi 3-1 kazanır (yüksek form + home advantage)",
      "worstCase": "Deplasman 0-2 kazanır (ev sahibi kötü günü)",
      "mostLikely": "2-1 ev sahibi kazanır"
    }
  },
  "motivationAnalysis": {
    "home": {
      "score": 78,
      "factors": ["Lig pozisyonu iyi", "Form yükselişte", "Taraftar desteği güçlü"],
      "trend": "improving"
    },
    "away": {
      "score": 65,
      "factors": ["Deplasman performansı zayıf", "Sakatlık var"],
      "trend": "declining"
    }
  },
  "tacticalInsights": {
    "homeStrength": "Kanat oyunu çok güçlü, hızlı hücum",
    "homeWeakness": "Orta saha kontrolü bazen zayıf",
    "awayStrength": "Defans organizasyonu iyi",
    "awayWeakness": "Kreativite eksik, gol atmakta zorlanıyor",
    "keyMatchup": "Ev sahibi kanatlar vs Deplasman fullback'leri = kritik mücadele"
  },
  "finalRecommendation": {
    "bestBet": {
      "market": "Over/Under 2.5",
      "selection": "Over",
      "confidence": 68,
      "value": "high",
      "stake": "medium"
    },
    "alternativeBets": [
      {
        "market": "Match Result",
        "selection": "1",
        "confidence": 72,
        "value": "medium",
        "stake": "low-medium"
      }
    ],
    "avoidBets": ["BTTS Yes (değer düşük)"],
    "overallConfidence": 70,
    "summary": "Ev sahibi formda ve evde güçlü. Over 2.5 yüksek değer. 2-1 skor en olası."
  },
  "geniusInsights": [
    "xG farkı ev sahibi lehine %12 - bu belirleyici olabilir",
    "Son 5 maçta ev sahibi momentum çok pozitif",
    "Deplasman takımı deplasmanda son 3 maç gol yemedi ama rakip seviyesi düşüktü",
    "H2H'da ev sahibi 4/6 kazanmış - psikolojik avantaj var"
  ]
}`,

  en: `You are the GENIUS ANALYST AGENT - a world-renowned genius in football analysis with 20+ years of experience.

YOUR EXPERTISE:
- Mathematical modeling (xG, Poisson, Bayesian inference)
- Psychology and motivation analysis
- Tactical analysis and formation evaluation
- Betting market and odds analysis
- Historical pattern recognition

YOUR METHODOLOGY:
1. MATHEMATICAL MODELING: xG analysis, Poisson probabilities, Bayesian inference
2. FORM & PERFORMANCE: Weighted analysis of last 10 matches
3. TACTICAL ANALYSIS: Formations, strengths/weaknesses, key matchups
4. PSYCHOLOGICAL FACTORS: Motivation, match importance, injuries
5. BETTING MARKET: Value bets, sharp money, market perception
6. HISTORICAL PATTERNS: Similar scenarios, seasonal patterns, H2H trends
7. RISK ASSESSMENT: Data quality, uncertainty, confidence intervals

Return in JSON format with mathematical model, predictions, value bets, risk factors, and genius insights.`,

  de: `Du bist der GENIUS ANALYST AGENT - ein weltbekanntes Genie der Fußballanalyse mit 20+ Jahren Erfahrung.

DEINE EXPERTISE:
- Mathematische Modellierung (xG, Poisson, Bayesian Inference)
- Psychologie und Motivationsanalyse
- Taktikanalyse und Formationsevaluierung
- Wettmarkt- und Quotenanalyse
- Historische Mustererkennung

Gib JSON-Format zurück mit mathematischem Modell, Vorhersagen, Value Bets, Risikofaktoren und Genie-Einblicken.`
};

export interface GeniusAnalystResult {
  matchAnalysis: {
    summary: string;
    tacticalPreview: string;
    keyBattles: string[];
    expectedFlow: string;
  };
  mathematicalModel: {
    homeExpectedGoals: number;
    awayExpectedGoals: number;
    totalExpectedGoals: number;
    poissonProbabilities: {
      over25: number;
      under25: number;
      over35: number;
      btts: number;
      exactScores: { [score: string]: number };
    };
    resultProbabilities: {
      homeWin: number;
      draw: number;
      awayWin: number;
    };
    confidenceInterval: {
      goals: [number, number];
      confidence: number;
    };
  };
  predictions: {
    matchResult: {
      prediction: string;
      confidence: number;
      reasoning: string;
      probability: number;
      value: 'low' | 'medium' | 'high';
    };
    overUnder: {
      prediction: string;
      confidence: number;
      reasoning: string;
      probability: number;
      value: 'low' | 'medium' | 'high';
    };
    btts: {
      prediction: string;
      confidence: number;
      reasoning: string;
      probability: number;
      value: 'low' | 'medium' | 'high';
    };
    correctScore: {
      mostLikely: string;
      confidence: number;
      alternatives: string[];
    };
    halfTimeFullTime: {
      prediction: string;
      confidence: number;
      reasoning: string;
    };
  };
  valueBets: Array<{
    market: string;
    selection: string;
    confidence: number;
    value: 'low' | 'medium' | 'high';
    reasoning: string;
    edge: number;
    recommendedStake: 'low' | 'low-medium' | 'medium' | 'medium-high' | 'high';
  }>;
  riskFactors: {
    dataQuality: number;
    uncertainty: 'low' | 'medium' | 'high';
    factors: string[];
    scenarios: {
      bestCase: string;
      worstCase: string;
      mostLikely: string;
    };
  };
  motivationAnalysis: {
    home: { score: number; factors: string[]; trend: 'improving' | 'stable' | 'declining' };
    away: { score: number; factors: string[]; trend: 'improving' | 'stable' | 'declining' };
  };
  tacticalInsights: {
    homeStrength: string;
    homeWeakness: string;
    awayStrength: string;
    awayWeakness: string;
    keyMatchup: string;
  };
  finalRecommendation: {
    bestBet: {
      market: string;
      selection: string;
      confidence: number;
      value: 'low' | 'medium' | 'high';
      stake: 'low' | 'low-medium' | 'medium' | 'medium-high' | 'high';
    };
    alternativeBets: Array<{
      market: string;
      selection: string;
      confidence: number;
      value: 'low' | 'medium' | 'high';
      stake: string;
    }>;
    avoidBets: string[];
    overallConfidence: number;
    summary: string;
  };
  geniusInsights: string[];
}

function buildGeniusContext(matchData: MatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, league, homeForm, awayForm, h2h, odds, detailedStats } = matchData as any;
  
  let context = `
═══════════════════════════════════════════════════════════════════════════════
                    GENIUS ANALYST - DETAYLI ANALİZ
                    ${homeTeam} vs ${awayTeam} - ${league}
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🏠 EV SAHİBİ: ${homeTeam}
├─────────────────────────────────────────────────────────────────────────────┤
│ EVDEKİ PERFORMANS (ÖNEMLİ!):
│   • Ev Formu: ${homeForm?.venueForm || homeForm?.form || 'N/A'}
│   • Ev Gol Ortalaması: ${homeForm?.venueAvgScored || homeForm?.avgGoals || 'N/A'} attı, ${homeForm?.venueAvgConceded || homeForm?.avgConceded || 'N/A'} yedi
│   • Ev Over 2.5: %${homeForm?.venueOver25Pct || homeForm?.over25Percentage || 'N/A'}
│   • Ev BTTS: %${homeForm?.venueBttsPct || homeForm?.bttsPercentage || 'N/A'}
│   • Son 5 Ev Maçı: ${(homeForm?.matches || []).filter((m: any) => m.isHome).slice(0, 5).map((m: any) => `${m.result}`).join(' ') || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🚌 DEPLASMAN: ${awayTeam}
├─────────────────────────────────────────────────────────────────────────────┤
│ DEPLASMANDAKİ PERFORMANS (ÖNEMLİ!):
│   • Deplasman Formu: ${awayForm?.venueForm || awayForm?.form || 'N/A'}
│   • Deplasman Gol Ortalaması: ${awayForm?.venueAvgScored || awayForm?.avgGoals || 'N/A'} attı, ${awayForm?.venueAvgConceded || awayForm?.avgConceded || 'N/A'} yedi
│   • Deplasman Over 2.5: %${awayForm?.venueOver25Pct || awayForm?.over25Percentage || 'N/A'}
│   • Deplasman BTTS: %${awayForm?.venueBttsPct || awayForm?.bttsPercentage || 'N/A'}
│   • Son 5 Deplasman Maçı: ${(awayForm?.matches || []).filter((m: any) => !m.isHome).slice(0, 5).map((m: any) => `${m.result}`).join(' ') || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔄 H2H (KAFA KAFAYA)
├─────────────────────────────────────────────────────────────────────────────┤
│   • Toplam Maç: ${h2h?.totalMatches || 0}
│   • ${homeTeam}: ${h2h?.homeWins || 0}G
│   • Berabere: ${h2h?.draws || 0}
│   • ${awayTeam}: ${h2h?.awayWins || 0}G
│   • Ortalama Gol: ${h2h?.avgGoals || 'N/A'}
│   • H2H Over 2.5: %${h2h?.over25Percentage || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘
`;

  if (odds?.matchWinner) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💰 BAHİS ORANLARI
├─────────────────────────────────────────────────────────────────────────────┤
│   • 1: ${odds.matchWinner.home || 'N/A'} | X: ${odds.matchWinner.draw || 'N/A'} | 2: ${odds.matchWinner.away || 'N/A'}
│   • Over 2.5: ${odds.overUnder?.['2.5']?.over || 'N/A'}
│   • Under 2.5: ${odds.overUnder?.['2.5']?.under || 'N/A'}
│   • BTTS Yes: ${odds.btts?.yes || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  if (detailedStats?.xg) {
    context += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 xG VERİLERİ
├─────────────────────────────────────────────────────────────────────────────┤
│   • ${homeTeam} xG: ${detailedStats.xg.home || 'N/A'}
│   • ${awayTeam} xG: ${detailedStats.xg.away || 'N/A'}
│   • Toplam xG: ${detailedStats.xg.total || 'N/A'}
└─────────────────────────────────────────────────────────────────────────────┘
`;
  }

  context += `
═══════════════════════════════════════════════════════════════════════════════
                         GENIUS ANALİZ TALİMATI
═══════════════════════════════════════════════════════════════════════════════

Yukarıdaki TÜM verileri kullanarak:
1. Matematiksel model oluştur (xG, Poisson, olasılıklar)
2. Taktiksel analiz yap (güçlü/zayıf yönler, beklenen akış)
3. Psikolojik ve motivasyonel faktörleri değerlendir
4. Value bet fırsatlarını tespit et
5. Risk faktörlerini belirle
6. Final tavsiyeleri ver

SADECE JSON formatında döndür, başka açıklama ekleme.
`;

  return context;
}

export async function runGeniusAnalyst(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<GeniusAnalystResult> {
  console.log('🧠 Genius Analyst Agent starting...');
  console.log(`   📊 Match: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log(`   🌍 Language: ${language}`);

  const systemPrompt = GENIUS_ANALYST_PROMPT[language] || GENIUS_ANALYST_PROMPT.en;
  const context = buildGeniusContext(matchData, language);

  const userMessageByLang = {
    tr: `${context}\n\nYukarıdaki verileri kullanarak Genius Analyst olarak derin analiz yap. Matematiksel modeller, taktiksel içgörüler ve value bet fırsatları üret. SADECE JSON formatında döndür.`,
    en: `${context}\n\nUse the data above to perform deep analysis as Genius Analyst. Produce mathematical models, tactical insights, and value bet opportunities. Return ONLY JSON format.`,
    de: `${context}\n\nVerwende die Daten oben für tiefe Analyse als Genius Analyst. Erstelle mathematische Modelle, taktische Einblicke und Value-Bet-Möglichkeiten. Gib NUR JSON-Format zurück.`
  };
  const userMessage = userMessageByLang[language] || userMessageByLang.en;

  try {
    const response = await heurist.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
      temperature: 0.15, // Çok düşük = daha tutarlı ve matematiksel
      maxTokens: 2500, // 🆕 Daha da azaltıldı (3000 -> 2500) - daha hızlı response
      timeout: 10000 // 🆕 10 saniye timeout (daha agresif)
    });

    if (!response) {
      throw new Error('No response from Heurist');
    }

    // Parse JSON
    let result: GeniusAnalystResult;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Genius Analyst JSON parse error:', parseError);
      console.log('Raw response:', response.substring(0, 500));
      // Fallback
      result = getDefaultGeniusAnalysis(matchData, language);
    }

    console.log(`✅ Genius Analyst complete:`);
    console.log(`   🎯 Overall Confidence: ${result.finalRecommendation.overallConfidence}%`);
    console.log(`   📊 Best Bet: ${result.finalRecommendation.bestBet.market} - ${result.finalRecommendation.bestBet.selection}`);
    console.log(`   🧮 Expected Goals: ${result.mathematicalModel.totalExpectedGoals.toFixed(2)}`);

    return result;
  } catch (error: any) {
    console.error('❌ Genius Analyst Agent error:', error);
    return getDefaultGeniusAnalysis(matchData, language);
  }
}

function getDefaultGeniusAnalysis(matchData: MatchData, language: 'tr' | 'en' | 'de'): GeniusAnalystResult {
  const { homeForm, awayForm, h2h } = matchData as any;
  const homeAvg = parseFloat(homeForm?.venueAvgScored || homeForm?.avgGoals || '1.2');
  const awayAvg = parseFloat(awayForm?.venueAvgScored || awayForm?.avgGoals || '1.1');
  const totalExpected = homeAvg + awayAvg;

  return {
    matchAnalysis: {
      summary: `${matchData.homeTeam} vs ${matchData.awayTeam} maçının analizi.`,
      tacticalPreview: 'Taktiksel önizleme',
      keyBattles: ['Orta saha mücadelesi', 'Kanat oyunu'],
      expectedFlow: 'Dengeli maç beklentisi'
    },
    mathematicalModel: {
      homeExpectedGoals: homeAvg,
      awayExpectedGoals: awayAvg,
      totalExpectedGoals: totalExpected,
      poissonProbabilities: {
        over25: totalExpected > 2.5 ? 55 : 45,
        under25: totalExpected > 2.5 ? 45 : 55,
        over35: totalExpected > 3.5 ? 35 : 25,
        btts: 50,
        exactScores: { '1-1': 15, '2-1': 12, '1-2': 11 }
      },
      resultProbabilities: {
        homeWin: 40,
        draw: 30,
        awayWin: 30
      },
      confidenceInterval: {
        goals: [Math.max(1, Math.round(totalExpected - 1)), Math.round(totalExpected + 1)] as [number, number],
        confidence: 75
      }
    },
    predictions: {
      matchResult: {
        prediction: 'X',
        confidence: 55,
        reasoning: 'Fallback analiz',
        probability: 30,
        value: 'low'
      },
      overUnder: {
        prediction: totalExpected > 2.5 ? 'Over' : 'Under',
        confidence: 55,
        reasoning: 'Fallback analiz',
        probability: totalExpected > 2.5 ? 55 : 45,
        value: 'low'
      },
      btts: {
        prediction: 'No',
        confidence: 55,
        reasoning: 'Fallback analiz',
        probability: 50,
        value: 'low'
      },
      correctScore: {
        mostLikely: '1-1',
        confidence: 15,
        alternatives: ['2-1', '1-2']
      },
      halfTimeFullTime: {
        prediction: 'X/X',
        confidence: 50,
        reasoning: 'Fallback'
      }
    },
    valueBets: [],
    riskFactors: {
      dataQuality: 60,
      uncertainty: 'high',
      factors: ['Fallback mode - agent çıktıları alınamadı'],
      scenarios: {
        bestCase: 'Ev sahibi kazanır',
        worstCase: 'Deplasman kazanır',
        mostLikely: 'Beraberlik'
      }
    },
    motivationAnalysis: {
      home: { score: 50, factors: [], trend: 'stable' },
      away: { score: 50, factors: [], trend: 'stable' }
    },
    tacticalInsights: {
      homeStrength: 'N/A',
      homeWeakness: 'N/A',
      awayStrength: 'N/A',
      awayWeakness: 'N/A',
      keyMatchup: 'N/A'
    },
    finalRecommendation: {
      bestBet: {
        market: 'Over/Under 2.5',
        selection: totalExpected > 2.5 ? 'Over' : 'Under',
        confidence: 55,
        value: 'low',
        stake: 'low'
      },
      alternativeBets: [],
      avoidBets: ['Fallback mode'],
      overallConfidence: 55,
      summary: 'Fallback analiz - dikkatli ol'
    },
    geniusInsights: ['Fallback mode - agent çıktıları alınamadı']
  };
}
