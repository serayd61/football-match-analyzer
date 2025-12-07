export const dynamic = 'force-dynamic';
import { checkUserAccess, incrementAnalysisCount } from '@/lib/accessControl';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase';

// API Clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ==================== PROMPTS ====================

const getAnalysisPrompt = (
  lang: string,
  homeTeam: string,
  awayTeam: string,
  league: string,
  odds: any,
  homeForm: any,
  awayForm: any,
  h2h: any
) => {
  const prompts: Record<string, string> = {
    tr: `SEN PROFESYONEL BAHİS ANALİSTİSİN.

📊 MAÇ: ${homeTeam} vs ${awayTeam}
🏆 LİG: ${league}

💰 ORANLAR:
- 1X2: Ev=${odds?.matchWinner?.home || 'N/A'} | X=${odds?.matchWinner?.draw || 'N/A'} | Dep=${odds?.matchWinner?.away || 'N/A'}
- Ü/A 2.5: Üst=${odds?.overUnder?.['2.5']?.over || 'N/A'} | Alt=${odds?.overUnder?.['2.5']?.under || 'N/A'}
- KG: Var=${odds?.btts?.yes || 'N/A'} | Yok=${odds?.btts?.no || 'N/A'}

📈 ${homeTeam} FORM: ${homeForm?.form || 'N/A'}
- Son 5 Maç Puanı: ${homeForm?.points || 0}/15
- Maç Başı Gol: ${homeForm?.avgGoals || 'N/A'}
- Maç Başı Yenilen: ${homeForm?.avgConceded || 'N/A'}
- Üst 2.5 Oranı: %${homeForm?.over25Percentage || 'N/A'}
- KG Var Oranı: %${homeForm?.bttsPercentage || 'N/A'}

📉 ${awayTeam} FORM: ${awayForm?.form || 'N/A'}
- Son 5 Maç Puanı: ${awayForm?.points || 0}/15
- Maç Başı Gol: ${awayForm?.avgGoals || 'N/A'}
- Maç Başı Yenilen: ${awayForm?.avgConceded || 'N/A'}
- Üst 2.5 Oranı: %${awayForm?.over25Percentage || 'N/A'}
- KG Var Oranı: %${awayForm?.bttsPercentage || 'N/A'}

⚔️ KAFA KAFAYA: ${h2h?.totalMatches || 0} maç
- ${homeTeam} Galibiyeti: ${h2h?.homeWins || 0}
- ${awayTeam} Galibiyeti: ${h2h?.awayWins || 0}
- Beraberlik: ${h2h?.draws || 0}
- Ortalama Gol: ${h2h?.avgGoals || 'N/A'}
- Üst 2.5: %${h2h?.over25Percentage || 'N/A'}

🎯 ANALİZ TALİMATLARI:
- VERİLERE DAYALI analiz yap
- Form verilerini DİKKATLİCE değerlendir
- Güven oranları %50-80 arasında GERÇEKÇI olsun
- Her tahmin için SOMUT gerekçe ver

SADECE JSON DÖNDÜR:
{
  "matchResult": {"prediction": "1 veya X veya 2", "confidence": 65, "reasoning": "Form ve istatistiklere dayalı açıklama"},
  "overUnder25": {"prediction": "Over veya Under", "confidence": 70, "reasoning": "Gol verilerine dayalı açıklama"},
  "btts": {"prediction": "Yes veya No", "confidence": 68, "reasoning": "Her iki takımın gol verilerine dayalı"},
  "bestBet": {"type": "Bahis türü", "selection": "Seçim", "confidence": 72, "reasoning": "En güvenilir bahis açıklaması"},
  "riskLevel": "Düşük/Orta/Yüksek",
  "overallAnalysis": "Maçın genel değerlendirmesi 2-3 cümle"
}`,

    en: `YOU ARE A PROFESSIONAL BETTING ANALYST.

📊 MATCH: ${homeTeam} vs ${awayTeam}
🏆 LEAGUE: ${league}

💰 ODDS:
- 1X2: Home=${odds?.matchWinner?.home || 'N/A'} | X=${odds?.matchWinner?.draw || 'N/A'} | Away=${odds?.matchWinner?.away || 'N/A'}
- O/U 2.5: Over=${odds?.overUnder?.['2.5']?.over || 'N/A'} | Under=${odds?.overUnder?.['2.5']?.under || 'N/A'}
- BTTS: Yes=${odds?.btts?.yes || 'N/A'} | No=${odds?.btts?.no || 'N/A'}

📈 ${homeTeam} FORM: ${homeForm?.form || 'N/A'}
- Last 5 Points: ${homeForm?.points || 0}/15
- Goals Per Game: ${homeForm?.avgGoals || 'N/A'}
- Conceded Per Game: ${homeForm?.avgConceded || 'N/A'}
- Over 2.5 Rate: ${homeForm?.over25Percentage || 'N/A'}%
- BTTS Rate: ${homeForm?.bttsPercentage || 'N/A'}%

📉 ${awayTeam} FORM: ${awayForm?.form || 'N/A'}
- Last 5 Points: ${awayForm?.points || 0}/15
- Goals Per Game: ${awayForm?.avgGoals || 'N/A'}
- Conceded Per Game: ${awayForm?.avgConceded || 'N/A'}
- Over 2.5 Rate: ${awayForm?.over25Percentage || 'N/A'}%
- BTTS Rate: ${awayForm?.bttsPercentage || 'N/A'}%

⚔️ HEAD TO HEAD: ${h2h?.totalMatches || 0} matches
- ${homeTeam} Wins: ${h2h?.homeWins || 0}
- ${awayTeam} Wins: ${h2h?.awayWins || 0}
- Draws: ${h2h?.draws || 0}
- Avg Goals: ${h2h?.avgGoals || 'N/A'}
- Over 2.5: ${h2h?.over25Percentage || 'N/A'}%

🎯 ANALYSIS INSTRUCTIONS:
- Analyze based on PROVIDED DATA
- Evaluate form data CAREFULLY
- Confidence should be REALISTIC between 50-80%
- Give CONCRETE reasoning for each prediction

RETURN ONLY JSON:
{
  "matchResult": {"prediction": "1 or X or 2", "confidence": 65, "reasoning": "Explanation based on form and stats"},
  "overUnder25": {"prediction": "Over or Under", "confidence": 70, "reasoning": "Explanation based on goal data"},
  "btts": {"prediction": "Yes or No", "confidence": 68, "reasoning": "Based on both teams goal data"},
  "bestBet": {"type": "Bet type", "selection": "Selection", "confidence": 72, "reasoning": "Most reliable bet explanation"},
  "riskLevel": "Low/Medium/High",
  "overallAnalysis": "Overall match assessment 2-3 sentences"
}`,

    de: `PROFESSIONELLER WETT-ANALYST.
📊 ${homeTeam} vs ${awayTeam} | ${league}
Form: ${homeForm?.form || 'N/A'} vs ${awayForm?.form || 'N/A'}
Gib NUR JSON zurück mit matchResult, overUnder25, btts, bestBet, riskLevel, overallAnalysis. Confidence zwischen 50-80%.`,
  };

  return prompts[lang] || prompts.en;
};

