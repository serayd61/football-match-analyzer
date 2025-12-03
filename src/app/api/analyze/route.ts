import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';

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
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;scores;odds.market;odds.bookmaker`
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
// VERİ İŞLEME
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
    if (!result.bookmakers.includes(bookmakerName)) result.bookmakers.push(bookmakerName);
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
      };
    }
    if (marketId === 28) {
      result.btts = {
        yes: values.find((v: any) => v.label === 'Yes')?.value,
        no: values.find((v: any) => v.label === 'No')?.value,
      };
    }
    if (marketId === 12) {
      result.doubleChance = {
        homeOrDraw: values.find((v: any) => v.label === '1X')?.value,
        awayOrDraw: values.find((v: any) => v.label === 'X2')?.value,
        homeOrAway: values.find((v: any) => v.label === '12')?.value,
      };
    }
    if (marketId === 7) {
      result.halfTime = {
        home: values.find((v: any) => v.label === '1')?.value,
        draw: values.find((v: any) => v.label === 'X')?.value,
        away: values.find((v: any) => v.label === '2')?.value,
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
      if (!result.bookmakers.includes(bookmaker)) result.bookmakers.push(bookmaker);

      if (!result.matchWinner && marketName.includes('1x2')) {
        result.matchWinner = {
          home: odd.values?.find((v: any) => v.label === '1')?.value,
          draw: odd.values?.find((v: any) => v.label === 'X')?.value,
          away: odd.values?.find((v: any) => v.label === '2')?.value,
        };
      }
      if (!result.overUnder['2.5'] && marketName.includes('over')) {
        result.overUnder['2.5'] = {
          over: odd.values?.find((v: any) => v.label === 'Over')?.value,
          under: odd.values?.find((v: any) => v.label === 'Under')?.value,
        };
      }
      if (!result.btts && marketName.includes('both')) {
        result.btts = {
          yes: odd.values?.find((v: any) => v.label === 'Yes')?.value,
          no: odd.values?.find((v: any) => v.label === 'No')?.value,
        };
      }
    });
  }

  return result;
}

function calculateDetailedForm(matches: any[], teamId: number) {
  if (!matches || matches.length === 0) {
    return {
      form: 'N/A', points: 0, avgGoals: '0.00', avgConceded: '0.00',
      wins: 0, draws: 0, losses: 0, cleanSheets: 0, failedToScore: 0,
      over25: 0, bttsYes: 0, over25Percentage: '0', bttsPercentage: '0',
      cleanSheetPercentage: '0', matches: [],
    };
  }

  let points = 0, goals = 0, conceded = 0, wins = 0, draws = 0, losses = 0;
  let cleanSheets = 0, failedToScore = 0, over25 = 0, bttsYes = 0;
  const formArray: string[] = [];
  const matchDetails: any[] = [];

  matches.slice(0, 10).forEach((match: any) => {
    const scores = match.scores || [];
    const participants = match.participants || [];
    let homeScore = 0, awayScore = 0;

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

    if (teamGoals > oppGoals) { points += 3; wins++; formArray.push('W'); }
    else if (teamGoals === oppGoals) { points += 1; draws++; formArray.push('D'); }
    else { losses++; formArray.push('L'); }

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
    points, wins, draws, losses,
    avgGoals: (goals / matchCount).toFixed(2),
    avgConceded: (conceded / matchCount).toFixed(2),
    cleanSheets, failedToScore, over25, bttsYes,
    over25Percentage: ((over25 / matchCount) * 100).toFixed(0),
    bttsPercentage: ((bttsYes / matchCount) * 100).toFixed(0),
    cleanSheetPercentage: ((cleanSheets / matchCount) * 100).toFixed(0),
    matches: matchDetails.slice(0, 5),
  };
}

function analyzeH2H(h2hMatches: any[], homeTeamId: number, awayTeamId: number) {
  if (!h2hMatches || h2hMatches.length === 0) {
    return {
      totalMatches: 0, homeWins: 0, awayWins: 0, draws: 0,
      avgGoals: '0.00', over25: 0, bttsYes: 0,
      over25Percentage: '0', bttsPercentage: '0', matches: [],
    };
  }

  let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, over25 = 0, bttsYes = 0;
  const matchDetails: any[] = [];

  h2hMatches.forEach((match: any) => {
    const scores = match.scores || [];
    const participants = match.participants || [];
    let homeScore = 0, awayScore = 0;

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
    if (homeScore > awayScore) { if (homeIsOurHome) homeWins++; else awayWins++; }
    else if (homeScore < awayScore) { if (homeIsOurHome) awayWins++; else homeWins++; }
    else { draws++; }

    matchDetails.push({ home: homeTeam?.name, away: awayTeam?.name, score: `${homeScore}-${awayScore}` });
  });

  const matchCount = Math.max(h2hMatches.length, 1);
  return {
    totalMatches: h2hMatches.length, homeWins, awayWins, draws,
    avgGoals: (totalGoals / matchCount).toFixed(2),
    over25, bttsYes,
    over25Percentage: ((over25 / matchCount) * 100).toFixed(0),
    bttsPercentage: ((bttsYes / matchCount) * 100).toFixed(0),
    matches: matchDetails.slice(0, 5),
  };
}

// ========================
// 🔥🔥🔥 ULTRA AGRESİF AI PROMPTLARI 🔥🔥🔥
// ========================

function createUltraAggressivePrompt(data: any, language: string = 'en') {
  const { homeTeam, awayTeam, odds, homeForm, awayForm, h2h, fixture } = data;

  // ===== 🇹🇷 TÜRKÇE - ULTRA AGRESİF =====
  const turkishPrompt = `🔥🔥🔥 DÜNYA'NIN EN BAŞARILI BAHİS ANALİSTİ OLARAK GÖREV YAPIYORSUN! 🔥🔥🔥

