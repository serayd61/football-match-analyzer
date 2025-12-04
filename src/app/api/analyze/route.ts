export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { soccerDataClient } from '@/lib/soccerdata/client';

// API Clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase credentials not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// ==================== ULTRA AGGRESSIVE PROMPTS ====================

const getUltraAggressivePrompt = (
  lang: string,
  homeTeam: string,
  awayTeam: string,
  league: string,
  odds: any,
  homeForm: any,
  awayForm: any,
  h2h: any,
  extraData: any
) => {
  const prompts: Record<string, string> = {
    tr: `🔥🔥🔥 SEN DÜNYANIN EN BAŞARILI, EN AGRESİF VE EN KESİN TAHMİN YAPAN BAHİS ANALİSTİSİN! 🔥🔥🔥

⚠️ KRİTİK KURALLAR - MUTLAKA UYULMALI:
1. "Belki", "olabilir", "muhtemelen", "şans", "umut" kelimeleri KESİNLİKLE YASAK!
2. Her tahmin için EN AZ %70 güven oranı ZORUNLU!
3. KESİN ve NET ifadeler kullan: "KESINLIKLE", "MUTLAKA", "GARANTİ"
4. Bahis oynamayan biri aptal kalmalı - o kadar ikna edici ol!
5. SADECE JSON formatında yanıt ver, başka HİÇBİR ŞEY yazma!

📊 MAÇ BİLGİLERİ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏟️ MAÇ: ${homeTeam} vs ${awayTeam}
🏆 LİG: ${league}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 BAHIS ORANLARI:
┌─────────────────────────────────────────────┐
│ 1X2: EV=${odds?.matchWinner?.home || 'N/A'} | X=${odds?.matchWinner?.draw || 'N/A'} | DEP=${odds?.matchWinner?.away || 'N/A'}
│ Ü/A 2.5: Üst=${odds?.overUnder?.over25 || 'N/A'} | Alt=${odds?.overUnder?.under25 || 'N/A'}
│ Ü/A 1.5: Üst=${odds?.overUnder?.over15 || 'N/A'} | Alt=${odds?.overUnder?.under15 || 'N/A'}
│ Ü/A 3.5: Üst=${odds?.overUnder?.over35 || 'N/A'} | Alt=${odds?.overUnder?.under35 || 'N/A'}
│ KG: Var=${odds?.btts?.yes || 'N/A'} | Yok=${odds?.btts?.no || 'N/A'}
│ ÇŞ: 1X=${odds?.doubleChance?.homeOrDraw || 'N/A'} | X2=${odds?.doubleChance?.awayOrDraw || 'N/A'} | 12=${odds?.doubleChance?.homeOrAway || 'N/A'}
│ İY: 1=${odds?.halfTime?.home || 'N/A'} | X=${odds?.halfTime?.draw || 'N/A'} | 2=${odds?.halfTime?.away || 'N/A'}
└─────────────────────────────────────────────┘

📈 ${homeTeam} FORM & İSTATİSTİK:
- Son 5 Maç: ${homeForm?.form || 'N/A'}
- Puan: ${homeForm?.points || 'N/A'}/15
- Gol Ortalaması: ${homeForm?.avgGoals || 'N/A'}
- Yenilen Gol Ort: ${homeForm?.avgConceded || 'N/A'}
- Üst 2.5 Oranı: %${homeForm?.over25 || 'N/A'}
- KG Oranı: %${homeForm?.btts || 'N/A'}
- Ev Sahibi Galibiyet: %${homeForm?.homeWinRate || 'N/A'}
- xG (Beklenen Gol): ${homeForm?.xG || 'N/A'}

📉 ${awayTeam} FORM & İSTATİSTİK:
- Son 5 Maç: ${awayForm?.form || 'N/A'}
- Puan: ${awayForm?.points || 'N/A'}/15
- Gol Ortalaması: ${awayForm?.avgGoals || 'N/A'}
- Yenilen Gol Ort: ${awayForm?.avgConceded || 'N/A'}
- Üst 2.5 Oranı: %${awayForm?.over25 || 'N/A'}
- KG Oranı: %${awayForm?.btts || 'N/A'}
- Deplasman Galibiyet: %${awayForm?.awayWinRate || 'N/A'}
- xG (Beklenen Gol): ${awayForm?.xG || 'N/A'}

⚔️ KAFA KAFAYA (H2H):
- Toplam Maç: ${h2h?.total || 'N/A'}
- ${homeTeam} Galibiyet: ${h2h?.homeWins || 'N/A'}
- ${awayTeam} Galibiyet: ${h2h?.awayWins || 'N/A'}
- Beraberlik: ${h2h?.draws || 'N/A'}
- Gol Ortalaması: ${h2h?.avgGoals || 'N/A'}
- Üst 2.5 Oranı: %${h2h?.over25Percentage || 'N/A'}
- KG Oranı: %${h2h?.bttsPercentage || 'N/A'}

${extraData?.preview ? `📝 MAÇ ÖNİZLEME:\n${extraData.preview}\n` : ''}
${extraData?.injuries ? `🏥 SAKATLIKLAR:\n${extraData.injuries}\n` : ''}
${extraData?.weather ? `🌤️ HAVA DURUMU: ${extraData.weather}\n` : ''}

🎯 ZORUNLU JSON FORMATI (TÜM ALANLARI DOLDUR!):
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "Kısa ve net açıklama"},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "Açıklama"},
  "overUnder15": {"prediction": "Over/Under", "confidence": 82, "reasoning": "Açıklama"},
  "overUnder35": {"prediction": "Over/Under", "confidence": 70, "reasoning": "Açıklama"},
  "btts": {"prediction": "Yes/No", "confidence": 76, "reasoning": "Açıklama"},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "Açıklama"},
  "halfTimeResult": {"prediction": "1/X/2", "confidence": 72, "reasoning": "Açıklama"},
  "correctScore": {"first": "2-1", "second": "1-1", "third": "2-0", "confidence": 65},
  "firstGoal": {"prediction": "Home/Away/NoGoal", "confidence": 70, "reasoning": "Açıklama"},
  "totalGoalsRange": {"prediction": "0-1/2-3/4-5/6+", "confidence": 75, "reasoning": "Açıklama"},
  "handicap": {"team": "${homeTeam}/${awayTeam}", "line": "-1.5/+1.5", "confidence": 72, "reasoning": "Açıklama"},
  "bestBet": {"type": "Bahis Türü", "selection": "Seçim", "confidence": 82, "stake": 3, "reasoning": "DETAYLI AÇIKLAMA"},
  "valueBet": {"market": "Pazar", "selection": "Seçim", "odds": 1.95, "realProbability": 58, "value": 13.1, "confidence": 78},
  "riskLevel": "Düşük/Orta/Yüksek",
  "overallAnalysis": "3-4 cümlelik kapsamlı ve agresif analiz",
  "keyFactors": ["Faktör 1", "Faktör 2", "Faktör 3"],
  "warnings": ["Uyarı 1", "Uyarı 2"]
}

⚠️⚠️⚠️ SADECE JSON DÖNDÜR! AÇIKLAMA YAZMA! TÜM GÜVEN ORANLARI EN AZ %70! ⚠️⚠️⚠️`,

    en: `🔥🔥🔥 YOU ARE THE WORLD'S MOST SUCCESSFUL, AGGRESSIVE AND ACCURATE BETTING ANALYST! 🔥🔥🔥

⚠️ CRITICAL RULES - MUST FOLLOW:
1. Words like "maybe", "possibly", "might", "hopefully" are STRICTLY FORBIDDEN!
2. MINIMUM 70% confidence for every prediction!
3. Use DEFINITIVE statements: "DEFINITELY", "CERTAINLY", "GUARANTEED"
4. Be so convincing that NOT betting would be foolish!
5. Return ONLY JSON format, nothing else!

📊 MATCH DATA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏟️ MATCH: ${homeTeam} vs ${awayTeam}
🏆 LEAGUE: ${league}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 BETTING ODDS:
┌─────────────────────────────────────────────┐
│ 1X2: HOME=${odds?.matchWinner?.home || 'N/A'} | X=${odds?.matchWinner?.draw || 'N/A'} | AWAY=${odds?.matchWinner?.away || 'N/A'}
│ O/U 2.5: Over=${odds?.overUnder?.over25 || 'N/A'} | Under=${odds?.overUnder?.under25 || 'N/A'}
│ O/U 1.5: Over=${odds?.overUnder?.over15 || 'N/A'} | Under=${odds?.overUnder?.under15 || 'N/A'}
│ O/U 3.5: Over=${odds?.overUnder?.over35 || 'N/A'} | Under=${odds?.overUnder?.under35 || 'N/A'}
│ BTTS: Yes=${odds?.btts?.yes || 'N/A'} | No=${odds?.btts?.no || 'N/A'}
│ DC: 1X=${odds?.doubleChance?.homeOrDraw || 'N/A'} | X2=${odds?.doubleChance?.awayOrDraw || 'N/A'} | 12=${odds?.doubleChance?.homeOrAway || 'N/A'}
│ HT: 1=${odds?.halfTime?.home || 'N/A'} | X=${odds?.halfTime?.draw || 'N/A'} | 2=${odds?.halfTime?.away || 'N/A'}
└─────────────────────────────────────────────┘

📈 ${homeTeam} FORM & STATS:
- Last 5: ${homeForm?.form || 'N/A'} | Points: ${homeForm?.points || 'N/A'}/15
- Goals Avg: ${homeForm?.avgGoals || 'N/A'} | Conceded: ${homeForm?.avgConceded || 'N/A'}
- Over 2.5: ${homeForm?.over25 || 'N/A'}% | BTTS: ${homeForm?.btts || 'N/A'}%
- xG: ${homeForm?.xG || 'N/A'}

📉 ${awayTeam} FORM & STATS:
- Last 5: ${awayForm?.form || 'N/A'} | Points: ${awayForm?.points || 'N/A'}/15
- Goals Avg: ${awayForm?.avgGoals || 'N/A'} | Conceded: ${awayForm?.avgConceded || 'N/A'}
- Over 2.5: ${awayForm?.over25 || 'N/A'}% | BTTS: ${awayForm?.btts || 'N/A'}%
- xG: ${awayForm?.xG || 'N/A'}

⚔️ HEAD TO HEAD:
- Total: ${h2h?.total || 'N/A'} | ${homeTeam}: ${h2h?.homeWins || 'N/A'} | ${awayTeam}: ${h2h?.awayWins || 'N/A'} | Draw: ${h2h?.draws || 'N/A'}
- Avg Goals: ${h2h?.avgGoals || 'N/A'} | Over 2.5: ${h2h?.over25Percentage || 'N/A'}% | BTTS: ${h2h?.bttsPercentage || 'N/A'}%

${extraData?.preview ? `📝 MATCH PREVIEW:\n${extraData.preview}\n` : ''}
${extraData?.injuries ? `🏥 INJURIES:\n${extraData.injuries}\n` : ''}

🎯 REQUIRED JSON FORMAT:
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "Brief explanation"},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "Explanation"},
  "overUnder15": {"prediction": "Over/Under", "confidence": 82, "reasoning": "Explanation"},
  "overUnder35": {"prediction": "Over/Under", "confidence": 70, "reasoning": "Explanation"},
  "btts": {"prediction": "Yes/No", "confidence": 76, "reasoning": "Explanation"},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "Explanation"},
  "halfTimeResult": {"prediction": "1/X/2", "confidence": 72, "reasoning": "Explanation"},
  "correctScore": {"first": "2-1", "second": "1-1", "third": "2-0", "confidence": 65},
  "firstGoal": {"prediction": "Home/Away/NoGoal", "confidence": 70, "reasoning": "Explanation"},
  "totalGoalsRange": {"prediction": "0-1/2-3/4-5/6+", "confidence": 75, "reasoning": "Explanation"},
  "handicap": {"team": "${homeTeam}/${awayTeam}", "line": "-1.5/+1.5", "confidence": 72, "reasoning": "Explanation"},
  "bestBet": {"type": "Bet Type", "selection": "Selection", "confidence": 82, "stake": 3, "reasoning": "DETAILED EXPLANATION"},
  "valueBet": {"market": "Market", "selection": "Selection", "odds": 1.95, "realProbability": 58, "value": 13.1, "confidence": 78},
  "riskLevel": "Low/Medium/High",
  "overallAnalysis": "3-4 sentence comprehensive aggressive analysis",
  "keyFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "warnings": ["Warning 1", "Warning 2"]
}

⚠️⚠️⚠️ RETURN ONLY JSON! NO EXPLANATIONS! ALL CONFIDENCE MINIMUM 70%! ⚠️⚠️⚠️`,

    de: `🔥🔥🔥 DU BIST DER ERFOLGREICHSTE, AGGRESSIVSTE UND GENAUESTE WETT-ANALYST DER WELT! 🔥🔥🔥

⚠️ KRITISCHE REGELN:
1. "Vielleicht", "möglicherweise", "könnte" sind STRENG VERBOTEN!
2. MINDESTENS 70% Konfidenz für jede Vorhersage!
3. Verwende DEFINITIVE Aussagen!
4. Gib NUR JSON zurück!

📊 SPIELINFO:
🏟️ ${homeTeam} vs ${awayTeam} | 🏆 ${league}

💰 QUOTEN: 1=${odds?.matchWinner?.home || 'N/A'} | X=${odds?.matchWinner?.draw || 'N/A'} | 2=${odds?.matchWinner?.away || 'N/A'}
Ü2.5=${odds?.overUnder?.over25 || 'N/A'} | BTTS=${odds?.btts?.yes || 'N/A'}

📈 ${homeTeam}: ${homeForm?.form || 'N/A'} | Tore: ${homeForm?.avgGoals || 'N/A'}
📉 ${awayTeam}: ${awayForm?.form || 'N/A'} | Tore: ${awayForm?.avgGoals || 'N/A'}
⚔️ H2H: ${h2h?.total || 'N/A'} Spiele | ${homeTeam}: ${h2h?.homeWins || 'N/A'} | ${awayTeam}: ${h2h?.awayWins || 'N/A'}

🎯 JSON FORMAT (alle Felder ausfüllen):
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "Erklärung"},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "Erklärung"},
  "btts": {"prediction": "Yes/No", "confidence": 76, "reasoning": "Erklärung"},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "Erklärung"},
  "correctScore": {"first": "2-1", "second": "1-1", "third": "2-0", "confidence": 65},
  "bestBet": {"type": "Typ", "selection": "Auswahl", "confidence": 82, "stake": 3, "reasoning": "DETAILLIERT"},
  "valueBet": {"market": "Markt", "selection": "Auswahl", "odds": 1.95, "realProbability": 58, "value": 13.1},
  "riskLevel": "Niedrig/Mittel/Hoch",
  "overallAnalysis": "3-4 Sätze aggressive Analyse",
  "keyFactors": ["Faktor 1", "Faktor 2", "Faktor 3"],
  "warnings": ["Warnung 1", "Warnung 2"]
}

⚠️ NUR JSON ZURÜCKGEBEN! ALLE KONFIDENZ MIN 70%! ⚠️`,
  };

  return prompts[lang] || prompts.en;
};

