import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// Fixture ve odds verilerini çek
async function fetchFixtureData(fixtureId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;statistics;lineups;events;scores;odds;predictions;weather`
    );
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Fixture fetch error:', error);
    return null;
  }
}

// Takım istatistiklerini çek
async function fetchTeamStats(teamId: number, seasonId?: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=statistics;players;coaches;latest;upcoming`
    );
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Team stats error:', error);
    return null;
  }
}

// Head to Head verilerini çek
async function fetchH2H(team1Id: number, team2Id: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=scores;statistics`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('H2H fetch error:', error);
    return [];
  }
}

// Takımın son maçlarını çek
async function fetchRecentMatches(teamId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filter=participantIds:${teamId}&include=scores;statistics&per_page=10&order=starting_at&sort=desc`
    );
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Recent matches error:', error);
    return [];
  }
}

// Odds verilerini parse et
function parseOdds(fixture: any) {
  const odds: any = {
    matchWinner: null,
    overUnder: null,
    btts: null,
    doubleChance: null,
    correctScore: [],
    halfTime: null,
    asianHandicap: null,
    drawNoBet: null,
  };

  if (!fixture?.odds) return odds;

  fixture.odds.forEach((odd: any) => {
    const marketId = odd.market_id;
    const values = odd.values || [];

    // Match Winner (1X2)
    if (marketId === 1) {
      odds.matchWinner = {
        home: values.find((v: any) => v.label === '1')?.value || null,
        draw: values.find((v: any) => v.label === 'X')?.value || null,
        away: values.find((v: any) => v.label === '2')?.value || null,
      };
    }
    // Over/Under 2.5
    if (marketId === 18) {
      odds.overUnder = {
        over: values.find((v: any) => v.label === 'Over')?.value || null,
        under: values.find((v: any) => v.label === 'Under')?.value || null,
      };
    }
    // Both Teams to Score
    if (marketId === 28) {
      odds.btts = {
        yes: values.find((v: any) => v.label === 'Yes')?.value || null,
        no: values.find((v: any) => v.label === 'No')?.value || null,
      };
    }
    // Double Chance
    if (marketId === 17) {
      odds.doubleChance = {
        homeOrDraw: values.find((v: any) => v.label === '1X')?.value || null,
        awayOrDraw: values.find((v: any) => v.label === 'X2')?.value || null,
        homeOrAway: values.find((v: any) => v.label === '12')?.value || null,
      };
    }
    // Correct Score
    if (marketId === 57) {
      odds.correctScore = values.map((v: any) => ({
        score: v.label,
        odds: v.value,
      }));
    }
    // Half Time Result
    if (marketId === 7) {
      odds.halfTime = {
        home: values.find((v: any) => v.label === '1')?.value || null,
        draw: values.find((v: any) => v.label === 'X')?.value || null,
        away: values.find((v: any) => v.label === '2')?.value || null,
      };
    }
  });

  return odds;
}

// Form hesapla
function calculateForm(matches: any[], teamId: number) {
  if (!matches || matches.length === 0) return { form: 'N/A', points: 0, goals: 0, conceded: 0 };

  let points = 0;
  let goals = 0;
  let conceded = 0;
  const formArray: string[] = [];

  matches.slice(0, 5).forEach((match: any) => {
    const scores = match.scores || [];
    const homeScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
    const awayScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;

    const isHome = match.participants?.find((p: any) => p.id === teamId && p.meta?.location === 'home');
    const teamGoals = isHome ? homeScore : awayScore;
    const oppGoals = isHome ? awayScore : homeScore;

    goals += teamGoals;
    conceded += oppGoals;

    if (teamGoals > oppGoals) {
      points += 3;
      formArray.push('W');
    } else if (teamGoals === oppGoals) {
      points += 1;
      formArray.push('D');
    } else {
      formArray.push('L');
    }
  });

  return {
    form: formArray.join(''),
    points,
    goals,
    conceded,
    avgGoals: (goals / Math.max(formArray.length, 1)).toFixed(1),
    avgConceded: (conceded / Math.max(formArray.length, 1)).toFixed(1),
  };
}

