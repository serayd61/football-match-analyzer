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

// Günlük limit
const DAILY_ANALYSIS_LIMIT = 50; // Pro kullanıcılar için

// Cache'den analiz getir
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

// Analizi cache'e kaydet
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
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 saat
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

// Kullanıcı analiz geçmişine ekle
async function addToUserHistory(userId: string, analysisId: string, fixtureId: number, homeTeam: string, awayTeam: string) {
  try {
    await supabaseAdmin
      .from('user_analyses')
      .upsert({
        user_id: userId,
        analysis_id: analysisId,
        fixture_id: fixtureId,
        home_team: homeTeam,
        away_team: awayTeam,
        viewed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,fixture_id',
      });
  } catch (error) {
    console.error('User history error:', error);
  }
}

// Günlük kullanım kontrolü ve artırma
async function checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  const today = new Date().toISOString().split('T')[0];

  try {
    // Mevcut kullanımı al veya oluştur
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

      // Sayacı artır
      await supabaseAdmin
        .from('user_daily_usage')
        .update({ analysis_count: existing.analysis_count + 1 })
        .eq('id', existing.id);

      return { allowed: true, count: existing.analysis_count + 1, limit: DAILY_ANALYSIS_LIMIT };
    } else {
      // Yeni kayıt oluştur
      await supabaseAdmin
        .from('user_daily_usage')
        .insert({
          user_id: userId,
          date: today,
          analysis_count: 1,
        });

      return { allowed: true, count: 1, limit: DAILY_ANALYSIS_LIMIT };
    }
  } catch (error) {
    console.error('Usage check error:', error);
    return { allowed: true, count: 0, limit: DAILY_ANALYSIS_LIMIT };
  }
}