⚠️⚠️⚠️ MUTLAK KURALLAR - İHLAL YASAK! ⚠️⚠️⚠️
1. "Belki", "olabilir", "muhtemelen", "şans", "umut" KELİMELERİ YASAK!
2. Her tahmin %70+ güven ile olmalı - altı KABUL EDİLMEZ!
3. KESİN, NET, AGRESİF tahminler ver!
4. Bahisçilerin göremediği VALUE'ları BUL!
5. TÜM YANITLAR TÜRKÇE!

🏟️ MAÇ BİLGİLERİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 ${homeTeam} vs ${awayTeam}
🏆 Lig: ${fixture?.league?.name || 'N/A'}
📅 Tarih: ${fixture?.starting_at || 'N/A'}

💰 BAHİS ORANLARI (BOOKMAKER VERİLERİ)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────────────────────────────────┐
│ 1X2: EV=${odds?.matchWinner?.home || '-'} | X=${odds?.matchWinner?.draw || '-'} | DEP=${odds?.matchWinner?.away || '-'}
│ Ü/A 2.5: Üst=${odds?.overUnder?.['2.5']?.over || '-'} | Alt=${odds?.overUnder?.['2.5']?.under || '-'}
│ KG VAR/YOK: Var=${odds?.btts?.yes || '-'} | Yok=${odds?.btts?.no || '-'}
│ Çifte Şans: 1X=${odds?.doubleChance?.homeOrDraw || '-'} | X2=${odds?.doubleChance?.awayOrDraw || '-'} | 12=${odds?.doubleChance?.homeOrAway || '-'}
│ İlk Yarı: 1=${odds?.halfTime?.home || '-'} | X=${odds?.halfTime?.draw || '-'} | 2=${odds?.halfTime?.away || '-'}
└─────────────────────────────────────────────┘

📊 ${homeTeam} - DETAYLI FORM ANALİZİ (Son 10 Maç)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 Form: ${homeForm?.form || 'N/A'} | Toplam Puan: ${homeForm?.points || 0}/30
✅ Galibiyet: ${homeForm?.wins || 0} | 🤝 Beraberlik: ${homeForm?.draws || 0} | ❌ Mağlubiyet: ${homeForm?.losses || 0}
⚽ Attığı Gol Ort: ${homeForm?.avgGoals || '0'} | 🥅 Yediği Gol Ort: ${homeForm?.avgConceded || '0'}
📈 Üst 2.5 Oranı: %${homeForm?.over25Percentage || 0} | 🎯 KG Oranı: %${homeForm?.bttsPercentage || 0}
🛡️ Gol Yemeden: %${homeForm?.cleanSheetPercentage || 0} | 😤 Gol Atamadan: ${homeForm?.failedToScore || 0} maç
📋 Son Maçlar: ${homeForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' → ') || 'N/A'}

📊 ${awayTeam} - DETAYLI FORM ANALİZİ (Son 10 Maç)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 Form: ${awayForm?.form || 'N/A'} | Toplam Puan: ${awayForm?.points || 0}/30
✅ Galibiyet: ${awayForm?.wins || 0} | 🤝 Beraberlik: ${awayForm?.draws || 0} | ❌ Mağlubiyet: ${awayForm?.losses || 0}
⚽ Attığı Gol Ort: ${awayForm?.avgGoals || '0'} | 🥅 Yediği Gol Ort: ${awayForm?.avgConceded || '0'}
📈 Üst 2.5 Oranı: %${awayForm?.over25Percentage || 0} | 🎯 KG Oranı: %${awayForm?.bttsPercentage || 0}
🛡️ Gol Yemeden: %${awayForm?.cleanSheetPercentage || 0} | 😤 Gol Atamadan: ${awayForm?.failedToScore || 0} maç
📋 Son Maçlar: ${awayForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' → ') || 'N/A'}

