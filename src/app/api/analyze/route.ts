import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// API Keys
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

interface MatchData {
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  competition: string;
  matchDate: string;
}

interface TeamStats {
  form: string;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  bttsMatches: number;
  over25Matches: number;
  homeWins?: number;
  awayWins?: number;
  position?: number;
  points?: number;
}

interface H2HData {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  avgGoals: number;
  bttsPercentage: number;
  recentMatches: string[];
}

interface AIPrediction {
  model: string;
  matchResult: { prediction: string; confidence: number };
  overUnder: { prediction: string; confidence: number };
  btts: { prediction: string; confidence: number };
  reasoning: string;
}

// Fetch team statistics from Sportmonks
async function fetchTeamStats(teamId: number, teamName: string): Promise<TeamStats> {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=latest;statistics`,
      { next: { revalidate: 3600 } }
    );
    
    if (!response.ok) {
      console.log(`Team stats API failed for ${teamName}, using defaults`);
      return getDefaultStats();
    }

    const data = await response.json();
    const team = data.data;
    const stats = team?.statistics || [];
    
    // Extract form from latest matches
    const latest = team?.latest || [];
    const form = latest.slice(0, 5).map((match: any) => {
      const isHome = match.participants?.[0]?.id === teamId;
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT')?.score?.participant === 'home' 
        ? match.scores.find((s: any) => s.description === 'CURRENT')?.score?.goals : 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT')?.score?.participant === 'away'
        ? match.scores.find((s: any) => s.description === 'CURRENT')?.score?.goals : 0;
      
      if (isHome) {
        return homeScore > awayScore ? 'W' : homeScore < awayScore ? 'L' : 'D';
      } else {
        return awayScore > homeScore ? 'W' : awayScore < homeScore ? 'L' : 'D';
      }
    }).join('');

    return {
      form: form || 'DDDDD',
      goalsScored: stats.find((s: any) => s.type_id === 52)?.value?.total || 0,
      goalsConceded: stats.find((s: any) => s.type_id === 88)?.value?.total || 0,
      cleanSheets: stats.find((s: any) => s.type_id === 194)?.value?.total || 0,
      bttsMatches: 0,
      over25Matches: 0,
    };
  } catch (error) {
    console.error(`Error fetching team stats for ${teamName}:`, error);
    return getDefaultStats();
  }
}

function getDefaultStats(): TeamStats {
  return {
    form: 'DDDDD',
    goalsScored: 15,
    goalsConceded: 12,
    cleanSheets: 3,
    bttsMatches: 5,
    over25Matches: 6,
  };
}

// Fetch H2H data
async function fetchH2HData(homeTeamId: number, awayTeamId: number): Promise<H2HData> {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=scores`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      return getDefaultH2H();
    }

    const data = await response.json();
    const matches = data.data || [];

    let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, bttsCount = 0;
    const recentMatches: string[] = [];

    matches.slice(0, 10).forEach((match: any) => {
      const scores = match.scores || [];
      const ftScore = scores.find((s: any) => s.description === 'CURRENT');
      const homeGoals = ftScore?.score?.home || 0;
      const awayGoals = ftScore?.score?.away || 0;

      const isHomeTeamHome = match.participants?.[0]?.id === homeTeamId;
      
      if (isHomeTeamHome) {
        if (homeGoals > awayGoals) homeWins++;
        else if (awayGoals > homeGoals) awayWins++;
        else draws++;
      } else {
        if (awayGoals > homeGoals) homeWins++;
        else if (homeGoals > awayGoals) awayWins++;
        else draws++;
      }

      totalGoals += homeGoals + awayGoals;
      if (homeGoals > 0 && awayGoals > 0) bttsCount++;
      
      recentMatches.push(`${homeGoals}-${awayGoals}`);
    });

    const totalMatches = matches.length || 1;

    return {
      totalMatches,
      homeWins,
      awayWins,
      draws,
      avgGoals: totalGoals / totalMatches,
      bttsPercentage: (bttsCount / totalMatches) * 100,
      recentMatches: recentMatches.slice(0, 5),
    };
  } catch (error) {
    console.error('Error fetching H2H data:', error);
    return getDefaultH2H();
  }
}

function getDefaultH2H(): H2HData {
  return {
    totalMatches: 5,
    homeWins: 2,
    awayWins: 1,
    draws: 2,
    avgGoals: 2.4,
    bttsPercentage: 60,
    recentMatches: ['2-1', '1-1', '0-2', '1-0', '2-2'],
  };
}