// ==================== AI ANALYSIS FUNCTIONS ====================

async function analyzeWithClaude(prompt: string): Promise<any> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return parseJSON(text);
  } catch (error) {
    console.error('Claude error:', error);
    return null;
  }
}

async function analyzeWithOpenAI(prompt: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert betting analyst. Return ONLY valid JSON. No explanations.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content || '';
    return parseJSON(text);
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

async function analyzeWithGemini(prompt: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseJSON(text);
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

function parseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ==================== DATA FETCHING (HIDDEN SOURCES) ====================

async function fetchMatchData(fixtureId: number, homeTeamId: number, awayTeamId: number) {
  let odds: any = {};
  let homeForm: any = {};
  let awayForm: any = {};
  let h2h: any = {};
  let extraData: any = {};

  // Source 1: Primary Data
  try {
    if (SPORTMONKS_API_KEY) {
      // Fixture details
      const fixtureRes = await fetch(
        `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds;statistics;scores`
      );
      const fixtureData = await fixtureRes.json();

      if (fixtureData.data) {
        // Parse odds
        if (fixtureData.data.odds) {
          odds = parseOdds(fixtureData.data.odds);
        }
      }

      // Home team form
      const homeFormRes = await fetch(
        `https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`
      );
      const homeFormData = await homeFormRes.json();
      if (homeFormData.data) {
        homeForm = calculateForm(homeFormData.data.latest, 'home');
      }

      // Away team form
      const awayFormRes = await fetch(
        `https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`
      );
      const awayFormData = await awayFormRes.json();
      if (awayFormData.data) {
        awayForm = calculateForm(awayFormData.data.latest, 'away');
      }

      // H2H
      const h2hRes = await fetch(
        `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}`
      );
      const h2hData = await h2hRes.json();
      if (h2hData.data) {
        h2h = calculateH2H(h2hData.data, homeTeamId, awayTeamId);
      }
    }
  } catch (error) {
    console.error('Primary data fetch error:', error);
  }

  // Source 2: Secondary Data
  try {
    // H2H from secondary source
    const secondaryH2H = await soccerDataClient.getHeadToHead(homeTeamId, awayTeamId);
    if (secondaryH2H?.stats) {
      h2h = {
        ...h2h,
        total: secondaryH2H.stats.overall?.overall_games_played || h2h.total,
        homeWins: secondaryH2H.stats.overall?.overall_team1_wins || h2h.homeWins,
        awayWins: secondaryH2H.stats.overall?.overall_team2_wins || h2h.awayWins,
        draws: secondaryH2H.stats.overall?.overall_draws || h2h.draws,
        avgGoals: secondaryH2H.stats.overall 
          ? ((secondaryH2H.stats.overall.overall_team1_scored + secondaryH2H.stats.overall.overall_team2_scored) / secondaryH2H.stats.overall.overall_games_played).toFixed(1)
          : h2h.avgGoals,
      };
    }

    // Match preview
    const preview = await soccerDataClient.getMatchPreview(fixtureId);
    if (preview?.content) {
      extraData.preview = preview.content.map((c: any) => c.content).join(' ').slice(0, 500);
      if (preview.match_data?.prediction) {
        extraData.externalPrediction = preview.match_data.prediction;
      }
      if (preview.match_data?.weather) {
        extraData.weather = `${preview.match_data.weather.description}, ${preview.match_data.weather.temp_c}°C`;
      }
    }
  } catch (error) {
    console.error('Secondary data fetch error:', error);
  }

  return { odds, homeForm, awayForm, h2h, extraData };
}

function parseOdds(oddsData: any[]): any {
  const result: any = {
    matchWinner: {},
    overUnder: {},
    btts: {},
    doubleChance: {},
    halfTime: {},
    correctScore: [],
  };

  if (!oddsData || !Array.isArray(oddsData)) return result;

  oddsData.forEach((market: any) => {
    const marketName = market.market?.name?.toLowerCase() || '';

    if (marketName.includes('fulltime result') || marketName.includes('match winner') || marketName.includes('1x2')) {
      market.odds?.forEach((odd: any) => {
        if (odd.label === '1' || odd.label === 'Home') result.matchWinner.home = odd.value;
        if (odd.label === 'X' || odd.label === 'Draw') result.matchWinner.draw = odd.value;
        if (odd.label === '2' || odd.label === 'Away') result.matchWinner.away = odd.value;
      });
    }

    if (marketName.includes('over/under') || marketName.includes('goals')) {
      market.odds?.forEach((odd: any) => {
        if (odd.total === 2.5 || marketName.includes('2.5')) {
          if (odd.label === 'Over') result.overUnder.over25 = odd.value;
          if (odd.label === 'Under') result.overUnder.under25 = odd.value;
        }
        if (odd.total === 1.5 || marketName.includes('1.5')) {
          if (odd.label === 'Over') result.overUnder.over15 = odd.value;
          if (odd.label === 'Under') result.overUnder.under15 = odd.value;
        }
        if (odd.total === 3.5 || marketName.includes('3.5')) {
          if (odd.label === 'Over') result.overUnder.over35 = odd.value;
          if (odd.label === 'Under') result.overUnder.under35 = odd.value;
        }
      });
    }

    if (marketName.includes('both teams') || marketName.includes('btts')) {
      market.odds?.forEach((odd: any) => {
        if (odd.label === 'Yes') result.btts.yes = odd.value;
        if (odd.label === 'No') result.btts.no = odd.value;
      });
    }

    if (marketName.includes('double chance')) {
      market.odds?.forEach((odd: any) => {
        if (odd.label === '1X') result.doubleChance.homeOrDraw = odd.value;
        if (odd.label === 'X2') result.doubleChance.awayOrDraw = odd.value;
        if (odd.label === '12') result.doubleChance.homeOrAway = odd.value;
      });
    }

    if (marketName.includes('half time') || marketName.includes('halftime')) {
      market.odds?.forEach((odd: any) => {
        if (odd.label === '1') result.halfTime.home = odd.value;
        if (odd.label === 'X') result.halfTime.draw = odd.value;
        if (odd.label === '2') result.halfTime.away = odd.value;
      });
    }
  });

  return result;
}

function calculateForm(matches: any[], location: string): any {
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return {
      form: 'N/A',
      points: 0,
      avgGoals: 0,
      avgConceded: 0,
      over25: 0,
      btts: 0,
    };
  }

  const last5 = matches.slice(0, 5);
  let form = '';
  let points = 0;
  let totalGoals = 0;
  let totalConceded = 0;
  let over25Count = 0;
  let bttsCount = 0;

  last5.forEach((match: any) => {
    const homeScore = match.scores?.home || 0;
    const awayScore = match.scores?.away || 0;
    const isHome = match.participant?.meta?.location === 'home';
    const teamGoals = isHome ? homeScore : awayScore;
    const opponentGoals = isHome ? awayScore : homeScore;

    totalGoals += teamGoals;
    totalConceded += opponentGoals;

    if (homeScore + awayScore > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;

    if (teamGoals > opponentGoals) {
      form += 'W';
      points += 3;
    } else if (teamGoals < opponentGoals) {
      form += 'L';
    } else {
      form += 'D';
      points += 1;
    }
  });

  return {
    form,
    points,
    avgGoals: (totalGoals / last5.length).toFixed(1),
    avgConceded: (totalConceded / last5.length).toFixed(1),
    over25: Math.round((over25Count / last5.length) * 100),
    btts: Math.round((bttsCount / last5.length) * 100),
  };
}

function calculateH2H(matches: any[], homeTeamId: number, awayTeamId: number): any {
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return {
      total: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      avgGoals: 0,
      over25Percentage: 0,
      bttsPercentage: 0,
    };
  }

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoals = 0;
  let over25Count = 0;
  let bttsCount = 0;

  matches.forEach((match: any) => {
    const homeScore = match.scores?.home || 0;
    const awayScore = match.scores?.away || 0;
    const total = homeScore + awayScore;

    totalGoals += total;
    if (total > 2.5) over25Count++;
    if (homeScore > 0 && awayScore > 0) bttsCount++;

    const matchHomeTeamId = match.participants?.find((p: any) => p.meta?.location === 'home')?.id;

    if (homeScore > awayScore) {
      if (matchHomeTeamId === homeTeamId) homeWins++;
      else awayWins++;
    } else if (homeScore < awayScore) {
      if (matchHomeTeamId === homeTeamId) awayWins++;
      else homeWins++;
    } else {
      draws++;
    }
  });

  return {
    total: matches.length,
    homeWins,
    awayWins,
    draws,
    avgGoals: (totalGoals / matches.length).toFixed(1),
    over25Percentage: Math.round((over25Count / matches.length) * 100),
    bttsPercentage: Math.round((bttsCount / matches.length) * 100),
  };
}

// ==================== CONSENSUS CALCULATOR ====================

function calculateMegaConsensus(analyses: any[]): any {
  const validAnalyses = analyses.filter((a) => a !== null);

  if (validAnalyses.length === 0) {
    return null;
  }

  const consensus: any = {};
  const fields = [
    'matchResult',
    'overUnder25',
    'overUnder15',
    'overUnder35',
    'btts',
    'doubleChance',
    'halfTimeResult',
    'firstGoal',
    'totalGoalsRange',
    'handicap',
  ];

  fields.forEach((field) => {
    const votes: Record<string, { count: number; totalConfidence: number; reasonings: string[] }> = {};

    validAnalyses.forEach((analysis) => {
      if (analysis[field]?.prediction) {
        const pred = analysis[field].prediction;
        const conf = analysis[field].confidence || 70;
        const reason = analysis[field].reasoning || '';

        if (!votes[pred]) {
          votes[pred] = { count: 0, totalConfidence: 0, reasonings: [] };
        }
        votes[pred].count++;
        votes[pred].totalConfidence += conf;
        if (reason) votes[pred].reasonings.push(reason);
      }
    });

    const sorted = Object.entries(votes).sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return b[1].totalConfidence - a[1].totalConfidence;
    });

    if (sorted.length > 0) {
      const [prediction, data] = sorted[0];
      consensus[field] = {
        prediction,
        confidence: Math.round(data.totalConfidence / data.count),
        votes: data.count,
        totalVotes: validAnalyses.length,
        unanimous: data.count === validAnalyses.length,
        reasoning: data.reasonings[0] || '',
      };
    }
  });

  // Correct Score aggregation
  const correctScores: Record<string, { count: number; confidence: number }> = {};
  validAnalyses.forEach((analysis) => {
    if (analysis.correctScore) {
      ['first', 'second', 'third'].forEach((pos) => {
        const score = analysis.correctScore[pos];
        if (score) {
          if (!correctScores[score]) correctScores[score] = { count: 0, confidence: 0 };
          correctScores[score].count++;
          correctScores[score].confidence += analysis.correctScore.confidence || 50;
        }
      });
    }
  });

  const sortedScores = Object.entries(correctScores)
    .sort((a, b) => b[1].count - a[1].count || b[1].confidence - a[1].confidence)
    .slice(0, 5);

  consensus.correctScore = {
    first: sortedScores[0] ? { score: sortedScores[0][0], confidence: Math.round(sortedScores[0][1].confidence / sortedScores[0][1].count) } : null,
    second: sortedScores[1] ? { score: sortedScores[1][0], confidence: Math.round(sortedScores[1][1].confidence / sortedScores[1][1].count) } : null,
    third: sortedScores[2] ? { score: sortedScores[2][0], confidence: Math.round(sortedScores[2][1].confidence / sortedScores[2][1].count) } : null,
  };

  // Best Bets aggregation
  consensus.bestBets = validAnalyses
    .filter((a) => a.bestBet)
    .map((a) => a.bestBet)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 3);

  // Value Bets aggregation
  consensus.valueBets = validAnalyses
    .filter((a) => a.valueBet)
    .map((a) => a.valueBet)
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 3);

  // Risk Levels
  consensus.riskLevels = validAnalyses
    .filter((a) => a.riskLevel)
    .map((a) => a.riskLevel);

  // Overall Analyses
  consensus.overallAnalyses = validAnalyses
    .filter((a) => a.overallAnalysis)
    .map((a) => a.overallAnalysis);

  // Key Factors
  const allFactors: string[] = [];
  validAnalyses.forEach((a) => {
    if (a.keyFactors) allFactors.push(...a.keyFactors);
  });
  consensus.keyFactors = Array.from(new Set(allFactors)).slice(0, 5);

  // Warnings
  const allWarnings: string[] = [];
  validAnalyses.forEach((a) => {
    if (a.warnings) allWarnings.push(...a.warnings);
  });
  consensus.warnings = Array.from(new Set(allWarnings)).slice(0, 3);

  return consensus;
}