⚔️ KAFA KAFAYA İSTATİSTİKLER (Son ${h2h?.totalMatches || 0} Maç)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 ${homeTeam}: ${h2h?.homeWins || 0} galibiyet | 🤝 Beraberlik: ${h2h?.draws || 0} | 🚌 ${awayTeam}: ${h2h?.awayWins || 0} galibiyet
⚽ Maç Başı Ortalama Gol: ${h2h?.avgGoals || '0'}
📈 Üst 2.5 Gerçekleşme: %${h2h?.over25Percentage || 0} | 🎯 KG Gerçekleşme: %${h2h?.bttsPercentage || 0}
📋 Son Maçlar: ${h2h?.matches?.map((m: any) => `${m.home} ${m.score} ${m.away}`).join(' | ') || 'N/A'}

🎯 ANALİZ GÖREVİN - 15 FARKLI BAHİS TİPİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Yukarıdaki TÜM verileri analiz et ve şu bahis tiplerini değerlendir:

1. ⚽ MAÇ SONUCU (1X2) - Kim kazanır? Güven %70+
2. 📊 ÜST/ALT 2.5 GOL - Kaç gol olur?
3. 🔥 KARŞİLİKLI GOL (KG) - İki takım da gol atar mı?
4. 🛡️ ÇİFTE ŞANS - En güvenli seçenek
5. ⏱️ İLK YARI SONUCU - Devre arasında durum
6. 🎯 DOĞRU SKOR - En olası 3 skor
7. 📈 TOPLAM GOL ARALIĞI - 0-1, 2-3, 4+
8. ⚡ İLK GOL - Kim önce gol atar
9. 🏆 HANDİKAPLI BAHİS - Fark tahmini
10. 📉 ÜST/ALT 1.5 GOL - Düşük skorlu mu?
11. 📈 ÜST/ALT 3.5 GOL - Yüksek skorlu mu?
12. 🌟 MAÇIN YILDIZI - Fark yaratacak oyuncu
13. 💎 VALUE BET - Oranların hatalı olduğu yer
14. ⚠️ RİSK SEVİYESİ - Düşük/Orta/Yüksek
15. 🏆 EN İYİ TEK BAHİS - Bütçe sınırlıysa bunu oyna!

📝 JSON FORMATI (SADECE JSON DÖNDÜR!):
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "Türkçe detaylı açıklama", "value": true},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "Türkçe açıklama", "value": false},
  "btts": {"prediction": "Yes/No", "confidence": 72, "reasoning": "Türkçe açıklama", "value": true},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "Türkçe açıklama"},
  "halfTimeResult": {"prediction": "1/X/2", "confidence": 70, "reasoning": "Türkçe açıklama"},
  "correctScore": {
    "first": {"score": "2-1", "confidence": 18, "reasoning": "Neden bu skor"},
    "second": {"score": "1-1", "confidence": 15, "reasoning": "Neden"},
    "third": {"score": "2-0", "confidence": 12, "reasoning": "Neden"}
  },
  "totalGoalsRange": {"prediction": "2-3/0-1/4+", "confidence": 74, "reasoning": "Türkçe açıklama"},
  "firstGoal": {"prediction": "Home/Away/No Goal", "confidence": 70, "reasoning": "Türkçe açıklama"},
  "handicap": {"team": "Takım adı", "line": "-1.5/+1.5", "confidence": 72, "reasoning": "Türkçe açıklama"},
  "overUnder15": {"prediction": "Over/Under", "confidence": 80, "reasoning": "Türkçe açıklama"},
  "overUnder35": {"prediction": "Over/Under", "confidence": 70, "reasoning": "Türkçe açıklama"},
  "starPlayer": {"name": "Oyuncu adı", "team": "Takım", "expectedContribution": "Gol/Asist/Performans", "reasoning": "Neden fark yaratacak"},
  "valueBet": {"market": "Pazar adı", "selection": "Seçim", "odds": 2.10, "realProbability": 55, "valuePercentage": 15.5, "reasoning": "VALUE neden var"},
  "overallAnalysis": "3-4 cümlelik Türkçe kapsamlı maç analizi - KESİN ve NET ifadelerle",
  "bestBet": {"type": "Bahis tipi", "selection": "Seçim", "confidence": 82, "stake": 3, "reasoning": "Neden bu en iyi bahis"},
  "riskLevel": "Düşük/Orta/Yüksek",
  "keyFactors": ["Önemli faktör 1", "Faktör 2", "Faktör 3"],
  "warnings": ["Dikkat edilecek risk 1", "Risk 2"]
}

🔥🔥🔥 SADECE JSON DÖNDÜR! TÜM METİNLER TÜRKÇE! KESİN TAHMİNLER! 🔥🔥🔥`;

  // ===== 🇬🇧 ENGLISH - ULTRA AGGRESSIVE =====
  const englishPrompt = `🔥🔥🔥 YOU ARE THE WORLD'S MOST SUCCESSFUL BETTING ANALYST! 🔥🔥🔥

⚠️⚠️⚠️ ABSOLUTE RULES - VIOLATION FORBIDDEN! ⚠️⚠️⚠️
1. Words like "maybe", "possibly", "might", "hopefully" are BANNED!
2. Every prediction must have 70%+ confidence - lower is UNACCEPTABLE!
3. Give DEFINITE, CLEAR, AGGRESSIVE predictions!
4. FIND values that bookmakers don't see!
5. ALL RESPONSES IN ENGLISH!

