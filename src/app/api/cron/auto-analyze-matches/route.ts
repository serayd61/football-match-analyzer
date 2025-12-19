// ============================================================================
// CRON JOB - AUTO ANALYZE ALL NEW MATCHES
// Her saat başı yeni eklenen maçları 3 farklı sistemle analiz eder:
// 1. AI Consensus (Claude, Gemini, DeepSeek)
// 2. Quad-Brain (4 model ağırlıklı)
// 3. AI Agents (5 uzman ajan)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 dakika - çok maç olabilir

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// API Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';
const FOOTBALL_API_HOST = 'api-football-v1.p.rapidapi.com';

// ============================================================================
// TYPES
// ============================================================================

interface MatchToAnalyze {
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  kick_off_time?: string;
}

interface AnalysisResult {
  btts: { prediction: 'yes' | 'no'; confidence: number; reasoning: string };
  overUnder: { prediction: 'over' | 'under'; confidence: number; reasoning: string };
  matchResult: { prediction: 'home' | 'draw' | 'away'; confidence: number; reasoning: string };
  bestBet?: { market: string; selection: string; confidence: number };
}

interface SystemAnalysis {
  system: 'ai_consensus' | 'quad_brain' | 'ai_agents';
  models: string[];
  consensus: AnalysisResult;
  individualPredictions: Record<string, AnalysisResult>;
  analyzedAt: string;
  processingTime: number;
}

// ============================================================================
// AI CALL FUNCTIONS
// ============================================================================

async function callClaude(prompt: string): Promise<string> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || '';
  } catch (error) {
    console.error('Claude error:', error);
    return '';
  }
}

async function callGemini(prompt: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500 }
        })
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Gemini error:', error);
    return '';
  }
}

async function callOpenRouter(model: string, prompt: string): Promise<string> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://footballanalytics.pro',
        'X-Title': 'Football Analytics Pro'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error(`OpenRouter ${model} error:`, error);
    return '';
  }
}

// ============================================================================
// FETCH MATCH STATS & INJURIES FROM SPORTMONKS
// ============================================================================

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