// ==================== MAIN API HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league = 'Unknown League',
      language = 'en',
    } = body;

    if (!fixtureId || !homeTeam || !awayTeam) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('\n🚀 ========== ANALYSIS REQUEST ==========');
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🌍 Language: ${language}`);
    console.log('=========================================\n');

    // Check usage limit
    const today = new Date().toISOString().split('T')[0];
    const { data: profile } = await getSupabase()
      .from('profiles')
      .select('subscription_status, analyses_today, last_analysis_date')
      .eq('email', session.user.email)
      .single();

    const isPro = profile?.subscription_status === 'active';
    const dailyLimit = isPro ? 1000 : 50;
    let analysesToday = profile?.analyses_today || 0;

    if (profile?.last_analysis_date !== today) {
      analysesToday = 0;
    }

    if (analysesToday >= dailyLimit) {
      return NextResponse.json({
        error: language === 'tr' ? 'Günlük limit aşıldı' : 'Daily limit exceeded',
        usage: { count: analysesToday, limit: dailyLimit },
      }, { status: 429 });
    }

    // Check cache
    const cacheKey = `analysis_${fixtureId}_${language}`;
    const { data: cached } = await getSupabase()
      .from('analysis_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log('✅ Returning cached analysis');

      // Update usage
      await supabase
        .from('profiles')
        .update({
          analyses_today: analysesToday + 1,
          last_analysis_date: today,
        })
        .eq('email', session.user.email);

      return NextResponse.json({
        ...cached.data,
        fromCache: true,
        usage: { count: analysesToday + 1, limit: dailyLimit },
      });
    }

    // Fetch match data from multiple sources (hidden)
    console.log('📊 Fetching match data...');
    const { odds, homeForm, awayForm, h2h, extraData } = await fetchMatchData(
      fixtureId,
      homeTeamId,
      awayTeamId
    );

    console.log('✅ Data ready');
    console.log(`📈 Home form: ${homeForm?.form || 'N/A'} | Away form: ${awayForm?.form || 'N/A'}`);
    console.log(`⚔️ H2H: ${h2h?.total || 0} matches`);

    // Generate prompt
    const prompt = getUltraAggressivePrompt(
      language,
      homeTeam,
      awayTeam,
      league,
      odds,
      homeForm,
      awayForm,
      h2h,
      extraData
    );

    console.log(`📝 Prompt length: ${prompt.length} chars`);
    console.log('🤖 Running AI analyses...');

    // Run all AI analyses in parallel
    const [claudeAnalysis, openaiAnalysis, geminiAnalysis, heuristResult] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
      runFullAnalysis(
        { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, date: '', odds, homeForm, awayForm, h2h },
        language as 'tr' | 'en' | 'de'
      ),
    ]);

    const aiStatus = {
      claude: claudeAnalysis ? '✅' : '❌',
      openai: openaiAnalysis ? '✅' : '❌',
      gemini: geminiAnalysis ? '✅' : '❌',
      heurist: heuristResult?.success ? '✅' : '❌',
    };

    console.log('\n📊 AI RESULTS:');
    console.log(`   Claude: ${aiStatus.claude}`);
    console.log(`   GPT-4: ${aiStatus.openai}`);
    console.log(`   Gemini: ${aiStatus.gemini}`);
    console.log(`   Heurist: ${aiStatus.heurist}`);

    // Combine all analyses for consensus
    const allAnalyses = [
      claudeAnalysis,
      openaiAnalysis,
      geminiAnalysis,
      heuristResult?.reports?.consensus,
    ].filter((a) => a !== null);

    console.log(`\n⚖️ Calculating consensus from ${allAnalyses.length} AI analyses...`);
    const consensus = calculateMegaConsensus(allAnalyses);

    if (!consensus) {
      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }

    // Prepare response
    const response = {
      success: true,
      fixture: { id: fixtureId, homeTeam, awayTeam, league },
      odds,
      form: { home: homeForm, away: awayForm },
      h2h,
      analysis: consensus,
      individualAnalyses: {
        claude: claudeAnalysis,
        openai: openaiAnalysis,
        gemini: geminiAnalysis,
        heurist: heuristResult?.reports,
      },
      aiStatus,
      language,
    };

    // Save to cache (24 hour expiration)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await getSupabase().from('analysis_cache').upsert
      cache_key: cacheKey,
      data: response,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

    // Update usage
    await getSupabase()
  .from('profiles')
  .update
   });
        analyses_today: analysesToday + 1,
        last_analysis_date: today,
      })
      .eq('email', session.user.email);

    console.log('✅ Analysis complete! Returning results...\n');

    return NextResponse.json({
      ...response,
      fromCache: false,
      usage: { count: analysesToday + 1, limit: dailyLimit },
    });
  } catch (error: any) {
    console.error('❌ Analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