// ==================== AI FUNCTIONS ====================

async function analyzeWithClaude(prompt: string): Promise<any> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
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
        { role: 'system', content: 'You are an expert betting analyst. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    return parseJSON(response.choices[0]?.message?.content || '');
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
    return parseJSON(result.response.text());
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

async function analyzeWithPerplexity(prompt: string): Promise<any> {
  if (!PERPLEXITY_API_KEY) {
    console.error('Perplexity API key not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert betting analyst. Analyze the match data and return ONLY valid JSON. No markdown, no explanation, just JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseJSON(text);
  } catch (error) {
    console.error('Perplexity error:', error);
    return null;
  }
}

function parseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1].trim()); } catch { }
    }
    // Try to find raw JSON object
    const rawMatch = text.match(/\{[\s\S]*\}/);
    if (rawMatch) {
      try { return JSON.parse(rawMatch[0]); } catch { return null; }
    }
    return null;
  }
}

// ==================== DATA FETCHING ====================

async function fetchMatchData(fixtureId: number, homeTeamId: number, awayTeamId: number, homeTeamName: string, awayTeamName: string) {
  let odds: any = {};
  let homeForm: any = getDefaultForm();
  let awayForm: any = getDefaultForm();
  let h2h: any = getDefaultH2H();

  if (!SPORTMONKS_API_KEY) {
    console.log('⚠️ SPORTMONKS_API_KEY not configured');
    return { odds, homeForm, awayForm, h2h };
  }

  try {
    const [fixtureRes, homeFormRes, awayFormRes, h2hRes] = await Promise.all([
      fetch(`https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=odds`),
      fetch(`https://api.sportmonks.com/v3/football/teams/${homeTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`),
      fetch(`https://api.sportmonks.com/v3/football/teams/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}&include=latest`),
      fetch(`https://api.sportmonks.com/v3/football/fixtures/head-to-head/${homeTeamId}/${awayTeamId}?api_token=${SPORTMONKS_API_KEY}`),
    ]);

    const [fixtureData, homeFormData, awayFormData, h2hData] = await Promise.all([
      fixtureRes.json(),
      homeFormRes.json(),
      awayFormRes.json(),
      h2hRes.json(),
    ]);

    if (fixtureData.data?.odds) {
      odds = parseOdds(fixtureData.data.odds);
    }

    if (homeFormData.data?.latest && homeFormData.data.latest.length > 0) {
      homeForm = calculateFormFromResultInfo(homeFormData.data.latest, homeTeamName);
    }

    if (awayFormData.data?.latest && awayFormData.data.latest.length > 0) {
      awayForm = calculateFormFromResultInfo(awayFormData.data.latest, awayTeamName);
    }

    if (h2hData.data && h2hData.data.length > 0) {
      h2h = calculateH2HFromResultInfo(h2hData.data, homeTeamName, awayTeamName);
    }

  } catch (error) {
    console.error('Sportmonks fetch error:', error);
  }

  return { odds, homeForm, awayForm, h2h };
}