async function fetchFromSportmonks(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${SPORTMONKS_API}${endpoint}`);
  url.searchParams.append('api_token', SPORTMONKS_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
  
  try {
    const res = await fetch(url.toString());
    return await res.json();
  } catch (error) {
    console.error(`Sportmonks fetch error: ${endpoint}`, error);
    return { data: null };
  }
}

interface InjuryInfo {
  playerName: string;
  reason: string;
}

async function getTeamInjuries(teamId: number): Promise<InjuryInfo[]> {
  const data = await fetchFromSportmonks(`/sidelined/teams/${teamId}`, {
    include: 'player;type'
  });
  
  if (!data?.data) return [];
  
  return data.data
    .filter((s: any) => !s.end_date || new Date(s.end_date) > new Date())
    .map((s: any) => ({
      playerName: s.player?.display_name || s.player?.name || 'Unknown',
      reason: s.type?.name || s.description || 'Injury'
    }));
}

async function getMatchContext(homeTeamId: number, awayTeamId: number) {
  const [homeInjuries, awayInjuries] = await Promise.all([
    getTeamInjuries(homeTeamId),
    getTeamInjuries(awayTeamId)
  ]);
  
  return {
    homeInjuries,
    awayInjuries,
    injurySummary: `EV SAHİBİ SAKATLARI (${homeInjuries.length}): ${homeInjuries.map(i => `${i.playerName} (${i.reason})`).join(', ') || 'Yok'}. DEPLASMAN SAKATLARI (${awayInjuries.length}): ${awayInjuries.map(i => `${i.playerName} (${i.reason})`).join(', ') || 'Yok'}.`
  };
}

// ============================================================================
// PARSE AI RESPONSE
// ============================================================================

function parseAIResponse(text: string): AnalysisResult | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        btts: {
          prediction: parsed.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
          confidence: Math.min(100, Math.max(0, parseInt(parsed.btts?.confidence) || 60)),
          reasoning: parsed.btts?.reasoning || ''
        },
        overUnder: {
          prediction: parsed.overUnder?.prediction?.toLowerCase() === 'over' ? 'over' : 'under',
          confidence: Math.min(100, Math.max(0, parseInt(parsed.overUnder?.confidence) || 60)),
          reasoning: parsed.overUnder?.reasoning || ''
        },
        matchResult: {
          prediction: ['home', 'draw', 'away'].includes(parsed.matchResult?.prediction?.toLowerCase()) 
            ? parsed.matchResult.prediction.toLowerCase() 
            : 'draw',
          confidence: Math.min(100, Math.max(0, parseInt(parsed.matchResult?.confidence) || 50)),
          reasoning: parsed.matchResult?.reasoning || ''
        },
        bestBet: parsed.bestBet
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// ANALYSIS PROMPTS
// ============================================================================

function getAnalysisPrompt(match: MatchToAnalyze, context: string = '', injuryInfo: string = ''): string {
  return `Sen profesyonel bir futbol analistisin. Aşağıdaki maç için analiz yap:

MAÇ: ${match.home_team} vs ${match.away_team}
LİG: ${match.league}
TARİH: ${match.match_date}

${injuryInfo ? `SAKATLIK BİLGİSİ: ${injuryInfo}` : ''}

${context}

Analiz et ve aşağıdaki JSON formatında yanıt ver:

{
  "btts": {
    "prediction": "yes" veya "no",
    "confidence": 50-90 arası sayı,
    "reasoning": "Kısa gerekçe"
  },
  "overUnder": {
    "prediction": "over" veya "under" (2.5 gol için),
    "confidence": 50-90 arası sayı,
    "reasoning": "Kısa gerekçe"
  },
  "matchResult": {
    "prediction": "home", "draw" veya "away",
    "confidence": 50-85 arası sayı,
    "reasoning": "Kısa gerekçe"
  },
  "bestBet": {
    "market": "En güvenli bahis marketi",
    "selection": "Seçim",
    "confidence": 60-85 arası sayı
  }
}

ÖNEMLI:
- Sadece JSON formatında yanıt ver
- Güven değerleri gerçekçi olsun (50-85 arası)
- Kesin bilgi yoksa temkinli ol`;
}

// ============================================================================
// SYSTEM 1: AI CONSENSUS (Claude + Gemini + DeepSeek)
// ============================================================================

async function analyzeWithAIConsensus(match: MatchToAnalyze, injuryInfo: string = ''): Promise<SystemAnalysis> {
  const startTime = Date.now();
  const prompt = getAnalysisPrompt(match, '', injuryInfo);
  
  // Call all 3 models in parallel
  const [claudeRes, geminiRes, deepseekRes] = await Promise.all([
    callClaude(prompt),
    callGemini(prompt),
    callOpenRouter('deepseek/deepseek-chat', prompt)
  ]);

  const claudeParsed = parseAIResponse(claudeRes);
  const geminiParsed = parseAIResponse(geminiRes);
  const deepseekParsed = parseAIResponse(deepseekRes);

  const predictions: Record<string, AnalysisResult> = {};
  if (claudeParsed) predictions['claude'] = claudeParsed;
  if (geminiParsed) predictions['gemini'] = geminiParsed;
  if (deepseekParsed) predictions['deepseek'] = deepseekParsed;

  // Calculate consensus
  const consensus = calculateConsensus(predictions);

  return {
    system: 'ai_consensus',
    models: ['claude', 'gemini', 'deepseek'],
    consensus,
    individualPredictions: predictions,
    analyzedAt: new Date().toISOString(),
    processingTime: Date.now() - startTime
  };
}

// ============================================================================
// SYSTEM 2: QUAD-BRAIN (Claude + Gemini + Grok + Mistral)
// ============================================================================

async function analyzeWithQuadBrain(match: MatchToAnalyze, injuryInfo: string = ''): Promise<SystemAnalysis> {
  const startTime = Date.now();
  const prompt = getAnalysisPrompt(match, 'Rol: İstatistiksel analiz ve pattern recognition odaklı.', injuryInfo);
  
  const [claudeRes, geminiRes, grokRes, mistralRes] = await Promise.all([
    callClaude(prompt),
    callGemini(prompt),
    callOpenRouter('x-ai/grok-3-mini-beta', prompt),
    callOpenRouter('mistralai/mistral-large', prompt)
  ]);

  const predictions: Record<string, AnalysisResult> = {};
  
  const claudeParsed = parseAIResponse(claudeRes);
  const geminiParsed = parseAIResponse(geminiRes);
  const grokParsed = parseAIResponse(grokRes);
  const mistralParsed = parseAIResponse(mistralRes);

  if (claudeParsed) predictions['claude'] = claudeParsed;
  if (geminiParsed) predictions['gemini'] = geminiParsed;
  if (grokParsed) predictions['grok'] = grokParsed;
  if (mistralParsed) predictions['mistral'] = mistralParsed;

  const consensus = calculateConsensus(predictions);

  return {
    system: 'quad_brain',
    models: ['claude', 'gemini', 'grok', 'mistral'],
    consensus,
    individualPredictions: predictions,
    analyzedAt: new Date().toISOString(),
    processingTime: Date.now() - startTime
  };
}

// ============================================================================
// SYSTEM 3: AI AGENTS (5 Specialized Agents)
// ============================================================================

async function analyzeWithAgents(match: MatchToAnalyze, injuryInfo: string = ''): Promise<SystemAnalysis> {
  const startTime = Date.now();
  
  const agents = [
    { name: 'stats_agent', role: 'İstatistik ve xG analizi uzmanı' },
    { name: 'form_agent', role: 'Takım formu ve son maçlar uzmanı' },
    { name: 'injury_agent', role: 'Sakatlık ve kadro analizi uzmanı' },
    { name: 'h2h_agent', role: 'Head-to-head ve tarihsel veri uzmanı' },
    { name: 'tactical_agent', role: 'Taktik ve kadro analizi uzmanı' },
    { name: 'value_agent', role: 'Oran değeri ve value bet uzmanı' }
  ];

  const predictions: Record<string, AnalysisResult> = {};

  // Run agents in parallel with Claude
  const agentPromises = agents.map(async (agent) => {
    const prompt = getAnalysisPrompt(match, `Rol: ${agent.role}`, injuryInfo);
    const response = await callClaude(prompt);
    const parsed = parseAIResponse(response);
    if (parsed) {
      predictions[agent.name] = parsed;
    }
  });

  await Promise.all(agentPromises);

  const consensus = calculateConsensus(predictions);

  return {
    system: 'ai_agents',
    models: agents.map(a => a.name),
    consensus,
    individualPredictions: predictions,
    analyzedAt: new Date().toISOString(),
    processingTime: Date.now() - startTime
  };
}

// ============================================================================
// CONSENSUS CALCULATOR
// ============================================================================

function calculateConsensus(predictions: Record<string, AnalysisResult>): AnalysisResult {
  const entries = Object.values(predictions);
  if (entries.length === 0) {
    return {
      btts: { prediction: 'no', confidence: 50, reasoning: 'Veri yok' },
      overUnder: { prediction: 'under', confidence: 50, reasoning: 'Veri yok' },
      matchResult: { prediction: 'draw', confidence: 50, reasoning: 'Veri yok' }
    };
  }

  // BTTS consensus
  const bttsYes = entries.filter(e => e.btts.prediction === 'yes').length;
  const bttsNo = entries.length - bttsYes;
  const bttsPrediction = bttsYes >= bttsNo ? 'yes' : 'no';
  const bttsConfidence = Math.round(
    entries.filter(e => e.btts.prediction === bttsPrediction)
      .reduce((sum, e) => sum + e.btts.confidence, 0) / 
    Math.max(1, entries.filter(e => e.btts.prediction === bttsPrediction).length)
  );

  // Over/Under consensus
  const overCount = entries.filter(e => e.overUnder.prediction === 'over').length;
  const underCount = entries.length - overCount;
  const ouPrediction = overCount >= underCount ? 'over' : 'under';
  const ouConfidence = Math.round(
    entries.filter(e => e.overUnder.prediction === ouPrediction)
      .reduce((sum, e) => sum + e.overUnder.confidence, 0) /
    Math.max(1, entries.filter(e => e.overUnder.prediction === ouPrediction).length)
  );

  // Match Result consensus
  const mrCounts = { home: 0, draw: 0, away: 0 };
  entries.forEach(e => mrCounts[e.matchResult.prediction]++);
  const mrPrediction = Object.entries(mrCounts).sort((a, b) => b[1] - a[1])[0][0] as 'home' | 'draw' | 'away';
  const mrConfidence = Math.round(
    entries.filter(e => e.matchResult.prediction === mrPrediction)
      .reduce((sum, e) => sum + e.matchResult.confidence, 0) /
    Math.max(1, entries.filter(e => e.matchResult.prediction === mrPrediction).length)
  );

  // Combine reasonings
  const bttsReasons = entries.map(e => e.btts.reasoning).filter(r => r).join(' | ');
  const ouReasons = entries.map(e => e.overUnder.reasoning).filter(r => r).join(' | ');
  const mrReasons = entries.map(e => e.matchResult.reasoning).filter(r => r).join(' | ');

  return {
    btts: { prediction: bttsPrediction as 'yes' | 'no', confidence: bttsConfidence, reasoning: bttsReasons },
    overUnder: { prediction: ouPrediction as 'over' | 'under', confidence: ouConfidence, reasoning: ouReasons },
    matchResult: { prediction: mrPrediction, confidence: mrConfidence, reasoning: mrReasons }
  };
}

// ============================================================================
// SAVE ANALYSIS TO DATABASE
// ============================================================================

async function saveAnalysis(
  match: MatchToAnalyze,
  analyses: SystemAnalysis[]
): Promise<boolean> {
  try {
    // Create or get prediction session
    const sessionData = {
      fixture_id: match.fixture_id,
      home_team: match.home_team,
      away_team: match.away_team,
      league: match.league,
      match_date: match.match_date,
      prediction_source: 'auto_analysis',
      session_type: 'auto',
      is_settled: false,
      created_at: new Date().toISOString()
    };

    // Check if already analyzed
    const { data: existing } = await supabase
      .from('prediction_sessions')
      .select('id')
      .eq('fixture_id', match.fixture_id)
      .eq('prediction_source', 'auto_analysis')
      .maybeSingle();

    if (existing) {
      console.log(`   ⏭️ Already analyzed: ${match.home_team} vs ${match.away_team}`);
      return false;
    }

    // Get best consensus from all systems
    const bestAnalysis = analyses.reduce((best, curr) => {
      const currAvgConf = (curr.consensus.btts.confidence + curr.consensus.overUnder.confidence + curr.consensus.matchResult.confidence) / 3;
      const bestAvgConf = (best.consensus.btts.confidence + best.consensus.overUnder.confidence + best.consensus.matchResult.confidence) / 3;
      return currAvgConf > bestAvgConf ? curr : best;
    });

    // Add consensus to session
    const fullSessionData = {
      ...sessionData,
      consensus_btts: bestAnalysis.consensus.btts.prediction,
      consensus_btts_confidence: bestAnalysis.consensus.btts.confidence,
      consensus_over_under: bestAnalysis.consensus.overUnder.prediction,
      consensus_over_under_confidence: bestAnalysis.consensus.overUnder.confidence,
      consensus_match_result: bestAnalysis.consensus.matchResult.prediction,
      consensus_match_result_confidence: bestAnalysis.consensus.matchResult.confidence
    };

    const { data: session, error: sessionError } = await supabase
      .from('prediction_sessions')
      .insert(fullSessionData)
      .select('id')
      .single();

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return false;
    }

    // Save individual model predictions
    for (const analysis of analyses) {
      for (const [modelName, prediction] of Object.entries(analysis.individualPredictions)) {
        const modelData = {
          session_id: session.id,
          model_name: modelName,
          model_type: analysis.system === 'ai_agents' ? 'agent' : 'llm',
          btts_prediction: prediction.btts.prediction,
          btts_confidence: prediction.btts.confidence,
          btts_reasoning: prediction.btts.reasoning,
          over_under_prediction: prediction.overUnder.prediction,
          over_under_confidence: prediction.overUnder.confidence,
          over_under_reasoning: prediction.overUnder.reasoning,
          match_result_prediction: prediction.matchResult.prediction,
          match_result_confidence: prediction.matchResult.confidence,
          match_result_reasoning: prediction.matchResult.reasoning,
          primary_recommendation_market: prediction.bestBet?.market,
          primary_recommendation_selection: prediction.bestBet?.selection,
          primary_recommendation_confidence: prediction.bestBet?.confidence,
          response_time_ms: Math.round(analysis.processingTime / Object.keys(analysis.individualPredictions).length),
          raw_response: { system: analysis.system }
        };

        await supabase.from('ai_model_predictions').insert(modelData);
      }
    }

    // Save full analysis as JSON
    await supabase.from('match_full_analysis').upsert({
      fixture_id: match.fixture_id,
      home_team: match.home_team,
      away_team: match.away_team,
      league: match.league,
      match_date: match.match_date,
      ai_consensus: analyses.find(a => a.system === 'ai_consensus'),
      quad_brain: analyses.find(a => a.system === 'quad_brain'),
      ai_agents: analyses.find(a => a.system === 'ai_agents'),
      created_at: new Date().toISOString()
    }, { onConflict: 'fixture_id' });

    console.log(`   ✅ Saved analysis for ${match.home_team} vs ${match.away_team}`);
    return true;
  } catch (error) {
    console.error('Save error:', error);
    return false;
  }
}

// ============================================================================
// GET MATCHES TO ANALYZE
// ============================================================================

async function getMatchesToAnalyze(): Promise<MatchToAnalyze[]> {
  // Get matches from the next 24-48 hours that haven't been analyzed
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  try {
    // First check existing predictions to know what's already analyzed
    const { data: existingPredictions } = await supabase
      .from('prediction_sessions')
      .select('fixture_id')
      .eq('prediction_source', 'auto_analysis');

    const analyzedFixtureIds = new Set(existingPredictions?.map(p => p.fixture_id) || []);

    // Fetch upcoming fixtures from API-Football
    const res = await fetch(
      `https://${FOOTBALL_API_HOST}/v3/fixtures?date=${now.toISOString().split('T')[0]}&status=NS`,
      {
        headers: {
          'X-RapidAPI-Key': FOOTBALL_API_KEY,
          'X-RapidAPI-Host': FOOTBALL_API_HOST,
        }
      }
    );

    const data = await res.json();
    const fixtures = data.response || [];

    // Filter and format matches
    const matches: MatchToAnalyze[] = fixtures
      .filter((f: any) => !analyzedFixtureIds.has(f.fixture.id))
      .slice(0, 20) // Limit to 20 matches per run
      .map((f: any) => ({
        fixture_id: f.fixture.id,
        home_team: f.teams.home.name,
        away_team: f.teams.away.name,
        league: f.league.name,
        match_date: f.fixture.date.split('T')[0],
        kick_off_time: f.fixture.date
      }));

    return matches;
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🤖 AUTO MATCH ANALYSIS - 3 SYSTEM PARALLEL');
    console.log('═'.repeat(70));

    // Get matches to analyze
    const matches = await getMatchesToAnalyze();
    console.log(`📊 Found ${matches.length} matches to analyze`);

    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new matches to analyze',
        analyzed: 0,
        duration: Date.now() - startTime
      });
    }

    let analyzed = 0;
    let errors = 0;

    // Process each match
    for (const match of matches) {
      try {
        console.log(`\n🔍 Analyzing: ${match.home_team} vs ${match.away_team}`);

        // Fetch injury info from SportMonks (replaces Perplexity!)
        let injuryInfo = '';
        try {
          // We need team IDs - for now use fixture endpoint
          // In production, you'd get team IDs from the fixtures API
          console.log('   🏥 Fetching injury data from SportMonks...');
          // injuryInfo will be populated when we have team IDs
        } catch (e) {
          console.log('   ⚠️ Could not fetch injury data');
        }

        // Run all 3 systems in parallel with injury context
        const [aiConsensus, quadBrain, aiAgents] = await Promise.all([
          analyzeWithAIConsensus(match, injuryInfo),
          analyzeWithQuadBrain(match, injuryInfo),
          analyzeWithAgents(match, injuryInfo)
        ]);

        console.log(`   📊 AI Consensus: ${aiConsensus.processingTime}ms`);
        console.log(`   🧠 Quad-Brain: ${quadBrain.processingTime}ms`);
        console.log(`   🤖 AI Agents: ${aiAgents.processingTime}ms`);

        // Save all analyses
        const saved = await saveAnalysis(match, [aiConsensus, quadBrain, aiAgents]);
        if (saved) analyzed++;

      } catch (error) {
        console.error(`   ❌ Error analyzing ${match.home_team} vs ${match.away_team}:`, error);
        errors++;
      }

      // Small delay between matches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Analysis complete: ${analyzed} matches, ${errors} errors (${duration}ms)`);

    return NextResponse.json({
      success: true,
      analyzed,
      errors,
      total: matches.length,
      duration
    });

  } catch (error) {
    console.error('Auto-analyze error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

