// src/app/api/analyze/route.ts
// DÜZELTILMIŞ VERSİYON - matchId/fixtureId uyumu + Odds Entegrasyonu

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
// ODDS TİPLERİ
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
  doubleChance: {
    homeOrDraw: number;
    awayOrDraw: number;
    homeOrAway: number;
  } | null;
  correctScore: { [key: string]: number };
  bookmakerConsensus: string;
}

// Market ID'leri (Sportmonks)
const MARKET_IDS = {
  MATCH_WINNER: 1,
  OVER_UNDER: 18,
  BTTS: 28,
  DOUBLE_CHANCE: 17,
  CORRECT_SCORE: 57,
};

const BOOKMAKER_PRIORITY = [2, 1, 5, 6, 9, 15, 23, 29, 35];

// ============================================
// ODDS ÇEKME
// ============================================
async function fetchFixtureOdds(fixtureId: number): Promise<OddsData | null> {
  try {
    const url = `${SPORTMONKS_BASE}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds`;
    console.log(`📊 Fetching odds for fixture ${fixtureId}...`);
    
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      console.error(`Odds fetch failed: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const odds = data.data?.odds || [];
    
    if (odds.length === 0) {
      console.log('No odds available');
      return null;
    }
    
    console.log(`✅ Found ${odds.length} odds entries`);
    return parseOdds(odds);
  } catch (error) {
    console.error('Error fetching odds:', error);
    return null;
  }
}

function parseOdds(oddsArray: any[]): OddsData {
  const result: OddsData = {
    matchWinner: null,
    overUnder: null,
    btts: null,
    doubleChance: null,
    correctScore: {},
    bookmakerConsensus: ''
  };
  
  const groupedByMarket: { [key: number]: any[] } = {};
  for (const odd of oddsArray) {
    const marketId = odd.market_id;
    if (!groupedByMarket[marketId]) groupedByMarket[marketId] = [];
    groupedByMarket[marketId].push(odd);
  }
  
  // 1X2 Match Winner
  const mwOdds = groupedByMarket[MARKET_IDS.MATCH_WINNER] || [];
  if (mwOdds.length > 0) {
    const best = selectBestBookmaker(mwOdds);
    const home = best.find((o: any) => o.label === '1' || o.label === 'Home');
    const draw = best.find((o: any) => o.label === 'X' || o.label === 'Draw');
    const away = best.find((o: any) => o.label === '2' || o.label === 'Away');
    
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
    const best = selectBestBookmaker(ou25);
    const over = best.find((o: any) => o.label === 'Over');
    const under = best.find((o: any) => o.label === 'Under');
    
    if (over && under) {
      result.overUnder = {
        over25: parseFloat(over.value),
        under25: parseFloat(under.value),
        overProb: (1 / parseFloat(over.value)) * 100,
        underProb: (1 / parseFloat(under.value)) * 100
      };
    }
  }
  
  // BTTS
  const bttsOdds = groupedByMarket[MARKET_IDS.BTTS] || [];
  if (bttsOdds.length > 0) {
    const best = selectBestBookmaker(bttsOdds);
    const yes = best.find((o: any) => o.label === 'Yes');
    const no = best.find((o: any) => o.label === 'No');
    
    if (yes && no) {
      result.btts = {
        yes: parseFloat(yes.value),
        no: parseFloat(no.value),
        yesProb: (1 / parseFloat(yes.value)) * 100,
        noProb: (1 / parseFloat(no.value)) * 100
      };
    }
  }
  
  // Correct Score
  const csOdds = groupedByMarket[MARKET_IDS.CORRECT_SCORE] || [];
  if (csOdds.length > 0) {
    const best = selectBestBookmaker(csOdds);
    const sorted = best
      .filter((o: any) => o.name && o.value)
      .sort((a: any, b: any) => parseFloat(a.value) - parseFloat(b.value))
      .slice(0, 10);
    
    for (const cs of sorted) {
      result.correctScore[cs.name] = parseFloat(cs.value);
    }
  }
  
  result.bookmakerConsensus = generateConsensus(result);
  return result;
}

function selectBestBookmaker(odds: any[]): any[] {
  for (const id of BOOKMAKER_PRIORITY) {
    const filtered = odds.filter((o: any) => o.bookmaker_id === id);
    if (filtered.length > 0) return filtered;
  }
  return odds.slice(0, 10);
}

function generateConsensus(odds: OddsData): string {
  const insights: string[] = [];
  
  if (odds.matchWinner) {
    const mw = odds.matchWinner;
    if (mw.homeProb > 55) insights.push(`Ev sahibi favori (%${mw.homeProb.toFixed(0)})`);
    else if (mw.awayProb > 45) insights.push(`Deplasman şanslı (%${mw.awayProb.toFixed(0)})`);
    else if (mw.drawProb > 30) insights.push(`Beraberlik olası (%${mw.drawProb.toFixed(0)})`);
  }
  
  if (odds.overUnder) {
    if (odds.overUnder.overProb > 55) insights.push(`Gollü maç bekleniyor`);
    else if (odds.overUnder.underProb > 55) insights.push(`Az gollü maç bekleniyor`);
  }
  
  if (odds.btts && odds.btts.yesProb > 55) {
    insights.push(`KG Var beklentisi güçlü`);
  }
  
  return insights.join('. ') || 'Dengeli oranlar';
}

// ============================================
// MAÇ VERİSİ ÇEKME
// ============================================
async function fetchMatchData(fixtureId: number) {
  const includes = 'participants;scores;statistics;events;lineups;venue';
  const url = `${SPORTMONKS_BASE}/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=${includes}`;
  
  try {
    const [fixtureRes, oddsData] = await Promise.all([
      fetch(url, { cache: 'no-store' }),
      fetchFixtureOdds(fixtureId)
    ]);
    
    if (!fixtureRes.ok) {
      throw new Error(`Fixture fetch failed: ${fixtureRes.status}`);
    }
    
    const fixtureData = await fixtureRes.json();
    return { fixture: fixtureData.data, odds: oddsData };
  } catch (error) {
    console.error('Error fetching match data:', error);
    throw error;
  }
}

// ============================================
// AI PROMPT
// ============================================
function buildPrompt(homeTeam: string, awayTeam: string, matchData: any, oddsData: OddsData | null): string {
  let oddsSection = '';
  
  if (oddsData) {
    oddsSection = `
## 📊 BAHİS ORANLARI (ÇOK ÖNEMLİ!)

### Maç Sonucu (1X2):
${oddsData.matchWinner ? `
- ${homeTeam}: ${oddsData.matchWinner.home} (${oddsData.matchWinner.homeProb.toFixed(0)}%)
- Beraberlik: ${oddsData.matchWinner.draw} (${oddsData.matchWinner.drawProb.toFixed(0)}%)
- ${awayTeam}: ${oddsData.matchWinner.away} (${oddsData.matchWinner.awayProb.toFixed(0)}%)` : 'Veri yok'}

### 2.5 Gol Üst/Alt:
${oddsData.overUnder ? `
- Üst 2.5: ${oddsData.overUnder.over25} (${oddsData.overUnder.overProb.toFixed(0)}%)
- Alt 2.5: ${oddsData.overUnder.under25} (${oddsData.overUnder.underProb.toFixed(0)}%)` : 'Veri yok'}

### KG Var/Yok:
${oddsData.btts ? `
- KG Var: ${oddsData.btts.yes} (${oddsData.btts.yesProb.toFixed(0)}%)
- KG Yok: ${oddsData.btts.no} (${oddsData.btts.noProb.toFixed(0)}%)` : 'Veri yok'}

### En Olası Skorlar:
${Object.entries(oddsData.correctScore).slice(0, 5).map(([s, o]) => `- ${s}: ${o}`).join('\n') || 'Veri yok'}

### 🎯 Bookmaker Görüşü: ${oddsData.bookmakerConsensus}

⚠️ KURAL: Bahis oranlarını dikkate al! Oranlarla uyumluysan güveni artır, değilsen açıkla.
`;
  }

  return `Sen elit futbol analistisin. ${homeTeam} vs ${awayTeam} maçını analiz et.

${oddsSection}

## Maç Verileri:
${JSON.stringify(matchData, null, 2)}

Aşağıdaki JSON formatında yanıt ver:

{
  "matchResult": {
    "prediction": "1" veya "X" veya "2",
    "confidence": 0-100,
    "reasoning": "açıklama"
  },
  "goals": {
    "over25": true/false,
    "confidence": 0-100,
    "expectedGoals": sayı,
    "reasoning": "açıklama"
  },
  "btts": {
    "prediction": true/false,
    "confidence": 0-100,
    "reasoning": "açıklama"
  },
  "corners": {
    "over95": true/false,
    "confidence": 0-100,
    "expectedCorners": sayı,
    "reasoning": "açıklama"
  },
  "cards": {
    "over35": true/false,
    "confidence": 0-100,
    "expectedCards": sayı,
    "reasoning": "açıklama"
  },
  "firstHalf": {
    "prediction": "1" veya "X" veya "2",
    "over05": true/false,
    "confidence": 0-100,
    "reasoning": "açıklama"
  },
  "correctScore": {
    "prediction": "2-1",
    "confidence": 0-100,
    "reasoning": "açıklama"
  },
  "riskLevel": "LOW" veya "MEDIUM" veya "HIGH",
  "bestBets": [
    {"market": "...", "selection": "...", "confidence": 0-100, "reasoning": "..."}
  ],
  "overallAnalysis": "genel değerlendirme"
}

SADECE JSON DÖNDÜR.`;
}

// ============================================
// AI ANALİZ
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
      const text = content.text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(text);
    }
    throw new Error('Invalid response');
  } catch (error) {
    console.error('Claude error:', error);
    return null;
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
    if (content) return JSON.parse(content);
    throw new Error('Invalid response');
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

async function analyzeWithGemini(prompt: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('No JSON found');
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

// ============================================
// CONSENSUS
// ============================================
function buildConsensusResult(claude: any, openai_r: any, gemini: any, odds: OddsData | null): any {
  const results = [claude, openai_r, gemini].filter(r => r);
  
  if (results.length === 0) {
    return { error: 'Tüm AI analizleri başarısız oldu' };
  }
  
  const matchPreds = results.map(r => r.matchResult?.prediction).filter(Boolean);
  const goalPreds = results.map(r => r.goals?.over25);
  const bttsPreds = results.map(r => r.btts?.prediction);
  
  const getMajority = (arr: string[]) => {
    const counts: Record<string, number> = {};
    arr.forEach(x => counts[x] = (counts[x] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };
  
  const getMajorityBool = (arr: boolean[]) => arr.filter(x => x).length > arr.length / 2;
  
  const avgConf = (key: string) => {
    const vals = results.map(r => r[key]?.confidence || 0);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  return {
    matchResult: {
      prediction: getMajority(matchPreds),
      confidence: avgConf('matchResult'),
      aiAgreement: `${matchPreds.filter(p => p === getMajority(matchPreds)).length}/${matchPreds.length}`,
      bookmakerOdds: odds?.matchWinner || null,
      individual: { claude: claude?.matchResult, openai: openai_r?.matchResult, gemini: gemini?.matchResult }
    },
    goals: {
      over25: getMajorityBool(goalPreds),
      confidence: avgConf('goals'),
      expectedGoals: results[0]?.goals?.expectedGoals || 2.5,
      bookmakerOdds: odds?.overUnder || null
    },
    btts: {
      prediction: getMajorityBool(bttsPreds),
      confidence: avgConf('btts'),
      bookmakerOdds: odds?.btts || null
    },
    corners: results[0]?.corners || null,
    cards: results[0]?.cards || null,
    firstHalf: results[0]?.firstHalf || null,
    correctScore: results[0]?.correctScore || null,
    riskLevel: getMajority(results.map(r => r.riskLevel).filter(Boolean)) || 'MEDIUM',
    bestBets: results[0]?.bestBets || [],
    bookmakerConsensus: odds?.bookmakerConsensus || 'Odds verisi yok',
    overallAnalysis: results[0]?.overallAnalysis || ''
  };
}

// ============================================
// ANA API ROUTE
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 Received body:', JSON.stringify(body));
    
    // Her iki ismi de kabul et: fixtureId veya matchId
    const fixtureId = body.fixtureId || body.matchId || body.id;
    const homeTeam = body.homeTeam || body.home || 'Home Team';
    const awayTeam = body.awayTeam || body.away || 'Away Team';
    
    if (!fixtureId) {
      console.error('❌ No fixture ID provided');
      return NextResponse.json(
        { error: 'Fixture ID gerekli', received: body },
        { status: 400 }
      );
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Analyzing: ${homeTeam} vs ${awayTeam} (ID: ${fixtureId})`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Maç verisi + odds çek
    const { fixture, odds } = await fetchMatchData(Number(fixtureId));
    
    if (!fixture) {
      return NextResponse.json(
        { error: 'Maç verisi bulunamadı', fixtureId },
        { status: 404 }
      );
    }
    
    // AI prompt
    const prompt = buildPrompt(homeTeam, awayTeam, fixture, odds);
    
    // 3 AI paralel çalıştır
    console.log('🤖 Running AI analysis...');
    const [claudeRes, openaiRes, geminiRes] = await Promise.allSettled([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt)
    ]);
    
    const claude = claudeRes.status === 'fulfilled' ? claudeRes.value : null;
    const openai_r = openaiRes.status === 'fulfilled' ? openaiRes.value : null;
    const gemini = geminiRes.status === 'fulfilled' ? geminiRes.value : null;
    
    console.log(`✅ Claude: ${claude ? 'OK' : 'FAILED'}`);
    console.log(`✅ OpenAI: ${openai_r ? 'OK' : 'FAILED'}`);
    console.log(`✅ Gemini: ${gemini ? 'OK' : 'FAILED'}`);
    
    // En az 1 AI çalışmalı
    if (!claude && !openai_r && !gemini) {
      return NextResponse.json(
        { error: 'Tüm AI analizleri başarısız oldu' },
        { status: 500 }
      );
    }
    
    // Consensus oluştur
    const analysis = buildConsensusResult(claude, openai_r, gemini, odds);
    
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
        correctScore: odds.correctScore,
        consensus: odds.bookmakerConsensus
      } : null,
      analysis,
      aiStatus: {
        claude: claude ? 'success' : 'failed',
        openai: openai_r ? 'success' : 'failed',
        gemini: gemini ? 'success' : 'failed'
      }
    });
    
  } catch (error: any) {
    console.error('❌ Analysis error:', error);
    return NextResponse.json(
      { error: 'Analiz hatası', details: error.message },
      { status: 500 }
    );
  }
}