// Fixture verilerini çek
async function fetchFixtureData(fixtureId: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;statistics;scores;odds`
    );
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Fixture fetch error:', error);
    return null;
  }
}

// Head to Head verilerini çek
async function fetchH2H(team1Id: number, team2Id: number) {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=scores`
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

// Odds parse et
function parseOdds(fixture: any) {
  const odds: any = {
    matchWinner: null,
    overUnder: null,
    btts: null,
    doubleChance: null,
    halfTime: null,
  };

  if (!fixture?.odds) return odds;

  fixture.odds.forEach((odd: any) => {
    const marketId = odd.market_id;
    const values = odd.values || [];

    if (marketId === 1) {
      odds.matchWinner = {
        home: values.find((v: any) => v.label === '1')?.value || null,
        draw: values.find((v: any) => v.label === 'X')?.value || null,
        away: values.find((v: any) => v.label === '2')?.value || null,
      };
    }
    if (marketId === 18) {
      odds.overUnder = {
        over: values.find((v: any) => v.label === 'Over')?.value || null,
        under: values.find((v: any) => v.label === 'Under')?.value || null,
      };
    }
    if (marketId === 28) {
      odds.btts = {
        yes: values.find((v: any) => v.label === 'Yes')?.value || null,
        no: values.find((v: any) => v.label === 'No')?.value || null,
      };
    }
    if (marketId === 17) {
      odds.doubleChance = {
        homeOrDraw: values.find((v: any) => v.label === '1X')?.value || null,
        awayOrDraw: values.find((v: any) => v.label === 'X2')?.value || null,
        homeOrAway: values.find((v: any) => v.label === '12')?.value || null,
      };
    }
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
  if (!matches || matches.length === 0) return { form: 'N/A', points: 0, avgGoals: '0', avgConceded: '0' };

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
    avgGoals: (goals / Math.max(formArray.length, 1)).toFixed(1),
    avgConceded: (conceded / Math.max(formArray.length, 1)).toFixed(1),
  };
}

// AI Prompt oluştur
function createAggressivePrompt(data: any, language: string = 'en') {
  const { homeTeam, awayTeam, odds, homeForm, awayForm, h2h } = data;

  const langInstructions: Record<string, string> = {
    tr: 'TÜM yanıtlarını TÜRKÇE olarak ver.',
    en: 'Provide ALL responses in ENGLISH.',
    de: 'Gib ALLE Antworten auf DEUTSCH.',
  };

  const langInstruction = langInstructions[language] || langInstructions.en;

  return `${langInstruction}

You are a world-renowned football analyst. Analyze this match and provide predictions.

🏟️ MATCH: ${homeTeam} vs ${awayTeam}

📊 ODDS:
${odds.matchWinner ? `- 1X2: 1=${odds.matchWinner.home} | X=${odds.matchWinner.draw} | 2=${odds.matchWinner.away}` : ''}
${odds.overUnder ? `- O/U 2.5: Over=${odds.overUnder.over} | Under=${odds.overUnder.under}` : ''}
${odds.btts ? `- BTTS: Yes=${odds.btts.yes} | No=${odds.btts.no}` : ''}

📈 ${homeTeam} FORM: ${homeForm.form} (${homeForm.points}/15 pts, ${homeForm.avgGoals} goals avg)
📉 ${awayTeam} FORM: ${awayForm.form} (${awayForm.points}/15 pts, ${awayForm.avgGoals} goals avg)

⚔️ H2H: ${h2h.length} recent matches

Respond ONLY in JSON format:
{
  "matchResult": { "prediction": "1/X/2", "confidence": 75, "reasoning": "brief explanation", "value": true/false },
  "overUnder25": { "prediction": "Over/Under", "confidence": 70, "reasoning": "brief explanation", "value": true/false },
  "btts": { "prediction": "Yes/No", "confidence": 72, "reasoning": "brief explanation", "value": true/false },
  "doubleChance": { "prediction": "1X/X2/12", "confidence": 85, "reasoning": "brief explanation" },
  "halfTimeResult": { "prediction": "1/X/2", "confidence": 65, "reasoning": "brief explanation" },
  "correctScore": {
    "first": { "score": "2-1", "confidence": 15 },
    "second": { "score": "1-1", "confidence": 12 },
    "third": { "score": "2-0", "confidence": 10 }
  },
  "totalGoalsRange": { "prediction": "2-3", "confidence": 68 },
  "firstGoal": { "prediction": "Home/Away/No Goal", "confidence": 70 },
  "starPlayer": { "name": "Player name", "team": "Team", "reason": "why" },
  "overallAnalysis": "2-3 sentence summary",
  "bestBet": { "type": "bet type", "prediction": "prediction", "confidence": 80, "reasoning": "why" },
  "riskLevel": "Low/Medium/High"
}`;
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

  const consensus: any = {};
  const fields = ['matchResult', 'overUnder25', 'btts', 'doubleChance', 'halfTimeResult', 'totalGoalsRange', 'firstGoal'];

  fields.forEach(field => {
    const predictions: Record<string, number> = {};
    let totalConfidence = 0;

    validAnalyses.forEach(analysis => {
      if (analysis[field]?.prediction) {
        const pred = analysis[field].prediction;
        predictions[pred] = (predictions[pred] || 0) + 1;
        totalConfidence += analysis[field].confidence || 0;
      }
    });

    if (Object.keys(predictions).length > 0) {
      const maxVotes = Math.max(...Object.values(predictions));
      const winner = Object.keys(predictions).find(k => predictions[k] === maxVotes);
      consensus[field] = {
        prediction: winner,
        confidence: Math.round(totalConfidence / validAnalyses.length),
        votes: maxVotes,
        totalVotes: validAnalyses.length,
        unanimous: maxVotes === validAnalyses.length,
      };
    }
  });

  consensus.correctScore = validAnalyses[0]?.correctScore || null;
  consensus.aiCount = validAnalyses.length;
  consensus.bestBets = validAnalyses.map(a => a?.bestBet).filter(Boolean);
  consensus.starPlayers = validAnalyses.map(a => a?.starPlayer).filter(Boolean);
  consensus.riskLevels = validAnalyses.map(a => a?.riskLevel).filter(Boolean);
  consensus.overallAnalyses = validAnalyses.map(a => a?.overallAnalysis).filter(Boolean);

  return consensus;
}

export async function POST(request: NextRequest) {
  try {
    // Session kontrolü
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

    // 1. Önce cache'e bak
    const cached = await getCachedAnalysis(fixtureId, language);
    if (cached) {
      // Kullanıcı geçmişine ekle
      await addToUserHistory(userId, cached.id, fixtureId, homeTeam, awayTeam);

      return NextResponse.json({
        success: true,
        fromCache: true,
        fixture: { id: fixtureId, homeTeam, awayTeam },
        odds: cached.odds_data,
        form: cached.form_data,
        analysis: cached.analysis_data,
        aiStatus: { claude: '✅', openai: '✅', gemini: '✅' },
        language,
      });
    }

    // 2. Cache'de yoksa, günlük limit kontrolü
    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return NextResponse.json({
        error: `Daily limit reached (${usage.count}/${usage.limit}). Try again tomorrow.`,
        limitReached: true,
        usage,
      }, { status: 429 });
    }

    // 3. Verileri çek
    const [fixture, homeRecentMatches, awayRecentMatches, h2h] = await Promise.all([
      fetchFixtureData(fixtureId),
      homeTeamId ? fetchRecentMatches(homeTeamId) : Promise.resolve([]),
      awayTeamId ? fetchRecentMatches(awayTeamId) : Promise.resolve([]),
      homeTeamId && awayTeamId ? fetchH2H(homeTeamId, awayTeamId) : Promise.resolve([]),
    ]);

    const odds = parseOdds(fixture);
    const homeForm = calculateForm(homeRecentMatches, homeTeamId);
    const awayForm = calculateForm(awayRecentMatches, awayTeamId);

    // 4. AI analizi yap
    const prompt = createAggressivePrompt({ homeTeam, awayTeam, odds, homeForm, awayForm, h2h }, language);

    const [claudeAnalysis, openaiAnalysis, geminiAnalysis] = await Promise.all([
      analyzeWithClaude(prompt),
      analyzeWithOpenAI(prompt),
      analyzeWithGemini(prompt),
    ]);

    const consensus = calculateConsensus([claudeAnalysis, openaiAnalysis, geminiAnalysis]);

    const aiStatus = {
      claude: claudeAnalysis ? '✅' : '❌',
      openai: openaiAnalysis ? '✅' : '❌',
      gemini: geminiAnalysis ? '✅' : '❌',
    };

    const formData = { home: homeForm, away: awayForm };

    // 5. Cache'e kaydet
    const cachedAnalysis = await cacheAnalysis(
      fixtureId,
      homeTeam,
      awayTeam,
      consensus,
      odds,
      formData,
      language,
      fixture?.league?.name,
      fixture?.starting_at
    );

    // 6. Kullanıcı geçmişine ekle
    if (cachedAnalysis) {
      await addToUserHistory(userId, cachedAnalysis.id, fixtureId, homeTeam, awayTeam);
    }

    return NextResponse.json({
      success: true,
      fromCache: false,
      fixture: { id: fixtureId, homeTeam, awayTeam },
      odds,
      form: formData,
      h2h: h2h.slice(0, 5),
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
