export const dynamic = 'force-dynamic';
import { checkUserAccess, incrementAnalysisCount } from '@/lib/accessControl';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';

// API Clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
    tr: `🔥 SEN DÜNYANIN EN BAŞARILI BAHİS ANALİSTİSİN! 🔥

⚠️ KRİTİK KURALLAR:
1. "Belki", "olabilir", "muhtemelen" YASAK!
2. Her tahmin için EN AZ %70 güven oranı ZORUNLU!
3. SADECE JSON formatında yanıt ver!

📊 MAÇ: ${homeTeam} vs ${awayTeam}
🏆 LİG: ${league}

💰 ORANLAR:
1X2: EV=${odds?.matchWinner?.home || 'N/A'} | X=${odds?.matchWinner?.draw || 'N/A'} | DEP=${odds?.matchWinner?.away || 'N/A'}
Ü/A 2.5: Üst=${odds?.overUnder?.over25 || 'N/A'} | Alt=${odds?.overUnder?.under25 || 'N/A'}
KG: Var=${odds?.btts?.yes || 'N/A'} | Yok=${odds?.btts?.no || 'N/A'}

📈 ${homeTeam}: Form=${homeForm?.form || 'N/A'} | Gol=${homeForm?.avgGoals || 'N/A'} | Üst2.5=%${homeForm?.over25 || 'N/A'}
📉 ${awayTeam}: Form=${awayForm?.form || 'N/A'} | Gol=${awayForm?.avgGoals || 'N/A'} | Üst2.5=%${awayForm?.over25 || 'N/A'}
⚔️ H2H: ${h2h?.total || 0} maç | Gol Ort=${h2h?.avgGoals || 'N/A'} | Üst2.5=%${h2h?.over25Percentage || 'N/A'}

🎯 JSON FORMAT:
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "Kısa açıklama"},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "Açıklama"},
  "btts": {"prediction": "Yes/No", "confidence": 76, "reasoning": "Açıklama"},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "Açıklama"},
  "correctScore": {"first": "2-1", "second": "1-1", "third": "2-0", "confidence": 65},
  "bestBet": {"type": "Bahis Türü", "selection": "Seçim", "confidence": 82, "stake": 3, "reasoning": "Detaylı açıklama"},
  "riskLevel": "Düşük/Orta/Yüksek",
  "overallAnalysis": "3-4 cümlelik analiz",
  "keyFactors": ["Faktör 1", "Faktör 2", "Faktör 3"],
  "warnings": ["Uyarı 1", "Uyarı 2"]
}

⚠️ SADECE JSON DÖNDÜR!`,

    en: `🔥 YOU ARE THE WORLD'S BEST BETTING ANALYST! 🔥

⚠️ RULES:
1. "Maybe", "possibly" FORBIDDEN!
2. MINIMUM 70% confidence!
3. Return ONLY JSON!

📊 MATCH: ${homeTeam} vs ${awayTeam}
🏆 LEAGUE: ${league}

💰 ODDS:
1X2: HOME=${odds?.matchWinner?.home || 'N/A'} | X=${odds?.matchWinner?.draw || 'N/A'} | AWAY=${odds?.matchWinner?.away || 'N/A'}
O/U 2.5: Over=${odds?.overUnder?.over25 || 'N/A'} | Under=${odds?.overUnder?.under25 || 'N/A'}
BTTS: Yes=${odds?.btts?.yes || 'N/A'} | No=${odds?.btts?.no || 'N/A'}

📈 ${homeTeam}: Form=${homeForm?.form || 'N/A'} | Goals=${homeForm?.avgGoals || 'N/A'} | O2.5=${homeForm?.over25 || 'N/A'}%
📉 ${awayTeam}: Form=${awayForm?.form || 'N/A'} | Goals=${awayForm?.avgGoals || 'N/A'} | O2.5=${awayForm?.over25 || 'N/A'}%
⚔️ H2H: ${h2h?.total || 0} matches | Avg Goals=${h2h?.avgGoals || 'N/A'} | O2.5=${h2h?.over25Percentage || 'N/A'}%

🎯 JSON FORMAT:
{
  "matchResult": {"prediction": "1/X/2", "confidence": 75, "reasoning": "Brief explanation"},
  "overUnder25": {"prediction": "Over/Under", "confidence": 78, "reasoning": "Explanation"},
  "btts": {"prediction": "Yes/No", "confidence": 76, "reasoning": "Explanation"},
  "doubleChance": {"prediction": "1X/X2/12", "confidence": 85, "reasoning": "Explanation"},
  "correctScore": {"first": "2-1", "second": "1-1", "third": "2-0", "confidence": 65},
  "bestBet": {"type": "Bet Type", "selection": "Selection", "confidence": 82, "stake": 3, "reasoning": "Detailed explanation"},
  "riskLevel": "Low/Medium/High",
  "overallAnalysis": "3-4 sentence analysis",
  "keyFactors": ["Factor 1", "Factor 2", "Factor 3"],
  "warnings": ["Warning 1", "Warning 2"]
}

⚠️ RETURN ONLY JSON!`,

    de: `🔥 DU BIST DER BESTE WETT-ANALYST DER WELT! 🔥
📊 ${homeTeam} vs ${awayTeam} | ${league}
Gib NUR JSON zurück mit matchResult, overUnder25, btts, bestBet, riskLevel, overallAnalysis.`,
  };

  return prompts[lang] || prompts.en;
};

