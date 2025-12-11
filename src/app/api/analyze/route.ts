import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ============================================================================
// SPORTMONKS - TAKIM İSTATİSTİKLERİ
// ============================================================================

async function fetchTeamStats(teamId: number, teamName: string) {
  const defaults = {
    name: teamName,
    form: 'DDDDD',
    played: 10,
    wins: 3,
    draws: 4,
    losses: 3,
    goalsFor: 12,
    goalsAgainst: 10,
    avgGoalsFor: 1.2,
    avgGoalsAgainst: 1.0,
    cleanSheets: 3,
    failedToScore: 2,
    last5Results: [] as string[],
  };

  if (!teamId || !SPORTMONKS_API_KEY) {
    console.log(`⚠️ No teamId or API key for ${teamName}, using defaults`);
    return defaults;
  }

  try {
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 90);

    const url = `https://api.sportmonks.com/v3/football/fixtures/between/${pastDate.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants&per_page=15`;
    
    console.log(`📊 Fetching stats for ${teamName} (ID: ${teamId})`);
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.log(`❌ API error for ${teamName}: ${response.status}`);
      return defaults;
    }

    const json = await response.json();
    const matches = json.data || [];

    if (matches.length === 0) {
      console.log(`⚠️ No matches found for ${teamName}`);
      return defaults;
    }

    console.log(`✅ Found ${matches.length} matches for ${teamName}`);

    let wins = 0, draws = 0, losses = 0;
    let goalsFor = 0, goalsAgainst = 0;
    let cleanSheets = 0, failedToScore = 0;
    const formArray: string[] = [];
    const last5Results: string[] = [];

    // Her maçı işle
    for (const match of matches.slice(0, 10)) {
      const participants = match.participants || [];
      const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
      const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
      
      // Skor bul
      const scores = match.scores || [];
      let homeGoals = 0;
      let awayGoals = 0;

      for (const score of scores) {
        if (score.description === 'CURRENT') {
          homeGoals = score.score?.home ?? 0;
          awayGoals = score.score?.away ?? 0;
          break;
        }
      }

      // Bu takım ev sahibi mi deplasman mı?
      const isHome = homeTeam?.id === teamId;
      const teamGoals = isHome ? homeGoals : awayGoals;
      const opponentGoals = isHome ? awayGoals : homeGoals;
      const opponentName = isHome ? awayTeam?.name : homeTeam?.name;

      // İstatistikleri güncelle
      goalsFor += teamGoals;
      goalsAgainst += opponentGoals;

      if (opponentGoals === 0) cleanSheets++;
      if (teamGoals === 0) failedToScore++;

      let result: string;
      if (teamGoals > opponentGoals) {
        wins++;
        result = 'W';
      } else if (teamGoals < opponentGoals) {
        losses++;
        result = 'L';
      } else {
        draws++;
        result = 'D';
      }

      formArray.push(result);
      
      if (last5Results.length < 5) {
        last5Results.push(`${result} ${teamGoals}-${opponentGoals} vs ${opponentName || 'Unknown'}`);
      }
    }

    const played = matches.length;

    const stats = {
      name: teamName,
      form: formArray.slice(0, 5).join(''),
      played,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      avgGoalsFor: Number((goalsFor / played).toFixed(2)),
      avgGoalsAgainst: Number((goalsAgainst / played).toFixed(2)),
      cleanSheets,
      failedToScore,
      last5Results,
    };

    console.log(`📈 ${teamName} stats:`, { form: stats.form, avgGoalsFor: stats.avgGoalsFor, avgGoalsAgainst: stats.avgGoalsAgainst });

    return stats;
  } catch (error) {
    console.error(`❌ Error fetching ${teamName}:`, error);
    return defaults;
  }
}

// ============================================================================
// SPORTMONKS - H2H (Karşılıklı Maçlar)
// ============================================================================