🏟️ MATCH INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 ${homeTeam} vs ${awayTeam}
🏆 League: ${fixture?.league?.name || 'N/A'}
📅 Date: ${fixture?.starting_at || 'N/A'}

💰 BETTING ODDS (BOOKMAKER DATA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────────────────────────────────┐
│ 1X2: HOME=${odds?.matchWinner?.home || '-'} | X=${odds?.matchWinner?.draw || '-'} | AWAY=${odds?.matchWinner?.away || '-'}
│ O/U 2.5: Over=${odds?.overUnder?.['2.5']?.over || '-'} | Under=${odds?.overUnder?.['2.5']?.under || '-'}
│ BTTS: Yes=${odds?.btts?.yes || '-'} | No=${odds?.btts?.no || '-'}
│ Double Chance: 1X=${odds?.doubleChance?.homeOrDraw || '-'} | X2=${odds?.doubleChance?.awayOrDraw || '-'} | 12=${odds?.doubleChance?.homeOrAway || '-'}
│ Half Time: 1=${odds?.halfTime?.home || '-'} | X=${odds?.halfTime?.draw || '-'} | 2=${odds?.halfTime?.away || '-'}
└─────────────────────────────────────────────┘

📊 ${homeTeam} - DETAILED FORM ANALYSIS (Last 10 Matches)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 Form: ${homeForm?.form || 'N/A'} | Total Points: ${homeForm?.points || 0}/30
✅ Wins: ${homeForm?.wins || 0} | 🤝 Draws: ${homeForm?.draws || 0} | ❌ Losses: ${homeForm?.losses || 0}
⚽ Goals Scored Avg: ${homeForm?.avgGoals || '0'} | 🥅 Goals Conceded Avg: ${homeForm?.avgConceded || '0'}
📈 Over 2.5 Rate: ${homeForm?.over25Percentage || 0}% | 🎯 BTTS Rate: ${homeForm?.bttsPercentage || 0}%
🛡️ Clean Sheet: ${homeForm?.cleanSheetPercentage || 0}% | 😤 Failed to Score: ${homeForm?.failedToScore || 0} matches
📋 Recent: ${homeForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' → ') || 'N/A'}

📊 ${awayTeam} - DETAILED FORM ANALYSIS (Last 10 Matches)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 Form: ${awayForm?.form || 'N/A'} | Total Points: ${awayForm?.points || 0}/30
✅ Wins: ${awayForm?.wins || 0} | 🤝 Draws: ${awayForm?.draws || 0} | ❌ Losses: ${awayForm?.losses || 0}
⚽ Goals Scored Avg: ${awayForm?.avgGoals || '0'} | 🥅 Goals Conceded Avg: ${awayForm?.avgConceded || '0'}
📈 Over 2.5 Rate: ${awayForm?.over25Percentage || 0}% | 🎯 BTTS Rate: ${awayForm?.bttsPercentage || 0}%
🛡️ Clean Sheet: ${awayForm?.cleanSheetPercentage || 0}% | 😤 Failed to Score: ${awayForm?.failedToScore || 0} matches
📋 Recent: ${awayForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' → ') || 'N/A'}

⚔️ HEAD TO HEAD STATISTICS (Last ${h2h?.totalMatches || 0} Matches)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 ${homeTeam}: ${h2h?.homeWins || 0} wins | 🤝 Draws: ${h2h?.draws || 0} | 🚌 ${awayTeam}: ${h2h?.awayWins || 0} wins
⚽ Average Goals Per Match: ${h2h?.avgGoals || '0'}
📈 Over 2.5 Rate: ${h2h?.over25Percentage || 0}% | 🎯 BTTS Rate: ${h2h?.bttsPercentage || 0}%
📋 Recent: ${h2h?.matches?.map((m: any) => `${m.home} ${m.score} ${m.away}`).join(' | ') || 'N/A'}

🎯 YOUR TASK - ANALYZE 15 DIFFERENT BET TYPES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 JSON FORMAT (RETURN ONLY JSON!):
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "English detailed explanation", "value": true},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "English explanation", "value": false},
  "btts": {"prediction": "Yes/No", "confidence": 72, "reasoning": "English explanation", "value": true},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "English explanation"},
  "halfTimeResult": {"prediction": "1/X/2", "confidence": 70, "reasoning": "English explanation"},
  "correctScore": {
    "first": {"score": "2-1", "confidence": 18, "reasoning": "Why this score"},
    "second": {"score": "1-1", "confidence": 15, "reasoning": "Why"},
    "third": {"score": "2-0", "confidence": 12, "reasoning": "Why"}
  },
  "totalGoalsRange": {"prediction": "2-3/0-1/4+", "confidence": 74, "reasoning": "English explanation"},
  "firstGoal": {"prediction": "Home/Away/No Goal", "confidence": 70, "reasoning": "English explanation"},
  "handicap": {"team": "Team name", "line": "-1.5/+1.5", "confidence": 72, "reasoning": "English explanation"},
  "overUnder15": {"prediction": "Over/Under", "confidence": 80, "reasoning": "English explanation"},
  "overUnder35": {"prediction": "Over/Under", "confidence": 70, "reasoning": "English explanation"},
  "starPlayer": {"name": "Player name", "team": "Team", "expectedContribution": "Goal/Assist/Performance", "reasoning": "Why will make difference"},
  "valueBet": {"market": "Market name", "selection": "Selection", "odds": 2.10, "realProbability": 55, "valuePercentage": 15.5, "reasoning": "Why VALUE exists"},
  "overallAnalysis": "3-4 sentence English comprehensive analysis - DEFINITE and CLEAR statements",
  "bestBet": {"type": "Bet type", "selection": "Selection", "confidence": 82, "stake": 3, "reasoning": "Why this is best bet"},
  "riskLevel": "Low/Medium/High",
  "keyFactors": ["Key factor 1", "Factor 2", "Factor 3"],
  "warnings": ["Risk to watch 1", "Risk 2"]
}