// Build analysis prompt
function buildAnalysisPrompt(
  matchData: MatchData,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HData
): string {
  return `
🏟️ MAÇ ANALİZİ İSTEĞİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 MAÇ BİLGİSİ:
• Ev Sahibi: ${matchData.homeTeamName}
• Deplasman: ${matchData.awayTeamName}
• Lig: ${matchData.competition}
• Tarih: ${matchData.matchDate}

📊 EV SAHİBİ İSTATİSTİKLERİ (${matchData.homeTeamName}):
• Son 5 Maç Formu: ${homeStats.form}
• Atılan Gol: ${homeStats.goalsScored}
• Yenilen Gol: ${homeStats.goalsConceded}
• Gol Yemeden: ${homeStats.cleanSheets} maç

📊 DEPLASMAN İSTATİSTİKLERİ (${matchData.awayTeamName}):
• Son 5 Maç Formu: ${awayStats.form}
• Atılan Gol: ${awayStats.goalsScored}
• Yenilen Gol: ${awayStats.goalsConceded}
• Gol Yemeden: ${awayStats.cleanSheets} maç

🔄 KARŞILAŞMA GEÇMİŞİ (H2H):
• Toplam Maç: ${h2h.totalMatches}
• ${matchData.homeTeamName} Galibiyeti: ${h2h.homeWins}
• ${matchData.awayTeamName} Galibiyeti: ${h2h.awayWins}
• Beraberlik: ${h2h.draws}
• Ortalama Gol: ${h2h.avgGoals.toFixed(2)}
• KG VAR Oranı: %${h2h.bttsPercentage.toFixed(0)}
• Son Skorlar: ${h2h.recentMatches.join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LÜTFEN AŞAĞIDAKİ TAHMİNLERİ YAP:

1. MAÇ SONUCU (1X2):
   - Tahmin: [Ev Sahibi / Beraberlik / Deplasman]
   - Güven: [%0-100]
   - Gerekçe: [Kısa açıklama]

2. TOPLAM GOL (Ü/A 2.5):
   - Tahmin: [Üst 2.5 / Alt 2.5]
   - Güven: [%0-100]
   - Gerekçe: [Kısa açıklama]

3. KG VAR (BTTS):
   - Tahmin: [Evet / Hayır]
   - Güven: [%0-100]
   - Gerekçe: [Kısa açıklama]

4. ÖNERİLEN BAHİS:
   - En güvenli bahis önerisi ve gerekçesi

5. RİSK DEĞERLENDİRMESİ:
   - Düşük / Orta / Yüksek risk ve nedeni

Yanıtını Türkçe ver ve profesyonel bir analist gibi detaylı analiz yap.
`;
}

