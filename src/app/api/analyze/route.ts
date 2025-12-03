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

// Fixture detayları - TÜM VERİLERİ ÇEK
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
    
    console.log('=== FIXTURE RAW DATA ===');
    console.log('Odds count:', data.data?.odds?.length || 0);
    
    return data.data || null;
  } catch (error) {
    console.error('Fixture fetch error:', error);
    return null;
  }
}

// Takım detayları - İSTATİSTİKLER, OYUNCULAR, SON MAÇLAR
async function fetchTeamDetails(teamId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=players;coaches;statistics;latest;upcoming;venue`
    );
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Team details error:', error);
    return null;
  }
}

// Takımın son maçları - DETAYLI
async function fetchRecentMatches(teamId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filter=participantIds:${teamId}&include=participants;scores;statistics;events&per_page=10&order=starting_at&sort=desc`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Recent matches error:', error);
    return [];
  }
}

// Head to Head - SON 10 MAÇ
async function fetchH2H(team1Id: number, team2Id: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores;statistics;events&per_page=10`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('H2H error:', error);
    return [];
  }
}

// Bookmaker Predictions
async function fetchPredictions(fixtureId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/predictions/probabilities/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Predictions error:', error);
    return [];
  }
}

// Pre-match Odds - TÜM MARKETLER
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

// Odds'ları detaylı parse et
function parseOddsDetailed(preMatchOdds: any[], fixture: any) {
 const result: any = {
    matchWinner: null,
    overUnder: { '1.5': null, '2.5': null, '3.5': null },
    btts: null,
    doubleChance: null,
    halfTime: null,
    halfTimeFullTime: null,
    correctScore: [],
    asianHandicap: null,
    drawNoBet: null,
    firstGoal: null,
    totalCorners: null,
    bothHalves: null,
    bookmakers: [],
  };

  // Fixture'dan gelen odds
  if (fixture?.odds && Array.isArray(fixture.odds)) {
    fixture.odds.forEach((odd: any) => {
      const marketId = odd.market_id;
      const values = odd.values || [];
      const bookmaker = odd.bookmaker?.name || 'Unknown';

      if (!result.bookmakers.includes(bookmaker)) {
        result.bookmakers.push(bookmaker);
      }

      // 1X2 (Market ID: 1)
      if (marketId === 1) {
        result.matchWinner = {
          home: values.find((v: any) => v.label === '1')?.value,
          draw: values.find((v: any) => v.label === 'X')?.value,
          away: values.find((v: any) => v.label === '2')?.value,
          bookmaker,
        };
      }
      // Over/Under 2.5 (Market ID: 18)
      if (marketId === 18) {
        result.overUnder['2.5'] = {
          over: values.find((v: any) => v.label === 'Over')?.value,
          under: values.find((v: any) => v.label === 'Under')?.value,
          bookmaker,
        };
      }
      // Over/Under 1.5 (Market ID: 17 or similar)
      if (marketId === 25) {
        result.overUnder['1.5'] = {
          over: values.find((v: any) => v.label === 'Over')?.value,
          under: values.find((v: any) => v.label === 'Under')?.value,
          bookmaker,
        };
      }
      // Over/Under 3.5 (Market ID: 26 or similar)
      if (marketId === 26) {
        result.overUnder['3.5'] = {
          over: values.find((v: any) => v.label === 'Over')?.value,
          under: values.find((v: any) => v.label === 'Under')?.value,
          bookmaker,
        };
      }
      // BTTS (Market ID: 28)
      if (marketId === 28) {
        result.btts = {
          yes: values.find((v: any) => v.label === 'Yes')?.value,
          no: values.find((v: any) => v.label === 'No')?.value,
          bookmaker,
        };
      }
      // Double Chance (Market ID: 12)
      if (marketId === 12) {
        result.doubleChance = {
          homeOrDraw: values.find((v: any) => v.label === '1X')?.value,
          awayOrDraw: values.find((v: any) => v.label === 'X2')?.value,
          homeOrAway: values.find((v: any) => v.label === '12')?.value,
          bookmaker,
        };
      }
      // Half Time Result (Market ID: 7)
      if (marketId === 7) {
        result.halfTime = {
          home: values.find((v: any) => v.label === '1')?.value,
          draw: values.find((v: any) => v.label === 'X')?.value,
          away: values.find((v: any) => v.label === '2')?.value,
          bookmaker,
        };
      }
      // Correct Score (Market ID: 57)
      if (marketId === 57) {
        result.correctScore = values.map((v: any) => ({
          score: v.label,
          odds: v.value,
        })).slice(0, 10);
      }
      // Draw No Bet (Market ID: 14)
      if (marketId === 14) {
        result.drawNoBet = {
          home: values.find((v: any) => v.label === '1')?.value,
          away: values.find((v: any) => v.label === '2')?.value,
          bookmaker,
        };
      }
    });
  }

  // Pre-match odds'tan ekle
  if (odds && Array.isArray(odds)) {
    odds.forEach((odd: any) => {
      const marketName = odd.market?.name?.toLowerCase() || '';
      const bookmaker = odd.bookmaker?.name || 'Unknown';

      if (!result.bookmakers.includes(bookmaker)) {
        result.bookmakers.push(bookmaker);
      }

      // Eksik marketleri doldur
      if (marketName.includes('1x2') && !result.matchWinner) {
        result.matchWinner = {
          home: odd.values?.find((v: any) => v.label === '1')?.value,
          draw: odd.values?.find((v: any) => v.label === 'X')?.value,
          away: odd.values?.find((v: any) => v.label === '2')?.value,
          bookmaker,
        };
      }
    });
  }

  return result;
}

// Form hesapla - DETAYLI
function calculateDetailedForm(matches: any[], teamId: number, teamName: string) {
  if (!matches || matches.length === 0) {
    return {
      form: 'N/A',
      points: 0,
      avgGoals: '0',
      avgConceded: '0',
      wins: 0,
      draws: 0,
      losses: 0,
      cleanSheets: 0,
      failedToScore: 0,
      over25: 0,
      bttsYes: 0,
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
    
    // Score çekme
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

    // İstatistikler
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
      date: match.starting_at,
    });
  });

  const matchCount = formArray.length;

  return {
    form: formArray.slice(0, 5).join(''),
    points,
    avgGoals: (goals / Math.max(matchCount, 1)).toFixed(2),
    avgConceded: (conceded / Math.max(matchCount, 1)).toFixed(2),
    wins,
    draws,
    losses,
    cleanSheets,
    failedToScore,
    over25,
    bttsYes,
    over25Percentage: ((over25 / Math.max(matchCount, 1)) * 100).toFixed(0),
    bttsPercentage: ((bttsYes / Math.max(matchCount, 1)) * 100).toFixed(0),
    cleanSheetPercentage: ((cleanSheets / Math.max(matchCount, 1)) * 100).toFixed(0),
    matches: matchDetails.slice(0, 5),
  };
}

// H2H analizi
function analyzeH2H(h2hMatches: any[], homeTeamId: number, awayTeamId: number) {
  if (!h2hMatches || h2hMatches.length === 0) {
    return {
      totalMatches: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      avgGoals: '0',
      over25: 0,
      bttsYes: 0,
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

    // Hangi takım kazandı (bizim takımlar açısından)
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
      date: match.starting_at,
    });
  });

  const matchCount = h2hMatches.length;

  return {
    totalMatches: matchCount,
    homeWins,
    awayWins,
    draws,
    avgGoals: (totalGoals / Math.max(matchCount, 1)).toFixed(2),
    over25,
    bttsYes,
    over25Percentage: ((over25 / Math.max(matchCount, 1)) * 100).toFixed(0),
    bttsPercentage: ((bttsYes / Math.max(matchCount, 1)) * 100).toFixed(0),
    matches: matchDetails.slice(0, 5),
  };
}

// Bookmaker predictions parse
function parsePredictions(predictions: any[]) {
  if (!predictions || predictions.length === 0) return null;

  const result: any = {
    homeWin: null,
    draw: null,
    awayWin: null,
    over25: null,
    under25: null,
    bttsYes: null,
    bttsNo: null,
    source: null,
  };

  predictions.forEach((pred: any) => {
    if (pred.type?.name === 'Home Win') result.homeWin = pred.probability;
    if (pred.type?.name === 'Draw') result.draw = pred.probability;
    if (pred.type?.name === 'Away Win') result.awayWin = pred.probability;
    if (pred.type?.name === 'Over 2.5') result.over25 = pred.probability;
    if (pred.type?.name === 'Under 2.5') result.under25 = pred.probability;
    if (pred.type?.name === 'BTTS Yes') result.bttsYes = pred.probability;
    if (pred.type?.name === 'BTTS No') result.bttsNo = pred.probability;
  });

  return result;
}

// ========================
// AGRESİF AI PROMPT
// ========================

function createAggressivePrompt(data: any, language: string = 'en') {
  const { 
    homeTeam, awayTeam, odds, homeForm, awayForm, h2h, 
    predictions, fixture, homeTeamDetails, awayTeamDetails 
  } = data;

  const langInstructions: Record<string, string> = {
    tr: `SEN DÜNYA ÇAPINDA TANINMIŞ, AGRESİF TAHMİNLERİYLE ÜNLÜ BİR FUTBOL ANALİZ UZMANISIN!
    
⚠️ KRİTİK KURALLAR:
- ASLA "belki", "olabilir", "muhtemel" gibi belirsiz kelimeler KULLANMA
- Her tahmin için KESİN ve NET bir seçim yap
- Güven yüzdesi %65'in altında OLMASIN
- Oranlarla uyumsuzsa NEDENINI açıkla ve VALUE BET olarak işaretle
- Tüm yanıtların TÜRKÇE olmalı`,
    
    en: `YOU ARE A WORLD-RENOWNED FOOTBALL ANALYST FAMOUS FOR AGGRESSIVE PREDICTIONS!
    
⚠️ CRITICAL RULES:
- NEVER use uncertain words like "maybe", "possibly", "might"
- Make a DEFINITE and CLEAR choice for each prediction
- Confidence must NOT be below 65%
- If odds disagree, EXPLAIN why and mark as VALUE BET
- All responses must be in ENGLISH`,
    
    de: `DU BIST EIN WELTBEKANNTER FUßBALLANALYST, BERÜHMT FÜR AGGRESSIVE VORHERSAGEN!
    
⚠️ KRITISCHE REGELN:
- Verwende NIEMALS unsichere Wörter wie "vielleicht", "möglicherweise"
- Triff für jede Vorhersage eine DEFINITIVE und KLARE Wahl
- Konfidenz darf NICHT unter 65% liegen
- Bei Widerspruch zu Quoten, ERKLÄRE warum und markiere als VALUE BET
- Alle Antworten müssen auf DEUTSCH sein`,
  };

  const langInstruction = langInstructions[language] || langInstructions.en;

  // Detaylı veri formatı
  const oddsSection = odds ? `
📊 BAHIS ORANLARI (BOOKMAKER: ${odds.bookmakers?.slice(0, 3).join(', ') || 'N/A'}):
┌─────────────────────────────────────────────────────────┐
│ 1X2: 1=${odds.matchWinner?.home || 'N/A'} | X=${odds.matchWinner?.draw || 'N/A'} | 2=${odds.matchWinner?.away || 'N/A'}
│ Ü/A 2.5: Ü=${odds.overUnder?.['2.5']?.over || 'N/A'} | A=${odds.overUnder?.['2.5']?.under || 'N/A'}
│ Ü/A 1.5: Ü=${odds.overUnder?.['1.5']?.over || 'N/A'} | A=${odds.overUnder?.['1.5']?.under || 'N/A'}
│ Ü/A 3.5: Ü=${odds.overUnder?.['3.5']?.over || 'N/A'} | A=${odds.overUnder?.['3.5']?.under || 'N/A'}
│ KG: Var=${odds.btts?.yes || 'N/A'} | Yok=${odds.btts?.no || 'N/A'}
│ Çifte Şans: 1X=${odds.doubleChance?.homeOrDraw || 'N/A'} | X2=${odds.doubleChance?.awayOrDraw || 'N/A'} | 12=${odds.doubleChance?.homeOrAway || 'N/A'}
│ İY: 1=${odds.halfTime?.home || 'N/A'} | X=${odds.halfTime?.draw || 'N/A'} | 2=${odds.halfTime?.away || 'N/A'}
│ DNB: 1=${odds.drawNoBet?.home || 'N/A'} | 2=${odds.drawNoBet?.away || 'N/A'}
└─────────────────────────────────────────────────────────┘
${odds.correctScore?.length > 0 ? `Doğru Skor Oranları: ${odds.correctScore.slice(0, 6).map((s: any) => `${s.score}(${s.odds})`).join(' | ')}` : ''}
` : '';

  const predictionsSection = predictions ? `
🔮 BOOKMAKER TAHMİNLERİ:
┌─────────────────────────────────────────────────────────┐
│ Ev Kazanır: ${predictions.homeWin || 'N/A'}% | Beraberlik: ${predictions.draw || 'N/A'}% | Deplasman: ${predictions.awayWin || 'N/A'}%
│ Üst 2.5: ${predictions.over25 || 'N/A'}% | Alt 2.5: ${predictions.under25 || 'N/A'}%
│ KG Var: ${predictions.bttsYes || 'N/A'}% | KG Yok: ${predictions.bttsNo || 'N/A'}%
└─────────────────────────────────────────────────────────┘
` : '';

  const homeFormSection = homeForm ? `
📈 ${homeTeam} FORM ANALİZİ (Son 10 Maç):
┌─────────────────────────────────────────────────────────┐
│ Form: ${homeForm.form} | Puan: ${homeForm.points}/30
│ G: ${homeForm.wins} | B: ${homeForm.draws} | M: ${homeForm.losses}
│ Attığı Gol Ort: ${homeForm.avgGoals} | Yediği: ${homeForm.avgConceded}
│ Üst 2.5: ${homeForm.over25Percentage}% | KG: ${homeForm.bttsPercentage}%
│ Gol Yemeden: ${homeForm.cleanSheetPercentage}% | Gol Atamadan: ${homeForm.failedToScore}
│ Son Maçlar: ${homeForm.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' | ') || 'N/A'}
└─────────────────────────────────────────────────────────┘
` : '';

  const awayFormSection = awayForm ? `