🔥🔥🔥 RETURN ONLY JSON! ALL TEXT IN ENGLISH! DEFINITE PREDICTIONS! 🔥🔥🔥`;

  // ===== 🇩🇪 GERMAN - ULTRA AGGRESSIVE =====
  const germanPrompt = `🔥🔥🔥 DU BIST DER ERFOLGREICHSTE WETTANALYST DER WELT! 🔥🔥🔥

⚠️⚠️⚠️ ABSOLUTE REGELN - VERSTOSS VERBOTEN! ⚠️⚠️⚠️
1. Wörter wie "vielleicht", "möglicherweise", "könnte", "hoffentlich" sind VERBOTEN!
2. Jede Vorhersage muss 70%+ Konfidenz haben - darunter ist INAKZEPTABEL!
3. Gib DEFINITIVE, KLARE, AGGRESSIVE Vorhersagen!
4. FINDE Values die Buchmacher nicht sehen!
5. ALLE ANTWORTEN AUF DEUTSCH!

🏟️ SPIELINFORMATIONEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 ${homeTeam} vs ${awayTeam}
🏆 Liga: ${fixture?.league?.name || 'N/A'}
📅 Datum: ${fixture?.starting_at || 'N/A'}

💰 WETTQUOTEN (BUCHMACHER-DATEN)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────────────────────────────────┐
│ 1X2: HEIM=${odds?.matchWinner?.home || '-'} | X=${odds?.matchWinner?.draw || '-'} | AUSW=${odds?.matchWinner?.away || '-'}
│ Ü/U 2.5: Über=${odds?.overUnder?.['2.5']?.over || '-'} | Unter=${odds?.overUnder?.['2.5']?.under || '-'}
│ Beide treffen: Ja=${odds?.btts?.yes || '-'} | Nein=${odds?.btts?.no || '-'}
│ Doppelte Chance: 1X=${odds?.doubleChance?.homeOrDraw || '-'} | X2=${odds?.doubleChance?.awayOrDraw || '-'} | 12=${odds?.doubleChance?.homeOrAway || '-'}
│ Halbzeit: 1=${odds?.halfTime?.home || '-'} | X=${odds?.halfTime?.draw || '-'} | 2=${odds?.halfTime?.away || '-'}
└─────────────────────────────────────────────┘

📊 ${homeTeam} - DETAILLIERTE FORMANALYSE (Letzte 10 Spiele)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 Form: ${homeForm?.form || 'N/A'} | Gesamtpunkte: ${homeForm?.points || 0}/30
✅ Siege: ${homeForm?.wins || 0} | 🤝 Unentschieden: ${homeForm?.draws || 0} | ❌ Niederlagen: ${homeForm?.losses || 0}
⚽ Tore geschossen Ø: ${homeForm?.avgGoals || '0'} | 🥅 Gegentore Ø: ${homeForm?.avgConceded || '0'}
📈 Über 2.5 Quote: ${homeForm?.over25Percentage || 0}% | 🎯 Beide treffen Quote: ${homeForm?.bttsPercentage || 0}%
🛡️ Ohne Gegentor: ${homeForm?.cleanSheetPercentage || 0}% | 😤 Ohne eigenes Tor: ${homeForm?.failedToScore || 0} Spiele
📋 Letzte: ${homeForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' → ') || 'N/A'}

📊 ${awayTeam} - DETAILLIERTE FORMANALYSE (Letzte 10 Spiele)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 Form: ${awayForm?.form || 'N/A'} | Gesamtpunkte: ${awayForm?.points || 0}/30
✅ Siege: ${awayForm?.wins || 0} | 🤝 Unentschieden: ${awayForm?.draws || 0} | ❌ Niederlagen: ${awayForm?.losses || 0}
⚽ Tore geschossen Ø: ${awayForm?.avgGoals || '0'} | 🥅 Gegentore Ø: ${awayForm?.avgConceded || '0'}
📈 Über 2.5 Quote: ${awayForm?.over25Percentage || 0}% | 🎯 Beide treffen Quote: ${awayForm?.bttsPercentage || 0}%
🛡️ Ohne Gegentor: ${awayForm?.cleanSheetPercentage || 0}% | 😤 Ohne eigenes Tor: ${awayForm?.failedToScore || 0} Spiele
📋 Letzte: ${awayForm?.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' → ') || 'N/A'}