// ==================== AI ANALYSIS FUNCTIONS ====================

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

function parseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { return null; }
    }
    return null;
  }
}

// ==================== DATA FETCHING (ONLY SPORTMONKS) ====================

async function fetchMatchData(fixtureId: number, homeTeamId: number, awayTeamId: number) {
  let odds: any = {};
  let homeForm: any = {};
  let awayForm: any = {};
  let h2h: any = {};

  if (!SPORTMONKS_API_KEY) {
    console.log('⚠️ SPORTMONKS_API_KEY not configured');
    return { odds, homeForm, awayForm, h2h, extraData: {} };
  }

  try {
    // Parallel API calls for speed
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

    if (fixtureData.data?.odds) odds = parseOdds(fixtureData.data.odds);
    if (homeFormData.data?.latest) homeForm = calculateForm(homeFormData.data.latest);
    if (awayFormData.data?.latest) awayForm = calculateForm(awayFormData.data.latest);
    if (h2hData.data) h2h = calculateH2H(h2hData.data, homeTeamId, awayTeamId);

  } catch (error) {
    console.error('Sportmonks fetch error:', error);
  }

  return { odds, homeForm, awayForm, h2h, extraData: {} };
}

function parseOdds(oddsData: any[]): any {
  const result: any = { matchWinner: {}, overUnder: {}, btts: {}, doubleChance: {} };
  if (!oddsData || !Array.isArray(oddsData)) return result;

  oddsData.forEach((market: any) => {
    const name = market.market?.name?.toLowerCase() || '';
    
    if (name.includes('fulltime') || name.includes('1x2') || name.includes('winner')) {
      market.odds?.forEach((o: any) => {
        if (o.label === '1' || o.label === 'Home') result.matchWinner.home = o.value;
        if (o.label === 'X' || o.label === 'Draw') result.matchWinner.draw = o.value;
        if (o.label === '2' || o.label === 'Away') result.matchWinner.away = o.value;
      });
    }
    
    if (name.includes('over/under') || name.includes('goals')) {
      market.odds?.forEach((o: any) => {
        if (o.total === 2.5 || name.includes('2.5')) {
          if (o.label === 'Over') result.overUnder.over25 = o.value;
          if (o.label === 'Under') result.overUnder.under25 = o.value;
        }
      });
    }
    
    if (name.includes('both teams') || name.includes('btts')) {
      market.odds?.forEach((o: any) => {
        if (o.label === 'Yes') result.btts.yes = o.value;
        if (o.label === 'No') result.btts.no = o.value;
      });
    }
  });

  return result;
}