// Agresif AI Prompt oluştur - DİL DESTEKLİ
function createAggressivePrompt(data: any, language: string = 'tr') {
  const { homeTeam, awayTeam, odds, homeForm, awayForm, h2h, fixture } = data;

  // Dil talimatları
  const langInstructions: Record<string, string> = {
    tr: 'TÜM yanıtlarını ve açıklamalarını TÜRKÇE olarak ver. JSON içindeki tüm "reasoning", "reason", "overallAnalysis" alanları TÜRKÇE olmalı.',
    en: 'Provide ALL your responses and explanations in ENGLISH. All "reasoning", "reason", "overallAnalysis" fields in JSON must be in ENGLISH.',
    de: 'Gib ALLE deine Antworten und Erklärungen auf DEUTSCH. Alle "reasoning", "reason", "overallAnalysis" Felder im JSON müssen auf DEUTSCH sein.',
  };

  // Dile göre etiketler
  const langLabels: Record<string, any> = {
    tr: {
      matchResult: 'Maç Sonucu',
      overUnder: 'Üst/Alt 2.5 Gol',
      btts: 'Karşılıklı Gol',
      doubleChance: 'Çifte Şans',
      halfTime: 'İlk Yarı Sonucu',
      correctScore: 'Doğru Skor',
      totalGoals: 'Toplam Gol Aralığı',
      firstGoal: 'İlk Gol',
      handicap: 'Handikap',
      starPlayer: 'Maçın Yıldızı',
      home: 'Ev Sahibi',
      away: 'Deplasman',
      draw: 'Beraberlik',
      over: 'Üst',
      under: 'Alt',
      yes: 'Var',
      no: 'Yok',
      noGoal: 'Gol Yok',
      low: 'Düşük',
      medium: 'Orta',
      high: 'Yüksek',
      lastMatches: 'Son 5 maç',
      points: 'Puan',
      avgGoalsScored: 'Attığı gol ort',
      avgGoalsConceded: 'Yediği gol ort',
      h2h: 'KAFA KAFAYA',
      noData: 'Veri yok',
      task: 'GÖREV',
      rules: 'ÖNEMLİ KURALLAR',
      outputFormat: 'ÇIKTI FORMATI',
      shortExplanation: 'Kısa açıklama',
      bestBetType: 'En güvenli bahis tipi',
      whyBest: 'Neden bu en iyi seçenek',
      whyDifferent: 'Neden fark yaratacak',
      overallEval: 'Genel maç değerlendirmesi',
    },
    en: {
      matchResult: 'Match Result',
      overUnder: 'Over/Under 2.5 Goals',
      btts: 'Both Teams to Score',
      doubleChance: 'Double Chance',
      halfTime: 'Half Time Result',
      correctScore: 'Correct Score',
      totalGoals: 'Total Goals Range',
      firstGoal: 'First Goal',
      handicap: 'Handicap',
      starPlayer: 'Star Player',
      home: 'Home',
      away: 'Away',
      draw: 'Draw',
      over: 'Over',
      under: 'Under',
      yes: 'Yes',
      no: 'No',
      noGoal: 'No Goal',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      lastMatches: 'Last 5 matches',
      points: 'Points',
      avgGoalsScored: 'Avg goals scored',
      avgGoalsConceded: 'Avg goals conceded',
      h2h: 'HEAD TO HEAD',
      noData: 'No data',
      task: 'TASK',
      rules: 'IMPORTANT RULES',
      outputFormat: 'OUTPUT FORMAT',
      shortExplanation: 'Short explanation',
      bestBetType: 'Safest bet type',
      whyBest: 'Why this is the best option',
      whyDifferent: 'Why will make a difference',
      overallEval: 'Overall match evaluation',
    },
    de: {
      matchResult: 'Spielergebnis',
      overUnder: 'Über/Unter 2.5 Tore',
      btts: 'Beide Teams treffen',
      doubleChance: 'Doppelte Chance',
      halfTime: 'Halbzeitergebnis',
      correctScore: 'Genaues Ergebnis',
      totalGoals: 'Tore Gesamt',
      firstGoal: 'Erstes Tor',
      handicap: 'Handicap',
      starPlayer: 'Spieler des Spiels',
      home: 'Heim',
      away: 'Auswärts',
      draw: 'Unentschieden',
      over: 'Über',
      under: 'Unter',
      yes: 'Ja',
      no: 'Nein',
      noGoal: 'Kein Tor',
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch',
      lastMatches: 'Letzte 5 Spiele',
      points: 'Punkte',
      avgGoalsScored: 'Ø Tore geschossen',
      avgGoalsConceded: 'Ø Tore kassiert',
      h2h: 'DIREKTER VERGLEICH',
      noData: 'Keine Daten',
      task: 'AUFGABE',
      rules: 'WICHTIGE REGELN',
      outputFormat: 'AUSGABEFORMAT',
      shortExplanation: 'Kurze Erklärung',
      bestBetType: 'Sicherste Wettart',
      whyBest: 'Warum ist das die beste Option',
      whyDifferent: 'Warum wird er den Unterschied machen',
      overallEval: 'Gesamtbewertung des Spiels',
    },
  };

  const labels = langLabels[language] || langLabels.en;
  const langInstruction = langInstructions[language] || langInstructions.en;

  return `${langInstruction}

You are a world-renowned football analysis expert known for aggressive predictions. You make bold, clear predictions that help bettors win.

🏟️ MATCH: ${homeTeam} vs ${awayTeam}

📊 BETTING ODDS:
${odds.matchWinner ? `- ${labels.matchResult}: 1=${odds.matchWinner.home} | X=${odds.matchWinner.draw} | 2=${odds.matchWinner.away}` : ''}
${odds.overUnder ? `- ${labels.overUnder}: ${labels.over}=${odds.overUnder.over} | ${labels.under}=${odds.overUnder.under}` : ''}
${odds.btts ? `- ${labels.btts}: ${labels.yes}=${odds.btts.yes} | ${labels.no}=${odds.btts.no}` : ''}
${odds.doubleChance ? `- ${labels.doubleChance}: 1X=${odds.doubleChance.homeOrDraw} | X2=${odds.doubleChance.awayOrDraw} | 12=${odds.doubleChance.homeOrAway}` : ''}
${odds.halfTime ? `- ${labels.halfTime}: 1=${odds.halfTime.home} | X=${odds.halfTime.draw} | 2=${odds.halfTime.away}` : ''}

📈 ${homeTeam} FORM:
- ${labels.lastMatches}: ${homeForm.form || 'N/A'}
- ${labels.points}: ${homeForm.points}/15
- ${labels.avgGoalsScored}: ${homeForm.avgGoals}
- ${labels.avgGoalsConceded}: ${homeForm.avgConceded}

📉 ${awayTeam} FORM:
- ${labels.lastMatches}: ${awayForm.form || 'N/A'}
- ${labels.points}: ${awayForm.points}/15
- ${labels.avgGoalsScored}: ${awayForm.avgGoals}
- ${labels.avgGoalsConceded}: ${awayForm.avgConceded}

⚔️ ${labels.h2h} (Last 5):
${h2h.slice(0, 5).map((m: any) => {
  const home = m.participants?.find((p: any) => p.meta?.location === 'home')?.name;
  const away = m.participants?.find((p: any) => p.meta?.location === 'away')?.name;
  const scores = m.scores?.find((s: any) => s.description === 'CURRENT');
  return `- ${home} ${scores?.score?.home || '?'}-${scores?.score?.away || '?'} ${away}`;
}).join('\n') || labels.noData}

🎯 ${labels.task}:
Analyze ALL betting types below and give a CLEAR prediction for each:

1. ${labels.matchResult} (1X2): Prediction (1, X or 2) and confidence (60-95%)
2. ${labels.overUnder}: Prediction (${labels.over} or ${labels.under}) and confidence
3. ${labels.btts}: Prediction (${labels.yes} or ${labels.no}) and confidence
4. ${labels.doubleChance}: Best option (1X, X2 or 12) and confidence
5. ${labels.halfTime}: Prediction (1, X or 2) and confidence
6. ${labels.correctScore}: Top 3 most likely scores with percentages
7. ${labels.totalGoals}: Choose from 0-1, 2-3, 4-5, 6+
8. ${labels.firstGoal}: Which team scores first? (${labels.home}, ${labels.away}, ${labels.noGoal})
9. ${labels.handicap}: -1.5 or +1.5 recommendation
10. ${labels.starPlayer}: Player who will make the difference

⚠️ ${labels.rules}:
- NEVER use uncertain words like "maybe", "possibly", "might"
- Make a DEFINITE choice for each prediction
- Confidence must not be below 60%
- If odds disagree with your prediction, EXPLAIN why
- HIGHLIGHT value bet opportunities (AI prediction > Betting probability)

📝 ${labels.outputFormat} (JSON):
{
  "matchResult": {
    "prediction": "1 or X or 2",
    "confidence": 75,
    "reasoning": "${labels.shortExplanation}",
    "value": true/false
  },
  "overUnder25": {
    "prediction": "${labels.over} or ${labels.under}",
    "confidence": 70,
    "reasoning": "${labels.shortExplanation}",
    "value": true/false
  },
  "btts": {
    "prediction": "${labels.yes} or ${labels.no}",
    "confidence": 72,
    "reasoning": "${labels.shortExplanation}",
    "value": true/false
  },
  "doubleChance": {
    "prediction": "1X or X2 or 12",
    "confidence": 85,
    "reasoning": "${labels.shortExplanation}"
  },
  "halfTimeResult": {
    "prediction": "1 or X or 2",
    "confidence": 65,
    "reasoning": "${labels.shortExplanation}"
  },
  "correctScore": {
    "first": { "score": "2-1", "confidence": 15 },
    "second": { "score": "1-1", "confidence": 12 },
    "third": { "score": "2-0", "confidence": 10 }
  },
  "totalGoalsRange": {
    "prediction": "2-3",
    "confidence": 68
  },
  "firstGoal": {
    "prediction": "${labels.home} or ${labels.away} or ${labels.noGoal}",
    "confidence": 70
  },
  "handicap": {
    "team": "${homeTeam} or ${awayTeam}",
    "line": "-1.5 or +1.5",
    "confidence": 65
  },
  "starPlayer": {
    "name": "Player name",
    "team": "Team name",
    "reason": "${labels.whyDifferent}"
  },
  "overallAnalysis": "2-3 sentence ${labels.overallEval}",
  "bestBet": {
    "type": "${labels.bestBetType}",
    "prediction": "Prediction",
    "confidence": 80,
    "reasoning": "${labels.whyBest}"
  },
  "riskLevel": "${labels.low}/${labels.medium}/${labels.high}"
}

ONLY respond with JSON format, nothing else. ALL explanations must be in ${language.toUpperCase()}!`;
}