📉 ${awayTeam} FORM ANALİZİ (Son 10 Maç):
┌─────────────────────────────────────────────────────────┐
│ Form: ${awayForm.form} | Puan: ${awayForm.points}/30
│ G: ${awayForm.wins} | B: ${awayForm.draws} | M: ${awayForm.losses}
│ Attığı Gol Ort: ${awayForm.avgGoals} | Yediği: ${awayForm.avgConceded}
│ Üst 2.5: ${awayForm.over25Percentage}% | KG: ${awayForm.bttsPercentage}%
│ Gol Yemeden: ${awayForm.cleanSheetPercentage}% | Gol Atamadan: ${awayForm.failedToScore}
│ Son Maçlar: ${awayForm.matches?.map((m: any) => `${m.opponent}(${m.score}${m.result})`).join(' | ') || 'N/A'}
└─────────────────────────────────────────────────────────┘
` : '';

  const h2hSection = h2h ? `
⚔️ KAFA KAFAYA (Son ${h2h.totalMatches} Maç):
┌─────────────────────────────────────────────────────────┐
│ ${homeTeam}: ${h2h.homeWins} Galibiyet | Beraberlik: ${h2h.draws} | ${awayTeam}: ${h2h.awayWins} Galibiyet
│ Ort. Gol: ${h2h.avgGoals} | Üst 2.5: ${h2h.over25Percentage}% | KG: ${h2h.bttsPercentage}%
│ Son Maçlar: ${h2h.matches?.map((m: any) => `${m.home} ${m.score} ${m.away}`).join(' | ') || 'N/A'}
└─────────────────────────────────────────────────────────┘
` : '';

  return `${langInstruction}