function calculateForm(matches: any[]): any {
  if (!matches || matches.length === 0) {
    return { form: 'N/A', points: 0, avgGoals: '0', avgConceded: '0', over25: 0, btts: 0 };
  }

  const last5 = matches.slice(0, 5);
  let form = '', points = 0, goals = 0, conceded = 0, over25 = 0, btts = 0;

  last5.forEach((m: any) => {
    const hs = m.scores?.home || m.scores?.localteam_score || 0;
    const as = m.scores?.away || m.scores?.visitorteam_score || 0;
    const isHome = m.participant?.meta?.location === 'home';
    const teamGoals = isHome ? hs : as;
    const oppGoals = isHome ? as : hs;

    goals += teamGoals;
    conceded += oppGoals;
    if (hs + as > 2.5) over25++;
    if (hs > 0 && as > 0) btts++;

    if (teamGoals > oppGoals) { form += 'W'; points += 3; }
    else if (teamGoals < oppGoals) { form += 'L'; }
    else { form += 'D'; points += 1; }
  });

  return {
    form,
    points,
    avgGoals: (goals / last5.length).toFixed(1),
    avgConceded: (conceded / last5.length).toFixed(1),
    over25: Math.round((over25 / last5.length) * 100),
    btts: Math.round((btts / last5.length) * 100),
  };
}

function calculateH2H(matches: any[], homeTeamId: number, awayTeamId: number): any {
  if (!matches || matches.length === 0) {
    return { total: 0, homeWins: 0, awayWins: 0, draws: 0, avgGoals: '0', over25Percentage: 0, bttsPercentage: 0 };
  }

  let homeWins = 0, awayWins = 0, draws = 0, totalGoals = 0, over25 = 0, btts = 0;

  matches.forEach((m: any) => {
    const hs = m.scores?.home || m.scores?.localteam_score || 0;
    const as = m.scores?.away || m.scores?.visitorteam_score || 0;
    totalGoals += hs + as;
    if (hs + as > 2.5) over25++;
    if (hs > 0 && as > 0) btts++;

    const matchHomeId = m.participants?.find((p: any) => p.meta?.location === 'home')?.id;
    if (hs > as) { matchHomeId === homeTeamId ? homeWins++ : awayWins++; }
    else if (hs < as) { matchHomeId === homeTeamId ? awayWins++ : homeWins++; }
    else { draws++; }
  });

  return {
    total: matches.length,
    homeWins,
    awayWins,
    draws,
    avgGoals: (totalGoals / matches.length).toFixed(1),
    over25Percentage: Math.round((over25 / matches.length) * 100),
    bttsPercentage: Math.round((btts / matches.length) * 100),
  };
}

// ==================== MEGA CONSENSUS ====================