// Claude analizi
async function analyzeWithClaude(prompt: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('Claude error:', error);
    return null;
  }
}

// OpenAI analizi
async function analyzeWithOpenAI(prompt: string) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    });
    const text = response.choices[0]?.message?.content || '';
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

// Gemini analizi
async function analyzeWithGemini(prompt: string) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

// Consensus hesapla
function calculateConsensus(analyses: any[]) {
  const validAnalyses = analyses.filter(a => a !== null);
  if (validAnalyses.length === 0) return null;

  const consensus: any = {
    matchResult: { predictions: {}, confidence: 0 },
    overUnder25: { predictions: {}, confidence: 0 },
    btts: { predictions: {}, confidence: 0 },
    doubleChance: { predictions: {}, confidence: 0 },
    halfTimeResult: { predictions: {}, confidence: 0 },
    correctScore: [],
    totalGoalsRange: { predictions: {}, confidence: 0 },
    firstGoal: { predictions: {}, confidence: 0 },
    aiAgreement: 0,
  };

  // Her kategori için sayım yap
  validAnalyses.forEach(analysis => {
    // Match Result
    if (analysis.matchResult) {
      const pred = analysis.matchResult.prediction;
      consensus.matchResult.predictions[pred] = (consensus.matchResult.predictions[pred] || 0) + 1;
      consensus.matchResult.confidence += analysis.matchResult.confidence || 0;
    }

    // Over/Under
    if (analysis.overUnder25) {
      const pred = analysis.overUnder25.prediction;
      consensus.overUnder25.predictions[pred] = (consensus.overUnder25.predictions[pred] || 0) + 1;
      consensus.overUnder25.confidence += analysis.overUnder25.confidence || 0;
    }

    // BTTS
    if (analysis.btts) {
      const pred = analysis.btts.prediction;
      consensus.btts.predictions[pred] = (consensus.btts.predictions[pred] || 0) + 1;
      consensus.btts.confidence += analysis.btts.confidence || 0;
    }

    // Double Chance
    if (analysis.doubleChance) {
      const pred = analysis.doubleChance.prediction;
      consensus.doubleChance.predictions[pred] = (consensus.doubleChance.predictions[pred] || 0) + 1;
      consensus.doubleChance.confidence += analysis.doubleChance.confidence || 0;
    }

    // Half Time
    if (analysis.halfTimeResult) {
      const pred = analysis.halfTimeResult.prediction;
      consensus.halfTimeResult.predictions[pred] = (consensus.halfTimeResult.predictions[pred] || 0) + 1;
      consensus.halfTimeResult.confidence += analysis.halfTimeResult.confidence || 0;
    }

    // Correct Scores
    if (analysis.correctScore) {
      consensus.correctScore.push(analysis.correctScore);
    }

    // Total Goals Range
    if (analysis.totalGoalsRange) {
      const pred = analysis.totalGoalsRange.prediction;
      consensus.totalGoalsRange.predictions[pred] = (consensus.totalGoalsRange.predictions[pred] || 0) + 1;
      consensus.totalGoalsRange.confidence += analysis.totalGoalsRange.confidence || 0;
    }

    // First Goal
    if (analysis.firstGoal) {
      const pred = analysis.firstGoal.prediction;
      consensus.firstGoal.predictions[pred] = (consensus.firstGoal.predictions[pred] || 0) + 1;
      consensus.firstGoal.confidence += analysis.firstGoal.confidence || 0;
    }
  });

  // En çok oy alan tahminleri bul
  const getFinalPrediction = (category: any) => {
    const preds = category.predictions;
    if (Object.keys(preds).length === 0) return null;
    const maxVotes = Math.max(...Object.values(preds) as number[]);
    const winner = Object.keys(preds).find(k => preds[k] === maxVotes);
    return {
      prediction: winner,
      confidence: Math.round(category.confidence / validAnalyses.length),
      votes: maxVotes,
      totalVotes: validAnalyses.length,
      unanimous: maxVotes === validAnalyses.length,
    };
  };

  return {
    matchResult: getFinalPrediction(consensus.matchResult),
    overUnder25: getFinalPrediction(consensus.overUnder25),
    btts: getFinalPrediction(consensus.btts),
    doubleChance: getFinalPrediction(consensus.doubleChance),
    halfTimeResult: getFinalPrediction(consensus.halfTimeResult),
    totalGoalsRange: getFinalPrediction(consensus.totalGoalsRange),
    firstGoal: getFinalPrediction(consensus.firstGoal),
    correctScore: consensus.correctScore[0] || null,
    aiCount: validAnalyses.length,
    bestBets: validAnalyses.map(a => a?.bestBet).filter(Boolean),
    starPlayers: validAnalyses.map(a => a?.starPlayer).filter(Boolean),
    riskLevels: validAnalyses.map(a => a?.riskLevel).filter(Boolean),
    overallAnalyses: validAnalyses.map(a => a?.overallAnalysis).filter(Boolean),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, language = 'en' } = body;

    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID gerekli' }, { status: 400 });
    }

    // Verileri paralel olarak çek
    const [fixture, homeRecentMatches, awayRecentMatches, h2h] = await Promise.all([
      fetchFixtureData(fixtureId),
      homeTeamId ? fetchRecentMatches(homeTeamId) : Promise.resolve([]),
      awayTeamId ? fetchRecentMatches(awayTeamId) : Promise.resolve([]),
      homeTeamId && awayTeamId ? fetchH2H(homeTeamId, awayTeamId) : Promise.resolve([]),
    ]);

    // Odds parse et
    const odds = parseOdds(fixture);

    // Form hesapla
    const homeForm = calculateForm(homeRecentMatches, homeTeamId);
    const awayForm = calculateForm(awayRecentMatches, awayTeamId);

    // Prompt oluştur - DİL PARAMETRESİ EKLENDİ
    const prompt = createAggressivePrompt({
      homeTeam,
      awayTeam,
      odds,
      homeForm,
      awayForm,
      h2h,
      fixture,
    }, language);

    // 3 AI'dan paralel analiz al
    const [claudeAnalysis, openaiAnalysis, geminiAnalysis] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
    ]);

    // Consensus hesapla
    const consensus = calculateConsensus([claudeAnalysis, openaiAnalysis, geminiAnalysis]);

    // Başarılı AI'ları listele
    const aiStatus = {
      claude: claudeAnalysis ? '✅' : '❌',
      openai: openaiAnalysis ? '✅' : '❌',
      gemini: geminiAnalysis ? '✅' : '❌',
    };

    return NextResponse.json({
      success: true,
      fixture: {
        id: fixtureId,
        homeTeam,
        awayTeam,
      },
      odds,
      form: {
        home: homeForm,
        away: awayForm,
      },
      h2h: h2h.slice(0, 5),
      analysis: consensus,
      individualAnalyses: {
        claude: claudeAnalysis,
        openai: openaiAnalysis,
        gemini: geminiAnalysis,
      },
      aiStatus,
      language,
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Analiz hatası: ' + error.message }, { status: 500 });
  }
}
