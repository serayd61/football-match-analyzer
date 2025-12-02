// src/app/api/analyze/route.ts
// ODDS ENTEGRASYONlu VERSİYON - Value Betting Analizi ile AI Güçlendirme

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE = 'https://api.sportmonks.com/v3/football';

// ============================================
// ODDS TİPLERİ VE MARKET ID'LERİ
// ============================================
interface OddsData {
  matchWinner: {
    home: number;
    draw: number;
    away: number;
    homeProb: number;
    drawProb: number;
    awayProb: number;
  } | null;
  overUnder: {
    over25: number;
    under25: number;
    overProb: number;
    underProb: number;
  } | null;
  btts: {
    yes: number;
    no: number;
    yesProb: number;
    noProb: number;
  } | null;
  asianHandicap: {
    line: string;
    home: number;
    away: number;
  } | null;
  doubleChance: {
    homeOrDraw: number;
    awayOrDraw: number;
    homeOrAway: number;
  } | null;
  correctScore: {
    [key: string]: number;
  };
  bookmakerConsensus: string;
  valueOpportunities: ValueOpportunity[];
}

interface ValueOpportunity {
  market: string;
  selection: string;
  odds: number;
  impliedProb: number;
  estimatedTrueProb: number;
  valuePercent: number;
  recommendation: string;
}

// Market ID'leri (Sportmonks)
const MARKET_IDS = {
  MATCH_WINNER: 1,        // 1X2
  OVER_UNDER: 18,         // Over/Under
  BTTS: 28,               // Both Teams to Score
  ASIAN_HANDICAP: 12,     // Asian Handicap
  DOUBLE_CHANCE: 17,      // Double Chance
  CORRECT_SCORE: 57,      // Correct Score
  HT_RESULT: 45,          // Half Time Result
  HT_FT: 59,              // Half Time / Full Time
};

// Bookmaker öncelik sırası (güvenilirlik)
const BOOKMAKER_PRIORITY = [2, 1, 5, 6, 9, 15, 23, 29, 35]; // 2=Bet365 genelde

