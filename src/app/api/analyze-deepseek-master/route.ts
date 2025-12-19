// ============================================================================
// DEEPSEEK MASTER SINGLE MATCH ANALYSIS
// Dashboard'dan tek maç için 3 sistem + DeepSeek Master analizi
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 dakika yeterli tek maç için

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// API Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

interface MatchInput {
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  kick_off_time?: string;
}

interface AnalysisResult {
  prediction: string;
  confidence: number;
  reasoning: string;
}

interface SystemConsensus {
  btts: AnalysisResult;
  overUnder: AnalysisResult;
  matchResult: AnalysisResult;
}

interface SystemAnalysis {
  system: string;
  models: string[];
  processingTime: number;
  consensus: SystemConsensus;
  modelResults?: any[];
}

// ============================================================================
// AI MODEL CALLS
// ============================================================================

async function callClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is missing!');
    return '';
  }
  try {
    console.log('📤 Calling Claude...');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // En ucuz Claude modeli
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Claude API error ${res.status}:`, errorText);
      return '';
    }
    
    const data = await res.json();
    const result = data.content?.[0]?.text || '';
    console.log('✅ Claude responded:', result.substring(0, 100) + '...');
    return result;
  } catch (e) {
    console.error('❌ Claude exception:', e);
    return '';
  }
}

async function callGemini(prompt: string): Promise<string> {
  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_GEMINI_API_KEY is missing!');
    return '';
  }
  try {
    console.log('📤 Calling Gemini...');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000 }
        })
      }
    );
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Gemini API error ${res.status}:`, errorText);
      return '';
    }
    
    const data = await res.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('✅ Gemini responded:', result.substring(0, 100) + '...');
    return result;
  } catch (e) {
    console.error('❌ Gemini exception:', e);
    return '';
  }
}

async function callOpenRouter(model: string, prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY is missing!');
    return '';
  }
  try {
    console.log(`📤 Calling OpenRouter (${model})...`);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://footballanalytics.pro'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ OpenRouter (${model}) API error ${res.status}:`, errorText);
      return '';
    }
    
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || '';
    console.log(`✅ OpenRouter (${model}) responded:`, result.substring(0, 100) + '...');
    return result;
  } catch (e) {
    console.error(`❌ OpenRouter (${model}) exception:`, e);
    return '';
  }
}

async function callDeepSeek(prompt: string): Promise<string> {
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('DeepSeek error:', e);
    return '';
  }
}

// ============================================================================
// ANALYSIS SYSTEMS
// ============================================================================

function getAnalysisPrompt(match: MatchInput, system: string): string {
  return `Sen profesyonel bir futbol analisti olarak ${match.home_team} vs ${match.away_team} (${match.league}) maçını analiz et.

Aşağıdaki 3 market için tahmin ver:
1. BTTS (Her İki Takım da Gol Atar): "yes" veya "no"
2. Over/Under 2.5 Gol: "over" veya "under"
3. Maç Sonucu: "home", "draw" veya "away"

Her tahmin için güven oranı (0-100) ve kısa gerekçe ver.

${system === 'agent' ? `
Sen bir UZMAN AJAN'sın. Kendi uzmanlık alanına göre analiz yap:
- Gol uzmanıysan: Gol istatistiklerine odaklan
- Defans uzmanıysan: Savunma performanslarına odaklan
- Form uzmanıysan: Son maç formlarına odaklan
- Head-to-head uzmanıysan: Geçmiş karşılaşmalara odaklan
` : ''}

Yanıtını sadece JSON formatında ver:
{
  "btts": {"prediction": "yes/no", "confidence": 75, "reasoning": "..."},
  "overUnder": {"prediction": "over/under", "confidence": 70, "reasoning": "..."},
  "matchResult": {"prediction": "home/draw/away", "confidence": 65, "reasoning": "..."}
}`;
}

function parseAIResponse(response: string): SystemConsensus {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  return {
    btts: { prediction: 'unknown', confidence: 0, reasoning: 'Parse error' },
    overUnder: { prediction: 'unknown', confidence: 0, reasoning: 'Parse error' },
    matchResult: { prediction: 'unknown', confidence: 0, reasoning: 'Parse error' }
  };
}

function aggregateResults(results: SystemConsensus[]): SystemConsensus {
  const validResults = results.filter(r => r.btts.confidence > 0);
  if (validResults.length === 0) {
    return {
      btts: { prediction: 'unknown', confidence: 0, reasoning: 'No valid results' },
      overUnder: { prediction: 'unknown', confidence: 0, reasoning: 'No valid results' },
      matchResult: { prediction: 'unknown', confidence: 0, reasoning: 'No valid results' }
    };
  }

  const aggregate = (field: 'btts' | 'overUnder' | 'matchResult') => {
    const predictions = validResults.map(r => r[field].prediction);
    const prediction = predictions.sort((a, b) =>
      predictions.filter(v => v === b).length - predictions.filter(v => v === a).length
    )[0];
    const avgConfidence = Math.round(
      validResults.reduce((sum, r) => sum + r[field].confidence, 0) / validResults.length
    );
    const reasoning = validResults.find(r => r[field].prediction === prediction)?.[field].reasoning || '';
    return { prediction, confidence: avgConfidence, reasoning };
  };

  return {
    btts: aggregate('btts'),
    overUnder: aggregate('overUnder'),
    matchResult: aggregate('matchResult')
  };
}

