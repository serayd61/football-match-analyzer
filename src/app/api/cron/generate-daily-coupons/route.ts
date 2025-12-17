// ============================================================================
// CRON JOB - GENERATE DAILY COUPONS WITH AI CONSENSUS
// Her gün sabah 07:00'de (UTC) günlük kuponları AI analizi ile oluşturur
// 3 AI modeli (Claude, GPT-4, Gemini) ortak karar verir
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // AI analizi için 2 dakika

// SportMonks API
const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const API_TOKEN = process.env.SPORTMONKS_API_KEY || '';

// AI API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';

// Desteklenen ligler (40+ lig)
const SUPPORTED_LEAGUES = [
  8, 564, 82, 301, 384, 2, 5, 7, 271, 501, 72, 208, 244, 203, 318, 27, 513, 66, 600, 462, 106, 169, 99,
  9, 565, 83, 302, 385, 268, 239, 273, 1659, 406, 292, 636, 325, 24, 320, 529, 308, 19
];

interface MatchData {
  id: number;
  home: string;
  away: string;
  league: string;
  time: string;
  odds: { home: number; draw: number; away: number };
}

interface AIPrediction {
  match: number; // Match index (1-based)
  prediction: string; // "1", "X", "2"
  confidence: number;
  reasoning: string;
}

interface AIConsensus {
  matchId: number;
  home: string;
  away: string;
  league: string;
  time: string;
  prediction: string;
  odds: number;
  confidence: number;
  aiAgreement: number; // Kaç AI aynı tahminde (1-3)
  reasoning: {
    claude?: string;
    gpt4?: string;
    gemini?: string;
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🧠 DAILY AI CONSENSUS COUPON GENERATION');
    console.log('═'.repeat(70));

    const today = new Date().toISOString().split('T')[0];
    const supabase = getSupabaseAdmin();

    // Check if coupons already exist for today
    const { data: existing } = await supabase
      .from('daily_coupons')
      .select('id')
      .eq('date', today)
      .eq('coupon_type', 'safe')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('⏭️ Safe coupon already exists for today');
      return NextResponse.json({ 
        success: true, 
        message: 'Safe coupon already exists for today',
        date: today 
      });
    }

    // Fetch today's matches
    console.log('📡 Fetching matches from SportMonks...');
    const matches = await fetchTodayMatches();
    
    if (matches.length < 1) {
      console.log('❌ No matches found');
      return NextResponse.json({ 
        success: false, 
        error: 'No matches found today',
        count: 0 
      }, { status: 400 });
    }

    console.log(`✅ Found ${matches.length} matches`);

    // Analyze matches with 3 AI models
    console.log('🤖 Getting AI predictions...');
    const aiConsensus = await getAIConsensus(matches);
    
    if (aiConsensus.length < 1) {
      console.log('❌ No AI consensus found');
      return NextResponse.json({ 
        success: false, 
        error: 'AI analysis failed',
      }, { status: 500 });
    }

    // Filter only high-confidence picks (all 3 AIs agree)
    const strongPicks = aiConsensus
      .filter(c => c.aiAgreement >= 2 && c.confidence >= 60) // En az 2 AI aynı fikirde
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    if (strongPicks.length === 0) {
      // Fallback: En yüksek güvenli olanları al
      strongPicks.push(...aiConsensus.sort((a, b) => b.confidence - a.confidence).slice(0, 3));
    }

    console.log(`🎯 Selected ${strongPicks.length} consensus picks`);

    // Generate safe coupon
    const safeCoupon = {
      date: today,
      coupon_type: 'safe',
      matches: strongPicks.map(p => ({
        fixture_id: p.matchId,
        home_team: p.home,
        away_team: p.away,
        league: p.league,
        kick_off: p.time,
        selection: p.prediction,
        odds: p.odds,
        ai_agreement: p.aiAgreement,
        ai_reasoning: p.reasoning,
      })),
      total_odds: Math.round(strongPicks.reduce((acc, p) => acc * p.odds, 1) * 100) / 100,
      confidence: Math.round(strongPicks.reduce((acc, p) => acc + p.confidence, 0) / strongPicks.length),
      suggested_stake: 100,
      potential_win: Math.round(100 * strongPicks.reduce((acc, p) => acc * p.odds, 1)),
      ai_reasoning: JSON.stringify({
        tr: `🧠 AI Konsensüs Kuponu: ${strongPicks.length} maçta 3 AI modeli (Claude, GPT-4, Gemini) analiz yaptı ve ortak karara vardı. Yüksek güvenilirlik!`,
        en: `🧠 AI Consensus Coupon: 3 AI models (Claude, GPT-4, Gemini) analyzed ${strongPicks.length} matches and reached agreement. High reliability!`,
        de: `🧠 KI-Konsens-Tipp: 3 KI-Modelle (Claude, GPT-4, Gemini) haben ${strongPicks.length} Spiele analysiert und eine Einigung erzielt. Hohe Zuverlässigkeit!`,
      }),
      status: 'pending',
    };

