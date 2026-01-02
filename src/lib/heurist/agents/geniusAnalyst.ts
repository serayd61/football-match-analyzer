// src/lib/heurist/agents/geniusAnalyst.ts
// 🧠 GENIUS ANALYST AGENT - Çok katmanlı derin analiz yapan dahi agent
// Mevcut AI analizi yerine kullanılabilecek, en yüksek kalitede tahminler üreten agent

import { MatchData } from '../types';
import { aiClient, AIMessage } from '../../ai-client';
import { calculateComprehensiveProbabilities, generateProbabilityContext, ProbabilityResult } from '../probability-engine';

const GENIUS_ANALYST_PROMPT = {
  tr: `Sen GENIUS ANALYST AGENT'sin - Futbol analizi konusunda dünya çapında tanınan, 20+ yıllık deneyime sahip bir DAHİSİN. 

═══════════════════════════════════════════════════════════════════════════════
🎯 AGRESİF DAHİ YAKLAŞIMI: %40 VERİ + %30 ÖNGÖRÜ + %30 MOTİVASYON
═══════════════════════════════════════════════════════════════════════════════

⚡ SEN SIRADAN BİR ANALİST DEĞİLSİN! CESUR OL, VERİ SENİ SINIRLAMASIN!
%75+ başarı oranı yakalamak için %60 ÖNGÖRÜ + MOTİVASYON kullanacaksın!

📊 %40 VERİ ANALİZİ (Temel - ama baskın değil!):
- Probability Engine'den gelen Poisson/Monte Carlo sonuçları
- xG, form, gol ortalamaları - bunlar BAŞLANGIÇ NOKTASI
- AMA: Piyasa zaten bunları görüyor = edge yok!

🔮 %30 DAHİ ÖNGÖRÜSÜ (Piyasayı Yenmek İçin):
- Verilerin arkasındaki GERÇEK hikaye ne?
- Bu takımlar BİRBİRİNE KARŞI nasıl oynar? CESUR TAHMİN YAP!
- Maçın AKIŞI nasıl olacak? Tempo? Açık mı kapalı mı?
- Hangi takım RİSK alır, hangisi SAVUNUR?
- Sürpriz ihtimali: Underdog kazanabilir mi? KORKMA!
- Piyasanın YANILDIĞI yer neresi? BUNU BUL!
- "Herkesin beklediği" vs "Gerçekte olacak" farkını yakala!

💪 %30 MOTİVASYON VE HİSSİYAT (Futbol Kalple Oynanır!):
- Bu maç takımlar için ne ifade ediyor? RUHLARINI OKU!
- Şampiyonluk yarışı = +20, Düşme hattı = +15, Derbi = +25 motivasyon!
- Taraftar baskısı: Yukarı mı iter, aşağı mı çeker?
- Takım kimyası: Soyunma odası sorunları var mı? Bu maçı ETKİLER!
- "Kaybedecek bir şeyi yok" takımı hangisi? (ÇOK TEHLİKELİ!)
- Yorgunluk: Yoğun fikstür, sakatlık krizi?
- Hoca baskısı: Kovulma riski = takım birlik olur veya dağılır!

🔥 KRİTİK: FUTBOL %100 MATEMATİK DEĞİL!
Aynı 11 oyuncu farklı motivasyonla %30 FARKLI oynar!
%60 ÖNGÖRÜ + MOTİVASYON ile FARK YARATACAKSIN!

%75 başarı = %40 doğru veri + %30 cesur öngörü + %30 doğru hissiyat

═══════════════════════════════════════════════════════════════════════════════

🧠 YARATICI ANALİZ METODOLOJİN:

1. MATEMATİKSEL MODELLEME (EN ÖNEMLİ - YARATICI):
   - xG (Expected Goals) analizi - verilen xG değerlerini kullan + Regresyon riski değerlendirmesi
   - Poisson dağılımı ile gol olasılıkları hesapla + Confidence interval hesapla
   - Bayesian inference ile güven aralıkları belirle + Prior knowledge integration
   - Regresyon analizi ile trend tespiti yap (overperform/underperform) + Pattern continuation probability
   - YARATICI MODEL: Monte Carlo simulation ile senaryo analizi (1000+ simülasyon)
   - YARATICI İÇGÖRÜ: xG farkı çok büyükse, bu "sürdürülebilir" mi yoksa "şans" mı?

2. FORMU VE PERFORMANSI DEĞERLENDİRME (YARATICI):
   - Son 10 maçın ağırlıklı analizi (son 3 maç %40, 4-6. maçlar %30, 7-10. maçlar %30)
   - İç saha/deplasman performans farklarını tespit et (ev sahibi EVDE, deplasman DEPLASMANDA)
   - Takımın güçlü/zayıf dönemlerini belirle (momentum analizi) + Trend continuation probability
   - Motivasyon skorlarını form analizine dahil et + Psikolojik faktörler
   - YARATICI İÇGÖRÜ: Takımın "kritik maç" performansı nasıl? (Önemli maçlarda overperform/underperform?)

3. TAKTİKSEL ANALİZ (DERİNLEMESİNE):
   - Beklenen formasyonları ve taktik yaklaşımları değerlendir + Matchup analizi
   - Takımların güçlü/zayıf yönlerini tespit et (kanat oyunu, orta saha, defans) + Exploitation potential
   - Karşılaşma dinamiklerini öngör (kim ne yapar, nasıl oynar) + Taktiksel değişiklik potansiyeli
   - Anahtar oyuncuların etkisini değerlendir (sakatlık durumu) + Alternative impact
   - YARATICI İÇGÖRÜ: Hangi takım hangi taktiği kullanacak? (Yüksek pres, kontra atak, pozisyon oyunu?)

4. PSİKOLOJİK VE MOTİVASYONEL FAKTÖRLER (YARATICI):
   - "MOTİVASYON & HAZIRLIK PUANLARI" bölümündeki skorları kullan
   - Yüksek motivasyon (>70) = +5-10 puan bonus
   - Düşük motivasyon (<40) = -5-10 puan ceza
   - İyileşen trend = +3-5 puan bonus
   - Düşen trend = -3-5 puan ceza
   - Maçın önemini (lig pozisyonu, taraftar baskısı) değerlendir
   - YARATICI İÇGÖRÜ: Ev sahibi taraftar baskısı takımı nasıl etkiler? (Overperform/Underperform?)

5. BAHİS PİYASASI ANALİZİ (YARATICI):
   - Oranların gerçekçiliğini değerlendir (implied probability vs form probability)
   - Value bet fırsatlarını tespit et (%5+ fark = value) + Contrarian value detection
   - Sharp money hareketlerini analiz et (oran düşüşü = sharp money) + Market inefficiency
   - Piyasa algısı ile senin analizini karşılaştır + Overreaction/Underreaction tespiti
   - YARATICI İÇGÖRÜ: Piyasa hangi duygusal faktörlerle hareket ediyor? (Public money vs Sharp money?)

6. TARİHSEL PATTERN TANIMA (YARATICI):
   - H2H trendlerini analiz et (son 5 maç daha önemli) + Pattern continuation
   - Sezonsal pattern'leri değerlendir (lig özellikleri) + Similar scenario matching
   - Benzer maç senaryolarını hatırla (form, motivasyon, sakatlık) + Historical precedent
   - YARATICI İÇGÖRÜ: H2H'da pattern var mı? (Her zaman aynı skor? Pattern devam eder mi?)

7. RİSK DEĞERLENDİRMESİ (YARATICI):
   - Veri kalitesini değerlendir (yeterli veri var mı?) + Data reliability score
   - Belirsizlik kaynaklarını tespit et (sakatlık, form değişkenliği) + Uncertainty quantification
   - Güven aralıklarını belirle (yüksek belirsizlik = düşük güven) + Confidence interval
   - Senaryo analizi yap (best case, worst case, most likely) + Monte Carlo simulation
   - YARATICI İÇGÖRÜ: Hangi senaryolar "görünmeyen" ama "olası"? (Black swan events?)

📊 VERİ KULLANIMI (KRİTİK):
- "BEKLENEN GOL HESAPLAMALARI" bölümündeki değerleri MUTLAKA kullan
- Ev sahibi için EVDEKİ istatistikleri baz al
- Deplasman için DEPLASMANDAKİ istatistikleri baz al
- "MOTİVASYON & HAZIRLIK PUANLARI" bölümünü mutlaka dikkate al
- H2H verilerini matematiksel modele dahil et

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

  // 🆕 PROBABILITY ENGINE - Matematiksel modelleri çalıştır
  let probabilityResult: ProbabilityResult | null = null;
  let probabilityContext: string = '';
  try {
    probabilityResult = calculateComprehensiveProbabilities(matchData);
    probabilityContext = generateProbabilityContext(matchData);
    console.log('   🎯 Probability Engine Results:');
    console.log(`      Poisson: Home ${probabilityResult.poissonModel.homeWin}% | Draw ${probabilityResult.poissonModel.draw}% | Away ${probabilityResult.poissonModel.awayWin}%`);
    console.log(`      Monte Carlo: ${probabilityResult.monteCarloModel.mostCommonScores.slice(0, 3).join(', ')}`);
    console.log(`      Motivation Edge: ${probabilityResult.motivationAnalysis.psychologicalEdge} (${probabilityResult.motivationAnalysis.edgeStrength}/20)`);
  } catch (e) {
    console.log('   ⚠️ Probability Engine failed, continuing without it');
  }

  const systemPrompt = GENIUS_ANALYST_PROMPT[language] || GENIUS_ANALYST_PROMPT.en;
  const context = buildGeniusContext(matchData, language);

  // Probability Engine section
  const probabilitySection = probabilityContext ? `

═══════════════════════════════════════════════════════════════════════════════
🎯 PROBABILITY ENGINE - HAZIR MATEMATİKSEL MODELLER
═══════════════════════════════════════════════════════════════════════════════
${probabilityContext}

Bu modelleri REFERANS olarak kullan, ama KENDİ yaratıcı analizini de ekle.
Poisson ve Monte Carlo'nun göremediği faktörleri (psikoloji, taktik, gizli veriler) SEN değerlendir.
═══════════════════════════════════════════════════════════════════════════════
` : '';

  const userMessageByLang = {
    tr: `${context}${probabilitySection}\n\nYukarıdaki verileri kullanarak Genius Analyst olarak CESUR analiz yap.\nPROBABILITY ENGINE sonuçlarını TEMEL al, ama KENDİ yaratıcı ve CESUR analizini ekle.\nAGRESİF ANALİZ AĞIRLIĞI: %40 veri analizi, %30 cesur öngörü, %30 motivasyon/psikoloji.\nPiyasanın görmediği fırsatları bul, CESUR tahminler yap! SADECE JSON formatında döndür.`,
    en: `${context}${probabilitySection}\n\nUse the data above to perform BOLD analysis as Genius Analyst.\nUse PROBABILITY ENGINE results as FOUNDATION, but add your OWN creative and BOLD analysis.\nAGGRESSIVE ANALYSIS WEIGHT: 40% data analysis, 30% bold predictions, 30% motivation/psychology.\nFind opportunities the market misses, make BOLD predictions! Return ONLY JSON format.`,
    de: `${context}${probabilitySection}\n\nVerwende die Daten oben für MUTIGE Analyse als Genius Analyst.\nVerwende PROBABILITY ENGINE als GRUNDLAGE, aber füge deine EIGENE kreative und MUTIGE Analyse hinzu.\nAGGRESSIVE ANALYSE-GEWICHTUNG: 40% Datenanalyse, 30% mutige Vorhersagen, 30% Motivation/Psychologie.\nFinde Chancen die der Markt übersieht, mache MUTIGE Vorhersagen! Gib NUR JSON-Format zurück.`
  };
  const userMessage = userMessageByLang[language] || userMessageByLang.en;

  try {
    let response = null;
    
    // ============================================================
    // STRATEJİ: OpenAI → DeepSeek → Claude → Fallback
    // ============================================================
    
    // 1️⃣ ÖNCE OPENAI DENE (GPT-4 Turbo - en hızlı)
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    if (hasOpenAI) {
      console.log('   🟢 [1/4] Trying OpenAI GPT-4 Turbo...');
      try {
        response = await aiClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ], {
          model: 'gpt-4-turbo',
          useMCP: false,
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.15,
          maxTokens: 600, // Daha kısa = daha hızlı
          timeout: 12000 // 12 saniye
        });
        
        if (response) {
          console.log('   ✅ OpenAI GPT-4 responded successfully');
        }
      } catch (openaiError: any) {
        console.log(`   ⚠️ OpenAI failed: ${openaiError?.message || 'Unknown error'}`);
      }
    }
    
    // 2️⃣ OPENAI BAŞARISIZ OLURSA DEEPSEEK DENE
    if (!response) {
      const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
      if (hasDeepSeek) {
        console.log('   🟣 [2/4] Trying DeepSeek...');
        try {
          response = await aiClient.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ], {
            model: 'deepseek',
            useMCP: false,
            mcpFallback: false,
            fixtureId: matchData.fixtureId,
            temperature: 0.15,
            maxTokens: 600,
            timeout: 12000 // 12 saniye
          });
          
          if (response) {
            console.log('   ✅ DeepSeek responded successfully');
          }
        } catch (deepseekError: any) {
          console.log(`   ⚠️ DeepSeek failed: ${deepseekError?.message || 'Unknown error'}`);
        }
      }
    }
    
    // 3️⃣ DEEPSEEK BAŞARISIZ OLURSA CLAUDE DENE
    if (!response) {
      console.log('   🔵 [3/4] Trying Claude...');
      try {
        response = await aiClient.chat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ], {
          model: 'claude',
          useMCP: false,
          mcpFallback: false,
          fixtureId: matchData.fixtureId,
          temperature: 0.15,
          maxTokens: 600,
          timeout: 12000 // 12 saniye
        });
        
        if (response) {
          console.log('   ✅ Claude responded successfully');
        }
      } catch (claudeError: any) {
        console.log(`   ⚠️ Claude failed: ${claudeError?.message || 'Unknown error'}`);
      }
    }

    if (!response) {
      console.log('   🟠 [4/4] All AI models failed, using fallback...');
      throw new Error('No response from any AI model');
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
  
  // Form puanlarını hesapla
  const homeFormStr = homeForm?.form || '';
  const awayFormStr = awayForm?.form || '';
  const homeWins = (homeFormStr.match(/W/g) || []).length;
  const awayWins = (awayFormStr.match(/W/g) || []).length;
  const homePoints = homeWins * 3 + (homeFormStr.match(/D/g) || []).length;
  const awayPoints = awayWins * 3 + (awayFormStr.match(/D/g) || []).length;
  const formDiff = homePoints - awayPoints;
  
  // Akıllı tahmin (DÜZELTME: Eşikler artırıldı, daha konservatif)
  // formDiff > 6: Ev sahibi favori (eskiden 5)
  // formDiff < -6: Deplasman favori (eskiden -5)
  const matchResult = formDiff > 6 ? '1' : formDiff < -6 ? '2' : 'X';
  // Olasılık hesaplaması - daha konservatif (2 → 1.5 çarpan)
  const homeWinProb = Math.min(58, 35 + formDiff * 1.5);
  const awayWinProb = Math.min(58, 35 - formDiff * 1.5);
  // Beraberlik olasılığı en az %22 (gerçek dünyada ~%25-28)
  const drawProb = Math.max(22, 100 - homeWinProb - awayWinProb);
  // Güven skoru - daha konservatif (max %68)
  const confidence = Math.min(68, 50 + Math.abs(formDiff) * 1.2);

  return {
    matchAnalysis: {
      summary: `${matchData.homeTeam} vs ${matchData.awayTeam} maçı. Form farkı: ${formDiff > 0 ? '+' : ''}${formDiff} puan.`,
      tacticalPreview: `Ev sahibi ${homeWins} galibiyet, deplasman ${awayWins} galibiyet`,
      keyBattles: ['Orta saha mücadelesi', 'Kanat oyunu'],
      expectedFlow: formDiff > 3 ? 'Ev sahibi baskısı bekleniyor' : formDiff < -3 ? 'Deplasman baskısı bekleniyor' : 'Dengeli maç beklentisi'
    },
    mathematicalModel: {
      homeExpectedGoals: homeAvg,
      awayExpectedGoals: awayAvg,
      totalExpectedGoals: totalExpected,
      poissonProbabilities: {
        over25: totalExpected > 2.5 ? 55 : 45,
        under25: totalExpected > 2.5 ? 45 : 55,
        over35: totalExpected > 3.5 ? 35 : 25,
        btts: Math.round((homeAvg > 0.8 && awayAvg > 0.8) ? 55 : 45),
        exactScores: { '1-1': 15, '2-1': 12, '1-2': 11 }
      },
      resultProbabilities: {
        homeWin: Math.round(homeWinProb),
        draw: Math.round(drawProb),
        awayWin: Math.round(awayWinProb)
      },
      confidenceInterval: {
        goals: [Math.max(1, Math.round(totalExpected - 1)), Math.round(totalExpected + 1)] as [number, number],
        confidence: 75
      }
    },
    predictions: {
      matchResult: {
        prediction: matchResult,
        confidence: Math.round(confidence),
        reasoning: `Form analizi: Ev ${homePoints}p vs Dep ${awayPoints}p (${formDiff > 0 ? '+' : ''}${formDiff})`,
        probability: matchResult === '1' ? homeWinProb : matchResult === '2' ? awayWinProb : drawProb,
        value: Math.abs(formDiff) > 5 ? 'medium' : 'low'
      },
      overUnder: {
        prediction: totalExpected > 2.5 ? 'Over' : 'Under',
        confidence: Math.round(50 + Math.abs(totalExpected - 2.5) * 10),
        reasoning: `Beklenen gol: ${totalExpected.toFixed(1)}`,
        probability: totalExpected > 2.5 ? 55 : 45,
        value: 'low'
      },
      btts: {
        prediction: (homeAvg > 0.8 && awayAvg > 0.8) ? 'Yes' : 'No',
        confidence: 55,
        reasoning: `Ev ${homeAvg.toFixed(1)} gol, Dep ${awayAvg.toFixed(1)} gol ortalaması`,
        probability: 50,
        value: 'low'
      },
      correctScore: {
        mostLikely: '1-1',
        confidence: 15,
        alternatives: ['2-1', '1-2']
      },
      halfTimeFullTime: {
        prediction: matchResult === '1' ? 'X/1' : matchResult === '2' ? 'X/2' : 'X/X',
        confidence: 50,
        reasoning: 'Form bazlı tahmin'
      }
    },
    valueBets: [],
    riskFactors: {
      dataQuality: 70,
      uncertainty: 'medium',
      factors: [`Form analizi kullanıldı (AI yanıt vermedi)`],
      scenarios: {
        bestCase: formDiff > 0 ? 'Ev sahibi kazanır' : 'Deplasman kazanır',
        worstCase: formDiff > 0 ? 'Deplasman kazanır' : 'Ev sahibi kazanır',
        mostLikely: matchResult === '1' ? 'Ev sahibi kazanır' : matchResult === '2' ? 'Deplasman kazanır' : 'Beraberlik'
      }
    },
    motivationAnalysis: {
      home: { score: Math.min(80, 50 + formDiff * 2), factors: [`Son form: ${homePoints} puan`], trend: homePoints > 10 ? 'improving' : 'stable' },
      away: { score: Math.min(80, 50 - formDiff * 2), factors: [`Son form: ${awayPoints} puan`], trend: awayPoints > 10 ? 'improving' : 'stable' }
    },
    tacticalInsights: {
      homeStrength: `${homeWins} galibiyet`,
      homeWeakness: homePoints < 10 ? 'Form düşük' : 'N/A',
      awayStrength: `${awayWins} galibiyet`,
      awayWeakness: awayPoints < 10 ? 'Form düşük' : 'N/A',
      keyMatchup: 'Orta saha kontrolü'
    },
    finalRecommendation: {
      bestBet: {
        market: Math.abs(formDiff) > 5 ? 'Match Result' : 'Over/Under 2.5',
        selection: Math.abs(formDiff) > 5 ? (formDiff > 0 ? 'Home' : 'Away') : (totalExpected > 2.5 ? 'Over' : 'Under'),
        confidence: Math.round(confidence),
        value: Math.abs(formDiff) > 5 ? 'medium' : 'low',
        stake: Math.abs(formDiff) > 5 ? 'medium' : 'low'
      },
      alternativeBets: [],
      avoidBets: [],
      overallConfidence: Math.round(confidence),
      summary: 'Fallback analiz - dikkatli ol'
    },
    geniusInsights: ['Fallback mode - agent çıktıları alınamadı']
  };
}