⚔️ DIREKTER VERGLEICH (Letzte ${h2h?.totalMatches || 0} Spiele)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 ${homeTeam}: ${h2h?.homeWins || 0} Siege | 🤝 Unentschieden: ${h2h?.draws || 0} | 🚌 ${awayTeam}: ${h2h?.awayWins || 0} Siege
⚽ Durchschnittliche Tore: ${h2h?.avgGoals || '0'}
📈 Über 2.5 Quote: ${h2h?.over25Percentage || 0}% | 🎯 Beide treffen: ${h2h?.bttsPercentage || 0}%
📋 Letzte: ${h2h?.matches?.map((m: any) => `${m.home} ${m.score} ${m.away}`).join(' | ') || 'N/A'}

🎯 DEINE AUFGABE - ANALYSIERE 15 VERSCHIEDENE WETTARTEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 JSON FORMAT (GIB NUR JSON ZURÜCK!):
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "Deutsche detaillierte Erklärung", "value": true},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "Deutsche Erklärung", "value": false},
  "btts": {"prediction": "Yes/No", "confidence": 72, "reasoning": "Deutsche Erklärung", "value": true},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "Deutsche Erklärung"},
  "halfTimeResult": {"prediction": "1/X/2", "confidence": 70, "reasoning": "Deutsche Erklärung"},
  "correctScore": {
    "first": {"score": "2-1", "confidence": 18, "reasoning": "Warum dieses Ergebnis"},
    "second": {"score": "1-1", "confidence": 15, "reasoning": "Warum"},
    "third": {"score": "2-0", "confidence": 12, "reasoning": "Warum"}
  },
  "totalGoalsRange": {"prediction": "2-3/0-1/4+", "confidence": 74, "reasoning": "Deutsche Erklärung"},
  "firstGoal": {"prediction": "Home/Away/No Goal", "confidence": 70, "reasoning": "Deutsche Erklärung"},
  "handicap": {"team": "Teamname", "line": "-1.5/+1.5", "confidence": 72, "reasoning": "Deutsche Erklärung"},
  "overUnder15": {"prediction": "Over/Under", "confidence": 80, "reasoning": "Deutsche Erklärung"},
  "overUnder35": {"prediction": "Over/Under", "confidence": 70, "reasoning": "Deutsche Erklärung"},
  "starPlayer": {"name": "Spielername", "team": "Team", "expectedContribution": "Tor/Assist/Leistung", "reasoning": "Warum wird den Unterschied machen"},
  "valueBet": {"market": "Marktname", "selection": "Auswahl", "odds": 2.10, "realProbability": 55, "valuePercentage": 15.5, "reasoning": "Warum VALUE existiert"},
  "overallAnalysis": "3-4 Sätze deutsche umfassende Analyse - DEFINITIVE und KLARE Aussagen",
  "bestBet": {"type": "Wettart", "selection": "Auswahl", "confidence": 82, "stake": 3, "reasoning": "Warum dies die beste Wette ist"},
  "riskLevel": "Niedrig/Mittel/Hoch",
  "keyFactors": ["Wichtiger Faktor 1", "Faktor 2", "Faktor 3"],
  "warnings": ["Zu beachtendes Risiko 1", "Risiko 2"]
}