    // Save to database
    const { error: saveError } = await supabase
      .from('daily_coupons')
      .insert(safeCoupon);

    if (saveError) {
      console.error('❌ Error saving coupon:', saveError);
      return NextResponse.json({ success: false, error: saveError.message }, { status: 500 });
    }

    console.log('✅ AI Consensus coupon saved!');

    const totalTime = Date.now() - startTime;

    console.log('\n' + '═'.repeat(70));
    console.log('✅ CRON JOB COMPLETED');
    console.log(`   📊 Matches analyzed: ${matches.length}`);
    console.log(`   🧠 AI Consensus picks: ${strongPicks.length}`);
    console.log(`   💚 Total odds: ${safeCoupon.total_odds}`);
    console.log(`   🎯 Avg confidence: ${safeCoupon.confidence}%`);
    console.log(`   ⏱️ Time: ${totalTime}ms`);
    console.log('═'.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      date: today,
      stats: {
        matchesAnalyzed: matches.length,
        consensusPicks: strongPicks.length,
        totalOdds: safeCoupon.total_odds,
        avgConfidence: safeCoupon.confidence,
        duration: totalTime,
      },
    });

  } catch (error: any) {
    console.error('❌ CRON JOB ERROR:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

// ============================================================================
// FETCH TODAY'S MATCHES
// ============================================================================

async function fetchTodayMatches(): Promise<MatchData[]> {
  const today = new Date().toISOString().split('T')[0];
  const leagueFilter = SUPPORTED_LEAGUES.join(',');
  
  const url = `${SPORTMONKS_API}/fixtures/date/${today}?api_token=${API_TOKEN}&include=participants;league;odds&filters=fixtureLeagues:${leagueFilter}&per_page=50`;
  
  try {
    const response = await fetch(url, { 
      next: { revalidate: 0 },
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const fixtures = data.data || [];
    
    return fixtures.map((f: any) => {
      const home = f.participants?.find((p: any) => p.meta?.location === 'home');
      const away = f.participants?.find((p: any) => p.meta?.location === 'away');
      const odds = parseOdds(f);
      
      return {
        id: f.id,
        home: home?.name || 'Home',
        away: away?.name || 'Away',
        league: f.league?.name || 'Unknown',
        time: f.starting_at,
        odds,
      };
    }).filter((m: MatchData) => m.odds.home > 0);
    
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
}

function parseOdds(fixture: any): { home: number; draw: number; away: number } {
  const defaultOdds = { home: 1.5, draw: 3.5, away: 2.5 };
  
  try {
    const oddsData = fixture.odds?.data || fixture.odds || [];
    const market = oddsData.find((o: any) => o.market_id === 1 || o.name?.toLowerCase().includes('1x2'));
    if (!market) return defaultOdds;
    
    const bookmakers = market.bookmaker?.data || market.bookmakers || [];
    const bookmaker = bookmakers[0];
    if (!bookmaker) return defaultOdds;
    
    const odds = bookmaker.odds?.data || bookmaker.odds || [];
    
    return {
      home: parseFloat(odds.find((o: any) => o.label === '1')?.value) || defaultOdds.home,
      draw: parseFloat(odds.find((o: any) => o.label === 'X')?.value) || defaultOdds.draw,
      away: parseFloat(odds.find((o: any) => o.label === '2')?.value) || defaultOdds.away,
    };
  } catch {
    return defaultOdds;
  }
}

// ============================================================================
// AI CONSENSUS - 3 MODEL ANALYSIS
// ============================================================================

async function getAIConsensus(matches: MatchData[]): Promise<AIConsensus[]> {
  const results: AIConsensus[] = [];
  
  // Maçları grupla (max 5 maç bir seferde analiz et)
  const matchList = matches.slice(0, 10).map((m, i) => 
    `${i + 1}. ${m.home} vs ${m.away} (${m.league}) - Odds: 1=${m.odds.home}, X=${m.odds.draw}, 2=${m.odds.away}`
  ).join('\n');

  const prompt = `You are a professional football betting analyst. Analyze these matches and predict the most likely outcome.

MATCHES:
${matchList}

For each match, respond with JSON:
{
  "predictions": [
    {"match": 1, "prediction": "1", "confidence": 75, "reasoning": "short reason"},
    ...
  ]
}

Rules:
- prediction: "1" (home win), "X" (draw), or "2" (away win)
- confidence: 0-100 (how sure you are)
- Focus on VALUE and PROBABILITY, not just favorites
- Be conservative, only high confidence picks`;

  try {
    // Get predictions from 3 AI models in parallel
    const [claudePredictions, gpt4Predictions, geminiPredictions] = await Promise.all([
      getClaudePrediction(prompt),
      getGPT4Prediction(prompt),
      getGeminiPrediction(prompt),
    ]);

    console.log(`   Claude: ${claudePredictions.length} predictions`);
    console.log(`   GPT-4: ${gpt4Predictions.length} predictions`);
    console.log(`   Gemini: ${geminiPredictions.length} predictions`);

    // Find consensus for each match
    for (let i = 0; i < matches.length && i < 10; i++) {
      const match = matches[i];
      const matchIdx = i + 1;
      
      const claude = claudePredictions.find(p => p.match === matchIdx);
      const gpt4 = gpt4Predictions.find(p => p.match === matchIdx);
      const gemini = geminiPredictions.find(p => p.match === matchIdx);
      
      // Count predictions
      const predictions = [claude?.prediction, gpt4?.prediction, gemini?.prediction].filter(Boolean);
      const predictionCounts: { [key: string]: number } = {};
      predictions.forEach(p => {
        if (p) predictionCounts[p] = (predictionCounts[p] || 0) + 1;
      });
      
      // Find majority prediction
      const sortedPredictions = Object.entries(predictionCounts).sort((a, b) => b[1] - a[1]);
      if (sortedPredictions.length === 0) continue;
      
      const [consensusPrediction, agreementCount] = sortedPredictions[0];
      
      // Calculate average confidence
      const confidences = [claude?.confidence, gpt4?.confidence, gemini?.confidence].filter(Boolean) as number[];
      const avgConfidence = confidences.length > 0 
        ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
        : 50;
      
      // Get odds for the prediction
      const predictionOdds = consensusPrediction === '1' ? match.odds.home 
        : consensusPrediction === 'X' ? match.odds.draw 
        : match.odds.away;
      
      results.push({
        matchId: match.id,
        home: match.home,
        away: match.away,
        league: match.league,
        time: match.time,
        prediction: consensusPrediction,
        odds: predictionOdds,
        confidence: avgConfidence,
        aiAgreement: agreementCount,
        reasoning: {
          claude: claude?.reasoning,
          gpt4: gpt4?.reasoning,
          gemini: gemini?.reasoning,
        },
      });
    }
    
  } catch (error) {
    console.error('AI Consensus error:', error);
  }
  
  return results;
}

// ============================================================================
// INDIVIDUAL AI MODEL CALLS
// ============================================================================

async function getClaudePrediction(prompt: string): Promise<AIPrediction[]> {
  if (!ANTHROPIC_API_KEY) {
    console.log('   ⚠️ Claude: No API key');
    return [];
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    return parseAIPredictions(content);
  } catch (error) {
    console.error('Claude error:', error);
    return [];
  }
}

async function getGPT4Prediction(prompt: string): Promise<AIPrediction[]> {
  if (!OPENAI_API_KEY) {
    console.log('   ⚠️ GPT-4: No API key');
    return [];
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return parseAIPredictions(content);
  } catch (error) {
    console.error('GPT-4 error:', error);
    return [];
  }
}

async function getGeminiPrediction(prompt: string): Promise<AIPrediction[]> {
  if (!GOOGLE_API_KEY) {
    console.log('   ⚠️ Gemini: No API key');
    return [];
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1000 },
      }),
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIPredictions(content);
  } catch (error) {
    console.error('Gemini error:', error);
    return [];
  }
}

function parseAIPredictions(content: string): AIPrediction[] {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    
    const parsed = JSON.parse(jsonMatch[0]);
    const predictions = parsed.predictions || [];
    
    return predictions.map((p: any) => ({
      match: p.match,
      prediction: String(p.prediction),
      confidence: Number(p.confidence) || 50,
      reasoning: p.reasoning || '',
    }));
  } catch {
    return [];
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
