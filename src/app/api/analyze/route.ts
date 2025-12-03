import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const DAILY_ANALYSIS_LIMIT = 50;

// ========================
// VERİ ÇEKME FONKSİYONLARI
// ========================

async function fetchFixtureData(fixtureId: number) {
  try {
    const includes = [
      'participants',
      'league',
      'venue',
      'scores',
      'odds.market',
      'odds.bookmaker',
    ].join(';');

    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=${includes}`
    );
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Fixture fetch error:', error);
    return null;
  }
}

async function fetchRecentMatches(teamId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filter=participantIds:${teamId}&include=participants;scores;statistics&per_page=10&order=starting_at&sort=desc`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Recent matches error:', error);
    return [];
  }
}

async function fetchH2H(team1Id: number, team2Id: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores&per_page=10`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('H2H error:', error);
    return [];
  }
}

async function fetchPreMatchOdds(fixtureId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/odds/pre-match/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=market;bookmaker`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Pre-match odds error:', error);
    return [];
  }
}

// ========================
// VERİ İŞLEME FONKSİYONLARI
// ========================

function parseOddsDetailed(preMatchOdds: any[], fixture: any) {
  const result: any = {
    matchWinner: null,
    overUnder: { '1.5': null, '2.5': null, '3.5': null },
    btts: null,
    doubleChance: null,
    halfTime: null,
    correctScore: [],
    drawNoBet: null,
    bookmakers: [],
  };

  if (!fixture) return result;

  const allOdds = fixture.odds || [];
  if (!Array.isArray(allOdds)) return result;

  allOdds.forEach((odd: any) => {
    const marketId = odd.market_id;
    const bookmakerName = odd.bookmaker?.name || 'Unknown';

    if (!result.bookmakers.includes(bookmakerName)) {
      result.bookmakers.push(bookmakerName);
    }

    const values = odd.values || [];

    if (marketId === 1) {
      result.matchWinner = {
        home: values.find((v: any) => v.label === '1')?.value,
        draw: values.find((v: any) => v.label === 'X')?.value,
        away: values.find((v: any) => v.label === '2')?.value,
        bookmaker: bookmakerName,
      };
    }

    if (marketId === 18) {
      result.overUnder['2.5'] = {
        over: values.find((v: any) => v.label === 'Over')?.value,
        under: values.find((v: any) => v.label === 'Under')?.value,
        bookmaker: bookmakerName,
      };
    }

    if (marketId === 28) {
      result.btts = {
        yes: values.find((v: any) => v.label === 'Yes')?.value,
        no: values.find((v: any) => v.label === 'No')?.value,
        bookmaker: bookmakerName,
      };
    }

    if (marketId === 12) {
      result.doubleChance = {
        homeOrDraw: values.find((v: any) => v.label === '1X')?.value,
        awayOrDraw: values.find((v: any) => v.label === 'X2')?.value,
        homeOrAway: values.find((v: any) => v.label === '12')?.value,
        bookmaker: bookmakerName,
      };
    }

    if (marketId === 7) {
      result.halfTime = {
        home: values.find((v: any) => v.label === '1')?.value,
        draw: values.find((v: any) => v.label === 'X')?.value,
        away: values.find((v: any) => v.label === '2')?.value,
        bookmaker: bookmakerName,
      };
    }

    if (marketId === 57 && values.length > 0) {
      result.correctScore = values.slice(0, Math.min(values.length, 10)).map((v: any) => ({
        score: v.label,
        odds: v.value,
      }));
    }
  });

  if (preMatchOdds && Array.isArray(preMatchOdds)) {
    preMatchOdds.forEach((odd: any) => {
      const marketName = odd.market?.name?.toLowerCase() || '';
      const bookmaker = odd.bookmaker?.name || 'Unknown';

      if (!result.bookmakers.includes(bookmaker)) {
        result.bookmakers.push(bookmaker);
      }

      if (!result.matchWinner && marketName.includes('1x2')) {
        result.matchWinner = {
          home: odd.values?.find((v: any) => v.label === '1')?.value,
          draw: odd.values?.find((v: any) => v.label === 'X')?.value,
          away: odd.values?.find((v: any) => v.label === '2')?.value,
          bookmaker,
        };
      }

      if (!result.overUnder['2.5'] && marketName.includes('over')) {
        result.overUnder['2.5'] = {
          over: odd.values?.find((v: any) => v.label === 'Over')?.value,
          under: odd.values?.find((v: any) => v.label === 'Under')?.value,
          bookmaker,
        };
      }

      if (!result.btts && marketName.includes('both')) {
        result.btts = {
          yes: odd.values?.find((v: any) => v.label === 'Yes')?.value,
          no: odd.values?.find((v: any) => v.label === 'No')?.value,
          bookmaker,
        };
      }
    });
  }

  return result;
}