async function analyzeWithAIConsensus(match: MatchInput): Promise<SystemAnalysis> {
  const startTime = Date.now();
  const prompt = getAnalysisPrompt(match, 'consensus');

  const [claudeRes, geminiRes] = await Promise.all([
    callClaude(prompt),
    callGemini(prompt)
  ]);

  const results = [
    parseAIResponse(claudeRes),
    parseAIResponse(geminiRes)
  ];

  return {
    system: 'ai_consensus',
    models: ['Claude', 'Gemini'],
    processingTime: Date.now() - startTime,
    consensus: aggregateResults(results),
    modelResults: results
  };
}

async function analyzeWithQuadBrain(match: MatchInput): Promise<SystemAnalysis> {
  const startTime = Date.now();
  const prompt = getAnalysisPrompt(match, 'quadbrain');

  const [gpt4Res, claudeRes, geminiRes, mistralRes] = await Promise.all([
    callOpenRouter('openai/gpt-4-turbo', prompt),
    callClaude(prompt),
    callGemini(prompt),
    callOpenRouter('mistralai/mistral-large', prompt)
  ]);

  const results = [
    parseAIResponse(gpt4Res),
    parseAIResponse(claudeRes),
    parseAIResponse(geminiRes),
    parseAIResponse(mistralRes)
  ];

  return {
    system: 'quad_brain',
    models: ['GPT-4', 'Claude', 'Gemini', 'Mistral'],
    processingTime: Date.now() - startTime,
    consensus: aggregateResults(results),
    modelResults: results
  };
}

async function analyzeWithAgents(match: MatchInput): Promise<SystemAnalysis> {
  const startTime = Date.now();

  const agentPrompts = [
    getAnalysisPrompt(match, 'agent') + '\nSen GOL UZMANI olarak analiz yap.',
    getAnalysisPrompt(match, 'agent') + '\nSen DEFANS UZMANI olarak analiz yap.',
    getAnalysisPrompt(match, 'agent') + '\nSen FORM UZMANI olarak analiz yap.',
    getAnalysisPrompt(match, 'agent') + '\nSen HEAD-TO-HEAD UZMANI olarak analiz yap.',
    getAnalysisPrompt(match, 'agent') + '\nSen ORANLAR UZMANI olarak analiz yap.'
  ];

  const [agent1, agent2, agent3, agent4, agent5] = await Promise.all([
    callGemini(agentPrompts[0]),
    callGemini(agentPrompts[1]),
    callOpenRouter('anthropic/claude-3-haiku', agentPrompts[2]),
    callOpenRouter('anthropic/claude-3-haiku', agentPrompts[3]),
    callOpenRouter('mistralai/mistral-small', agentPrompts[4])
  ]);

  const results = [
    parseAIResponse(agent1),
    parseAIResponse(agent2),
    parseAIResponse(agent3),
    parseAIResponse(agent4),
    parseAIResponse(agent5)
  ];

  return {
    system: 'ai_agents',
    models: ['Gol Uzmanı', 'Defans Uzmanı', 'Form Uzmanı', 'H2H Uzmanı', 'Oranlar Uzmanı'],
    processingTime: Date.now() - startTime,
    consensus: aggregateResults(results),
    modelResults: results
  };
}

// ============================================================================
// DEEPSEEK MASTER ANALYST
// ============================================================================

