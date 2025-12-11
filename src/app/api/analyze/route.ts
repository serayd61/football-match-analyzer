import { NextRequest, NextResponse } from 'next/server';

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
  if (!teamId || !SPORTMONKS_API_KEY) {
    return getDefaultStats();
  }

  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      return getDefaultStats();
    }

    const data = await response.json();
    const team = data.data;
    const latest = team?.latest || [];

    const form = latest.slice(0, 5).map((match: any) => {
      const participants = match.participants || [];
      const home = participants.find((p: any) => p.meta?.location === 'home');
      const away = participants.find((p: any) => p.meta?.location === 'away');
      
      const scores = match.scores || [];
      const homeScore = scores.find((s: any) => s.description === 'CURRENT')?.score?.home || 0;
      const awayScore = scores.find((s: any) => s.description === 'CURRENT')?.score?.away || 0;

      const isHome = home?.id === teamId;
      const teamScore = isHome ? homeScore : awayScore;
      const oppScore = isHome ? awayScore : homeScore;

      if (teamScore > oppScore) return 'W';
      if (teamScore < oppScore) return 'L';
      return 'D';
    }).join('');

    return {
      form: form || 'DDDDD',
      goalsScored: 15,
      goalsConceded: 12,
      cleanSheets: 3,
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
  };
}