function getDefaultForm() {
  return { 
    form: 'N/A', 
    points: 0, 
    avgGoals: '1.3', 
    avgConceded: '1.1', 
    over25Percentage: '50', 
    bttsPercentage: '50' 
  };
}

function getDefaultH2H() {
  return { 
    totalMatches: 0, 
    homeWins: 0, 
    awayWins: 0, 
    draws: 0, 
    avgGoals: '2.5', 
    over25Percentage: '50', 
    bttsPercentage: '50' 
  };
}

function parseOdds(oddsData: any[]): any {
  const result: any = {
    matchWinner: {},
    overUnder: { '2.5': {} },
    btts: {},
  };

  if (!oddsData || !Array.isArray(oddsData)) return result;

  oddsData.forEach((odd: any) => {
    const marketName = odd.market_description?.toLowerCase() || odd.market?.name?.toLowerCase() || '';

    if (marketName.includes('fulltime result') || marketName.includes('1x2') || marketName.includes('winner')) {
      if (odd.label === 'Home' || odd.label === '1') result.matchWinner.home = parseFloat(odd.value);
      if (odd.label === 'Draw' || odd.label === 'X') result.matchWinner.draw = parseFloat(odd.value);
      if (odd.label === 'Away' || odd.label === '2') result.matchWinner.away = parseFloat(odd.value);
    }

    if (marketName.includes('over/under') || marketName.includes('goals')) {
      if (odd.total === 2.5 || odd.total === '2.5' || marketName.includes('2.5')) {
        if (odd.label === 'Over') result.overUnder['2.5'].over = parseFloat(odd.value);
        if (odd.label === 'Under') result.overUnder['2.5'].under = parseFloat(odd.value);
      }
    }

    if (marketName.includes('both teams') || marketName.includes('btts')) {
      if (odd.label === 'Yes') result.btts.yes = parseFloat(odd.value);
      if (odd.label === 'No') result.btts.no = parseFloat(odd.value);
    }
  });

  return result;
}

function calculateFormFromResultInfo(matches: any[], teamName: string): any {
  if (!matches || matches.length === 0) {
    return getDefaultForm();
  }

  const last5 = matches.slice(0, 5);
  let form = '';
  let points = 0;
  let wins = 0, draws = 0, losses = 0;

  const teamFirstWord = teamName.split(' ')[0].toLowerCase();

  last5.forEach((match: any) => {
    const resultInfo = (match.result_info || '').toLowerCase();
    
    if (resultInfo.includes('draw') || resultInfo.includes('ended in draw')) {
      form += 'D';
      draws++;
      points += 1;
    } else if (resultInfo.includes('won')) {
      const winnerName = resultInfo.split(' won')[0].trim().toLowerCase();
      
      if (winnerName.includes(teamFirstWord) || teamFirstWord.includes(winnerName.split(' ')[0])) {
        form += 'W';
        wins++;
        points += 3;
      } else {
        form += 'L';
        losses++;
      }
    } else {
      form += 'D';
      draws++;
      points += 1;
    }
  });

  const avgGoals = ((wins * 2.1) + (draws * 1.1) + (losses * 0.7)) / last5.length;
  const avgConceded = ((losses * 2.0) + (draws * 1.1) + (wins * 0.6)) / last5.length;
  const over25Pct = Math.round(((wins * 65) + (draws * 40) + (losses * 50)) / last5.length);
  const bttsPct = Math.round(((wins * 55) + (draws * 55) + (losses * 60)) / last5.length);

  console.log(`   ${teamName}: ${form} | Pts: ${points}/15 | Goals: ${avgGoals.toFixed(1)}`);

  return {
    form,
    points,
    avgGoals: avgGoals.toFixed(1),
    avgConceded: avgConceded.toFixed(1),
    over25Percentage: over25Pct.toString(),
    bttsPercentage: bttsPct.toString(),
  };
}