function calculateMegaConsensus(analyses: any[]): any {
  const valid = analyses.filter(a => a !== null);
  if (valid.length === 0) return null;

  const consensus: any = {};
  const fields = ['matchResult', 'overUnder25', 'btts', 'doubleChance', 'halfTimeResult'];

  fields.forEach(field => {
    const votes: Record<string, { count: number; conf: number; reasons: string[] }> = {};
    
    valid.forEach(a => {
      if (a[field]?.prediction) {
        const pred = a[field].prediction;
        if (!votes[pred]) votes[pred] = { count: 0, conf: 0, reasons: [] };
        votes[pred].count++;
        votes[pred].conf += a[field].confidence || 70;
        if (a[field].reasoning) votes[pred].reasons.push(a[field].reasoning);
      }
    });

    const sorted = Object.entries(votes).sort((a, b) => b[1].count - a[1].count || b[1].conf - a[1].conf);
    if (sorted.length > 0) {
      const [pred, data] = sorted[0];
      consensus[field] = {
        prediction: pred,
        confidence: Math.round(data.conf / data.count),
        votes: data.count,
        totalVotes: valid.length,
        unanimous: data.count === valid.length,
        reasoning: data.reasons[0] || '',
      };
    }
  });

  // Best Bets
  consensus.bestBets = valid.filter(a => a.bestBet).map(a => a.bestBet).sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 3);
  
  // Correct Scores
  const scores: Record<string, number> = {};
  valid.forEach(a => {
    if (a.correctScore) {
      ['first', 'second', 'third'].forEach(pos => {
        const s = a.correctScore[pos];
        if (s && typeof s === 'string') scores[s] = (scores[s] || 0) + 1;
      });
    }
  });
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  consensus.correctScore = {
    first: sortedScores[0]?.[0] || null,
    second: sortedScores[1]?.[0] || null,
    third: sortedScores[2]?.[0] || null,
  };

  // Key Factors & Warnings
  const factors: string[] = [], warnings: string[] = [];
  valid.forEach(a => {
    if (a.keyFactors) factors.push(...a.keyFactors);
    if (a.warnings) warnings.push(...a.warnings);
  });
  consensus.keyFactors = [...new Set(factors)].slice(0, 5);
  consensus.warnings = [...new Set(warnings)].slice(0, 3);
  consensus.overallAnalyses = valid.filter(a => a.overallAnalysis).map(a => a.overallAnalysis);

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
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league = '', language = 'en' } = body;

    if (!fixtureId || !homeTeam || !awayTeam) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🚀 ANALYSIS: ${homeTeam} vs ${awayTeam} [${language}]`);

    // Check cache
    const cacheKey = `analysis_${fixtureId}_${language}`;
    const { data: cached } = await supabaseAdmin.from('analysis_cache').select('*').eq('cache_key', cacheKey).single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      console.log('✅ Cache hit');
      await incrementAnalysisCount(session.user.email);
      return NextResponse.json({ ...cached.data, fromCache: true });
    }

    // Fetch data (ONLY SPORTMONKS)
    console.log('📊 Fetching Sportmonks data...');
    const { odds, homeForm, awayForm, h2h } = await fetchMatchData(fixtureId, homeTeamId, awayTeamId);
    
    console.log(`   Odds: ${odds?.matchWinner?.home ? 'YES' : 'NO'}`);
    console.log(`   Forms: ${homeForm?.form || 'N/A'} / ${awayForm?.form || 'N/A'}`);
    console.log(`   H2H: ${h2h?.total || 0} matches`);

    // Generate prompt
    const prompt = getUltraAggressivePrompt(language, homeTeam, awayTeam, league, odds, homeForm, awayForm, h2h, {});

    // Run ALL analyses in parallel (AI + Agents with SAME data)
    console.log('🤖 Running AI + Agents...');
    const [claude, gpt, gemini, heurist] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
      runFullAnalysis({ fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, date: '', odds, homeForm, awayForm, h2h }, language as 'tr' | 'en' | 'de'),
    ]);

    console.log(`   Claude: ${claude ? '✅' : '❌'} | GPT: ${gpt ? '✅' : '❌'} | Gemini: ${gemini ? '✅' : '❌'} | Heurist: ${heurist?.success ? '✅' : '❌'}`);

    // MEGA CONSENSUS: AI + Agents together
    const allAnalyses = [claude, gpt, gemini, heurist?.reports?.consensus].filter(a => a !== null);
    console.log(`⚖️ Consensus from ${allAnalyses.length} sources`);
    
    const consensus = calculateMegaConsensus(allAnalyses);
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
      individualAnalyses: { claude, openai: gpt, gemini, heurist: heurist?.reports },
      aiStatus: { claude: !!claude, openai: !!gpt, gemini: !!gemini, heurist: !!heurist?.success },
      language,
    };

    // Cache for 24h
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await supabaseAdmin.from('analysis_cache').upsert({ cache_key: cacheKey, data: response, expires_at: expiresAt.toISOString(), created_at: new Date().toISOString() });

    await incrementAnalysisCount(session.user.email);
    console.log('✅ Done!\n');

    return NextResponse.json({ ...response, fromCache: false });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