async function analyzeWithDeepSeekMaster(
  match: MatchInput,
  aiConsensus: SystemAnalysis,
  quadBrain: SystemAnalysis,
  aiAgents: SystemAnalysis
): Promise<any> {
  const startTime = Date.now();

  const prompt = `
Sen bir futbol maç analizi uzmanısın. Sana 3 farklı yapay zeka sisteminden gelen analizleri sunuyorum. 
Bu analizleri değerlendirerek kendi nihai kararını ver.

Maç Bilgisi: ${match.home_team} vs ${match.away_team} (${match.league})

--- AI Consensus Analizi ---
BTTS: ${aiConsensus.consensus.btts.prediction.toUpperCase()} (${aiConsensus.consensus.btts.confidence}%)
Over/Under 2.5: ${aiConsensus.consensus.overUnder.prediction.toUpperCase()} (${aiConsensus.consensus.overUnder.confidence}%)
Maç Sonucu: ${aiConsensus.consensus.matchResult.prediction.toUpperCase()} (${aiConsensus.consensus.matchResult.confidence}%)

--- Quad-Brain Analizi ---
BTTS: ${quadBrain.consensus.btts.prediction.toUpperCase()} (${quadBrain.consensus.btts.confidence}%)
Over/Under 2.5: ${quadBrain.consensus.overUnder.prediction.toUpperCase()} (${quadBrain.consensus.overUnder.confidence}%)
Maç Sonucu: ${quadBrain.consensus.matchResult.prediction.toUpperCase()} (${quadBrain.consensus.matchResult.confidence}%)

--- AI Agents Analizi ---
BTTS: ${aiAgents.consensus.btts.prediction.toUpperCase()} (${aiAgents.consensus.btts.confidence}%)
Over/Under 2.5: ${aiAgents.consensus.overUnder.prediction.toUpperCase()} (${aiAgents.consensus.overUnder.confidence}%)
Maç Sonucu: ${aiAgents.consensus.matchResult.prediction.toUpperCase()} (${aiAgents.consensus.matchResult.confidence}%)

--- Görevlerin ---
1. Her market için 3 sistemin analizlerini karşılaştır ve kendi nihai kararını ver.
2. Sistemler arası uyumu belirt (kaç sistem aynı fikirde).
3. Genel risk seviyesi belirle (low, medium, high).
4. En iyi bahis önerini sun.

Yanıtını JSON formatında ver:
{
  "finalVerdict": {
    "btts": { "prediction": "yes", "confidence": 75, "reasoning": "..." },
    "overUnder": { "prediction": "over", "confidence": 70, "reasoning": "..." },
    "matchResult": { "prediction": "home", "confidence": 65, "reasoning": "..." }
  },
  "systemAgreement": { "btts": 3, "overUnder": 2, "matchResult": 1 },
  "riskLevel": "medium",
  "bestBet": { "market": "BTTS", "selection": "YES", "confidence": 78, "reasoning": "..." },
  "warnings": []
}`;

  const response = await callDeepSeek(prompt);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        system: 'deepseek_master',
        processingTime: Date.now() - startTime,
        ...parsed
      };
    }
  } catch {}

  return {
    system: 'deepseek_master',
    processingTime: Date.now() - startTime,
    error: 'Parse failed'
  };
}

// ============================================================================
// SAVE TO DATABASE
// ============================================================================

async function saveAnalysis(
  match: MatchInput,
  aiConsensus: SystemAnalysis,
  quadBrain: SystemAnalysis,
  aiAgents: SystemAnalysis,
  deepseekMaster: any
) {
  // Save to match_full_analysis table
  const { error } = await supabase
    .from('match_full_analysis')
    .upsert({
      fixture_id: match.fixture_id,
      home_team: match.home_team,
      away_team: match.away_team,
      league: match.league,
      match_date: match.match_date,
      ai_consensus: aiConsensus,
      quad_brain: quadBrain,
      ai_agents: aiAgents,
      deepseek_master: deepseekMaster,
      created_at: new Date().toISOString()
    }, { onConflict: 'fixture_id' });

  if (error) {
    console.error('Save error:', error);
    throw error;
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { fixture_id, home_team, away_team, league, match_date, kick_off_time } = body;

    if (!fixture_id || !home_team || !away_team) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const match: MatchInput = { fixture_id, home_team, away_team, league, match_date, kick_off_time };

    console.log(`🎯 DeepSeek Master Analysis: ${home_team} vs ${away_team}`);

    // Run all 3 systems in parallel
    const [aiConsensus, quadBrain, aiAgents] = await Promise.all([
      analyzeWithAIConsensus(match),
      analyzeWithQuadBrain(match),
      analyzeWithAgents(match)
    ]);

    console.log(`   ✅ AI Consensus: ${aiConsensus.processingTime}ms`);
    console.log(`   ✅ Quad-Brain: ${quadBrain.processingTime}ms`);
    console.log(`   ✅ AI Agents: ${aiAgents.processingTime}ms`);

    // DeepSeek Master evaluates all results
    const deepseekMaster = await analyzeWithDeepSeekMaster(match, aiConsensus, quadBrain, aiAgents);
    console.log(`   🎯 DeepSeek Master: ${deepseekMaster.processingTime}ms`);

    // Save to database
    await saveAnalysis(match, aiConsensus, quadBrain, aiAgents, deepseekMaster);

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      match: `${home_team} vs ${away_team}`,
      duration: totalTime,
      aiConsensus: aiConsensus.consensus,
      quadBrain: quadBrain.consensus,
      aiAgents: aiAgents.consensus,
      deepseekMaster: {
        finalVerdict: deepseekMaster.finalVerdict,
        systemAgreement: deepseekMaster.systemAgreement,
        riskLevel: deepseekMaster.riskLevel,
        bestBet: deepseekMaster.bestBet,
        warnings: deepseekMaster.warnings
      }
    });

  } catch (error: any) {
    console.error('DeepSeek Master Analysis Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