🏟️ MAÇ: ${homeTeam} vs ${awayTeam}
📅 Tarih: ${fixture?.starting_at || 'N/A'}
🏆 Lig: ${fixture?.league?.name || 'N/A'}
🏟️ Stadyum: ${fixture?.venue?.name || 'N/A'}

${oddsSection}
${predictionsSection}
${homeFormSection}
${awayFormSection}
${h2hSection}

🎯 ANALİZ GÖREVİ:
Yukarıdaki TÜM verileri kullanarak şu 12 bahis tipini analiz et:

1. MAÇ SONUCU (1X2): KESİN tahmin ve %65+ güven
2. ÜST/ALT 2.5 GOL: Formları ve H2H'yi analiz et
3. KARŞILIKLI GOL (KG): Her iki takımın gol atma oranlarını değerlendir
4. ÇİFTE ŞANS: En güvenli seçenek
5. İLK YARI SONUCU: Takımların ilk yarı performanslarını analiz et
6. DOĞRU SKOR: En olası 3 skor
7. TOPLAM GOL ARALIĞI: 0-1, 2-3, 4-5, 6+ arasından
8. İLK GOL: Hangi takım ilk golü atar
9. HANDİKAP: -1.5 veya +1.5 önerisi
10. ÜST/ALT 1.5 GOL: Düşük skorlu maç olasılığı
11. ÜST/ALT 3.5 GOL: Yüksek skorlu maç olasılığı
12. MAÇIN YILDIZI: Fark yaratacak oyuncu