function calculateDetailedForm(matches: any[], teamId: number) {
  if (!matches || matches.length === 0) {
    return {
      form: 'N/A',
      points: 0,
      avgGoals: '0.00',
      avgConceded: '0.00',
      wins: 0,
      draws: 0,
      losses: 0,
      cleanSheets: 0,
      failedToScore: 0,
      over25: 0,
      bttsYes: 0,
      over25Percentage: '0',
      bttsPercentage: '0',
      cleanSheetPercentage: '0',
      matches: [],
    };
  }

  let points = 0;
  let goals = 0;
  let conceded = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let cleanSheets = 0;
  let failedToScore = 0;
  let over25 = 0;
  let bttsYes = 0;
  const formArray: string[] = [];
  const matchDetails: any[] = [];

  matches.slice(0, 10).forEach((match: any) => {
    const scores = match.scores || [];
    const participants = match.participants || [];
    
    let homeScore = 0;
    let awayScore = 0;
    
    scores.forEach((s: any) => {
      if (s.description === 'CURRENT') {
        if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
        if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
      }
    });

    const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
    const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
    const isHome = homeTeam?.id === teamId;
    
    const teamGoals = isHome ? homeScore : awayScore;
    const oppGoals = isHome ? awayScore : homeScore;
    const totalGoals = homeScore + awayScore;

    goals += teamGoals;
    conceded += oppGoals;

    if (totalGoals > 2.5) over25++;
    if (homeScore > 0 && awayScore > 0) bttsYes++;
    if (oppGoals === 0) cleanSheets++;
    if (teamGoals === 0) failedToScore++;

    if (teamGoals > oppGoals) {
      points += 3;
      wins++;
      formArray.push('W');
    } else if (teamGoals === oppGoals) {
      points += 1;
      draws++;
      formArray.push('D');
    } else {
      losses++;
      formArray.push('L');
    }

    matchDetails.push({
      opponent: isHome ? awayTeam?.name : homeTeam?.name,
      score: `${homeScore}-${awayScore}`,
      result: teamGoals > oppGoals ? 'W' : teamGoals === oppGoals ? 'D' : 'L',
      home: isHome,
    });
  });

  const matchCount = Math.max(formArray.length, 1);

  return {
    form: formArray.slice(0, 5).join(''),
    points,
    avgGoals: (goals / matchCount).toFixed(2),
    avgConceded: (conceded / matchCount).toFixed(2),
    wins,
    draws,
    losses,
    cleanSheets,
    failedToScore,
    over25,
    bttsYes,
    over25Percentage: ((over25 / matchCount) * 100).toFixed(0),
    bttsPercentage: ((bttsYes / matchCount) * 100).toFixed(0),
    cleanSheetPercentage: ((cleanSheets / matchCount) * 100).toFixed(0),
    matches: matchDetails.slice(0, 5),
  };
}

function analyzeH2H(h2hMatches: any[], homeTeamId: number, awayTeamId: number) {
  if (!h2hMatches || h2hMatches.length === 0) {
    return {
      totalMatches: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      avgGoals: '0.00',
      over25: 0,
      bttsYes: 0,
      over25Percentage: '0',
      bttsPercentage: '0',
      matches: [],
    };
  }

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoals = 0;
  let over25 = 0;
  let bttsYes = 0;
  const matchDetails: any[] = [];

  h2hMatches.forEach((match: any) => {
    const scores = match.scores || [];
    const participants = match.participants || [];

    let homeScore = 0;
    let awayScore = 0;

    scores.forEach((s: any) => {
      if (s.description === 'CURRENT') {
        if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
        if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
      }
    });

    const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
    const awayTeam = participants.find((p: any) => p.meta?.location === 'away');

    totalGoals += homeScore + awayScore;
    if (homeScore + awayScore > 2.5) over25++;
    if (homeScore > 0 && awayScore > 0) bttsYes++;

    const homeIsOurHome = homeTeam?.id === homeTeamId;
    if (homeScore > awayScore) {
      if (homeIsOurHome) homeWins++;
      else awayWins++;
    } else if (homeScore < awayScore) {
      if (homeIsOurHome) awayWins++;
      else homeWins++;
    } else {
      draws++;
    }

    matchDetails.push({
      home: homeTeam?.name,
      away: awayTeam?.name,
      score: `${homeScore}-${awayScore}`,
    });
  });

  const matchCount = Math.max(h2hMatches.length, 1);

  return {
    totalMatches: h2hMatches.length,
    homeWins,
    awayWins,
    draws,
    avgGoals: (totalGoals / matchCount).toFixed(2),
    over25,
    bttsYes,
    over25Percentage: ((over25 / matchCount) * 100).toFixed(0),
    bttsPercentage: ((bttsYes / matchCount) * 100).toFixed(0),
    matches: matchDetails.slice(0, 5),
  };
}

// ========================
// AGRESİF AI PROMPT - 3 DİL DESTEKLİ
// ========================