function calculateH2HFromResultInfo(matches: any[], homeTeamName: string, awayTeamName: string): any {
  if (!matches || matches.length === 0) {
    return getDefaultH2H();
  }

  let homeWins = 0, awayWins = 0, draws = 0;
  const homeFirstWord = homeTeamName.split(' ')[0].toLowerCase();
  const awayFirstWord = awayTeamName.split(' ')[0].toLowerCase();

  matches.forEach((match: any) => {
    const resultInfo = (match.result_info || '').toLowerCase();
    
    if (resultInfo.includes('draw')) {
      draws++;
    } else if (resultInfo.includes('won')) {
      const winnerName = resultInfo.split(' won')[0].trim().toLowerCase();
      if (winnerName.includes(homeFirstWord)) {
        homeWins++;
      } else if (winnerName.includes(awayFirstWord)) {
        awayWins++;
      } else {
        draws++;
      }
    }
  });

  const totalMatches = matches.length;
  const avgGoals = 2.3 + (homeWins + awayWins) * 0.1;
  const over25Pct = Math.round(45 + (homeWins + awayWins) * 3);
  const bttsPct = Math.round(50 + draws * 2);

  return {
    totalMatches,
    homeWins,
    awayWins,
    draws,
    avgGoals: avgGoals.toFixed(1),
    over25Percentage: Math.min(over25Pct, 80).toString(),
    bttsPercentage: Math.min(bttsPct, 75).toString(),
  };
}

// ==================== WEIGHTED CONSENSUS ====================

function calculateConsensus(analyses: any[]): any {
  const valid = analyses.filter(a => a !== null);
  if (valid.length === 0) return null;

  const consensus: any = {};
  const fields = ['matchResult', 'overUnder25', 'btts'];

  fields.forEach(field => {
    const scores: Record<string, { 
      weightedScore: number; 
      count: number; 
      reasons: string[]; 
      totalConf: number 
    }> = {};
    
    valid.forEach(a => {
      if (a[field]?.prediction) {
        const pred = a[field].prediction;
        const conf = Math.min(Math.max(a[field].confidence || 60, 50), 80);
        
        if (!scores[pred]) {
          scores[pred] = { weightedScore: 0, count: 0, reasons: [], totalConf: 0 };
        }
        
        scores[pred].weightedScore += conf;
        scores[pred].count++;
        scores[pred].totalConf += conf;
        if (a[field].reasoning) scores[pred].reasons.push(a[field].reasoning);
      }
    });

    const sorted = Object.entries(scores).sort((a, b) => {
      if (b[1].weightedScore !== a[1].weightedScore) {
        return b[1].weightedScore - a[1].weightedScore;
      }
      return b[1].count - a[1].count;
    });

    if (sorted.length > 0) {
      const [pred, data] = sorted[0];
      const totalVotes = valid.length;
      const avgConf = Math.round(data.totalConf / data.count);
      
      let finalConfidence = avgConf;
      const voteRatio = data.count / totalVotes;
      
      if (voteRatio < 0.5) {
        finalConfidence = Math.round(finalConfidence * 0.85);
      } else if (voteRatio >= 0.75) {
        finalConfidence = Math.min(finalConfidence + 3, 80);
      }
      
      if (data.count === totalVotes) {
        finalConfidence = Math.min(finalConfidence + 5, 80);
      }

      finalConfidence = Math.min(Math.max(finalConfidence, 45), 80);

      consensus[field] = {
        prediction: pred,
        confidence: finalConfidence,
        votes: data.count,
        totalVotes,
        unanimous: data.count === totalVotes,
        reasoning: data.reasons[0] || '',
      };

      console.log(`   ${field}: ${pred} (${data.count}/${totalVotes} votes, weighted: ${data.weightedScore}, conf: ${finalConfidence}%)`);
    }
  });

  const allBets = valid
    .filter(a => a.bestBet)
    .map(a => ({
      ...a.bestBet,
      confidence: Math.min(Math.max(a.bestBet.confidence || 60, 50), 80)
    }))
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  const uniqueBets: any[] = [];
  const seenBets = new Set<string>();
  
  allBets.forEach(bet => {
    const key = `${bet.type}-${bet.selection}`.toLowerCase();
    if (!seenBets.has(key) && uniqueBets.length < 3) {
      seenBets.add(key);
      uniqueBets.push(bet);
    }
  });

  consensus.bestBets = uniqueBets;
  consensus.overallAnalyses = valid.filter(a => a.overallAnalysis).map(a => a.overallAnalysis);
  
  const riskVotes: Record<string, number> = {};
  valid.forEach(a => {
    if (a.riskLevel) {
      const risk = a.riskLevel.toLowerCase().replace('düşük', 'low').replace('orta', 'medium').replace('yüksek', 'high');
      riskVotes[risk] = (riskVotes[risk] || 0) + 1;
    }
  });
  
  const sortedRisk = Object.entries(riskVotes).sort((a, b) => b[1] - a[1]);
  consensus.riskLevel = sortedRisk[0]?.[0] || 'Medium';

  return consensus;
}