async function fetchH2H(homeTeamId: number, awayTeamId: number, homeTeamName: string, awayTeamName: string) {
  const defaults = {
    played: 0,
    homeTeamWins: 0,
    awayTeamWins: 0,
    draws: 0,
    totalGoals: 0,
    avgGoals: 2.5,
    bttsCount: 0,
    bttsPercent: 50,
    over25Count: 0,
    over25Percent: 50,
    recentMatches: [] as string[],
  };

  if (!homeTeamId || !awayTeamId || !SPORTMONKS_API_KEY) {
    console.log('⚠️ No H2H data available');
    return defaults;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=scores;participants`;
    
    console.log(`🔄 Fetching H2H: ${homeTeamName} vs ${awayTeamName}`);

    const response = await fetch(url, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.log(`❌ H2H API error: ${response.status}`);
      return defaults;
    }

    const json = await response.json();
    const matches = json.data || [];

    if (matches.length === 0) {
      console.log('⚠️ No H2H matches found');
      return defaults;
    }

    console.log(`✅ Found ${matches.length} H2H matches`);

    let homeTeamWins = 0, awayTeamWins = 0, draws = 0;
    let totalGoals = 0, bttsCount = 0, over25Count = 0;
    const recentMatches: string[] = [];

    for (const match of matches.slice(0, 10)) {
      const participants = match.participants || [];
      const homeInMatch = participants.find((p: any) => p.meta?.location === 'home');
      
      const scores = match.scores || [];
      let hGoals = 0, aGoals = 0;

      for (const score of scores) {
        if (score.description === 'CURRENT') {
          hGoals = score.score?.home ?? 0;
          aGoals = score.score?.away ?? 0;
          break;
        }
      }

      // Hangi takım ev sahibiydi?
      const homeTeamWasHome = homeInMatch?.id === homeTeamId;
      
      let homeTeamGoals: number, awayTeamGoals: number;
      if (homeTeamWasHome) {
        homeTeamGoals = hGoals;
        awayTeamGoals = aGoals;
      } else {
        homeTeamGoals = aGoals;
        awayTeamGoals = hGoals;
      }

      // Kazananı belirle
      if (homeTeamGoals > awayTeamGoals) {
        homeTeamWins++;
      } else if (awayTeamGoals > homeTeamGoals) {
        awayTeamWins++;
      } else {
        draws++;
      }

      totalGoals += hGoals + aGoals;
      if (hGoals > 0 && aGoals > 0) bttsCount++;
      if (hGoals + aGoals > 2) over25Count++;

      if (recentMatches.length < 5) {
        recentMatches.push(`${homeTeamName} ${homeTeamGoals}-${awayTeamGoals} ${awayTeamName}`);
      }
    }

    const played = Math.min(matches.length, 10);

    const h2h = {
      played,
      homeTeamWins,
      awayTeamWins,
      draws,
      totalGoals,
      avgGoals: Number((totalGoals / played).toFixed(2)),
      bttsCount,
      bttsPercent: Math.round((bttsCount / played) * 100),
      over25Count,
      over25Percent: Math.round((over25Count / played) * 100),
      recentMatches,
    };

    console.log(`📊 H2H stats:`, { homeTeamWins, awayTeamWins, draws, avgGoals: h2h.avgGoals });

    return h2h;
  } catch (error) {
    console.error('❌ H2H fetch error:', error);
    return defaults;
  }
}

// ============================================================================
// AI PROMPT - DİL DESTEĞİ
// ============================================================================

function createAnalysisPrompt(
  homeTeam: string,
  awayTeam: string,
  homeStats: any,
  awayStats: any,
  h2h: any,
  lang: string
) {
  // TÜRKÇE
  if (lang === 'tr') {
    return `Sen uzman bir futbol analistisin. Aşağıdaki verileri kullanarak maç tahmini yap.

═══════════════════════════════════════════════════════════
⚽ MAÇ: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════

📊 ${homeTeam.toUpperCase()} (EV SAHİBİ)
────────────────────────────────────
- Son Form: ${homeStats.form} (${homeStats.wins}G-${homeStats.draws}B-${homeStats.losses}M)
- Maç Başı Attığı Gol: ${homeStats.avgGoalsFor}
- Maç Başı Yediği Gol: ${homeStats.avgGoalsAgainst}
- Gol Yemeden Bitirdiği: ${homeStats.cleanSheets}/${homeStats.played} maç
- Gol Atamadığı: ${homeStats.failedToScore}/${homeStats.played} maç
- Son Maçlar: ${homeStats.last5Results?.join(' | ') || 'Veri yok'}

📊 ${awayTeam.toUpperCase()} (DEPLASMAN)
────────────────────────────────────
- Son Form: ${awayStats.form} (${awayStats.wins}G-${awayStats.draws}B-${awayStats.losses}M)
- Maç Başı Attığı Gol: ${awayStats.avgGoalsFor}
- Maç Başı Yediği Gol: ${awayStats.avgGoalsAgainst}
- Gol Yemeden Bitirdiği: ${awayStats.cleanSheets}/${awayStats.played} maç
- Gol Atamadığı: ${awayStats.failedToScore}/${awayStats.played} maç
- Son Maçlar: ${awayStats.last5Results?.join(' | ') || 'Veri yok'}

🔄 KARŞILAŞMA GEÇMİŞİ (H2H) - Son ${h2h.played} maç
────────────────────────────────────
- ${homeTeam}: ${h2h.homeTeamWins} galibiyet
- ${awayTeam}: ${h2h.awayTeamWins} galibiyet
- Beraberlik: ${h2h.draws}
- Maç Başı Ortalama Gol: ${h2h.avgGoals}
- KG VAR Oranı: %${h2h.bttsPercent}
- 2.5 Üst Oranı: %${h2h.over25Percent}
- Son Maçlar: ${h2h.recentMatches?.join(' | ') || 'Veri yok'}

═══════════════════════════════════════════════════════════
TAHMİNLERİNİ AŞAĞIDAKİ FORMATTA VER:
═══════════════════════════════════════════════════════════

MAC_SONUCU: [Ev Sahibi Kazanir / Beraberlik / Deplasman Kazanir]
MAC_GUVEN: [50-95 arasi sayi]

TOPLAM_GOL: [Ust 2.5 / Alt 2.5]
GOL_GUVEN: [50-95 arasi sayi]

KG_VAR: [Evet / Hayir]
KG_GUVEN: [50-95 arasi sayi]

ACIKLAMA: [2-3 cümlelik kisa analiz ve gerekce]`;
  }

  // ALMANCA
  if (lang === 'de') {
    return `Du bist ein erfahrener Fußballanalyst. Nutze die folgenden Daten für deine Spielvorhersage.

═══════════════════════════════════════════════════════════
⚽ SPIEL: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════

📊 ${homeTeam.toUpperCase()} (HEIM)
────────────────────────────────────
- Form: ${homeStats.form} (${homeStats.wins}S-${homeStats.draws}U-${homeStats.losses}N)
- Tore pro Spiel: ${homeStats.avgGoalsFor}
- Gegentore pro Spiel: ${homeStats.avgGoalsAgainst}
- Zu Null: ${homeStats.cleanSheets}/${homeStats.played} Spiele
- Ohne Tor: ${homeStats.failedToScore}/${homeStats.played} Spiele

📊 ${awayTeam.toUpperCase()} (AUSWÄRTS)
────────────────────────────────────
- Form: ${awayStats.form} (${awayStats.wins}S-${awayStats.draws}U-${awayStats.losses}N)
- Tore pro Spiel: ${awayStats.avgGoalsFor}
- Gegentore pro Spiel: ${awayStats.avgGoalsAgainst}
- Zu Null: ${awayStats.cleanSheets}/${awayStats.played} Spiele
- Ohne Tor: ${awayStats.failedToScore}/${awayStats.played} Spiele

🔄 DIREKTER VERGLEICH (H2H) - Letzte ${h2h.played} Spiele
────────────────────────────────────
- ${homeTeam}: ${h2h.homeTeamWins} Siege
- ${awayTeam}: ${h2h.awayTeamWins} Siege
- Unentschieden: ${h2h.draws}
- Durchschn. Tore: ${h2h.avgGoals}
- Beide treffen: ${h2h.bttsPercent}%
- Über 2.5: ${h2h.over25Percent}%

═══════════════════════════════════════════════════════════
VORHERSAGEN IM FOLGENDEN FORMAT:
═══════════════════════════════════════════════════════════

ERGEBNIS: [Heimsieg / Unentschieden / Auswaertssieg]
ERGEBNIS_KONFIDENZ: [50-95]

TORE: [Ueber 2.5 / Unter 2.5]
TORE_KONFIDENZ: [50-95]

BTTS: [Ja / Nein]
BTTS_KONFIDENZ: [50-95]

ANALYSE: [2-3 Sätze kurze Analyse]`;
  }

  // İNGİLİZCE (default)
  return `You are an expert football analyst. Use the following data to make match predictions.

═══════════════════════════════════════════════════════════
⚽ MATCH: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════

📊 ${homeTeam.toUpperCase()} (HOME)
────────────────────────────────────
- Recent Form: ${homeStats.form} (${homeStats.wins}W-${homeStats.draws}D-${homeStats.losses}L)
- Goals Per Game: ${homeStats.avgGoalsFor}
- Conceded Per Game: ${homeStats.avgGoalsAgainst}
- Clean Sheets: ${homeStats.cleanSheets}/${homeStats.played} games
- Failed to Score: ${homeStats.failedToScore}/${homeStats.played} games
- Recent Results: ${homeStats.last5Results?.join(' | ') || 'No data'}

📊 ${awayTeam.toUpperCase()} (AWAY)
────────────────────────────────────
- Recent Form: ${awayStats.form} (${awayStats.wins}W-${awayStats.draws}D-${awayStats.losses}L)
- Goals Per Game: ${awayStats.avgGoalsFor}
- Conceded Per Game: ${awayStats.avgGoalsAgainst}
- Clean Sheets: ${awayStats.cleanSheets}/${awayStats.played} games
- Failed to Score: ${awayStats.failedToScore}/${awayStats.played} games
- Recent Results: ${awayStats.last5Results?.join(' | ') || 'No data'}

🔄 HEAD TO HEAD - Last ${h2h.played} matches
────────────────────────────────────
- ${homeTeam}: ${h2h.homeTeamWins} wins
- ${awayTeam}: ${h2h.awayTeamWins} wins
- Draws: ${h2h.draws}
- Average Goals: ${h2h.avgGoals}
- BTTS Rate: ${h2h.bttsPercent}%
- Over 2.5 Rate: ${h2h.over25Percent}%
- Recent: ${h2h.recentMatches?.join(' | ') || 'No data'}

═══════════════════════════════════════════════════════════
PROVIDE YOUR PREDICTIONS IN THIS EXACT FORMAT:
═══════════════════════════════════════════════════════════

MATCH_RESULT: [Home Win / Draw / Away Win]
RESULT_CONFIDENCE: [50-95]

TOTAL_GOALS: [Over 2.5 / Under 2.5]
GOALS_CONFIDENCE: [50-95]

BTTS: [Yes / No]
BTTS_CONFIDENCE: [50-95]

REASONING: [2-3 sentence brief analysis]`;
}

// ============================================================================
// AI API ÇAĞRILARI
// ============================================================================

async function callClaude(prompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️ Claude API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling Claude...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.log(`❌ Claude error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;
    console.log('✅ Claude responded');
    return text || null;
  } catch (error) {
    console.error('❌ Claude exception:', error);
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.log('⚠️ OpenAI API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.log(`❌ OpenAI error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    console.log('✅ OpenAI responded');
    return text || null;
  } catch (error) {
    console.error('❌ OpenAI exception:', error);
    return null;
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.log('⚠️ Gemini API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling Gemini...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      console.log(`❌ Gemini error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('✅ Gemini responded');
    return text || null;
  } catch (error) {
    console.error('❌ Gemini exception:', error);
    return null;
  }
}

async function callPerplexity(prompt: string): Promise<string | null> {
  if (!PERPLEXITY_API_KEY) {
    console.log('⚠️ Perplexity API key missing');
    return null;
  }

  try {
    console.log('🤖 Calling Perplexity...');
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.log(`❌ Perplexity error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    console.log('✅ Perplexity responded');
    return text || null;
  } catch (error) {
    console.error('❌ Perplexity exception:', error);
    return null;
  }
}

// ============================================================================
// AI YANITINI PARSE ETME - TÜM DİLLER
// ============================================================================

function parseAIResponse(text: string, lang: string) {
  const result = {
    matchResult: { prediction: 'Draw', confidence: 55 },
    overUnder25: { prediction: 'Under 2.5', confidence: 55 },
    btts: { prediction: 'No', confidence: 55 },
    reasoning: '',
  };

  if (!text) return result;

  const upper = text.toUpperCase();
  const lines = text.split('\n');

  // ===== MAÇ SONUCU =====
  // Türkçe
  if (upper.includes('MAC_SONUCU:') || upper.includes('MAÇ_SONUCU:')) {
    if (upper.includes('EV SAHIBI') || upper.includes('EV_SAHIBI')) {
      result.matchResult.prediction = 'Home Win';
    } else if (upper.includes('DEPLASMAN')) {
      result.matchResult.prediction = 'Away Win';
    } else if (upper.includes('BERABERLIK')) {
      result.matchResult.prediction = 'Draw';
    }
  }
  // Almanca
  else if (upper.includes('ERGEBNIS:')) {
    if (upper.includes('HEIMSIEG')) {
      result.matchResult.prediction = 'Home Win';
    } else if (upper.includes('AUSWAERTSSIEG') || upper.includes('AUSWÄRTSSIEG')) {
      result.matchResult.prediction = 'Away Win';
    } else if (upper.includes('UNENTSCHIEDEN')) {
      result.matchResult.prediction = 'Draw';
    }
  }
  // İngilizce
  else if (upper.includes('MATCH_RESULT:') || upper.includes('RESULT:')) {
    if (upper.includes('HOME WIN') || upper.includes('HOME_WIN')) {
      result.matchResult.prediction = 'Home Win';
    } else if (upper.includes('AWAY WIN') || upper.includes('AWAY_WIN')) {
      result.matchResult.prediction = 'Away Win';
    } else if (upper.includes('DRAW')) {
      result.matchResult.prediction = 'Draw';
    }
  }

  // Maç sonucu güven
  const matchConfPatterns = [
    /MAC_GUVEN[:\s]*(\d+)/i,
    /MAÇ_GÜVEN[:\s]*(\d+)/i,
    /RESULT_CONFIDENCE[:\s]*(\d+)/i,
    /ERGEBNIS_KONFIDENZ[:\s]*(\d+)/i,
  ];
  for (const pattern of matchConfPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.matchResult.confidence = Math.min(95, Math.max(50, parseInt(match[1])));
      break;
    }
  }

  // ===== TOPLAM GOL =====
  // Türkçe
  if (upper.includes('TOPLAM_GOL:') || upper.includes('TOPLAM GOL:')) {
    if (upper.includes('UST 2.5') || upper.includes('ÜST 2.5') || upper.includes('UST_2.5')) {
      result.overUnder25.prediction = 'Over 2.5';
    } else if (upper.includes('ALT 2.5') || upper.includes('ALT_2.5')) {
      result.overUnder25.prediction = 'Under 2.5';
    }
  }
  // Almanca
  else if (upper.includes('TORE:')) {
    if (upper.includes('UEBER 2.5') || upper.includes('ÜBER 2.5')) {
      result.overUnder25.prediction = 'Over 2.5';
    } else if (upper.includes('UNTER 2.5')) {
      result.overUnder25.prediction = 'Under 2.5';
    }
  }
  // İngilizce
  else if (upper.includes('TOTAL_GOALS:') || upper.includes('GOALS:')) {
    if (upper.includes('OVER 2.5') || upper.includes('OVER_2.5')) {
      result.overUnder25.prediction = 'Over 2.5';
    } else if (upper.includes('UNDER 2.5') || upper.includes('UNDER_2.5')) {
      result.overUnder25.prediction = 'Under 2.5';
    }
  }

  // Gol güven
  const goalConfPatterns = [
    /GOL_GUVEN[:\s]*(\d+)/i,
    /GOL_GÜVEN[:\s]*(\d+)/i,
    /GOALS_CONFIDENCE[:\s]*(\d+)/i,
    /TORE_KONFIDENZ[:\s]*(\d+)/i,
  ];
  for (const pattern of goalConfPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.overUnder25.confidence = Math.min(95, Math.max(50, parseInt(match[1])));
      break;
    }
  }

  // ===== KG VAR / BTTS =====
  if (upper.includes('KG_VAR:') || upper.includes('KG VAR:')) {
    if (upper.includes('EVET')) {
      result.btts.prediction = 'Yes';
    } else if (upper.includes('HAYIR')) {
      result.btts.prediction = 'No';
    }
  } else if (upper.includes('BTTS:')) {
    if (upper.includes('YES') || upper.includes('JA') || upper.includes('EVET')) {
      result.btts.prediction = 'Yes';
    } else if (upper.includes('NO') || upper.includes('NEIN') || upper.includes('HAYIR')) {
      result.btts.prediction = 'No';
    }
  }

  // BTTS güven
  const bttsConfPatterns = [
    /KG_GUVEN[:\s]*(\d+)/i,
    /KG_GÜVEN[:\s]*(\d+)/i,
    /BTTS_CONFIDENCE[:\s]*(\d+)/i,
    /BTTS_KONFIDENZ[:\s]*(\d+)/i,
  ];
  for (const pattern of bttsConfPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.btts.confidence = Math.min(95, Math.max(50, parseInt(match[1])));
      break;
    }
  }

  // ===== AÇIKLAMA =====
  const reasoningPatterns = [
    /ACIKLAMA[:\s]*(.*)/i,
    /AÇIKLAMA[:\s]*(.*)/i,
    /REASONING[:\s]*(.*)/i,
    /ANALYSE[:\s]*(.*)/i,
    /ANALYSIS[:\s]*(.*)/i,
  ];
  for (const pattern of reasoningPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.reasoning = match[1].trim().substring(0, 300);
      break;
    }
  }

  // Eğer reasoning bulunamadıysa, son birkaç satırı al
  if (!result.reasoning) {
    const lastLines = lines.slice(-3).join(' ').trim();
    result.reasoning = lastLines.substring(0, 300);
  }

  return result;
}

// ============================================================================
// CONSENSUS HESAPLAMA
// ============================================================================

function calculateConsensus(results: any[]) {
  const matchVotes: Record<string, { count: number; totalConf: number }> = {};
  const goalVotes: Record<string, { count: number; totalConf: number }> = {};
  const bttsVotes: Record<string, { count: number; totalConf: number }> = {};

  for (const r of results) {
    // Match Result
    const mr = r.matchResult.prediction;
    if (!matchVotes[mr]) matchVotes[mr] = { count: 0, totalConf: 0 };
    matchVotes[mr].count++;
    matchVotes[mr].totalConf += r.matchResult.confidence;

    // Goals
    const g = r.overUnder25.prediction;
    if (!goalVotes[g]) goalVotes[g] = { count: 0, totalConf: 0 };
    goalVotes[g].count++;
    goalVotes[g].totalConf += r.overUnder25.confidence;

    // BTTS
    const b = r.btts.prediction;
    if (!bttsVotes[b]) bttsVotes[b] = { count: 0, totalConf: 0 };
    bttsVotes[b].count++;
    bttsVotes[b].totalConf += r.btts.confidence;
  }

  const getWinner = (votes: Record<string, { count: number; totalConf: number }>) => {
    let best = { prediction: 'Unknown', confidence: 50, votes: 0 };
    for (const [pred, data] of Object.entries(votes)) {
      const avgConf = Math.round(data.totalConf / data.count);
      if (data.count > best.votes || (data.count === best.votes && avgConf > best.confidence)) {
        best = { prediction: pred, confidence: avgConf, votes: data.count };
      }
    }
    return best;
  };

  return {
    matchResult: getWinner(matchVotes),
    overUnder25: getWinner(goalVotes),
    btts: getWinner(bttsVotes),
  };
}

// ============================================================================
// ANA API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { homeTeam, awayTeam, homeTeamId, awayTeamId, league, language = 'tr' } = body;

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⚽ NEW ANALYSIS REQUEST: ${homeTeam} vs ${awayTeam}`);
    console.log(`📍 League: ${league || 'Unknown'}, Language: ${language}`);
    console.log('═══════════════════════════════════════════════════════════');

    if (!homeTeam || !awayTeam) {
      return NextResponse.json({
        success: false,
        error: language === 'tr' ? 'Takım adları gerekli.' : 'Team names required.',
      }, { status: 400 });
    }

    // 1. VERİ ÇEKME
    console.log('\n📊 FETCHING DATA...');
    const [homeStats, awayStats, h2h] = await Promise.all([
      fetchTeamStats(homeTeamId, homeTeam),
      fetchTeamStats(awayTeamId, awayTeam),
      fetchH2H(homeTeamId, awayTeamId, homeTeam, awayTeam),
    ]);

    const dataTime = Date.now();
    console.log(`✅ Data fetched in ${dataTime - startTime}ms`);

    // 2. PROMPT OLUŞTUR
    const prompt = createAnalysisPrompt(homeTeam, awayTeam, homeStats, awayStats, h2h, language);

    // 3. AI'LARI PARALEL ÇAĞIR
    console.log('\n🤖 CALLING AI MODELS...');
    const [claudeText, openaiText, geminiText, perplexityText] = await Promise.all([
      callClaude(prompt),
      callOpenAI(prompt),
      callGemini(prompt),
      callPerplexity(prompt),
    ]);

    const aiTime = Date.now();
    console.log(`✅ AI calls completed in ${aiTime - dataTime}ms`);

    // 4. SONUÇLARI TOPLA
    const aiStatus = {
      claude: !!claudeText,
      openai: !!openaiText,
      gemini: !!geminiText,
      perplexity: !!perplexityText,
    };

    const parsed: any[] = [];
    const individualAnalyses: Record<string, any> = {};

    if (claudeText) {
      const p = parseAIResponse(claudeText, language);
      parsed.push(p);
      individualAnalyses.claude = p;
    }
    if (openaiText) {
      const p = parseAIResponse(openaiText, language);
      parsed.push(p);
      individualAnalyses.openai = p;
    }
    if (geminiText) {
      const p = parseAIResponse(geminiText, language);
      parsed.push(p);
      individualAnalyses.gemini = p;
    }
    if (perplexityText) {
      const p = parseAIResponse(perplexityText, language);
      parsed.push(p);
      individualAnalyses.perplexity = p;
    }

    console.log(`\n📈 RESULTS: ${parsed.length}/4 AI models responded`);

    if (parsed.length === 0) {
      return NextResponse.json({
        success: false,
        error: language === 'tr'
          ? 'Hiçbir AI modeli yanıt vermedi. API anahtarlarını kontrol edin.'
          : 'No AI models responded. Check API keys.',
      }, { status: 500 });
    }

    // 5. CONSENSUS HESAPLA
    const consensus = calculateConsensus(parsed);
    const totalModels = parsed.length;

    // 6. EN İYİ BAHİS
    const bets = [
      { type: 'MATCH_RESULT', ...consensus.matchResult },
      { type: 'OVER_UNDER_25', ...consensus.overUnder25 },
      { type: 'BTTS', ...consensus.btts },
    ].sort((a, b) => (b.votes * 100 + b.confidence) - (a.votes * 100 + a.confidence));

    const bestBet = bets[0];
    const riskLevel = bestBet.votes >= 3 ? 'Low' : bestBet.votes >= 2 ? 'Medium' : 'High';

    // 7. RESPONSE
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ ANALYSIS COMPLETE in ${totalTime}ms`);
    console.log('═══════════════════════════════════════════════════════════\n');

    return NextResponse.json({
      success: true,
      analysis: {
        matchResult: {
          prediction: consensus.matchResult.prediction,
          confidence: consensus.matchResult.confidence,
          votes: consensus.matchResult.votes,
          totalVotes: totalModels,
        },
        overUnder25: {
          prediction: consensus.overUnder25.prediction,
          confidence: consensus.overUnder25.confidence,
          votes: consensus.overUnder25.votes,
          totalVotes: totalModels,
        },
        btts: {
          prediction: consensus.btts.prediction,
          confidence: consensus.btts.confidence,
          votes: consensus.btts.votes,
          totalVotes: totalModels,
        },
        riskLevel,
        bestBets: [{
          type: bestBet.type,
          selection: bestBet.prediction,
          confidence: bestBet.confidence,
          reasoning: language === 'tr'
            ? `${bestBet.votes}/${totalModels} AI model bu tahmin üzerinde uzlaştı.`
            : language === 'de'
            ? `${bestBet.votes}/${totalModels} KI-Modelle haben sich auf diese Vorhersage geeinigt.`
            : `${bestBet.votes}/${totalModels} AI models agreed on this prediction.`,
        }],
        overallAnalyses: parsed.map(p => p.reasoning).filter(Boolean).slice(0, 2),
      },
      aiStatus,
      individualAnalyses,
      modelsUsed: Object.keys(individualAnalyses),
      totalModels,
      stats: {
        home: homeStats,
        away: awayStats,
        h2h,
      },
      timing: {
        dataFetch: `${dataTime - startTime}ms`,
        aiCalls: `${aiTime - dataTime}ms`,
        total: `${totalTime}ms`,
      },
    });

  } catch (error: any) {
    console.error('❌ ANALYSIS ERROR:', error);
    return NextResponse.json({
      success: false,
      error: `Error: ${error.message}`,
    }, { status: 500 });
  }
}