function createAggressivePrompt(data: any, language: string = 'en') {
  const { homeTeam, awayTeam, odds, homeForm, awayForm, h2h, fixture } = data;

  // ===== TÜRKÇE PROMPT =====
  const turkishPrompt = `🔥🔥🔥 SEN DÜNYANIN EN İYİ FUTBOL ANALİSTİSİN! 🔥🔥🔥

⚠️⚠️⚠️ KRİTİK: TÜM YANITLARIN TÜRKÇE OLMALI! ⚠️⚠️⚠️

Sen bahis şirketlerinin korktuğu, %85+ başarı oranıyla tanınan efsanevi bir analistsin.
Tahminlerin KESİN, NET ve AGRESİF olmalı. Belirsizlik YASAK!

🏟️ MAÇ: ${homeTeam} vs ${awayTeam}
📅 Tarih: ${fixture?.starting_at || 'N/A'}
🏆 Lig: ${fixture?.league?.name || 'N/A'}

📊 BAHİS ORANLARI:
- 1X2: Ev=${odds?.matchWinner?.home || 'N/A'} | Beraberlik=${odds?.matchWinner?.draw || 'N/A'} | Deplasman=${odds?.matchWinner?.away || 'N/A'}
- Üst/Alt 2.5: Üst=${odds?.overUnder?.['2.5']?.over || 'N/A'} | Alt=${odds?.overUnder?.['2.5']?.under || 'N/A'}
- KG: Var=${odds?.btts?.yes || 'N/A'} | Yok=${odds?.btts?.no || 'N/A'}
- Çifte Şans: 1X=${odds?.doubleChance?.homeOrDraw || 'N/A'} | X2=${odds?.doubleChance?.awayOrDraw || 'N/A'} | 12=${odds?.doubleChance?.homeOrAway || 'N/A'}
- İlk Yarı: 1=${odds?.halfTime?.home || 'N/A'} | X=${odds?.halfTime?.draw || 'N/A'} | 2=${odds?.halfTime?.away || 'N/A'}

📈 ${homeTeam} FORM (Son 10 Maç):
- Form: ${homeForm?.form || 'N/A'} | Puan: ${homeForm?.points || 0}/30
- Galibiyet: ${homeForm?.wins || 0} | Beraberlik: ${homeForm?.draws || 0} | Mağlubiyet: ${homeForm?.losses || 0}
- Attığı Gol Ort: ${homeForm?.avgGoals || '0'} | Yediği Gol Ort: ${homeForm?.avgConceded || '0'}
- Üst 2.5 Oranı: %${homeForm?.over25Percentage || 0} | KG Oranı: %${homeForm?.bttsPercentage || 0}
- Gol Yemeden: %${homeForm?.cleanSheetPercentage || 0}
- Son Maçlar: ${homeForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(', ') || 'N/A'}

📉 ${awayTeam} FORM (Son 10 Maç):
- Form: ${awayForm?.form || 'N/A'} | Puan: ${awayForm?.points || 0}/30
- Galibiyet: ${awayForm?.wins || 0} | Beraberlik: ${awayForm?.draws || 0} | Mağlubiyet: ${awayForm?.losses || 0}
- Attığı Gol Ort: ${awayForm?.avgGoals || '0'} | Yediği Gol Ort: ${awayForm?.avgConceded || '0'}
- Üst 2.5 Oranı: %${awayForm?.over25Percentage || 0} | KG Oranı: %${awayForm?.bttsPercentage || 0}
- Gol Yemeden: %${awayForm?.cleanSheetPercentage || 0}
- Son Maçlar: ${awayForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(', ') || 'N/A'}

⚔️ KAFA KAFAYA (Son ${h2h?.totalMatches || 0} Maç):
- ${homeTeam}: ${h2h?.homeWins || 0} Galibiyet | Beraberlik: ${h2h?.draws || 0} | ${awayTeam}: ${h2h?.awayWins || 0} Galibiyet
- Ortalama Gol: ${h2h?.avgGoals || '0'} | Üst 2.5: %${h2h?.over25Percentage || 0} | KG: %${h2h?.bttsPercentage || 0}
- Son Maçlar: ${h2h?.matches?.map((m: any) => `${m.home} ${m.score} ${m.away}`).join(' | ') || 'N/A'}

🎯 ANALİZ GÖREVİN:
Yukarıdaki verileri kullanarak 12 bahis tipini analiz et. Her tahmin KESİN olmalı!

⚠️ ZORUNLU KURALLAR:
1. "Belki", "olabilir", "muhtemel" kelimeleri YASAK!
2. Her güven yüzdesi EN AZ %65 olmalı!
3. Value bet varsa MUTLAKA belirt!
4. Tüm açıklamalar TÜRKÇE olmalı!
5. SADECE JSON formatında yanıt ver!

📝 JSON FORMATI:
{
  "matchResult": {"prediction": "1 veya X veya 2", "confidence": 70, "reasoning": "TÜRKÇE açıklama - neden bu tahmin", "value": true/false},
  "overUnder25": {"prediction": "Over veya Under", "confidence": 72, "reasoning": "TÜRKÇE açıklama", "value": true/false},
  "btts": {"prediction": "Yes veya No", "confidence": 68, "reasoning": "TÜRKÇE açıklama", "value": true/false},
  "doubleChance": {"prediction": "1X veya X2 veya 12", "confidence": 80, "reasoning": "TÜRKÇE açıklama"},
  "halfTimeResult": {"prediction": "1 veya X veya 2", "confidence": 65, "reasoning": "TÜRKÇE açıklama"},
  "correctScore": {
    "first": {"score": "2-1", "confidence": 18, "reasoning": "TÜRKÇE neden bu skor"},
    "second": {"score": "1-1", "confidence": 15, "reasoning": "TÜRKÇE neden"},
    "third": {"score": "1-0", "confidence": 12, "reasoning": "TÜRKÇE neden"}
  },
  "totalGoalsRange": {"prediction": "0-1 veya 2-3 veya 4-5 veya 6+", "confidence": 70, "reasoning": "TÜRKÇE açıklama"},
  "firstGoal": {"prediction": "Home veya Away veya No Goal", "confidence": 65, "reasoning": "TÜRKÇE açıklama"},
  "handicap": {"team": "Takım adı", "line": "-1.5 veya +1.5", "confidence": 68, "reasoning": "TÜRKÇE açıklama"},
  "overUnder15": {"prediction": "Over veya Under", "confidence": 75, "reasoning": "TÜRKÇE açıklama"},
  "overUnder35": {"prediction": "Over veya Under", "confidence": 65, "reasoning": "TÜRKÇE açıklama"},
  "starPlayer": {"name": "Oyuncu adı", "team": "Takım", "reason": "TÜRKÇE neden fark yaratacak"},
  "overallAnalysis": "TÜRKÇE 3-4 cümlelik kapsamlı maç değerlendirmesi",
  "bestBet": {"type": "Bahis tipi", "prediction": "Tahmin", "confidence": 82, "reasoning": "TÜRKÇE neden bu en iyi bahis", "stake": "1-5 arası birim"},
  "riskLevel": "Düşük veya Orta veya Yüksek",
  "keyFactors": ["TÜRKÇE faktör 1", "TÜRKÇE faktör 2", "TÜRKÇE faktör 3"],
  "warnings": ["TÜRKÇE uyarı 1", "TÜRKÇE uyarı 2"]
}

⚠️⚠️⚠️ SADECE JSON DÖNDÜR! TÜM METİNLER TÜRKÇE OLMALI! ⚠️⚠️⚠️`;

  // ===== ENGLISH PROMPT =====
  const englishPrompt = `🔥🔥🔥 YOU ARE THE WORLD'S BEST FOOTBALL ANALYST! 🔥🔥🔥

⚠️⚠️⚠️ CRITICAL: ALL YOUR RESPONSES MUST BE IN ENGLISH! ⚠️⚠️⚠️

You are a legendary analyst with 85%+ success rate that bookmakers fear.
Your predictions must be DEFINITE, CLEAR, and AGGRESSIVE. Uncertainty is FORBIDDEN!

🏟️ MATCH: ${homeTeam} vs ${awayTeam}
📅 Date: ${fixture?.starting_at || 'N/A'}
🏆 League: ${fixture?.league?.name || 'N/A'}

📊 BETTING ODDS:
- 1X2: Home=${odds?.matchWinner?.home || 'N/A'} | Draw=${odds?.matchWinner?.draw || 'N/A'} | Away=${odds?.matchWinner?.away || 'N/A'}
- Over/Under 2.5: Over=${odds?.overUnder?.['2.5']?.over || 'N/A'} | Under=${odds?.overUnder?.['2.5']?.under || 'N/A'}
- BTTS: Yes=${odds?.btts?.yes || 'N/A'} | No=${odds?.btts?.no || 'N/A'}
- Double Chance: 1X=${odds?.doubleChance?.homeOrDraw || 'N/A'} | X2=${odds?.doubleChance?.awayOrDraw || 'N/A'} | 12=${odds?.doubleChance?.homeOrAway || 'N/A'}
- Half Time: 1=${odds?.halfTime?.home || 'N/A'} | X=${odds?.halfTime?.draw || 'N/A'} | 2=${odds?.halfTime?.away || 'N/A'}

📈 ${homeTeam} FORM (Last 10 Matches):
- Form: ${homeForm?.form || 'N/A'} | Points: ${homeForm?.points || 0}/30
- Wins: ${homeForm?.wins || 0} | Draws: ${homeForm?.draws || 0} | Losses: ${homeForm?.losses || 0}
- Goals Scored Avg: ${homeForm?.avgGoals || '0'} | Goals Conceded Avg: ${homeForm?.avgConceded || '0'}
- Over 2.5 Rate: ${homeForm?.over25Percentage || 0}% | BTTS Rate: ${homeForm?.bttsPercentage || 0}%
- Clean Sheet Rate: ${homeForm?.cleanSheetPercentage || 0}%
- Recent Matches: ${homeForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(', ') || 'N/A'}

📉 ${awayTeam} FORM (Last 10 Matches):
- Form: ${awayForm?.form || 'N/A'} | Points: ${awayForm?.points || 0}/30
- Wins: ${awayForm?.wins || 0} | Draws: ${awayForm?.draws || 0} | Losses: ${awayForm?.losses || 0}
- Goals Scored Avg: ${awayForm?.avgGoals || '0'} | Goals Conceded Avg: ${awayForm?.avgConceded || '0'}
- Over 2.5 Rate: ${awayForm?.over25Percentage || 0}% | BTTS Rate: ${awayForm?.bttsPercentage || 0}%
- Clean Sheet Rate: ${awayForm?.cleanSheetPercentage || 0}%
- Recent Matches: ${awayForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(', ') || 'N/A'}

⚔️ HEAD TO HEAD (Last ${h2h?.totalMatches || 0} Matches):
- ${homeTeam}: ${h2h?.homeWins || 0} Wins | Draws: ${h2h?.draws || 0} | ${awayTeam}: ${h2h?.awayWins || 0} Wins
- Average Goals: ${h2h?.avgGoals || '0'} | Over 2.5: ${h2h?.over25Percentage || 0}% | BTTS: ${h2h?.bttsPercentage || 0}%
- Recent Matches: ${h2h?.matches?.map((m: any) => `${m.home} ${m.score} ${m.away}`).join(' | ') || 'N/A'}

🎯 YOUR TASK:
Analyze 12 bet types using the data above. Every prediction must be DEFINITE!

⚠️ MANDATORY RULES:
1. Words like "maybe", "possibly", "might" are FORBIDDEN!
2. Every confidence must be AT LEAST 65%!
3. If there's value, you MUST indicate it!
4. ALL explanations MUST be in ENGLISH!
5. Respond ONLY in JSON format!

📝 JSON FORMAT:
{
  "matchResult": {"prediction": "1 or X or 2", "confidence": 70, "reasoning": "ENGLISH explanation - why this prediction", "value": true/false},
  "overUnder25": {"prediction": "Over or Under", "confidence": 72, "reasoning": "ENGLISH explanation", "value": true/false},
  "btts": {"prediction": "Yes or No", "confidence": 68, "reasoning": "ENGLISH explanation", "value": true/false},
  "doubleChance": {"prediction": "1X or X2 or 12", "confidence": 80, "reasoning": "ENGLISH explanation"},
  "halfTimeResult": {"prediction": "1 or X or 2", "confidence": 65, "reasoning": "ENGLISH explanation"},
  "correctScore": {
    "first": {"score": "2-1", "confidence": 18, "reasoning": "ENGLISH why this score"},
    "second": {"score": "1-1", "confidence": 15, "reasoning": "ENGLISH why"},
    "third": {"score": "1-0", "confidence": 12, "reasoning": "ENGLISH why"}
  },
  "totalGoalsRange": {"prediction": "0-1 or 2-3 or 4-5 or 6+", "confidence": 70, "reasoning": "ENGLISH explanation"},
  "firstGoal": {"prediction": "Home or Away or No Goal", "confidence": 65, "reasoning": "ENGLISH explanation"},
  "handicap": {"team": "Team name", "line": "-1.5 or +1.5", "confidence": 68, "reasoning": "ENGLISH explanation"},
  "overUnder15": {"prediction": "Over or Under", "confidence": 75, "reasoning": "ENGLISH explanation"},
  "overUnder35": {"prediction": "Over or Under", "confidence": 65, "reasoning": "ENGLISH explanation"},
  "starPlayer": {"name": "Player name", "team": "Team", "reason": "ENGLISH why will make difference"},
  "overallAnalysis": "ENGLISH 3-4 sentence comprehensive match evaluation",
  "bestBet": {"type": "Bet type", "prediction": "Prediction", "confidence": 82, "reasoning": "ENGLISH why this is best bet", "stake": "1-5 units"},
  "riskLevel": "Low or Medium or High",
  "keyFactors": ["ENGLISH factor 1", "ENGLISH factor 2", "ENGLISH factor 3"],
  "warnings": ["ENGLISH warning 1", "ENGLISH warning 2"]
}

⚠️⚠️⚠️ RETURN ONLY JSON! ALL TEXT MUST BE IN ENGLISH! ⚠️⚠️⚠️`;

  // ===== GERMAN PROMPT =====
  const germanPrompt = `🔥🔥🔥 DU BIST DER BESTE FUßBALLANALYST DER WELT! 🔥🔥🔥

⚠️⚠️⚠️ KRITISCH: ALLE DEINE ANTWORTEN MÜSSEN AUF DEUTSCH SEIN! ⚠️⚠️⚠️

Du bist ein legendärer Analyst mit über 85% Erfolgsquote, den die Buchmacher fürchten.
Deine Vorhersagen müssen DEFINITIV, KLAR und AGGRESSIV sein. Unsicherheit ist VERBOTEN!

🏟️ SPIEL: ${homeTeam} vs ${awayTeam}
📅 Datum: ${fixture?.starting_at || 'N/A'}
🏆 Liga: ${fixture?.league?.name || 'N/A'}

📊 WETTQUOTEN:
- 1X2: Heim=${odds?.matchWinner?.home || 'N/A'} | Unentschieden=${odds?.matchWinner?.draw || 'N/A'} | Auswärts=${odds?.matchWinner?.away || 'N/A'}
- Über/Unter 2.5: Über=${odds?.overUnder?.['2.5']?.over || 'N/A'} | Unter=${odds?.overUnder?.['2.5']?.under || 'N/A'}
- Beide treffen: Ja=${odds?.btts?.yes || 'N/A'} | Nein=${odds?.btts?.no || 'N/A'}
- Doppelte Chance: 1X=${odds?.doubleChance?.homeOrDraw || 'N/A'} | X2=${odds?.doubleChance?.awayOrDraw || 'N/A'} | 12=${odds?.doubleChance?.homeOrAway || 'N/A'}
- Halbzeit: 1=${odds?.halfTime?.home || 'N/A'} | X=${odds?.halfTime?.draw || 'N/A'} | 2=${odds?.halfTime?.away || 'N/A'}

📈 ${homeTeam} FORM (Letzte 10 Spiele):
- Form: ${homeForm?.form || 'N/A'} | Punkte: ${homeForm?.points || 0}/30
- Siege: ${homeForm?.wins || 0} | Unentschieden: ${homeForm?.draws || 0} | Niederlagen: ${homeForm?.losses || 0}
- Tore geschossen Ø: ${homeForm?.avgGoals || '0'} | Gegentore Ø: ${homeForm?.avgConceded || '0'}
- Über 2.5 Quote: ${homeForm?.over25Percentage || 0}% | Beide treffen Quote: ${homeForm?.bttsPercentage || 0}%
- Ohne Gegentor: ${homeForm?.cleanSheetPercentage || 0}%
- Letzte Spiele: ${homeForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(', ') || 'N/A'}

📉 ${awayTeam} FORM (Letzte 10 Spiele):
- Form: ${awayForm?.form || 'N/A'} | Punkte: ${awayForm?.points || 0}/30
- Siege: ${awayForm?.wins || 0} | Unentschieden: ${awayForm?.draws || 0} | Niederlagen: ${awayForm?.losses || 0}
- Tore geschossen Ø: ${awayForm?.avgGoals || '0'} | Gegentore Ø: ${awayForm?.avgConceded || '0'}
- Über 2.5 Quote: ${awayForm?.over25Percentage || 0}% | Beide treffen Quote: ${awayForm?.bttsPercentage || 0}%
- Ohne Gegentor: ${awayForm?.cleanSheetPercentage || 0}%
- Letzte Spiele: ${awayForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(', ') || 'N/A'}

⚔️ DIREKTER VERGLEICH (Letzte ${h2h?.totalMatches || 0} Spiele):
- ${homeTeam}: ${h2h?.homeWins || 0} Siege | Unentschieden: ${h2h?.draws || 0} | ${awayTeam}: ${h2h?.awayWins || 0} Siege
- Durchschnittliche Tore: ${h2h?.avgGoals || '0'} | Über 2.5: ${h2h?.over25Percentage || 0}% | Beide treffen: ${h2h?.bttsPercentage || 0}%
- Letzte Spiele: ${h2h?.matches?.map((m: any) => `${m.home} ${m.score} ${m.away}`).join(' | ') || 'N/A'}

🎯 DEINE AUFGABE:
Analysiere 12 Wettarten mit den obigen Daten. Jede Vorhersage muss DEFINITIV sein!

⚠️ PFLICHTREGELN:
1. Wörter wie "vielleicht", "möglicherweise", "könnte" sind VERBOTEN!
2. Jede Konfidenz muss MINDESTENS 65% sein!
3. Wenn es einen Value gibt, MUSST du ihn angeben!
4. ALLE Erklärungen MÜSSEN auf DEUTSCH sein!
5. Antworte NUR im JSON-Format!

📝 JSON FORMAT:
{
  "matchResult": {"prediction": "1 oder X oder 2", "confidence": 70, "reasoning": "DEUTSCHE Erklärung - warum diese Vorhersage", "value": true/false},
  "overUnder25": {"prediction": "Over oder Under", "confidence": 72, "reasoning": "DEUTSCHE Erklärung", "value": true/false},
  "btts": {"prediction": "Yes oder No", "confidence": 68, "reasoning": "DEUTSCHE Erklärung", "value": true/false},
  "doubleChance": {"prediction": "1X oder X2 oder 12", "confidence": 80, "reasoning": "DEUTSCHE Erklärung"},
  "halfTimeResult": {"prediction": "1 oder X oder 2", "confidence": 65, "reasoning": "DEUTSCHE Erklärung"},
  "correctScore": {
    "first": {"score": "2-1", "confidence": 18, "reasoning": "DEUTSCH warum dieses Ergebnis"},
    "second": {"score": "1-1", "confidence": 15, "reasoning": "DEUTSCH warum"},
    "third": {"score": "1-0", "confidence": 12, "reasoning": "DEUTSCH warum"}
  },
  "totalGoalsRange": {"prediction": "0-1 oder 2-3 oder 4-5 oder 6+", "confidence": 70, "reasoning": "DEUTSCHE Erklärung"},
  "firstGoal": {"prediction": "Home oder Away oder No Goal", "confidence": 65, "reasoning": "DEUTSCHE Erklärung"},
  "handicap": {"team": "Teamname", "line": "-1.5 oder +1.5", "confidence": 68, "reasoning": "DEUTSCHE Erklärung"},
  "overUnder15": {"prediction": "Over oder Under", "confidence": 75, "reasoning": "DEUTSCHE Erklärung"},
  "overUnder35": {"prediction": "Over oder Under", "confidence": 65, "reasoning": "DEUTSCHE Erklärung"},
  "starPlayer": {"name": "Spielername", "team": "Team", "reason": "DEUTSCH warum er den Unterschied macht"},
  "overallAnalysis": "DEUTSCHE 3-4 Sätze umfassende Spielbewertung",
  "bestBet": {"type": "Wettart", "prediction": "Vorhersage", "confidence": 82, "reasoning": "DEUTSCH warum dies die beste Wette ist", "stake": "1-5 Einheiten"},
  "riskLevel": "Niedrig oder Mittel oder Hoch",
  "keyFactors": ["DEUTSCHER Faktor 1", "DEUTSCHER Faktor 2", "DEUTSCHER Faktor 3"],
  "warnings": ["DEUTSCHE Warnung 1", "DEUTSCHE Warnung 2"]
}

⚠️⚠️⚠️ GIB NUR JSON ZURÜCK! ALLE TEXTE MÜSSEN AUF DEUTSCH SEIN! ⚠️⚠️⚠️`;

  // Dile göre prompt seç
  if (language === 'tr') return turkishPrompt;
  if (language === 'de') return germanPrompt;
  return englishPrompt;
}