// Fetch H2H data
async function fetchH2HData(homeTeamId: number, awayTeamId: number): Promise<H2HData> {
  if (!homeTeamId || !awayTeamId || !SPORTMONKS_API_KEY) {
    return getDefaultH2H();
  }

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

      if (homeGoals > awayGoals) homeWins++;
      else if (awayGoals > homeGoals) awayWins++;
      else draws++;

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
  h2h: H2HData,
  language: string
): string {
  const isEnglish = language === 'en';
  
  return `
${isEnglish ? 'FOOTBALL MATCH ANALYSIS REQUEST' : 'FUTBOL MAÇI ANALİZ İSTEĞİ'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${isEnglish ? 'MATCH INFO' : 'MAÇ BİLGİSİ'}:
• ${isEnglish ? 'Home' : 'Ev Sahibi'}: ${matchData.homeTeamName}
• ${isEnglish ? 'Away' : 'Deplasman'}: ${matchData.awayTeamName}
• ${isEnglish ? 'Competition' : 'Lig'}: ${matchData.competition}

${isEnglish ? 'HOME TEAM STATS' : 'EV SAHİBİ İSTATİSTİKLERİ'} (${matchData.homeTeamName}):
• ${isEnglish ? 'Last 5 Form' : 'Son 5 Maç Formu'}: ${homeStats.form}
• ${isEnglish ? 'Goals Scored' : 'Atılan Gol'}: ${homeStats.goalsScored}
• ${isEnglish ? 'Goals Conceded' : 'Yenilen Gol'}: ${homeStats.goalsConceded}
• ${isEnglish ? 'Clean Sheets' : 'Gol Yemeden'}: ${homeStats.cleanSheets}

${isEnglish ? 'AWAY TEAM STATS' : 'DEPLASMAN İSTATİSTİKLERİ'} (${matchData.awayTeamName}):
• ${isEnglish ? 'Last 5 Form' : 'Son 5 Maç Formu'}: ${awayStats.form}
• ${isEnglish ? 'Goals Scored' : 'Atılan Gol'}: ${awayStats.goalsScored}
• ${isEnglish ? 'Goals Conceded' : 'Yenilen Gol'}: ${awayStats.goalsConceded}
• ${isEnglish ? 'Clean Sheets' : 'Gol Yemeden'}: ${awayStats.cleanSheets}

${isEnglish ? 'HEAD TO HEAD' : 'KARŞILAŞMA GEÇMİŞİ'} (H2H):
• ${isEnglish ? 'Total Matches' : 'Toplam Maç'}: ${h2h.totalMatches}
• ${matchData.homeTeamName}: ${h2h.homeWins} ${isEnglish ? 'wins' : 'galibiyet'}
• ${matchData.awayTeamName}: ${h2h.awayWins} ${isEnglish ? 'wins' : 'galibiyet'}
• ${isEnglish ? 'Draws' : 'Beraberlik'}: ${h2h.draws}
• ${isEnglish ? 'Avg Goals' : 'Ortalama Gol'}: ${h2h.avgGoals.toFixed(2)}
• ${isEnglish ? 'BTTS Rate' : 'KG VAR Oranı'}: %${h2h.bttsPercentage.toFixed(0)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${isEnglish ? 'PLEASE PROVIDE PREDICTIONS' : 'LÜTFEN TAHMİNLERİ YAP'}:

1. ${isEnglish ? 'MATCH RESULT' : 'MAÇ SONUCU'} (1X2):
   - ${isEnglish ? 'Prediction' : 'Tahmin'}: [${isEnglish ? 'Home / Draw / Away' : 'Ev Sahibi / Beraberlik / Deplasman'}]
   - ${isEnglish ? 'Confidence' : 'Güven'}: [%0-100]

2. ${isEnglish ? 'TOTAL GOALS' : 'TOPLAM GOL'} (O/U 2.5):
   - ${isEnglish ? 'Prediction' : 'Tahmin'}: [${isEnglish ? 'Over 2.5 / Under 2.5' : 'Üst 2.5 / Alt 2.5'}]
   - ${isEnglish ? 'Confidence' : 'Güven'}: [%0-100]

3. BTTS (${isEnglish ? 'Both Teams To Score' : 'KG VAR'}):
   - ${isEnglish ? 'Prediction' : 'Tahmin'}: [${isEnglish ? 'Yes / No' : 'Evet / Hayır'}]
   - ${isEnglish ? 'Confidence' : 'Güven'}: [%0-100]

4. ${isEnglish ? 'BEST BET RECOMMENDATION' : 'EN İYİ BAHİS ÖNERİSİ'}

${isEnglish ? 'Respond in English' : 'Yanıtını Türkçe ver'}.
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

    if (!response.ok) return null;

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

    if (!response.ok) return null;

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

    if (!response.ok) return null;

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

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseAIResponse('Perplexity', text);
  } catch (error) {
    console.error('Perplexity error:', error);
    return null;
  }
}

// Parse AI response
function parseAIResponse(model: string, text: string): AIPrediction {
  const prediction: AIPrediction = {
    model,
    matchResult: { prediction: 'Belirsiz', confidence: 50 },
    overUnder: { prediction: 'Belirsiz', confidence: 50 },
    btts: { prediction: 'Belirsiz', confidence: 50 },
    reasoning: text,
  };

  const textLower = text.toLowerCase();

  // Match Result
  if (textLower.includes('ev sahibi') || textLower.includes('home win') || textLower.includes('home team')) {
    prediction.matchResult.prediction = 'Ev Sahibi';
    prediction.matchResult.confidence = extractConfidence(text) || 65;
  } else if (textLower.includes('deplasman') || textLower.includes('away win') || textLower.includes('away team')) {
    prediction.matchResult.prediction = 'Deplasman';
    prediction.matchResult.confidence = extractConfidence(text) || 60;
  } else if (textLower.includes('beraberlik') || textLower.includes('draw')) {
    prediction.matchResult.prediction = 'Beraberlik';
    prediction.matchResult.confidence = extractConfidence(text) || 55;
  }

  // Over/Under
  if (textLower.includes('üst 2.5') || textLower.includes('over 2.5')) {
    prediction.overUnder.prediction = 'Üst 2.5';
    prediction.overUnder.confidence = extractConfidence(text) || 60;
  } else if (textLower.includes('alt 2.5') || textLower.includes('under 2.5')) {
    prediction.overUnder.prediction = 'Alt 2.5';
    prediction.overUnder.confidence = extractConfidence(text) || 60;
  }

  // BTTS
  if (textLower.includes('kg var') || textLower.includes('btts: yes') || textLower.includes('btts yes') || (textLower.includes('btts') && textLower.includes('evet'))) {
    prediction.btts.prediction = 'Evet';
    prediction.btts.confidence = extractConfidence(text) || 58;
  } else if (textLower.includes('kg yok') || textLower.includes('btts: no') || textLower.includes('btts no') || (textLower.includes('btts') && textLower.includes('hayır'))) {
    prediction.btts.prediction = 'Hayır';
    prediction.btts.confidence = extractConfidence(text) || 55;
  }

  return prediction;
}

function extractConfidence(text: string): number | null {
  const patterns = [/%(\d+)/g, /(\d+)%/g, /(\d+)\s*percent/gi];
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = parseInt(match[1]);
      if (value >= 40 && value <= 100) return value;
    }
  }
  return null;
}

// Calculate consensus
function calculateConsensus(predictions: AIPrediction[]) {
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

// Format analysis for dashboard
function formatAnalysisForDashboard(
  predictions: AIPrediction[],
  consensus: ReturnType<typeof calculateConsensus>
) {
  const totalModels = predictions.length;
  
  // AI Status
  const aiStatus: Record<string, boolean> = {
    claude: predictions.some(p => p.model === 'Claude'),
    openai: predictions.some(p => p.model === 'GPT-4'),
    gemini: predictions.some(p => p.model === 'Gemini'),
    perplexity: predictions.some(p => p.model === 'Perplexity'),
  };

  // Individual analyses
  const individualAnalyses: Record<string, any> = {};
  predictions.forEach(p => {
    const key = p.model.toLowerCase().replace('-', '').replace('gpt4', 'openai');
    individualAnalyses[p.model === 'GPT-4' ? 'openai' : p.model.toLowerCase()] = {
      matchResult: p.matchResult,
      overUnder25: p.overUnder,
      btts: p.btts,
    };
  });

  // Best bet
  const bestBets = [
    { type: 'Maç Sonucu', ...consensus.matchResult },
    { type: 'Ü/A 2.5', ...consensus.overUnder },
    { type: 'KG VAR', ...consensus.btts },
  ].sort((a, b) => (b.votes * 100 + b.confidence) - (a.votes * 100 + a.confidence));

  const topBet = bestBets[0];

  return {
    matchResult: {
      prediction: consensus.matchResult.prediction,
      confidence: consensus.matchResult.confidence,
      votes: consensus.matchResult.votes,
      totalVotes: totalModels,
    },
    overUnder25: {
      prediction: consensus.overUnder.prediction,
      confidence: consensus.overUnder.confidence,
      votes: consensus.overUnder.votes,
      totalVotes: totalModels,
    },
    btts: {
      prediction: consensus.btts.prediction,
      confidence: consensus.btts.confidence,
      votes: consensus.btts.votes,
      totalVotes: totalModels,
    },
    riskLevel: topBet.votes >= 3 ? 'Low' : topBet.votes >= 2 ? 'Medium' : 'High',
    bestBets: [{
      type: topBet.type,
      selection: topBet.prediction,
      confidence: topBet.confidence,
      reasoning: `${topBet.votes}/${totalModels} AI model bu tahmin üzerinde uzlaştı.`,
    }],
    overallAnalyses: predictions.slice(0, 1).map(p => p.reasoning.substring(0, 500)),
    aiStatus,
    individualAnalyses,
  };
}

// Main POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Dashboard'dan gelen field isimleri
    const {
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      language = 'tr',
    } = body;

    // Validate
    if (!homeTeam || !awayTeam) {
      return NextResponse.json(
        { error: 'Ev sahibi ve deplasman takım adları gereklidir.' },
        { status: 400 }
      );
    }

    const matchData: MatchData = {
      homeTeamId: homeTeamId || 0,
      homeTeamName: homeTeam,
      awayTeamId: awayTeamId || 0,
      awayTeamName: awayTeam,
      competition: 'League Match',
      matchDate: new Date().toISOString(),
    };

    console.log('🔍 Analyzing match:', matchData);

    // Fetch data
    const [homeStats, awayStats, h2h] = await Promise.all([
      fetchTeamStats(matchData.homeTeamId, matchData.homeTeamName),
      fetchTeamStats(matchData.awayTeamId, matchData.awayTeamName),
      fetchH2HData(matchData.homeTeamId, matchData.awayTeamId),
    ]);

    console.log('📊 Data fetched, calling AI models...');

    // Build prompt
    const prompt = buildAnalysisPrompt(matchData, homeStats, awayStats, h2h, language);

    // Call all AI models
    const [claudeResult, openaiResult, geminiResult, perplexityResult] = await Promise.all([
      callClaude(prompt),
      callOpenAI(prompt),
      callGemini(prompt),
      callPerplexity(prompt),
    ]);

    // Collect predictions
    const predictions: AIPrediction[] = [];
    if (claudeResult) predictions.push(claudeResult);
    if (openaiResult) predictions.push(openaiResult);
    if (geminiResult) predictions.push(geminiResult);
    if (perplexityResult) predictions.push(perplexityResult);

    console.log(`🤖 ${predictions.length} AI models responded`);

    if (predictions.length === 0) {
      return NextResponse.json(
        { error: 'Hiçbir AI modeli yanıt vermedi. API anahtarlarını kontrol edin.' },
        { status: 500 }
      );
    }

    // Calculate consensus
    const consensus = calculateConsensus(predictions);

    // Format for dashboard
    const analysis = formatAnalysisForDashboard(predictions, consensus);

    return NextResponse.json({
      success: true,
      analysis,
      aiStatus: analysis.aiStatus,
      individualAnalyses: analysis.individualAnalyses,
      modelsUsed: predictions.map(p => p.model),
      totalModels: predictions.length,
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: `Analiz hatası: ${error.message}` },
      { status: 500 }
    );
  }
}