💰 VALUE BET TESPİTİ:
- Bookmaker olasılığı vs Senin tahminin karşılaştır
- Fark %10'dan fazlaysa VALUE BET olarak işaretle
- Oranların yanlış olduğunu düşündüğün yerleri belirt

📝 JSON FORMATI (SADECE JSON DÖNDÜR):
{
  "matchResult": { "prediction": "1/X/2", "confidence": 75, "reasoning": "detaylı açıklama", "value": true/false, "valueBetReason": "neden value" },
  "overUnder25": { "prediction": "Over/Under", "confidence": 70, "reasoning": "detaylı açıklama", "value": true/false },
  "btts": { "prediction": "Yes/No", "confidence": 72, "reasoning": "detaylı açıklama", "value": true/false },
  "doubleChance": { "prediction": "1X/X2/12", "confidence": 85, "reasoning": "detaylı açıklama" },
  "halfTimeResult": { "prediction": "1/X/2", "confidence": 68, "reasoning": "detaylı açıklama" },
  "correctScore": {
    "first": { "score": "2-1", "confidence": 18, "reasoning": "neden bu skor" },
    "second": { "score": "1-1", "confidence": 15, "reasoning": "neden bu skor" },
    "third": { "score": "2-0", "confidence": 12, "reasoning": "neden bu skor" }
  },
  "totalGoalsRange": { "prediction": "2-3", "confidence": 70, "reasoning": "detaylı açıklama" },
  "firstGoal": { "prediction": "Home/Away/No Goal", "confidence": 65, "reasoning": "detaylı açıklama" },
  "handicap": { "team": "Takım Adı", "line": "-1.5/+1.5", "confidence": 68, "reasoning": "detaylı açıklama" },
  "overUnder15": { "prediction": "Over/Under", "confidence": 75, "reasoning": "detaylı açıklama" },
  "overUnder35": { "prediction": "Over/Under", "confidence": 65, "reasoning": "detaylı açıklama" },
  "starPlayer": { "name": "Oyuncu Adı", "team": "Takım", "reason": "neden fark yaratacak", "expectedContribution": "gol/asist/performans" },
  "overallAnalysis": "3-4 cümlelik kapsamlı maç değerlendirmesi",
  "bestBet": { "type": "bahis tipi", "prediction": "tahmin", "confidence": 82, "reasoning": "neden bu en iyi bahis", "stake": "1-5 arası önerilen birim" },
  "riskLevel": "Low/Medium/High",
  "keyFactors": ["faktör1", "faktör2", "faktör3"],
  "warnings": ["dikkat edilecek nokta1", "dikkat edilecek nokta2"]
}`;
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
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

async function analyzeWithGemini(prompt: string) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('Gemini raw response length:', text.length);
    
    // JSON parse et
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
// CONSENSUS HESAPLAMA - GELİŞTİRİLMİŞ
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
        allPredictions: sortedPreds.map(([pred, d]) => ({
          prediction: pred,
          votes: d.count,
          avgConfidence: Math.round(d.totalConfidence / d.count),
        })),
      };
    }
  });

  // Correct Score - birleştir
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

  // Diğer alanlar
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
    const { data, error } = await supabaseAdmin
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
      })
      .select()
      .single();

    return data;
  } catch (error) {
    console.error('Cache save error:', error);
    return null;
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

    console.log('=== ANALYSIS REQUEST ===');
    console.log('Fixture:', fixtureId, homeTeam, 'vs', awayTeam);
    console.log('Teams:', homeTeamId, awayTeamId);

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

    // 3. TÜM VERİLERİ PARALEL ÇEK
    console.log('Fetching all data...');
    const [
      fixture,
      homeRecentMatches,
      awayRecentMatches,
      h2hMatches,
      predictions,
      preMatchOdds,
      homeTeamDetails,
      awayTeamDetails,
    ] = await Promise.all([
      fetchFixtureData(fixtureId),
      homeTeamId ? fetchRecentMatches(homeTeamId) : Promise.resolve([]),
      awayTeamId ? fetchRecentMatches(awayTeamId) : Promise.resolve([]),
      homeTeamId && awayTeamId ? fetchH2H(homeTeamId, awayTeamId) : Promise.resolve([]),
      fetchPredictions(fixtureId),
      fetchPreMatchOdds(fixtureId),
      homeTeamId ? fetchTeamDetails(homeTeamId) : Promise.resolve(null),
      awayTeamId ? fetchTeamDetails(awayTeamId) : Promise.resolve(null),
    ]);

    // Takım isimlerini fixture'dan al
    const homeTeamName = fixture?.participants?.find((p: any) => p.meta?.location === 'home')?.name || homeTeam || 'Home Team';
    const awayTeamName = fixture?.participants?.find((p: any) => p.meta?.location === 'away')?.name || awayTeam || 'Away Team';

    console.log('Teams from fixture:', homeTeamName, 'vs', awayTeamName);

    // 4. Verileri işle
    const odds = parseOddsDetailed(preMatchOdds, fixture);
    const homeForm = calculateDetailedForm(homeRecentMatches, homeTeamId, homeTeamName);
    const awayForm = calculateDetailedForm(awayRecentMatches, awayTeamId, awayTeamName);
    const h2h = analyzeH2H(h2hMatches, homeTeamId, awayTeamId);
    const bookmakerPredictions = parsePredictions(predictions);

    console.log('Odds parsed:', JSON.stringify(odds).slice(0, 200));
    console.log('Home form:', homeForm.form, 'pts:', homeForm.points);
    console.log('Away form:', awayForm.form, 'pts:', awayForm.points);
    console.log('H2H matches:', h2h.totalMatches);

    // 5. AGRESİF AI PROMPT
    const prompt = createAggressivePrompt({
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      odds,
      homeForm,
      awayForm,
      h2h,
      predictions: bookmakerPredictions,
      fixture,
      homeTeamDetails,
      awayTeamDetails,
    }, language);

    console.log('Prompt length:', prompt.length);

    // 6. 3 AI'DAN PARALEL ANALİZ
    console.log('Running AI analyses...');
    const [claudeAnalysis, openaiAnalysis, geminiAnalysis] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
    ]);

    console.log('Claude:', claudeAnalysis ? 'OK' : 'FAILED');
    console.log('OpenAI:', openaiAnalysis ? 'OK' : 'FAILED');
    console.log('Gemini:', geminiAnalysis ? 'OK' : 'FAILED');

    // 7. CONSENSUS HESAPLA
    const consensus = calculateConsensus([claudeAnalysis, openaiAnalysis, geminiAnalysis]);

    const aiStatus = {
      claude: claudeAnalysis ? '✅' : '❌',
      openai: openaiAnalysis ? '✅' : '❌',
      gemini: geminiAnalysis ? '✅' : '❌',
    };

    const formData = { home: homeForm, away: awayForm };

    // 8. Cache'e kaydet
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

    // 9. Kullanıcı geçmişine ekle
    await addToUserHistory(userId, fixtureId, homeTeamName, awayTeamName);

    return NextResponse.json({
      success: true,
      fromCache: false,
      fixture: { 
        id: fixtureId, 
        homeTeam: homeTeamName, 
        awayTeam: awayTeamName,
        league: fixture?.league?.name,
        venue: fixture?.venue?.name,
        date: fixture?.starting_at,
      },
      odds,
      form: formData,
      h2h,
      predictions: bookmakerPredictions,
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