🔥🔥🔥 GIB NUR JSON ZURÜCK! ALLE TEXTE AUF DEUTSCH! DEFINITIVE VORHERSAGEN! 🔥🔥🔥`;

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
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
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
      max_tokens: 4000,
    });
    const text = response.choices[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
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
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

// ========================
// MEGA CONSENSUS - 4 AI + HEURIST
// ========================

function calculateMegaConsensus(analyses: any[]) {
  const validAnalyses = analyses.filter(a => a !== null);
  if (validAnalyses.length === 0) return null;

  const consensus: any = {};
  const fields = [
    'matchResult', 'overUnder25', 'btts', 'doubleChance',
    'halfTimeResult', 'totalGoalsRange', 'firstGoal',
    'overUnder15', 'overUnder35', 'handicap'
  ];

  fields.forEach(field => {
    const predictions: Record<string, { count: number; totalConf: number; reasonings: string[] }> = {};

    validAnalyses.forEach(analysis => {
      if (analysis[field]?.prediction) {
        const pred = String(analysis[field].prediction);
        if (!predictions[pred]) predictions[pred] = { count: 0, totalConf: 0, reasonings: [] };
        predictions[pred].count++;
        predictions[pred].totalConf += analysis[field].confidence || 70;
        if (analysis[field].reasoning) predictions[pred].reasonings.push(analysis[field].reasoning);
      }
    });

    if (Object.keys(predictions).length > 0) {
      const sorted = Object.entries(predictions).sort((a, b) => 
        b[1].count - a[1].count || b[1].totalConf - a[1].totalConf
      );
      const [winner, data] = sorted[0];

      consensus[field] = {
        prediction: winner,
        confidence: Math.round(data.totalConf / data.count),
        votes: data.count,
        totalVotes: validAnalyses.length,
        unanimous: data.count === validAnalyses.length,
        reasoning: data.reasonings[0] || '',
      };
    }
  });

  // Correct Score
  const scores: Record<string, { count: number; totalConf: number }> = {};
  validAnalyses.forEach(a => {
    if (a.correctScore) {
      ['first', 'second', 'third'].forEach(pos => {
        if (a.correctScore[pos]?.score) {
          const s = a.correctScore[pos].score;
          if (!scores[s]) scores[s] = { count: 0, totalConf: 0 };
          scores[s].count++;
          scores[s].totalConf += a.correctScore[pos].confidence || 15;
        }
      });
    }
  });

  const sortedScores = Object.entries(scores)
    .sort((a, b) => b[1].count - a[1].count || b[1].totalConf - a[1].totalConf)
    .slice(0, 5);

  consensus.correctScore = {
    first: sortedScores[0] ? { score: sortedScores[0][0], confidence: Math.round(sortedScores[0][1].totalConf / sortedScores[0][1].count), votes: sortedScores[0][1].count } : null,
    second: sortedScores[1] ? { score: sortedScores[1][0], confidence: Math.round(sortedScores[1][1].totalConf / sortedScores[1][1].count), votes: sortedScores[1][1].count } : null,
    third: sortedScores[2] ? { score: sortedScores[2][0], confidence: Math.round(sortedScores[2][1].totalConf / sortedScores[2][1].count), votes: sortedScores[2][1].count } : null,
  };

  consensus.aiCount = validAnalyses.length;
  consensus.bestBets = validAnalyses.map(a => a?.bestBet).filter(Boolean);
  consensus.valueBets = validAnalyses.map(a => a?.valueBet).filter(Boolean);
  consensus.starPlayers = validAnalyses.map(a => a?.starPlayer).filter(Boolean);
  consensus.riskLevels = validAnalyses.map(a => a?.riskLevel).filter(Boolean);
  consensus.overallAnalyses = validAnalyses.map(a => a?.overallAnalysis).filter(Boolean);
  consensus.keyFactors = Array.from(new Set(validAnalyses.flatMap(a => a?.keyFactors || [])));
  consensus.warnings = Array.from(new Set(validAnalyses.flatMap(a => a?.warnings || [])));

  return consensus;
}

// ========================
// CACHE & DB FONKSİYONLARI
// ========================

async function getCachedAnalysis(fixtureId: number, language: string) {
  try {
    const { data } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('fixture_id', fixtureId)
      .eq('language', language)
      .gt('expires_at', new Date().toISOString())
      .single();
    return data || null;
  } catch { return null; }
}

async function cacheAnalysis(fixtureId: number, homeTeam: string, awayTeam: string, analysisData: any, oddsData: any, formData: any, language: string, league?: string, matchDate?: string) {
  try {
    await supabaseAdmin.from('analyses').upsert({
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
    }, { onConflict: 'fixture_id' });
  } catch (error) { console.error('Cache error:', error); }
}

async function addToUserHistory(userId: string, fixtureId: number, homeTeam: string, awayTeam: string) {
  try {
    await supabaseAdmin.from('user_analyses').upsert({
      user_id: userId,
      fixture_id: fixtureId,
      home_team: homeTeam,
      away_team: awayTeam,
      viewed_at: new Date().toISOString(),
      is_favorite: false,
    }, { onConflict: 'user_id,fixture_id', ignoreDuplicates: false });
  } catch (error) { console.error('History error:', error); }
}

async function checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const { data: existing } = await supabaseAdmin.from('user_daily_usage').select('*').eq('user_id', userId).eq('date', today).single();

    if (existing) {
      if (existing.analysis_count >= DAILY_ANALYSIS_LIMIT) {
        return { allowed: false, count: existing.analysis_count, limit: DAILY_ANALYSIS_LIMIT };
      }
      await supabaseAdmin.from('user_daily_usage').update({ analysis_count: existing.analysis_count + 1 }).eq('id', existing.id);
      return { allowed: true, count: existing.analysis_count + 1, limit: DAILY_ANALYSIS_LIMIT };
    } else {
      await supabaseAdmin.from('user_daily_usage').insert({ user_id: userId, date: today, analysis_count: 1 });
      return { allowed: true, count: 1, limit: DAILY_ANALYSIS_LIMIT };
    }
  } catch (error) {
    console.error('Usage error:', error);
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

    console.log(`\n🚀 ========== ANALYSIS REQUEST ==========`);
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🌍 Language: ${language}`);
    console.log(`=========================================\n`);

    // 1. Cache kontrol
    const cached = await getCachedAnalysis(fixtureId, language);
    if (cached) {
      console.log('⚡ Cache HIT!');
      await addToUserHistory(userId, fixtureId, cached.home_team, cached.away_team);
      return NextResponse.json({
        success: true,
        fromCache: true,
        fixture: { id: fixtureId, homeTeam: cached.home_team, awayTeam: cached.away_team },
        odds: cached.odds_data,
        form: cached.form_data,
        analysis: cached.analysis_data,
        aiStatus: { claude: '✅', openai: '✅', gemini: '✅', heurist: '✅' },
        language,
      });
    }

    // 2. Günlük limit
    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return NextResponse.json({ error: `Daily limit reached (${usage.count}/${usage.limit})`, limitReached: true, usage }, { status: 429 });
    }

    // 3. Verileri çek
    console.log('📊 Fetching data...');
    const [fixture, homeRecentMatches, awayRecentMatches, h2hMatches, preMatchOdds] = await Promise.all([
      fetchFixtureData(fixtureId),
      homeTeamId ? fetchRecentMatches(homeTeamId) : Promise.resolve([]),
      awayTeamId ? fetchRecentMatches(awayTeamId) : Promise.resolve([]),
      homeTeamId && awayTeamId ? fetchH2H(homeTeamId, awayTeamId) : Promise.resolve([]),
      fetchPreMatchOdds(fixtureId),
    ]);

    const homeTeamName = fixture?.participants?.find((p: any) => p.meta?.location === 'home')?.name || homeTeam || 'Home';
    const awayTeamName = fixture?.participants?.find((p: any) => p.meta?.location === 'away')?.name || awayTeam || 'Away';

    const odds = parseOddsDetailed(preMatchOdds, fixture);
    const homeForm = calculateDetailedForm(homeRecentMatches, homeTeamId);
    const awayForm = calculateDetailedForm(awayRecentMatches, awayTeamId);
    const h2h = analyzeH2H(h2hMatches, homeTeamId, awayTeamId);

    console.log(`✅ Data ready: ${homeTeamName} vs ${awayTeamName}`);
    console.log(`📈 Home form: ${homeForm.form} | Away form: ${awayForm.form}`);
    console.log(`⚔️ H2H: ${h2h.totalMatches} matches`);

    // 4. AI Prompt
    const prompt = createUltraAggressivePrompt({
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      odds, homeForm, awayForm, h2h, fixture,
    }, language);

    console.log(`📝 Prompt length: ${prompt.length} chars`);

    // 5. 🔥 MEGA AI ANALİZ - 4 AI + HEURIST AGENTS 🔥
    console.log('\n🤖 Running AI analyses...');

    const heuristPromise = runFullAnalysis({
      fixtureId,
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      homeTeamId,
      awayTeamId,
      league: fixture?.league?.name || '',
      date: fixture?.starting_at || '',
      odds, homeForm, awayForm, h2h,
    }, language as 'tr' | 'en' | 'de').catch(err => {
      console.error('Heurist error:', err);
      return null;
    });

    const [claudeAnalysis, openaiAnalysis, geminiAnalysis, heuristResult] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
      heuristPromise,
    ]);

    console.log(`\n📊 AI RESULTS:`);
    console.log(`   Claude: ${claudeAnalysis ? '✅' : '❌'}`);
    console.log(`   GPT-4: ${openaiAnalysis ? '✅' : '❌'}`);
    console.log(`   Gemini: ${geminiAnalysis ? '✅' : '❌'}`);
    console.log(`   Heurist: ${heuristResult?.success ? '✅' : '❌'}`);

    // 6. MEGA CONSENSUS
    const allAnalyses = [
      claudeAnalysis,
      openaiAnalysis,
      geminiAnalysis,
      heuristResult?.reports?.consensus,
    ].filter(Boolean);

    console.log(`\n⚖️ Calculating consensus from ${allAnalyses.length} AI analyses...`);
    const consensus = calculateMegaConsensus(allAnalyses);

    const aiStatus = {
      claude: claudeAnalysis ? '✅' : '❌',
      openai: openaiAnalysis ? '✅' : '❌',
      gemini: geminiAnalysis ? '✅' : '❌',
      heurist: heuristResult?.success ? '✅' : '❌',
    };

    const formData = { home: homeForm, away: awayForm };

    // 7. Cache'e kaydet
    await cacheAnalysis(fixtureId, homeTeamName, awayTeamName, consensus, odds, formData, language, fixture?.league?.name, fixture?.starting_at);

    // 8. Kullanıcı geçmişi
    await addToUserHistory(userId, fixtureId, homeTeamName, awayTeamName);

    console.log(`\n✅ Analysis complete! Returning results...\n`);

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
      individualAnalyses: {
        claude: claudeAnalysis,
        openai: openaiAnalysis,
        gemini: geminiAnalysis,
        heurist: heuristResult?.reports,
      },
      aiStatus,
      language,
      usage: { count: usage.count, limit: usage.limit },
    });

  } catch (error: any) {
    console.error('❌ Analysis error:', error);
    return NextResponse.json({ error: 'Analysis error: ' + error.message }, { status: 500 });
  }
}
