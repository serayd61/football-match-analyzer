import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ============================================================================
// SPORTMONKS VERİ ÇEKME
// ============================================================================

async function getTeamStats(teamId: number) {
  if (!teamId || !SPORTMONKS_API_KEY) {
    return { form: 'DDDDD', avgScored: 1.5, avgConceded: 1.2, cleanSheets: 2, failedToScore: 1 };
  }

  try {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 60);

    const res = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/between/${past.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants&per_page=10`,
      { next: { revalidate: 1800 } }
    );

    if (!res.ok) return { form: 'DDDDD', avgScored: 1.5, avgConceded: 1.2, cleanSheets: 2, failedToScore: 1 };

    const json = await res.json();
    const matches = json.data || [];
    if (!matches.length) return { form: 'DDDDD', avgScored: 1.5, avgConceded: 1.2, cleanSheets: 2, failedToScore: 1 };

    let scored = 0, conceded = 0, cleanSheets = 0, failedToScore = 0;
    const formArr: string[] = [];

    matches.slice(0, 10).forEach((m: any) => {
      const home = m.participants?.find((p: any) => p.meta?.location === 'home');
      const scores = m.scores?.find((s: any) => s.description === 'CURRENT');
      const hg = scores?.score?.home ?? 0;
      const ag = scores?.score?.away ?? 0;
      const isHome = home?.id === teamId;
      const teamGoals = isHome ? hg : ag;
      const oppGoals = isHome ? ag : hg;

      scored += teamGoals;
      conceded += oppGoals;
      if (oppGoals === 0) cleanSheets++;
      if (teamGoals === 0) failedToScore++;
      formArr.push(teamGoals > oppGoals ? 'W' : teamGoals < oppGoals ? 'L' : 'D');
    });

    const total = matches.length;
    return {
      form: formArr.slice(0, 5).join(''),
      avgScored: +(scored / total).toFixed(2),
      avgConceded: +(conceded / total).toFixed(2),
      cleanSheets,
      failedToScore,
    };
  } catch {
    return { form: 'DDDDD', avgScored: 1.5, avgConceded: 1.2, cleanSheets: 2, failedToScore: 1 };
  }
}

async function getH2H(homeId: number, awayId: number) {
  if (!homeId || !awayId || !SPORTMONKS_API_KEY) {
    return { played: 0, homeWins: 0, awayWins: 0, draws: 0, avgGoals: 2.5, btts: 50, over25: 50 };
  }

  try {
    const res = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeId}/${awayId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return { played: 0, homeWins: 0, awayWins: 0, draws: 0, avgGoals: 2.5, btts: 50, over25: 50 };

    const json = await res.json();
    const matches = json.data || [];
    if (!matches.length) return { played: 0, homeWins: 0, awayWins: 0, draws: 0, avgGoals: 2.5, btts: 50, over25: 50 };

    let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, bttsCount = 0, over25Count = 0;

    matches.slice(0, 10).forEach((m: any) => {
      const home = m.participants?.find((p: any) => p.meta?.location === 'home');
      const scores = m.scores?.find((s: any) => s.description === 'CURRENT');
      const hg = scores?.score?.home ?? 0;
      const ag = scores?.score?.away ?? 0;
      const wasHomeTeamHome = home?.id === homeId;

      if (wasHomeTeamHome) {
        if (hg > ag) homeWins++; else if (ag > hg) awayWins++; else draws++;
      } else {
        if (ag > hg) homeWins++; else if (hg > ag) awayWins++; else draws++;
      }

      totalGoals += hg + ag;
      if (hg > 0 && ag > 0) bttsCount++;
      if (hg + ag > 2) over25Count++;
    });

    const played = matches.length;
    return {
      played,
      homeWins,
      awayWins,
      draws,
      avgGoals: +(totalGoals / played).toFixed(2),
      btts: Math.round((bttsCount / played) * 100),
      over25: Math.round((over25Count / played) * 100),
    };
  } catch {
    return { played: 0, homeWins: 0, awayWins: 0, draws: 0, avgGoals: 2.5, btts: 50, over25: 50 };
  }
}

// ============================================================================
// AI PROMPT OLUŞTURMA
// ============================================================================

function createPrompt(home: string, away: string, homeStats: any, awayStats: any, h2h: any, lang: string) {
  const tr = lang === 'tr';
  const de = lang === 'de';

  if (tr) {
    return `Profesyonel futbol analisti olarak bu maçı analiz et:

**${home} vs ${away}**

**${home} (Ev Sahibi):**
- Form: ${homeStats.form}
- Maç başı atılan: ${homeStats.avgScored} gol
- Maç başı yenilen: ${homeStats.avgConceded} gol
- Gol yemeden: ${homeStats.cleanSheets} maç
- Gol atamadan: ${homeStats.failedToScore} maç

**${away} (Deplasman):**
- Form: ${awayStats.form}
- Maç başı atılan: ${awayStats.avgScored} gol
- Maç başı yenilen: ${awayStats.avgConceded} gol
- Gol yemeden: ${awayStats.cleanSheets} maç
- Gol atamadan: ${awayStats.failedToScore} maç

**H2H (${h2h.played} maç):**
- ${home}: ${h2h.homeWins} galibiyet
- ${away}: ${h2h.awayWins} galibiyet
- Beraberlik: ${h2h.draws}
- Ort. gol: ${h2h.avgGoals}
- KG VAR: %${h2h.btts}
- 2.5 Üst: %${h2h.over25}

TAHMİNLERİNİ TAM OLARAK BU FORMATTA VER:

SONUC: [Ev Sahibi/Beraberlik/Deplasman]
SONUC_GUVEN: [50-95]

GOL: [Ust 2.5/Alt 2.5]
GOL_GUVEN: [50-95]

BTTS: [Evet/Hayir]
BTTS_GUVEN: [50-95]

ANALIZ: [1-2 cümle açıklama]`;
  }

  if (de) {
    return `Als professioneller Fußballanalyst, analysiere dieses Spiel:

**${home} vs ${away}**

**${home} (Heim):**
- Form: ${homeStats.form}
- Tore pro Spiel: ${homeStats.avgScored}
- Gegentore pro Spiel: ${homeStats.avgConceded}
- Zu Null: ${homeStats.cleanSheets}
- Ohne Tor: ${homeStats.failedToScore}

**${away} (Auswärts):**
- Form: ${awayStats.form}
- Tore pro Spiel: ${awayStats.avgScored}
- Gegentore pro Spiel: ${awayStats.avgConceded}
- Zu Null: ${awayStats.cleanSheets}
- Ohne Tor: ${awayStats.failedToScore}

**H2H (${h2h.played} Spiele):**
- ${home}: ${h2h.homeWins} Siege
- ${away}: ${h2h.awayWins} Siege
- Unentschieden: ${h2h.draws}
- Durchschn. Tore: ${h2h.avgGoals}
- Beide treffen: ${h2h.btts}%
- Über 2.5: ${h2h.over25}%

VORHERSAGEN GENAU IN DIESEM FORMAT:

ERGEBNIS: [Heimsieg/Unentschieden/Auswärtssieg]
ERGEBNIS_KONFIDENZ: [50-95]

TORE: [Über 2.5/Unter 2.5]
TORE_KONFIDENZ: [50-95]

BTTS: [Ja/Nein]
BTTS_KONFIDENZ: [50-95]

ANALYSE: [1-2 Sätze Erklärung]`;
  }

  // English default
  return `As a professional football analyst, analyze this match:

**${home} vs ${away}**

**${home} (Home):**
- Form: ${homeStats.form}
- Goals per game: ${homeStats.avgScored}
- Conceded per game: ${homeStats.avgConceded}
- Clean sheets: ${homeStats.cleanSheets}
- Failed to score: ${homeStats.failedToScore}

**${away} (Away):**
- Form: ${awayStats.form}
- Goals per game: ${awayStats.avgScored}
- Conceded per game: ${awayStats.avgConceded}
- Clean sheets: ${awayStats.cleanSheets}
- Failed to score: ${awayStats.failedToScore}

**H2H (${h2h.played} games):**
- ${home}: ${h2h.homeWins} wins
- ${away}: ${h2h.awayWins} wins
- Draws: ${h2h.draws}
- Avg goals: ${h2h.avgGoals}
- BTTS: ${h2h.btts}%
- Over 2.5: ${h2h.over25}%

PREDICTIONS IN EXACTLY THIS FORMAT:

RESULT: [Home Win/Draw/Away Win]
RESULT_CONFIDENCE: [50-95]

GOALS: [Over 2.5/Under 2.5]
GOALS_CONFIDENCE: [50-95]

BTTS: [Yes/No]
BTTS_CONFIDENCE: [50-95]

ANALYSIS: [1-2 sentence explanation]`;
}

// ============================================================================
// AI ÇAĞRILARI
// ============================================================================

async function callClaude(prompt: string) {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.content?.[0]?.text || null;
  } catch { return null; }
}

async function callOpenAI(prompt: string) {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.7 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

async function callGemini(prompt: string) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.7 } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

async function callPerplexity(prompt: string) {
  if (!PERPLEXITY_API_KEY) return null;
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PERPLEXITY_API_KEY}` },
      body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.7 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// ============================================================================
// YANIT PARSE
// ============================================================================

function parseResponse(text: string, lang: string) {
  const lines = text.toUpperCase();
  
  let matchResult = 'Draw';
  let matchConf = 60;
  let goals = 'Under 2.5';
  let goalsConf = 60;
  let btts = 'No';
  let bttsConf = 60;
  let analysis = '';

  // Match Result - çoklu dil desteği
  if (lines.includes('SONUC:') || lines.includes('RESULT:') || lines.includes('ERGEBNIS:')) {
    if (lines.includes('EV SAHIBI') || lines.includes('HOME WIN') || lines.includes('HEIMSIEG')) {
      matchResult = 'Home Win';
    } else if (lines.includes('DEPLASMAN') || lines.includes('AWAY WIN') || lines.includes('AUSWÄRTSSIEG') || lines.includes('AUSWARTSSIEG')) {
      matchResult = 'Away Win';
    } else if (lines.includes('BERABERLIK') || lines.includes('DRAW') || lines.includes('UNENTSCHIEDEN')) {
      matchResult = 'Draw';
    }
  }

  // Match Result Confidence
  const matchConfMatch = text.match(/(?:SONUC_GUVEN|RESULT_CONFIDENCE|ERGEBNIS_KONFIDENZ)[:\s]*(\d+)/i);
  if (matchConfMatch) matchConf = Math.min(95, Math.max(50, parseInt(matchConfMatch[1])));

  // Goals
  if (lines.includes('GOL:') || lines.includes('GOALS:') || lines.includes('TORE:')) {
    if (lines.includes('UST') || lines.includes('OVER') || lines.includes('ÜBER') || lines.includes('UBER')) {
      goals = 'Over 2.5';
    } else if (lines.includes('ALT') || lines.includes('UNDER') || lines.includes('UNTER')) {
      goals = 'Under 2.5';
    }
  }

  // Goals Confidence
  const goalsConfMatch = text.match(/(?:GOL_GUVEN|GOALS_CONFIDENCE|TORE_KONFIDENZ)[:\s]*(\d+)/i);
  if (goalsConfMatch) goalsConf = Math.min(95, Math.max(50, parseInt(goalsConfMatch[1])));

  // BTTS
  if (lines.includes('BTTS:')) {
    if (lines.includes('EVET') || lines.includes('YES') || lines.includes('JA')) {
      btts = 'Yes';
    } else if (lines.includes('HAYIR') || lines.includes('NO') || lines.includes('NEIN')) {
      btts = 'No';
    }
  }

  // BTTS Confidence
  const bttsConfMatch = text.match(/(?:BTTS_GUVEN|BTTS_CONFIDENCE|BTTS_KONFIDENZ)[:\s]*(\d+)/i);
  if (bttsConfMatch) bttsConf = Math.min(95, Math.max(50, parseInt(bttsConfMatch[1])));

  // Analysis
  const analysisMatch = text.match(/(?:ANALIZ|ANALYSIS|ANALYSE)[:\s]*(.*?)(?:\n|$)/i);
  if (analysisMatch) analysis = analysisMatch[1].trim();

  return { matchResult, matchConf, goals, goalsConf, btts, bttsConf, analysis };
}

// ============================================================================
// CONSENSUS HESAPLAMA
// ============================================================================

function getConsensus(results: any[]) {
  const matchVotes: Record<string, number[]> = {};
  const goalsVotes: Record<string, number[]> = {};
  const bttsVotes: Record<string, number[]> = {};

  results.forEach(r => {
    if (!matchVotes[r.matchResult]) matchVotes[r.matchResult] = [];
    matchVotes[r.matchResult].push(r.matchConf);

    if (!goalsVotes[r.goals]) goalsVotes[r.goals] = [];
    goalsVotes[r.goals].push(r.goalsConf);

    if (!bttsVotes[r.btts]) bttsVotes[r.btts] = [];
    bttsVotes[r.btts].push(r.bttsConf);
  });

  const pick = (votes: Record<string, number[]>) => {
    let best = { pred: 'Unknown', conf: 50, votes: 0 };
    Object.entries(votes).forEach(([p, confs]) => {
      const avg = Math.round(confs.reduce((a, b) => a + b, 0) / confs.length);
      if (confs.length > best.votes || (confs.length === best.votes && avg > best.conf)) {
        best = { pred: p, conf: avg, votes: confs.length };
      }
    });
    return best;
  };

  return {
    matchResult: pick(matchVotes),
    overUnder25: pick(goalsVotes),
    btts: pick(bttsVotes),
  };
}

// ============================================================================
// ANA HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Dashboard'dan gelen field isimleri
    const { homeTeam, awayTeam, homeTeamId, awayTeamId, language = 'tr' } = body;

    if (!homeTeam || !awayTeam) {
      return NextResponse.json({ success: false, error: 'Takım adları gerekli.' }, { status: 400 });
    }

    console.log(`⚽ Analyzing: ${homeTeam} vs ${awayTeam}`);

    // Verileri çek
    const [homeStats, awayStats, h2h] = await Promise.all([
      getTeamStats(homeTeamId),
      getTeamStats(awayTeamId),
      getH2H(homeTeamId, awayTeamId),
    ]);

    // Prompt oluştur
    const prompt = createPrompt(homeTeam, awayTeam, homeStats, awayStats, h2h, language);

    // AI'ları paralel çağır
    const [claudeText, openaiText, geminiText, perplexityText] = await Promise.all([
      callClaude(prompt),
      callOpenAI(prompt),
      callGemini(prompt),
      callPerplexity(prompt),
    ]);

    // Sonuçları topla
    const aiStatus = { claude: !!claudeText, openai: !!openaiText, gemini: !!geminiText, perplexity: !!perplexityText };
    const individualAnalyses: Record<string, any> = {};
    const parsed: any[] = [];

    if (claudeText) {
      const p = parseResponse(claudeText, language);
      parsed.push(p);
      individualAnalyses.claude = { matchResult: { prediction: p.matchResult, confidence: p.matchConf }, overUnder25: { prediction: p.goals, confidence: p.goalsConf }, btts: { prediction: p.btts, confidence: p.bttsConf } };
    }
    if (openaiText) {
      const p = parseResponse(openaiText, language);
      parsed.push(p);
      individualAnalyses.openai = { matchResult: { prediction: p.matchResult, confidence: p.matchConf }, overUnder25: { prediction: p.goals, confidence: p.goalsConf }, btts: { prediction: p.btts, confidence: p.bttsConf } };
    }
    if (geminiText) {
      const p = parseResponse(geminiText, language);
      parsed.push(p);
      individualAnalyses.gemini = { matchResult: { prediction: p.matchResult, confidence: p.matchConf }, overUnder25: { prediction: p.goals, confidence: p.goalsConf }, btts: { prediction: p.btts, confidence: p.bttsConf } };
    }
    if (perplexityText) {
      const p = parseResponse(perplexityText, language);
      parsed.push(p);
      individualAnalyses.perplexity = { matchResult: { prediction: p.matchResult, confidence: p.matchConf }, overUnder25: { prediction: p.goals, confidence: p.goalsConf }, btts: { prediction: p.btts, confidence: p.bttsConf } };
    }

    console.log(`🤖 ${parsed.length}/4 AI responded`);

    if (parsed.length === 0) {
      return NextResponse.json({ success: false, error: 'AI modelleri yanıt vermedi.' }, { status: 500 });
    }

    // Consensus
    const consensus = getConsensus(parsed);
    const total = parsed.length;

    // Best bet
    const bets = [
      { type: 'MATCH_RESULT', selection: consensus.matchResult.pred, conf: consensus.matchResult.conf, votes: consensus.matchResult.votes },
      { type: 'OVER_UNDER_25', selection: consensus.overUnder25.pred, conf: consensus.overUnder25.conf, votes: consensus.overUnder25.votes },
      { type: 'BTTS', selection: consensus.btts.pred, conf: consensus.btts.conf, votes: consensus.btts.votes },
    ].sort((a, b) => (b.votes * 100 + b.conf) - (a.votes * 100 + a.conf));

    const best = bets[0];
    const risk = best.votes >= 3 ? 'Low' : best.votes >= 2 ? 'Medium' : 'High';

    // Dashboard formatında response
    return NextResponse.json({
      success: true,
      analysis: {
        matchResult: { prediction: consensus.matchResult.pred, confidence: consensus.matchResult.conf, votes: consensus.matchResult.votes, totalVotes: total },
        overUnder25: { prediction: consensus.overUnder25.pred, confidence: consensus.overUnder25.conf, votes: consensus.overUnder25.votes, totalVotes: total },
        btts: { prediction: consensus.btts.pred, confidence: consensus.btts.conf, votes: consensus.btts.votes, totalVotes: total },
        riskLevel: risk,
        bestBets: [{ type: best.type, selection: best.selection, confidence: best.conf, reasoning: `${best.votes}/${total} AI model uzlaştı.` }],
        overallAnalyses: parsed.map(p => p.analysis).filter(Boolean).slice(0, 2),
      },
      aiStatus,
      individualAnalyses,
      modelsUsed: Object.keys(individualAnalyses),
      totalModels: total,
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