// ========================
// AI ANALİZ FONKSİYONLARI
// ========================

async function analyzeWithClaude(prompt: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('Claude error:', error);
    return null;
  }
}

async function analyzeWithOpenAI(prompt: string) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
    });
    const text = response.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

async function analyzeWithGemini(prompt: string) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

// ========================
// CONSENSUS HESAPLAMA
// ========================

function calculateConsensus(analyses: any[]) {
  const validAnalyses = analyses.filter(a => a !== null);
  if (validAnalyses.length === 0) return null;

  const consensus: any = {};
  const fields = [
    'matchResult', 'overUnder25', 'btts', 'doubleChance', 
    'halfTimeResult', 'totalGoalsRange', 'firstGoal',
    'overUnder15', 'overUnder35', 'handicap'
  ];

  fields.forEach(field => {
    const predictions: Record<string, { count: number; totalConfidence: number; reasonings: string[] }> = {};

    validAnalyses.forEach(analysis => {
      if (analysis[field]?.prediction) {
        const pred = String(analysis[field].prediction);
        if (!predictions[pred]) {
          predictions[pred] = { count: 0, totalConfidence: 0, reasonings: [] };
        }
        predictions[pred].count++;
        predictions[pred].totalConfidence += analysis[field].confidence || 0;
        if (analysis[field].reasoning) {
          predictions[pred].reasonings.push(analysis[field].reasoning);
        }
      }
    });

    if (Object.keys(predictions).length > 0) {
      const sortedPreds = Object.entries(predictions)
        .sort((a, b) => b[1].count - a[1].count || b[1].totalConfidence - a[1].totalConfidence);
      
      const [winner, data] = sortedPreds[0];
      const avgConfidence = Math.round(data.totalConfidence / data.count);

      consensus[field] = {
        prediction: winner,
        confidence: avgConfidence,
        votes: data.count,
        totalVotes: validAnalyses.length,
        unanimous: data.count === validAnalyses.length,
        reasoning: data.reasonings[0] || '',
      };
    }
  });

  const correctScores: Record<string, { count: number; totalConfidence: number }> = {};
  validAnalyses.forEach(analysis => {
    if (analysis.correctScore) {
      ['first', 'second', 'third'].forEach(pos => {
        if (analysis.correctScore[pos]?.score) {
          const score = analysis.correctScore[pos].score;
          if (!correctScores[score]) {
            correctScores[score] = { count: 0, totalConfidence: 0 };
          }
          correctScores[score].count++;
          correctScores[score].totalConfidence += analysis.correctScore[pos].confidence || 0;
        }
      });
    }
  });

  const sortedScores = Object.entries(correctScores)
    .sort((a, b) => b[1].count - a[1].count || b[1].totalConfidence - a[1].totalConfidence)
    .slice(0, 5);

  consensus.correctScore = {
    first: sortedScores[0] ? { score: sortedScores[0][0], confidence: Math.round(sortedScores[0][1].totalConfidence / sortedScores[0][1].count), votes: sortedScores[0][1].count } : null,
    second: sortedScores[1] ? { score: sortedScores[1][0], confidence: Math.round(sortedScores[1][1].totalConfidence / sortedScores[1][1].count), votes: sortedScores[1][1].count } : null,
    third: sortedScores[2] ? { score: sortedScores[2][0], confidence: Math.round(sortedScores[2][1].totalConfidence / sortedScores[2][1].count), votes: sortedScores[2][1].count } : null,
  };

  consensus.aiCount = validAnalyses.length;
  consensus.bestBets = validAnalyses.map(a => a?.bestBet).filter(Boolean);
  consensus.starPlayers = validAnalyses.map(a => a?.starPlayer).filter(Boolean);
  consensus.riskLevels = validAnalyses.map(a => a?.riskLevel).filter(Boolean);
  consensus.overallAnalyses = validAnalyses.map(a => a?.overallAnalysis).filter(Boolean);
  consensus.keyFactors = Array.from(new Set(validAnalyses.flatMap(a => a?.keyFactors || [])));
  consensus.warnings = Array.from(new Set(validAnalyses.flatMap(a => a?.warnings || [])));

  return consensus;
}

