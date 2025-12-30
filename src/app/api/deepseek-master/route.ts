// ============================================================================
// API: DeepSeek Master Analysis - Single Match
// Dashboard'dan tek bir maç için DeepSeek Master analizi yapar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180; // 3 dakika

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
// AI CALL FUNCTIONS
// ============================================================================

async function callClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return '';
  
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!res.ok) return '';
    const data = await res.json();
    return data.content?.[0]?.text || '';
  } catch {
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
  } catch {
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
  } catch {
    return '';
  }
}

async function callDeepSeekDirect(prompt: string): Promise<string> {
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: `Sen dünya çapında tanınan bir futbol analiz uzmanısın. 
Birden fazla AI sisteminden gelen tahminleri değerlendirip, final kararını veriyorsun.` 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch {
    return '';
  }
}

// ============================================================================
// TYPES
// ============================================================================

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
// PARSE AI RESPONSE
// ============================================================================

function parseAIResponse(text: string): AnalysisResult | null {
  try {
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
          prediction: (() => {
            const pred = parsed.matchResult?.prediction;
            if (!pred) return 'draw';
            const lower = String(pred).toLowerCase().trim();
            if (lower === 'home' || lower === '1' || lower.includes('home')) return 'home';
            if (lower === 'away' || lower === '2' || lower.includes('away')) return 'away';
            return 'draw';
          })(),
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
// ANALYSIS PROMPT
// ============================================================================

function getAnalysisPrompt(homeTeam: string, awayTeam: string, league: string, matchDate: string): string {
  return `Sen profesyonel bir futbol analistisin. Aşağıdaki maç için analiz yap:

MAÇ: ${homeTeam} vs ${awayTeam}
LİG: ${league}
TARİH: ${matchDate}

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

SADECE JSON formatında yanıt ver.`;
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
  const bttsPrediction = bttsYes >= entries.length / 2 ? 'yes' : 'no';
  const bttsConfidence = Math.round(
    entries.filter(e => e.btts.prediction === bttsPrediction)
      .reduce((sum, e) => sum + e.btts.confidence, 0) / 
    Math.max(1, entries.filter(e => e.btts.prediction === bttsPrediction).length)
  );

  // Over/Under consensus
  const overCount = entries.filter(e => e.overUnder.prediction === 'over').length;
  const ouPrediction = overCount >= entries.length / 2 ? 'over' : 'under';
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

  return {
    btts: { prediction: bttsPrediction as 'yes' | 'no', confidence: bttsConfidence, reasoning: '' },
    overUnder: { prediction: ouPrediction as 'over' | 'under', confidence: ouConfidence, reasoning: '' },
    matchResult: { prediction: mrPrediction, confidence: mrConfidence, reasoning: '' }
  };
}

// ============================================================================
// NORMALIZE MATCH RESULT
// ============================================================================

function normalizeMatchResultToDb(pred: string): 'home' | 'draw' | 'away' {
  if (!pred) return 'draw';
  const lower = String(pred).toLowerCase().trim();
  if (lower === 'home' || lower === '1' || lower.includes('home')) return 'home';
  if (lower === 'away' || lower === '2' || lower.includes('away')) return 'away';
  return 'draw';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, league, matchDate } = body;

    if (!fixtureId || !homeTeam || !awayTeam) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🎯 DeepSeek Master Analysis: ${homeTeam} vs ${awayTeam}`);

    // Check if already analyzed
    const { data: existing } = await supabase
      .from('match_full_analysis')
      .select('deepseek_master')
      .eq('fixture_id', fixtureId)
      .maybeSingle();

    if (existing?.deepseek_master?.finalVerdict) {
      console.log('   ✅ Already analyzed, returning existing');
      return NextResponse.json({
        success: true,
        result: {
          finalVerdict: existing.deepseek_master.finalVerdict,
          confidence: existing.deepseek_master.confidence,
          reasoning: existing.deepseek_master.reasoning,
          systemAgreement: existing.deepseek_master.systemAgreement,
          riskLevel: existing.deepseek_master.riskLevel,
          bestBet: existing.deepseek_master.bestBet,
          warnings: existing.deepseek_master.warnings,
          processingTime: existing.deepseek_master.processingTime
        }
      });
    }

    const prompt = getAnalysisPrompt(homeTeam, awayTeam, league, matchDate);

    // SYSTEM 1: AI Consensus (Claude + Gemini + DeepSeek)
    console.log('   📊 System 1: AI Consensus...');
    const sys1Start = Date.now();
    const [claudeRes, geminiRes, deepseekRes] = await Promise.all([
      callClaude(prompt),
      callGemini(prompt),
      callOpenRouter('deepseek/deepseek-chat', prompt)
    ]);

    const aiConsensusPredictions: Record<string, AnalysisResult> = {};
    const cp = parseAIResponse(claudeRes);
    const gp = parseAIResponse(geminiRes);
    const dp = parseAIResponse(deepseekRes);
    if (cp) aiConsensusPredictions['claude'] = cp;
    if (gp) aiConsensusPredictions['gemini'] = gp;
    if (dp) aiConsensusPredictions['deepseek'] = dp;

    const aiConsensus: SystemAnalysis = {
      system: 'ai_consensus',
      models: ['claude', 'gemini', 'deepseek'],
      consensus: calculateConsensus(aiConsensusPredictions),
      individualPredictions: aiConsensusPredictions,
      analyzedAt: new Date().toISOString(),
      processingTime: Date.now() - sys1Start
    };
    console.log(`   ✅ AI Consensus: ${aiConsensus.processingTime}ms`);

    // SYSTEM 2: Quad-Brain (Claude + Gemini + Grok + Mistral)
    console.log('   🧠 System 2: Quad-Brain...');
    const sys2Start = Date.now();
    const [c2, g2, grokRes, mistralRes] = await Promise.all([
      callClaude(prompt),
      callGemini(prompt),
      callOpenRouter('x-ai/grok-3-mini-beta', prompt),
      callOpenRouter('mistralai/mistral-large', prompt)
    ]);

    const quadBrainPredictions: Record<string, AnalysisResult> = {};
    const c2p = parseAIResponse(c2);
    const g2p = parseAIResponse(g2);
    const grp = parseAIResponse(grokRes);
    const mip = parseAIResponse(mistralRes);
    if (c2p) quadBrainPredictions['claude'] = c2p;
    if (g2p) quadBrainPredictions['gemini'] = g2p;
    if (grp) quadBrainPredictions['grok'] = grp;
    if (mip) quadBrainPredictions['mistral'] = mip;

    const quadBrain: SystemAnalysis = {
      system: 'quad_brain',
      models: ['claude', 'gemini', 'grok', 'mistral'],
      consensus: calculateConsensus(quadBrainPredictions),
      individualPredictions: quadBrainPredictions,
      analyzedAt: new Date().toISOString(),
      processingTime: Date.now() - sys2Start
    };
    console.log(`   ✅ Quad-Brain: ${quadBrain.processingTime}ms`);

    // SYSTEM 3: AI Agents
    console.log('   🤖 System 3: AI Agents...');
    const sys3Start = Date.now();
    const agents = [
      { name: 'stats_agent', role: 'İstatistik uzmanı' },
      { name: 'form_agent', role: 'Form analisti' },
      { name: 'h2h_agent', role: 'H2H uzmanı' }
    ];

    const agentPredictions: Record<string, AnalysisResult> = {};
    const agentPromises = agents.map(async (agent) => {
      const response = await callClaude(`${prompt}\n\nRol: ${agent.role}`);
      const parsed = parseAIResponse(response);
      if (parsed) agentPredictions[agent.name] = parsed;
    });
    await Promise.all(agentPromises);

    const aiAgents: SystemAnalysis = {
      system: 'ai_agents',
      models: agents.map(a => a.name),
      consensus: calculateConsensus(agentPredictions),
      individualPredictions: agentPredictions,
      analyzedAt: new Date().toISOString(),
      processingTime: Date.now() - sys3Start
    };
    console.log(`   ✅ AI Agents: ${aiAgents.processingTime}ms`);

    // DEEPSEEK MASTER ANALYSIS
    console.log('   🎯 DeepSeek Master Decision...');
    const masterStart = Date.now();

    const masterPrompt = `
🎯 MASTER ANALİZ

MAÇ: ${homeTeam} vs ${awayTeam}
LİG: ${league}

SİSTEM 1 (AI Consensus): BTTS=${aiConsensus.consensus.btts.prediction}(%${aiConsensus.consensus.btts.confidence}), O/U=${aiConsensus.consensus.overUnder.prediction}(%${aiConsensus.consensus.overUnder.confidence}), MS=${aiConsensus.consensus.matchResult.prediction}(%${aiConsensus.consensus.matchResult.confidence})

SİSTEM 2 (Quad-Brain): BTTS=${quadBrain.consensus.btts.prediction}(%${quadBrain.consensus.btts.confidence}), O/U=${quadBrain.consensus.overUnder.prediction}(%${quadBrain.consensus.overUnder.confidence}), MS=${quadBrain.consensus.matchResult.prediction}(%${quadBrain.consensus.matchResult.confidence})

SİSTEM 3 (AI Agents): BTTS=${aiAgents.consensus.btts.prediction}(%${aiAgents.consensus.btts.confidence}), O/U=${aiAgents.consensus.overUnder.prediction}(%${aiAgents.consensus.overUnder.confidence}), MS=${aiAgents.consensus.matchResult.prediction}(%${aiAgents.consensus.matchResult.confidence})

YANITINI SADECE AŞAĞIDAKİ JSON FORMATINDA VER:

{
  "finalVerdict": {
    "btts": { "prediction": "yes/no", "confidence": 50-75, "reasoning": "kısa gerekçe" },
    "overUnder": { "prediction": "over/under", "confidence": 50-75, "reasoning": "kısa gerekçe" },
    "matchResult": { "prediction": "home/draw/away", "confidence": 45-65, "reasoning": "kısa gerekçe" }
  },
  "overallConfidence": 50-70,
  "masterReasoning": "2 cümlelik değerlendirme",
  "riskLevel": "low/medium/high",
  "bestBet": { "market": "BTTS/Over-Under/Match Result", "selection": "seçim", "confidence": 55-70, "reason": "neden" }
}`;

    const masterResponse = await callDeepSeekDirect(masterPrompt);
    
    // Parse master response
    let finalVerdict: AnalysisResult;
    let masterData: any = {};
    
    try {
      const jsonMatch = masterResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        masterData = JSON.parse(jsonMatch[0]);
        if (masterData.finalVerdict) {
          const fv = masterData.finalVerdict;
          finalVerdict = {
            btts: {
              prediction: fv.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
              confidence: Math.min(75, Math.max(50, parseInt(fv.btts?.confidence) || 60)),
              reasoning: fv.btts?.reasoning || ''
            },
            overUnder: {
              prediction: fv.overUnder?.prediction?.toLowerCase() === 'over' ? 'over' : 'under',
              confidence: Math.min(75, Math.max(50, parseInt(fv.overUnder?.confidence) || 60)),
              reasoning: fv.overUnder?.reasoning || ''
            },
            matchResult: {
              prediction: normalizeMatchResultToDb(fv.matchResult?.prediction),
              confidence: Math.min(65, Math.max(45, parseInt(fv.matchResult?.confidence) || 55)),
              reasoning: fv.matchResult?.reasoning || ''
            }
          };
        } else {
          finalVerdict = aiConsensus.consensus;
        }
      } else {
        finalVerdict = aiConsensus.consensus;
      }
    } catch {
      finalVerdict = aiConsensus.consensus;
    }

    // Calculate system agreement
    const bttsAgreement = [
      aiConsensus.consensus.btts.prediction,
      quadBrain.consensus.btts.prediction,
      aiAgents.consensus.btts.prediction
    ].filter(p => p === finalVerdict.btts.prediction).length;

    const ouAgreement = [
      aiConsensus.consensus.overUnder.prediction,
      quadBrain.consensus.overUnder.prediction,
      aiAgents.consensus.overUnder.prediction
    ].filter(p => p === finalVerdict.overUnder.prediction).length;

    const mrAgreement = [
      aiConsensus.consensus.matchResult.prediction,
      quadBrain.consensus.matchResult.prediction,
      aiAgents.consensus.matchResult.prediction
    ].filter(p => p === finalVerdict.matchResult.prediction).length;

    const systemAgreement = { btts: bttsAgreement, overUnder: ouAgreement, matchResult: mrAgreement };
    const riskLevel = Math.min(bttsAgreement, ouAgreement, mrAgreement) >= 2 ? 'low' : 
                      Math.max(bttsAgreement, ouAgreement, mrAgreement) >= 2 ? 'medium' : 'high';

    const masterResult = {
      finalVerdict,
      confidence: masterData.overallConfidence || Math.round((finalVerdict.btts.confidence + finalVerdict.overUnder.confidence + finalVerdict.matchResult.confidence) / 3),
      reasoning: masterData.masterReasoning || 'DeepSeek Master Analysis',
      systemAgreement,
      riskLevel: masterData.riskLevel || riskLevel,
      bestBet: masterData.bestBet || {
        market: 'BTTS',
        selection: finalVerdict.btts.prediction,
        confidence: finalVerdict.btts.confidence,
        reason: 'En yüksek sistem uyumu'
      },
      warnings: masterData.warnings || [],
      processingTime: Date.now() - masterStart
    };

    console.log(`   ✅ Master Analysis: ${masterResult.processingTime}ms`);

    // Save to database
    const today = matchDate || new Date().toISOString().split('T')[0];
    
    await supabase.from('match_full_analysis').upsert({
      fixture_id: fixtureId,
      home_team: homeTeam,
      away_team: awayTeam,
      league: league,
      match_date: today,
      ai_consensus: aiConsensus,
      quad_brain: quadBrain,
      ai_agents: aiAgents,
      deepseek_master: masterResult,
      best_system: 'deepseek_master',
      best_btts: finalVerdict.btts.prediction,
      best_btts_confidence: finalVerdict.btts.confidence,
      best_over_under: finalVerdict.overUnder.prediction,
      best_over_under_confidence: finalVerdict.overUnder.confidence,
      best_match_result: finalVerdict.matchResult.prediction,
      best_match_result_confidence: finalVerdict.matchResult.confidence,
      created_at: new Date().toISOString()
    }, { onConflict: 'fixture_id' });

    // Also save prediction session
    await supabase.from('prediction_sessions').upsert({
      fixture_id: fixtureId,
      home_team: homeTeam,
      away_team: awayTeam,
      league: league,
      match_date: today,
      prediction_source: 'deepseek_master',
      session_type: 'manual',
      is_settled: false,
      consensus_btts: finalVerdict.btts.prediction,
      consensus_btts_confidence: finalVerdict.btts.confidence,
      consensus_over_under: finalVerdict.overUnder.prediction,
      consensus_over_under_confidence: finalVerdict.overUnder.confidence,
      consensus_match_result: finalVerdict.matchResult.prediction,
      consensus_match_result_confidence: finalVerdict.matchResult.confidence,
      created_at: new Date().toISOString()
    }, { onConflict: 'fixture_id,prediction_source' });

    const totalTime = Date.now() - startTime;
    console.log(`✅ Total analysis time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      result: {
        ...masterResult,
        aiConsensusRaw: aiConsensus,
        quadBrainRaw: quadBrain,
        aiAgentsRaw: aiAgents,
        duration: totalTime
      }
    });

  } catch (error) {
    console.error('DeepSeek Master API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