// ============================================
// ODDS ÇEKME FONKSİYONU
// ============================================
async function fetchFixtureOdds(fixtureId: number): Promise<OddsData | null> {
  try {
    const url = `${SPORTMONKS_BASE}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds`;
    console.log(`📊 Fetching odds for fixture ${fixtureId}...`);
    
    const response = await fetch(url, { 
      next: { revalidate: 300 }, // 5 dk cache
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`Odds fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const odds = data.data?.odds || [];
    
    if (odds.length === 0) {
      console.log('No odds available for this fixture');
      return null;
    }
    
    console.log(`✅ Found ${odds.length} odds entries`);
    return parseOdds(odds);
    
  } catch (error) {
    console.error('Error fetching odds:', error);
    return null;
  }
}

// ============================================
// ODDS PARSE FONKSİYONU
// ============================================
function parseOdds(oddsArray: any[]): OddsData {
  const result: OddsData = {
    matchWinner: null,
    overUnder: null,
    btts: null,
    asianHandicap: null,
    doubleChance: null,
    correctScore: {},
    bookmakerConsensus: '',
    valueOpportunities: []
  };
  
  // Bookmaker'a göre grupla ve en güvenilir olanı seç
  const groupedByMarket: { [key: number]: any[] } = {};
  
  for (const odd of oddsArray) {
    const marketId = odd.market_id;
    if (!groupedByMarket[marketId]) {
      groupedByMarket[marketId] = [];
    }
    groupedByMarket[marketId].push(odd);
  }
  
  // 1X2 Match Winner
  const matchWinnerOdds = groupedByMarket[MARKET_IDS.MATCH_WINNER] || [];
  if (matchWinnerOdds.length > 0) {
    const bestOdds = selectBestBookmaker(matchWinnerOdds);
    const home = bestOdds.find((o: any) => o.label === '1' || o.label === 'Home');
    const draw = bestOdds.find((o: any) => o.label === 'X' || o.label === 'Draw');
    const away = bestOdds.find((o: any) => o.label === '2' || o.label === 'Away');
    
    if (home && draw && away) {
      result.matchWinner = {
        home: parseFloat(home.value),
        draw: parseFloat(draw.value),
        away: parseFloat(away.value),
        homeProb: (1 / parseFloat(home.value)) * 100,
        drawProb: (1 / parseFloat(draw.value)) * 100,
        awayProb: (1 / parseFloat(away.value)) * 100
      };
    }
  }
  
  // Over/Under 2.5
  const ouOdds = groupedByMarket[MARKET_IDS.OVER_UNDER] || [];
  const ou25 = ouOdds.filter((o: any) => o.total === '2.5' || o.name?.includes('2.5'));
  if (ou25.length > 0) {
    const bestOU = selectBestBookmaker(ou25);
    const over = bestOU.find((o: any) => o.label === 'Over' || o.label === 'Üst');
    const under = bestOU.find((o: any) => o.label === 'Under' || o.label === 'Alt');
    
    if (over && under) {
      result.overUnder = {
        over25: parseFloat(over.value),
        under25: parseFloat(under.value),
        overProb: (1 / parseFloat(over.value)) * 100,
        underProb: (1 / parseFloat(under.value)) * 100
      };
    }
  }
  
  // Both Teams to Score
  const bttsOdds = groupedByMarket[MARKET_IDS.BTTS] || [];
  if (bttsOdds.length > 0) {
    const bestBTTS = selectBestBookmaker(bttsOdds);
    const yes = bestBTTS.find((o: any) => o.label === 'Yes' || o.label === 'Evet');
    const no = bestBTTS.find((o: any) => o.label === 'No' || o.label === 'Hayır');
    
    if (yes && no) {
      result.btts = {
        yes: parseFloat(yes.value),
        no: parseFloat(no.value),
        yesProb: (1 / parseFloat(yes.value)) * 100,
        noProb: (1 / parseFloat(no.value)) * 100
      };
    }
  }
  
  // Double Chance
  const dcOdds = groupedByMarket[MARKET_IDS.DOUBLE_CHANCE] || [];
  if (dcOdds.length > 0) {
    const bestDC = selectBestBookmaker(dcOdds);
    const homeOrDraw = bestDC.find((o: any) => o.label?.includes('1X') || o.label?.includes('Home or Draw'));
    const awayOrDraw = bestDC.find((o: any) => o.label?.includes('X2') || o.label?.includes('Draw or Away'));
    const homeOrAway = bestDC.find((o: any) => o.label?.includes('12') || o.label?.includes('Home or Away'));
    
    if (homeOrDraw || awayOrDraw || homeOrAway) {
      result.doubleChance = {
        homeOrDraw: homeOrDraw ? parseFloat(homeOrDraw.value) : 0,
        awayOrDraw: awayOrDraw ? parseFloat(awayOrDraw.value) : 0,
        homeOrAway: homeOrAway ? parseFloat(homeOrAway.value) : 0
      };
    }
  }
  
  // Correct Score (en popüler 5 skor)
  const csOdds = groupedByMarket[MARKET_IDS.CORRECT_SCORE] || [];
  if (csOdds.length > 0) {
    const bestCS = selectBestBookmaker(csOdds);
    const sortedCS = bestCS
      .filter((o: any) => o.name && o.value)
      .sort((a: any, b: any) => parseFloat(a.value) - parseFloat(b.value))
      .slice(0, 10);
    
    for (const cs of sortedCS) {
      result.correctScore[cs.name] = parseFloat(cs.value);
    }
  }
  
  // Bookmaker Consensus (favori analizi)
  result.bookmakerConsensus = generateConsensus(result);
  
  // Value Opportunities
  result.valueOpportunities = findValueOpportunities(result);
  
  return result;
}

// En güvenilir bookmaker'ı seç
function selectBestBookmaker(odds: any[]): any[] {
  for (const bookmakerId of BOOKMAKER_PRIORITY) {
    const filtered = odds.filter((o: any) => o.bookmaker_id === bookmakerId);
    if (filtered.length > 0) return filtered;
  }
  return odds.slice(0, 10); // Fallback
}

// Bookmaker consensus oluştur
function generateConsensus(odds: OddsData): string {
  const insights: string[] = [];
  
  if (odds.matchWinner) {
    const mw = odds.matchWinner;
    if (mw.homeProb > 55) {
      insights.push(`Ev sahibi güçlü favori (%${mw.homeProb.toFixed(0)} implied prob)`);
    } else if (mw.awayProb > 45) {
      insights.push(`Deplasman ciddi şanslar görüyor (%${mw.awayProb.toFixed(0)})`);
    } else if (mw.drawProb > 30) {
      insights.push(`Beraberlik olasılığı yüksek (%${mw.drawProb.toFixed(0)})`);
    }
    
    // Oran dengesizliği
    const spread = Math.abs(mw.home - mw.away);
    if (spread > 3) {
      insights.push(`Büyük güç farkı var (oran farkı: ${spread.toFixed(2)})`);
    }
  }
  
  if (odds.overUnder) {
    const ou = odds.overUnder;
    if (ou.overProb > 55) {
      insights.push(`Gollü maç beklentisi yüksek (2.5 Üst: %${ou.overProb.toFixed(0)})`);
    } else if (ou.underProb > 55) {
      insights.push(`Düşük skorlu maç bekleniyor (2.5 Alt: %${ou.underProb.toFixed(0)})`);
    }
  }
  
  if (odds.btts) {
    if (odds.btts.yesProb > 55) {
      insights.push(`Her iki takım da gol atacak beklentisi güçlü (%${odds.btts.yesProb.toFixed(0)})`);
    }
  }
  
  return insights.join('. ') || 'Dengeli oran dağılımı, net favori yok.';
}

// Value betting fırsatları bul
function findValueOpportunities(odds: OddsData): ValueOpportunity[] {
  const opportunities: ValueOpportunity[] = [];
  
  // Basit value detection - düşük margin marketlerde
  if (odds.matchWinner) {
    const mw = odds.matchWinner;
    const totalProb = mw.homeProb + mw.drawProb + mw.awayProb;
    const margin = totalProb - 100;
    
    // Düşük marginli bookmaker = daha doğru oranlar
    if (margin < 8) {
      // Büyük favori value check
      if (mw.home < 1.40 && mw.homeProb > 70) {
        opportunities.push({
          market: 'Match Winner',
          selection: 'Home',
          odds: mw.home,
          impliedProb: mw.homeProb,
          estimatedTrueProb: mw.homeProb + 3, // Favori genelde underrated
          valuePercent: 3,
          recommendation: 'Düşük oranlı favori - ihtiyatlı ol'
        });
      }
      
      // Underdog value check
      if (mw.away > 4.0) {
        opportunities.push({
          market: 'Match Winner',
          selection: 'Away',
          odds: mw.away,
          impliedProb: mw.awayProb,
          estimatedTrueProb: mw.awayProb * 1.1, // Underdog genelde overpriced
          valuePercent: -10,
          recommendation: 'Yüksek oranlı underdog - risk yüksek'
        });
      }
    }
  }
  
  return opportunities;
}

// ============================================
// ANA ANALİZ FONKSİYONU (ODDS DAHİL)
// ============================================
async function fetchMatchDataWithOdds(fixtureId: number) {
  const includes = [
    'participants',
    'scores',
    'statistics',
    'events',
    'lineups',
    'venue'
  ].join(';');
  
  const fixtureUrl = `${SPORTMONKS_BASE}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=${includes}`;
  
  try {
    const [fixtureRes, oddsData] = await Promise.all([
      fetch(fixtureUrl),
      fetchFixtureOdds(fixtureId)
    ]);
    
    const fixtureData = await fixtureRes.json();
    
    return {
      fixture: fixtureData.data,
      odds: oddsData
    };
  } catch (error) {
    console.error('Error fetching match data with odds:', error);
    throw error;
  }
}

// ============================================
// AI PROMPT (ODDS BİLGİSİ DAHİL)
// ============================================
function buildAggressivePrompt(
  homeTeam: string,
  awayTeam: string,
  matchData: any,
  oddsData: OddsData | null
): string {
  let oddsSection = '';
  
  if (oddsData) {
    oddsSection = `
## 📊 BAHİS ORANLARI ANALİZİ (ÇOK ÖNEMLİ!)

Bahis şirketlerinin bu maç için belirlediği oranlar:

### Maç Sonucu (1X2):
${oddsData.matchWinner ? `
- Ev Sahibi (${homeTeam}): ${oddsData.matchWinner.home} → %${oddsData.matchWinner.homeProb.toFixed(1)} implied probability
- Beraberlik: ${oddsData.matchWinner.draw} → %${oddsData.matchWinner.drawProb.toFixed(1)} implied probability  
- Deplasman (${awayTeam}): ${oddsData.matchWinner.away} → %${oddsData.matchWinner.awayProb.toFixed(1)} implied probability
` : 'Veri yok'}

### 2.5 Gol Üst/Alt:
${oddsData.overUnder ? `
- 2.5 Üst: ${oddsData.overUnder.over25} → %${oddsData.overUnder.overProb.toFixed(1)} gollü maç olasılığı
- 2.5 Alt: ${oddsData.overUnder.under25} → %${oddsData.overUnder.underProb.toFixed(1)} az gollü maç olasılığı
` : 'Veri yok'}

### Karşılıklı Gol (KG):
${oddsData.btts ? `
- KG Var: ${oddsData.btts.yes} → %${oddsData.btts.yesProb.toFixed(1)}
- KG Yok: ${oddsData.btts.no} → %${oddsData.btts.noProb.toFixed(1)}
` : 'Veri yok'}

### Çifte Şans:
${oddsData.doubleChance ? `
- 1X (Ev veya Beraberlik): ${oddsData.doubleChance.homeOrDraw}
- X2 (Beraberlik veya Deplasman): ${oddsData.doubleChance.awayOrDraw}
- 12 (Ev veya Deplasman): ${oddsData.doubleChance.homeOrAway}
` : 'Veri yok'}

### En Olası Skorlar (Bahis Şirketlerine Göre):
${Object.keys(oddsData.correctScore).length > 0 ? 
  Object.entries(oddsData.correctScore)
    .slice(0, 5)
    .map(([score, odds]) => `- ${score}: ${odds}`)
    .join('\n')
  : 'Veri yok'}

### 🎯 BOOKMAKER CONSENSUS:
${oddsData.bookmakerConsensus}

---
⚠️ ÖNEMLİ TALİMAT:
Bahis oranları profesyonel analistlerin ve algoritmaların sonucudur. 
Bu oranları KESİNLİKLE dikkate al ve kendi analizinle birleştir.

- Eğer senin analizin bahis oranlarıyla UYUŞUYORSA → %70+ güvenle tahmin yap
- Eğer senin analizin bahis oranlarından FARKLIYSA → Nedenini açıkla ve ihtiyatlı ol
- Eğer bahis şirketleri net favori gösteriyorsa → Bu bilgiyi görmezden gelme

VALUE BETTING KURALI:
- Kendi olasılık tahminin > Bahis şirketinin implied probability → VALUE VAR, agresif ol
- Kendi olasılık tahminin < Bahis şirketinin implied probability → VALUE YOK, ihtiyatlı ol
`;
  }
  
  return `
Sen elit bir futbol analiz uzmanısın. Bahis şirketlerinin oranlarını ve istatistikleri birleştirerek EN İYİ tahminleri yapacaksın.

# MAÇ: ${homeTeam} vs ${awayTeam}

${oddsSection}

## Maç Verileri:
${JSON.stringify(matchData, null, 2)}

---

# GÖREV:
Yukarıdaki tüm verileri analiz et ve aşağıdaki formatta JSON döndür.

⚠️ AGRESİF OL: Bahis oranları net bir favori gösteriyorsa, güven yüzdesini yüksek tut.
⚠️ VALUE ARA: Senin analizin ile bahis oranları arasındaki farkları tespit et.
⚠️ DETAYLI AÇIKLA: Neden bu tahmini yaptığını bahis oranlarına referans vererek açıkla.

{
  "matchResult": {
    "prediction": "1" | "X" | "2",
    "confidence": number (0-100),
    "odds": number, // Bahis oranı
    "impliedProbability": number, // Bahis şirketinin olasılığı
    "yourProbability": number, // Senin tahminin
    "valuePercent": number, // Fark (+ value var, - value yok)
    "reasoning": "string - BAHIS ORANLARINA REFERANS VER"
  },
  "goals": {
    "over25": boolean,
    "confidence": number,
    "odds": number,
    "impliedProbability": number,
    "yourProbability": number,
    "valuePercent": number,
    "expectedGoals": number,
    "reasoning": "string"
  },
  "btts": {
    "prediction": boolean,
    "confidence": number,
    "odds": number,
    "impliedProbability": number,
    "yourProbability": number,
    "valuePercent": number,
    "reasoning": "string"
  },
  "corners": {
    "over95": boolean,
    "confidence": number,
    "expectedCorners": number,
    "reasoning": "string"
  },
  "cards": {
    "over35": boolean,
    "confidence": number,
    "expectedCards": number,
    "reasoning": "string"
  },
  "firstHalf": {
    "prediction": "1" | "X" | "2",
    "over05": boolean,
    "confidence": number,
    "reasoning": "string"
  },
  "correctScore": {
    "prediction": "string", // ör: "2-1"
    "confidence": number,
    "bookmakerOdds": number, // Bu skor için bahis oranı
    "reasoning": "string"
  },
  "htFt": {
    "prediction": "string", // ör: "1/1", "X/2"
    "confidence": number,
    "reasoning": "string"
  },
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "bestBets": [
    {
      "market": "string",
      "selection": "string",
      "odds": number,
      "confidence": number,
      "valuePercent": number,
      "reasoning": "string"
    }
  ],
  "avoidBets": ["string"], // Uzak durulması gereken bahisler
  "overallAnalysis": "string - Genel değerlendirme, bahis oranları ile senin analizini karşılaştır"
}

SADECE JSON DÖNDÜR, BAŞKA HİÇBİR ŞEY YAZMA.
`;
}

// ============================================
// AI ANALİZ FONKSİYONLARI
// ============================================
async function analyzeWithClaude(prompt: string): Promise<any> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = response.content[0];
    if (content.type === 'text') {
      return JSON.parse(content.text.replace(/```json\n?|\n?```/g, '').trim());
    }
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Claude error:', error);
    throw error;
  }
}

async function analyzeWithOpenAI(prompt: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('OpenAI error:', error);
    throw error;
  }
}

async function analyzeWithGemini(prompt: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // JSON'u çıkar
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Gemini error:', error);
    throw error;
  }
}

// ============================================
// CONSENSUS OLUŞTUR
// ============================================
function buildConsensus(
  claudeResult: any,
  openaiResult: any,
  geminiResult: any,
  oddsData: OddsData | null
): any {
  const results = [claudeResult, openaiResult, geminiResult].filter(r => r);
  
  if (results.length === 0) {
    throw new Error('No AI results available');
  }
  
  // Maç sonucu consensus
  const matchPredictions = results.map(r => r.matchResult?.prediction).filter(p => p);
  const matchConsensus = getMajority(matchPredictions);
  
  // Güven ortalaması
  const matchConfidences = results.map(r => r.matchResult?.confidence || 0);
  const avgConfidence = matchConfidences.reduce((a, b) => a + b, 0) / matchConfidences.length;
  
  // 2.5 gol consensus
  const goalPredictions = results.map(r => r.goals?.over25);
  const goalsConsensus = getMajorityBoolean(goalPredictions);
  
  // BTTS consensus
  const bttsPredictions = results.map(r => r.btts?.prediction);
  const bttsConsensus = getMajorityBoolean(bttsPredictions);
  
  // Best bets - tüm AI'lardan topla ve sırala
  const allBestBets: any[] = [];
  for (const result of results) {
    if (result.bestBets) {
      allBestBets.push(...result.bestBets);
    }
  }
  
  // Value'ya göre sırala
  const sortedBets = allBestBets
    .filter(b => b.valuePercent > 0)
    .sort((a, b) => (b.valuePercent || 0) - (a.valuePercent || 0))
    .slice(0, 5);
  
  return {
    matchResult: {
      prediction: matchConsensus,
      confidence: Math.round(avgConfidence),
      aiAgreement: `${matchPredictions.filter(p => p === matchConsensus).length}/${matchPredictions.length}`,
      bookmakerOdds: oddsData?.matchWinner ? {
        home: oddsData.matchWinner.home,
        draw: oddsData.matchWinner.draw,
        away: oddsData.matchWinner.away
      } : null,
      individual: {
        claude: claudeResult?.matchResult,
        openai: openaiResult?.matchResult,
        gemini: geminiResult?.matchResult
      }
    },
    goals: {
      over25: goalsConsensus,
      confidence: Math.round(results.map(r => r.goals?.confidence || 0).reduce((a, b) => a + b, 0) / results.length),
      aiAgreement: `${goalPredictions.filter(p => p === goalsConsensus).length}/${goalPredictions.length}`,
      bookmakerOdds: oddsData?.overUnder || null
    },
    btts: {
      prediction: bttsConsensus,
      confidence: Math.round(results.map(r => r.btts?.confidence || 0).reduce((a, b) => a + b, 0) / results.length),
      aiAgreement: `${bttsPredictions.filter(p => p === bttsConsensus).length}/${bttsPredictions.length}`,
      bookmakerOdds: oddsData?.btts || null
    },
    corners: mergeSimple(results.map(r => r.corners)),
    cards: mergeSimple(results.map(r => r.cards)),
    firstHalf: mergeSimple(results.map(r => r.firstHalf)),
    correctScore: results[0]?.correctScore || null, // Claude'un tahmini öncelikli
    htFt: results[0]?.htFt || null,
    riskLevel: getMajority(results.map(r => r.riskLevel)),
    bestBets: sortedBets,
    avoidBets: [...new Set(results.flatMap(r => r.avoidBets || []))],
    bookmakerConsensus: oddsData?.bookmakerConsensus || 'Odds verisi yok',
    valueOpportunities: oddsData?.valueOpportunities || [],
    overallAnalysis: results[0]?.overallAnalysis || ''
  };
}

function getMajority(arr: string[]): string {
  const counts: { [key: string]: number } = {};
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function getMajorityBoolean(arr: boolean[]): boolean {
  const trueCount = arr.filter(x => x === true).length;
  return trueCount > arr.length / 2;
}

function mergeSimple(arr: any[]): any {
  const valid = arr.filter(x => x);
  if (valid.length === 0) return null;
  return valid[0]; // Basitlik için ilk geçerli sonucu al
}

// ============================================
// ANA API ROUTE
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam } = body;
    
    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Analyzing: ${homeTeam} vs ${awayTeam} (ID: ${fixtureId})`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Maç verisi ve odds'u paralel çek
    const { fixture, odds } = await fetchMatchDataWithOdds(fixtureId);
    
    // AI prompt oluştur
    const prompt = buildAggressivePrompt(homeTeam, awayTeam, fixture, odds);
    
    // 3 AI'dan paralel analiz al
    console.log('🤖 Running AI analysis...');
    const [claudeResult, openaiResult, geminiResult] = await Promise.allSettled([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt)
    ]);
    
    const claude = claudeResult.status === 'fulfilled' ? claudeResult.value : null;
    const openai_res = openaiResult.status === 'fulfilled' ? openaiResult.value : null;
    const gemini = geminiResult.status === 'fulfilled' ? geminiResult.value : null;
    
    console.log(`✅ Claude: ${claude ? 'OK' : 'FAILED'}`);
    console.log(`✅ OpenAI: ${openai_res ? 'OK' : 'FAILED'}`);
    console.log(`✅ Gemini: ${gemini ? 'OK' : 'FAILED'}`);
    
    // Consensus oluştur
    const consensus = buildConsensus(claude, openai_res, gemini, odds);
    
    return NextResponse.json({
      success: true,
      fixture: {
        id: fixtureId,
        homeTeam,
        awayTeam,
        date: fixture?.starting_at
      },
      odds: odds ? {
        matchWinner: odds.matchWinner,
        overUnder: odds.overUnder,
        btts: odds.btts,
        correctScore: odds.correctScore
      } : null,
      analysis: consensus,
      aiResponses: {
        claude: claude ? 'available' : 'failed',
        openai: openai_res ? 'available' : 'failed',
        gemini: gemini ? 'available' : 'failed'
      }
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: String(error) },
      { status: 500 }
    );
  }
}