// ==================== MAIN HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const access = await checkUserAccess(session.user.email, ip);

    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message || 'Access denied', trialExpired: access.trialExpired }, { status: 403 });
    }

    if (!access.canAnalyze) {
      return NextResponse.json({ error: 'Daily limit reached', limitReached: true }, { status: 429 });
    }

    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league = '', language = 'en', forceRefresh = false } = body;

    if (!fixtureId || !homeTeam || !awayTeam) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🚀 ANALYSIS: ${homeTeam} vs ${awayTeam} [${language}]`);

    // Cache check
    const cacheKey = `analysis_v4_${fixtureId}_${language}`;
    
    if (!forceRefresh) {
      const { data: cached } = await supabaseAdmin
        .from('analysis_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log('✅ Cache hit');
        await incrementAnalysisCount(session.user.email);
        return NextResponse.json({ ...cached.data, fromCache: true });
      }
    }

    console.log('📊 Fetching Sportmonks data...');
    const { odds, homeForm, awayForm, h2h } = await fetchMatchData(
      fixtureId, homeTeamId, awayTeamId, homeTeam, awayTeam
    );
    
    console.log(`   Odds: ${odds?.matchWinner?.home ? 'YES' : 'NO'}`);
    console.log(`   Home: ${homeForm?.form} | Away: ${awayForm?.form}`);
    console.log(`   H2H: ${h2h?.totalMatches} matches`);

    const prompt = getAnalysisPrompt(language, homeTeam, awayTeam, league, odds, homeForm, awayForm, h2h);

    // Run all 4 AI analyses in parallel
    console.log('🤖 Running AI analyses (Claude, GPT-4, Gemini, Perplexity)...');
    const [claude, gpt, gemini, perplexity] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
      analyzeWithPerplexity(prompt),
    ]);

    console.log(`   Claude: ${claude ? '✅' : '❌'} | GPT-4: ${gpt ? '✅' : '❌'} | Gemini: ${gemini ? '✅' : '❌'} | Perplexity: ${perplexity ? '✅' : '❌'}`);

    const allAnalyses = [claude, gpt, gemini, perplexity].filter(a => a !== null);
    console.log(`⚖️ Weighted consensus from ${allAnalyses.length} AI models`);
    
    const consensus = calculateConsensus(allAnalyses);
    if (!consensus) {
      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }

    const response = {
      success: true,
      fixture: { id: fixtureId, homeTeam, awayTeam, league },
      odds,
      form: { home: homeForm, away: awayForm },
      h2h,
      analysis: consensus,
      individualAnalyses: { claude, openai: gpt, gemini, perplexity },
      aiStatus: { claude: !!claude, openai: !!gpt, gemini: !!gemini, perplexity: !!perplexity },
      language,
    };

    // Cache for 3 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 3);
    
    await supabaseAdmin.from('analysis_cache').upsert({
      cache_key: cacheKey,
      data: response,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    });

    await incrementAnalysisCount(session.user.email);
    console.log('✅ Done!\n');

    return NextResponse.json({ ...response, fromCache: false });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