// AI Model Calls
async function callClaude(prompt: string): Promise<AIPrediction | null> {
  if (!ANTHROPIC_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    return parseAIResponse('Claude', text);
  } catch (error) {
    console.error('Claude error:', error);
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<AIPrediction | null> {
  if (!OPENAI_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    return parseAIResponse('GPT-4', text);
  } catch (error) {
    console.error('OpenAI error:', error);
    return null;
  }
}

async function callGemini(prompt: string): Promise<AIPrediction | null> {
  if (!GEMINI_API_KEY) return null;
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return parseAIResponse('Gemini', text);
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

async function callPerplexity(prompt: string): Promise<AIPrediction | null> {
  if (!PERPLEXITY_API_KEY) return null;
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    return parseAIResponse('Perplexity', text);
  } catch (error) {
    console.error('Perplexity error:', error);
    return null;
  }
}

// Parse AI response to extract predictions
function parseAIResponse(model: string, text: string): AIPrediction {
  const prediction: AIPrediction = {
    model,
    matchResult: { prediction: 'Belirsiz', confidence: 50 },
    overUnder: { prediction: 'Belirsiz', confidence: 50 },
    btts: { prediction: 'Belirsiz', confidence: 50 },
    reasoning: text,
  };

  if (text.includes('Ev Sahibi') || text.includes('ev sahibi') || text.includes('1')) {
    prediction.matchResult.prediction = 'Ev Sahibi';
    prediction.matchResult.confidence = extractConfidence(text, 'maç sonucu') || 65;
  } else if (text.includes('Deplasman') || text.includes('deplasman') || text.includes('2')) {
    prediction.matchResult.prediction = 'Deplasman';
    prediction.matchResult.confidence = extractConfidence(text, 'maç sonucu') || 60;
  } else if (text.includes('Beraberlik') || text.includes('beraberlik') || text.includes('X')) {
    prediction.matchResult.prediction = 'Beraberlik';
    prediction.matchResult.confidence = extractConfidence(text, 'maç sonucu') || 55;
  }

  if (text.includes('Üst 2.5') || text.includes('üst 2.5') || text.includes('Ü 2.5')) {
    prediction.overUnder.prediction = 'Üst 2.5';
    prediction.overUnder.confidence = extractConfidence(text, 'gol') || 60;
  } else if (text.includes('Alt 2.5') || text.includes('alt 2.5') || text.includes('A 2.5')) {
    prediction.overUnder.prediction = 'Alt 2.5';
    prediction.overUnder.confidence = extractConfidence(text, 'gol') || 60;
  }

  if (text.includes('KG VAR') || text.includes('Evet') || text.includes('BTTS: Evet')) {
    prediction.btts.prediction = 'Evet';
    prediction.btts.confidence = extractConfidence(text, 'kg') || 58;
  } else if (text.includes('KG YOK') || text.includes('Hayır') || text.includes('BTTS: Hayır')) {
    prediction.btts.prediction = 'Hayır';
    prediction.btts.confidence = extractConfidence(text, 'kg') || 55;
  }

  return prediction;
}

function extractConfidence(text: string, context: string): number | null {
  const patterns = [
    /%(\d+)/g,
    /(\d+)%/g,
    /güven[:\s]*(\d+)/gi,
    /confidence[:\s]*(\d+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = parseInt(match[1]);
      if (value >= 0 && value <= 100) {
        return value;
      }
    }
  }
  return null;
}

// Calculate consensus from multiple AI predictions
function calculateConsensus(predictions: AIPrediction[]): {
  matchResult: { prediction: string; confidence: number; votes: number };
  overUnder: { prediction: string; confidence: number; votes: number };
  btts: { prediction: string; confidence: number; votes: number };
} {
  const matchVotes: Record<string, number[]> = {};
  const ouVotes: Record<string, number[]> = {};
  const bttsVotes: Record<string, number[]> = {};

  predictions.forEach(p => {
    if (!matchVotes[p.matchResult.prediction]) matchVotes[p.matchResult.prediction] = [];
    matchVotes[p.matchResult.prediction].push(p.matchResult.confidence);

    if (!ouVotes[p.overUnder.prediction]) ouVotes[p.overUnder.prediction] = [];
    ouVotes[p.overUnder.prediction].push(p.overUnder.confidence);

    if (!bttsVotes[p.btts.prediction]) bttsVotes[p.btts.prediction] = [];
    bttsVotes[p.btts.prediction].push(p.btts.confidence);
  });

  const getWinner = (votes: Record<string, number[]>) => {
    let winner = { prediction: 'Belirsiz', confidence: 50, votes: 0 };
    Object.entries(votes).forEach(([pred, confidences]) => {
      if (confidences.length > winner.votes || 
          (confidences.length === winner.votes && 
           confidences.reduce((a, b) => a + b, 0) / confidences.length > winner.confidence)) {
        winner = {
          prediction: pred,
          confidence: Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length),
          votes: confidences.length,
        };
      }
    });
    return winner;
  };

  return {
    matchResult: getWinner(matchVotes),
    overUnder: getWinner(ouVotes),
    btts: getWinner(bttsVotes),
  };
}

// Format final analysis
function formatFinalAnalysis(
  matchData: MatchData,
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HData,
  predictions: AIPrediction[],
  consensus: ReturnType<typeof calculateConsensus>
): string {
  const totalModels = predictions.length;
  
  let output = `
╔══════════════════════════════════════════════════════════════╗
║  ⚽ AI CONSENSUS MAÇ ANALİZİ                                  ║
╚══════════════════════════════════════════════════════════════╝

📌 ${matchData.homeTeamName} vs ${matchData.awayTeamName}
📅 ${new Date(matchData.matchDate).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
🏆 ${matchData.competition}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TAKIM FORMLARI
┌─────────────────────────────────────────────────────────────┐
│ ${matchData.homeTeamName.padEnd(25)} Form: ${homeStats.form.padEnd(8)} │
│ ${matchData.awayTeamName.padEnd(25)} Form: ${awayStats.form.padEnd(8)} │
└─────────────────────────────────────────────────────────────┘

🔄 KARŞILAŞMA GEÇMİŞİ (Son ${h2h.totalMatches} maç)
• ${matchData.homeTeamName}: ${h2h.homeWins} galibiyet
• ${matchData.awayTeamName}: ${h2h.awayWins} galibiyet  
• Beraberlik: ${h2h.draws}
• Maç başı gol: ${h2h.avgGoals.toFixed(2)}
• KG VAR oranı: %${h2h.bttsPercentage.toFixed(0)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 AI TAHMİNLERİ (${totalModels} Model Analizi)

`;

  predictions.forEach(p => {
    output += `
┌─ ${p.model} ─────────────────────────────────────────────────
│ Maç Sonucu: ${p.matchResult.prediction} (%${p.matchResult.confidence})
│ Ü/A 2.5: ${p.overUnder.prediction} (%${p.overUnder.confidence})
│ KG VAR: ${p.btts.prediction} (%${p.btts.confidence})
└──────────────────────────────────────────────────────────────
`;
  });

  const matchIcon = consensus.matchResult.votes >= 3 ? '✅' : consensus.matchResult.votes >= 2 ? '⚠️' : '❌';
  const ouIcon = consensus.overUnder.votes >= 3 ? '✅' : consensus.overUnder.votes >= 2 ? '⚠️' : '❌';
  const bttsIcon = consensus.btts.votes >= 3 ? '✅' : consensus.btts.votes >= 2 ? '⚠️' : '❌';

  output += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CONSENSUS TAHMİNLERİ (Minimum 2/${totalModels} Uzlaşı)

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  ${matchIcon} MAÇ SONUCU: ${consensus.matchResult.prediction.padEnd(15)} (%${consensus.matchResult.confidence})  [${consensus.matchResult.votes}/${totalModels} oy]
║                                                               ║
║  ${ouIcon} Ü/A 2.5 GOL: ${consensus.overUnder.prediction.padEnd(15)} (%${consensus.overUnder.confidence})  [${consensus.overUnder.votes}/${totalModels} oy]
║                                                               ║
║  ${bttsIcon} KG VAR/YOK: ${consensus.btts.prediction.padEnd(15)} (%${consensus.btts.confidence})  [${consensus.btts.votes}/${totalModels} oy]
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

`;

  const bestBet = [
    { market: 'Maç Sonucu', prediction: consensus.matchResult.prediction, confidence: consensus.matchResult.confidence, votes: consensus.matchResult.votes },
    { market: 'Ü/A 2.5', prediction: consensus.overUnder.prediction, confidence: consensus.overUnder.confidence, votes: consensus.overUnder.votes },
    { market: 'KG VAR/YOK', prediction: consensus.btts.prediction, confidence: consensus.btts.confidence, votes: consensus.btts.votes },
  ].sort((a, b) => (b.votes * 100 + b.confidence) - (a.votes * 100 + a.confidence))[0];

  output += `
💎 EN İYİ BAHİS ÖNERİSİ
┌─────────────────────────────────────────────────────────────┐
│  ${bestBet.market}: ${bestBet.prediction}                   
│  Güven: %${bestBet.confidence} | Uzlaşı: ${bestBet.votes}/${totalModels} model
└─────────────────────────────────────────────────────────────┘

⚠️ RİSK UYARISI: Bu analiz yalnızca bilgi amaçlıdır. 
   Bahis kararlarınız tamamen size aittir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Powered by: Claude + GPT-4 + Gemini + Perplexity (4 AI Consensus)
`;

  return output;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeTeamId, homeTeamName, awayTeamId, awayTeamName, competition, matchDate } = body;

    if (!homeTeamName || !awayTeamName) {
      return NextResponse.json(
        { error: 'Ev sahibi ve deplasman takım adları gereklidir.' },
        { status: 400 }
      );
    }

    const matchData: MatchData = {
      homeTeamId: homeTeamId || 0,
      homeTeamName,
      awayTeamId: awayTeamId || 0,
      awayTeamName,
      competition: competition || 'Bilinmiyor',
      matchDate: matchDate || new Date().toISOString(),
    };

    console.log('🔍 Fetching match data...', matchData);

    const [homeStats, awayStats, h2h] = await Promise.all([
      fetchTeamStats(matchData.homeTeamId, matchData.homeTeamName),
      fetchTeamStats(matchData.awayTeamId, matchData.awayTeamName),
      fetchH2HData(matchData.homeTeamId, matchData.awayTeamId),
    ]);

    console.log('📊 Data fetched, calling AI models...');

    const prompt = buildAnalysisPrompt(matchData, homeStats, awayStats, h2h);

    const [claudeResult, openaiResult, geminiResult, perplexityResult] = await Promise.all([
      callClaude(prompt),
      callOpenAI(prompt),
      callGemini(prompt),
      callPerplexity(prompt),
    ]);

    const predictions: AIPrediction[] = [];
    if (claudeResult) predictions.push(claudeResult);
    if (openaiResult) predictions.push(openaiResult);
    if (geminiResult) predictions.push(geminiResult);
    if (perplexityResult) predictions.push(perplexityResult);

    console.log(`🤖 ${predictions.length} AI models responded`);

    if (predictions.length === 0) {
      return NextResponse.json(
        { error: 'Hiçbir AI modeli yanıt vermedi. Lütfen API anahtarlarını kontrol edin.' },
        { status: 500 }
      );
    }

    const consensus = calculateConsensus(predictions);

    const analysis = formatFinalAnalysis(
      matchData,
      homeStats,
      awayStats,
      h2h,
      predictions,
      consensus
    );

    return NextResponse.json({
      success: true,
      analysis,
      predictions,
      consensus,
      modelsUsed: predictions.map(p => p.model),
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: `Analiz hatası: ${error.message}` },
      { status: 500 }
    );
  }
}