// ========================
// CACHE FONKSİYONLARI
// ========================

async function getCachedAnalysis(fixtureId: number, language: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('language', language)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function cacheAnalysis(
  fixtureId: number,
  homeTeam: string,
  awayTeam: string,
  analysisData: any,
  oddsData: any,
  formData: any,
  language: string,
  league?: string,
  matchDate?: string
) {
  try {
    await supabaseAdmin
      .from('analyses')
      .upsert({
        fixture_id: fixtureId,
        home_team: homeTeam,
        away_team: awayTeam,
        match_date: matchDate,
        league: league,
        analysis_data: analysisData,
        odds_data: oddsData,
        form_data: formData,
        language: language,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, {
        onConflict: 'fixture_id',
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

async function addToUserHistory(userId: string, fixtureId: number, homeTeam: string, awayTeam: string) {
  try {
    await supabaseAdmin
      .from('user_analyses')
      .upsert({
        user_id: userId,
        fixture_id: fixtureId,
        home_team: homeTeam,
        away_team: awayTeam,
        viewed_at: new Date().toISOString(),
        is_favorite: false,
      }, {
        onConflict: 'user_id,fixture_id',
        ignoreDuplicates: false,
      });
  } catch (error) {
    console.error('User history error:', error);
  }
}

async function checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: existing } = await supabaseAdmin
      .from('user_daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing) {
      if (existing.analysis_count >= DAILY_ANALYSIS_LIMIT) {
        return { allowed: false, count: existing.analysis_count, limit: DAILY_ANALYSIS_LIMIT };
      }

      await supabaseAdmin
        .from('user_daily_usage')
        .update({ analysis_count: existing.analysis_count + 1 })
        .eq('id', existing.id);

      return { allowed: true, count: existing.analysis_count + 1, limit: DAILY_ANALYSIS_LIMIT };
    } else {
      await supabaseAdmin
        .from('user_daily_usage')
        .insert({ user_id: userId, date: today, analysis_count: 1 });

      return { allowed: true, count: 1, limit: DAILY_ANALYSIS_LIMIT };
    }
  } catch (error) {
    console.error('Usage check error:', error);
    return { allowed: true, count: 0, limit: DAILY_ANALYSIS_LIMIT };
  }
}

// ========================
// ANA API ROUTE
// ========================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, language = 'en' } = body;

    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
    }

    // 1. Cache kontrol
    const cached = await getCachedAnalysis(fixtureId, language);
    if (cached) {
      await addToUserHistory(userId, fixtureId, cached.home_team, cached.away_team);
      return NextResponse.json({
        success: true,
        fromCache: true,
        fixture: { id: fixtureId, homeTeam: cached.home_team, awayTeam: cached.away_team },
        odds: cached.odds_data,
        form: cached.form_data,
        analysis: cached.analysis_data,
        aiStatus: { claude: '✅', openai: '✅', gemini: '✅' },
        language,
      });
    }

    // 2. Günlük limit kontrolü
    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Daily limit reached (${usage.count}/${usage.limit})`,
        limitReached: true,
        usage,
      }, { status: 429 });
    }

    // 3. Verileri paralel çek
    const [fixture, homeRecentMatches, awayRecentMatches, h2hMatches, preMatchOdds] = await Promise.all([
      fetchFixtureData(fixtureId),
      homeTeamId ? fetchRecentMatches(homeTeamId) : Promise.resolve([]),
      awayTeamId ? fetchRecentMatches(awayTeamId) : Promise.resolve([]),
      homeTeamId && awayTeamId ? fetchH2H(homeTeamId, awayTeamId) : Promise.resolve([]),
      fetchPreMatchOdds(fixtureId),
    ]);

    const homeTeamName = fixture?.participants?.find((p: any) => p.meta?.location === 'home')?.name || homeTeam || 'Home Team';
    const awayTeamName = fixture?.participants?.find((p: any) => p.meta?.location === 'away')?.name || awayTeam || 'Away Team';

    const odds = parseOddsDetailed(preMatchOdds, fixture);
    const homeForm = calculateDetailedForm(homeRecentMatches, homeTeamId);
    const awayForm = calculateDetailedForm(awayRecentMatches, awayTeamId);
    const h2h = analyzeH2H(h2hMatches, homeTeamId, awayTeamId);

    // 4. AI Prompt
    const prompt = createAggressivePrompt({
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      odds,
      homeForm,
      awayForm,
      h2h,
      fixture,
    }, language);

    // 5. 3 AI'dan paralel analiz
    const [claudeAnalysis, openaiAnalysis, geminiAnalysis] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
    ]);

    // 6. Consensus hesapla
    const consensus = calculateConsensus([claudeAnalysis, openaiAnalysis, geminiAnalysis]);

    const aiStatus = {
      claude: claudeAnalysis ? '✅' : '❌',
      openai: openaiAnalysis ? '✅' : '❌',
      gemini: geminiAnalysis ? '✅' : '❌',
    };

    const formData = { home: homeForm, away: awayForm };

    // 7. Cache'e kaydet
    await cacheAnalysis(
      fixtureId,
      homeTeamName,
      awayTeamName,
      consensus,
      odds,
      formData,
      language,
      fixture?.league?.name,
      fixture?.starting_at
    );

    // 8. Kullanıcı geçmişine ekle
    await addToUserHistory(userId, fixtureId, homeTeamName, awayTeamName);

    return NextResponse.json({
      success: true,
      fromCache: false,
      fixture: { 
        id: fixtureId, 
        homeTeam: homeTeamName, 
        awayTeam: awayTeamName,
        league: fixture?.league?.name,
        date: fixture?.starting_at,
      },
      odds,
      form: formData,
      h2h,
      analysis: consensus,
      individualAnalyses: { claude: claudeAnalysis, openai: openaiAnalysis, gemini: geminiAnalysis },
      aiStatus,
      language,
      usage: { count: usage.count, limit: usage.limit },
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Analysis error: ' + error.message }, { status: 500 });
  }
}
