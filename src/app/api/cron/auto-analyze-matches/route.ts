// ============================================================================
// CRON JOB - AUTO ANALYZE ALL NEW MATCHES
// Her saat başı (00:00, 01:00, 02:00, ...) yeni eklenen maçları 3 farklı sistemle analiz eder:
// 1. AI Consensus (Claude, Gemini, DeepSeek)
// 2. Quad-Brain (4 model ağırlıklı)
// 3. AI Agents (5 uzman ajan)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 dakika - çok maç olabilir

let _sb: SupabaseClient | null = null;
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return _sb;
}
const supabase = new Proxy({} as SupabaseClient, { get(_, p) { return (getSupabase() as any)[p]; } });

// API Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
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
  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is missing!');
    return '';
  }
  
  try {
    console.log('   📤 Calling Claude (Haiku)...');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // En ucuz Claude modeli
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`   ❌ Claude API error ${res.status}:`, errorText);
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
        console.error(`   Error type: ${errorDetails.error?.type || 'unknown'}, Message: ${errorDetails.error?.message || 'unknown'}`);
      } catch {
        console.error(`   Raw error: ${errorText}`);
      }
      return '';
    }
    
    const data = await res.json();
    const result = data.content?.[0]?.text || '';
    console.log(`   ✅ Claude responded (${result.length} chars)`);
    return result;
  } catch (error: any) {
    console.error('   ❌ Claude exception:', error.message || error);
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
// 🧠 DEEPSEEK MASTER ANALYST - Direct API Call
// ============================================================================

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
Birden fazla AI sisteminden gelen tahminleri değerlendirip, final kararını veriyorsun.
Analitik düşünce, istatistiksel akıl yürütme ve futbol bilgisi konusunda uzmansın.
Tüm verileri sentezleyerek en doğru tahminleri üretmelisin.` 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.3 // Daha tutarlı sonuçlar için düşük temperature
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('DeepSeek Direct API error:', error);
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
// HELPER FUNCTIONS
// ============================================================================

// Normalize match result prediction to database format (home/draw/away)
function normalizeMatchResultToDb(pred: string): 'home' | 'draw' | 'away' {
  if (!pred) return 'draw';
  const lower = String(pred).toLowerCase().trim();
  if (lower === 'home' || lower === '1' || lower.includes('home') || lower === 'home win') return 'home';
  if (lower === 'away' || lower === '2' || lower.includes('away') || lower === 'away win') return 'away';
  if (lower === 'draw' || lower === 'x' || lower === '0' || lower.includes('draw')) return 'draw';
  return 'draw';
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
          prediction: (() => {
            const pred = parsed.matchResult?.prediction;
            if (!pred) return 'draw';
            const lower = String(pred).toLowerCase().trim();
            // Check for normalized values first
            if (lower === 'home' || lower === '1') return 'home';
            if (lower === 'away' || lower === '2') return 'away';
            if (lower === 'draw' || lower === 'x' || lower === '0') return 'draw';
            // Check for full format
            if (lower.includes('home') || lower.includes('home win')) return 'home';
            if (lower.includes('away') || lower.includes('away win')) return 'away';
            if (lower.includes('draw')) return 'draw';
            // Default fallback
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
// 🎯 DEEPSEEK MASTER ANALYST - Final Decision Maker
// Tüm sistemlerin sonuçlarını alıp, uzman görüşü oluşturur
// ============================================================================

interface MasterAnalysis {
  finalVerdict: AnalysisResult;
  confidence: number;
  reasoning: string;
  systemAgreement: {
    btts: number; // Kaç sistem aynı fikirde (0-3)
    overUnder: number;
    matchResult: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  bestBet: {
    market: string;
    selection: string;
    confidence: number;
    reason: string;
  };
  warnings: string[];
  processingTime: number;
}

async function runDeepSeekMasterAnalyst(
  match: MatchToAnalyze,
  aiConsensus: SystemAnalysis,
  quadBrain: SystemAnalysis,
  aiAgents: SystemAnalysis,
  injuryInfo: string = ''
): Promise<MasterAnalysis> {
  const startTime = Date.now();

  // Build comprehensive prompt with all system results
  const prompt = `
🎯 MASTER ANALİZ GÖREVİ

Sen DeepSeek Master Analyst'sin - 3 farklı AI sisteminin sonuçlarını değerlendirip final kararı veren üst-akıl.

📊 MAÇ BİLGİSİ:
- Maç: ${match.home_team} vs ${match.away_team}
- Lig: ${match.league}
- Tarih: ${match.match_date}
${injuryInfo ? `- Sakatlıklar: ${injuryInfo}` : ''}

═══════════════════════════════════════════════════════════════

📈 SİSTEM 1: AI CONSENSUS (Claude + Gemini + DeepSeek)
Modeller: ${aiConsensus.models.join(', ')}
İşlem Süresi: ${aiConsensus.processingTime}ms

Sonuçlar:
- BTTS: ${aiConsensus.consensus.btts.prediction.toUpperCase()} (%${aiConsensus.consensus.btts.confidence})
  Gerekçe: ${aiConsensus.consensus.btts.reasoning || 'Yok'}
  
- Üst/Alt 2.5: ${aiConsensus.consensus.overUnder.prediction.toUpperCase()} (%${aiConsensus.consensus.overUnder.confidence})
  Gerekçe: ${aiConsensus.consensus.overUnder.reasoning || 'Yok'}
  
- Maç Sonucu: ${aiConsensus.consensus.matchResult.prediction.toUpperCase()} (%${aiConsensus.consensus.matchResult.confidence})
  Gerekçe: ${aiConsensus.consensus.matchResult.reasoning || 'Yok'}

Model Bazlı Detay:
${Object.entries(aiConsensus.individualPredictions).map(([model, pred]) => 
  `  ${model}: BTTS=${pred.btts.prediction}(%${pred.btts.confidence}), O/U=${pred.overUnder.prediction}(%${pred.overUnder.confidence}), MS=${pred.matchResult.prediction}(%${pred.matchResult.confidence})`
).join('\n')}

═══════════════════════════════════════════════════════════════

🧠 SİSTEM 2: QUAD-BRAIN (Claude + Gemini + Grok + Mistral)
Modeller: ${quadBrain.models.join(', ')}
İşlem Süresi: ${quadBrain.processingTime}ms

Sonuçlar:
- BTTS: ${quadBrain.consensus.btts.prediction.toUpperCase()} (%${quadBrain.consensus.btts.confidence})
- Üst/Alt 2.5: ${quadBrain.consensus.overUnder.prediction.toUpperCase()} (%${quadBrain.consensus.overUnder.confidence})
- Maç Sonucu: ${quadBrain.consensus.matchResult.prediction.toUpperCase()} (%${quadBrain.consensus.matchResult.confidence})

Model Bazlı Detay:
${Object.entries(quadBrain.individualPredictions).map(([model, pred]) => 
  `  ${model}: BTTS=${pred.btts.prediction}(%${pred.btts.confidence}), O/U=${pred.overUnder.prediction}(%${pred.overUnder.confidence}), MS=${pred.matchResult.prediction}(%${pred.matchResult.confidence})`
).join('\n')}

═══════════════════════════════════════════════════════════════

🤖 SİSTEM 3: AI AGENTS (5 Uzman Ajan)
Ajanlar: ${aiAgents.models.join(', ')}
İşlem Süresi: ${aiAgents.processingTime}ms

Sonuçlar:
- BTTS: ${aiAgents.consensus.btts.prediction.toUpperCase()} (%${aiAgents.consensus.btts.confidence})
- Üst/Alt 2.5: ${aiAgents.consensus.overUnder.prediction.toUpperCase()} (%${aiAgents.consensus.overUnder.confidence})
- Maç Sonucu: ${aiAgents.consensus.matchResult.prediction.toUpperCase()} (%${aiAgents.consensus.matchResult.confidence})

Ajan Bazlı Detay:
${Object.entries(aiAgents.individualPredictions).map(([agent, pred]) => 
  `  ${agent}: BTTS=${pred.btts.prediction}(%${pred.btts.confidence}), O/U=${pred.overUnder.prediction}(%${pred.overUnder.confidence}), MS=${pred.matchResult.prediction}(%${pred.matchResult.confidence})`
).join('\n')}

═══════════════════════════════════════════════════════════════

🎯 SENİN GÖREVİN:

1. Yukarıdaki 3 sistemin sonuçlarını analiz et
2. Modeller arası uyumu değerlendir (3 sistemin kaçı aynı fikirde?)
3. Final kararını ver - çoğunluk oyu önemli ama kalite faktörlerini de dikkate al
4. CONFIDENCE'ı GERÇEKÇİ tut - %70 confidence demek gerçekten %70 başarı şansı demektir!
   ⚠️ ÖNEMLİ: Aşırı güvenli olma! Eğer sistemler çelişiyorsa confidence'ı düşür.
   - 3/3 sistem aynı fikirde + yüksek confidence = %70-80
   - 2/3 sistem aynı fikirde = %55-65
   - Sistemler çelişiyor = %50-55
5. Match Result için özel dikkat: Maç sonucu tahmin etmek çok zor! Eğer %60'tan fazla confidence veriyorsan, çok güçlü kanıt olmalı.

YANITINI SADECE AŞAĞIDAKİ JSON FORMATINDA VER:

{
  "finalVerdict": {
    "btts": {
      "prediction": "yes" veya "no",
      "confidence": GERÇEKÇİ (3/3 uyum varsa 65-75, 2/3 varsa 55-65, çelişki varsa 50-55),
      "reasoning": "Kısa ama öz gerekçe - sistem uyumunu belirt"
    },
    "overUnder": {
      "prediction": "over" veya "under",
      "confidence": GERÇEKÇİ (3/3 uyum varsa 65-75, 2/3 varsa 55-65, çelişki varsa 50-55),
      "reasoning": "Kısa ama öz gerekçe - sistem uyumunu belirt"
    },
    "matchResult": {
      "prediction": "home", "draw" veya "away",
      "confidence": ÇOK GERÇEKÇİ (Maç sonucu zor! 3/3 uyum varsa 60-70, 2/3 varsa 50-60, çelişki varsa 45-50),
      "reasoning": "Kısa ama öz gerekçe - sistem uyumunu ve güvenilirlik faktörlerini belirt"
    }
  },
  "overallConfidence": 50-90 arası (genel güven),
  "masterReasoning": "2-3 cümlelik genel değerlendirme",
  "systemAgreement": {
    "btts": 0-3 (kaç sistem aynı fikirde),
    "overUnder": 0-3,
    "matchResult": 0-3
  },
  "riskLevel": "low", "medium" veya "high",
  "bestBet": {
    "market": "BTTS", "Over/Under" veya "Match Result",
    "selection": "Seçim",
    "confidence": 60-90,
    "reason": "Neden bu en güvenli"
  },
  "warnings": ["Varsa uyarılar dizisi"]
}`;

  try {
    const response = await callDeepSeekDirect(prompt);
    console.log(`   📝 DeepSeek raw response length: ${response.length} chars`);
    
    // ✅ DÜZELTME: DeepSeek'in döndürdüğü JSON'u parse et (finalVerdict içinde nested yapı var)
    let extendedData: any = {};
    let finalVerdict: AnalysisResult | null = null;
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extendedData = JSON.parse(jsonMatch[0]);
        console.log(`   ✅ Parsed JSON successfully`);
        
        // DeepSeek finalVerdict içinde nested yapı döndürüyor
        if (extendedData.finalVerdict) {
          const fv = extendedData.finalVerdict;
          finalVerdict = {
            btts: {
              prediction: (fv.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no') as 'yes' | 'no',
              confidence: Math.min(100, Math.max(0, parseInt(fv.btts?.confidence) || 60)),
              reasoning: fv.btts?.reasoning || ''
            },
            overUnder: {
              prediction: (fv.overUnder?.prediction?.toLowerCase() === 'over' ? 'over' : 'under') as 'over' | 'under',
              confidence: Math.min(100, Math.max(0, parseInt(fv.overUnder?.confidence) || 60)),
              reasoning: fv.overUnder?.reasoning || ''
            },
            matchResult: {
              prediction: (() => {
                const pred = fv.matchResult?.prediction;
                if (!pred) return 'draw';
                const lower = String(pred).toLowerCase().trim();
                if (lower === 'home' || lower === '1' || lower.includes('home')) return 'home';
                if (lower === 'away' || lower === '2' || lower.includes('away')) return 'away';
                if (lower === 'draw' || lower === 'x' || lower === '0' || lower.includes('draw')) return 'draw';
                return 'draw';
              })() as 'home' | 'draw' | 'away',
              confidence: Math.min(100, Math.max(0, parseInt(fv.matchResult?.confidence) || 50)),
              reasoning: fv.matchResult?.reasoning || ''
            },
            bestBet: extendedData.bestBet
          };
          console.log(`   ✅ Final Verdict: BTTS=${finalVerdict.btts.prediction}(${finalVerdict.btts.confidence}%), O/U=${finalVerdict.overUnder.prediction}(${finalVerdict.overUnder.confidence}%), MS=${finalVerdict.matchResult.prediction}(${finalVerdict.matchResult.confidence}%)`);
        } else {
          // Eğer finalVerdict yoksa, eski parseAIResponse fonksiyonunu kullan
          finalVerdict = parseAIResponse(response);
        }
      } else {
        console.log(`   ⚠️ No JSON found in response, using fallback`);
      }
    } catch (parseError) {
      console.error('   ❌ JSON parse error:', parseError);
      // Fallback: parseAIResponse kullan
      finalVerdict = parseAIResponse(response);
    }

    // Eğer hala null ise fallback değerler kullan
    if (!finalVerdict) {
      console.log(`   ⚠️ Using fallback values`);
      finalVerdict = {
        btts: { prediction: 'no', confidence: 50, reasoning: 'Parse hatası' },
        overUnder: { prediction: 'under', confidence: 50, reasoning: 'Parse hatası' },
        matchResult: { prediction: 'draw', confidence: 50, reasoning: 'Parse hatası' }
      };
    }

    // System agreement already calculated above (before finalVerdict creation)
    // Recalculate for logging if needed
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

    console.log(`   📊 System Agreement: BTTS=${bttsAgreement}/3, O/U=${ouAgreement}/3, MS=${mrAgreement}/3`);
    console.log(`   🎯 Calibrated Confidence: BTTS=${finalVerdict.btts.confidence}%, O/U=${finalVerdict.overUnder.confidence}%, MS=${finalVerdict.matchResult.confidence}%`);

    return {
      finalVerdict: finalVerdict,
      confidence: extendedData.overallConfidence || Math.round((finalVerdict.btts.confidence + finalVerdict.overUnder.confidence + finalVerdict.matchResult.confidence) / 3),
      reasoning: extendedData.masterReasoning || 'DeepSeek Master Analyst değerlendirmesi',
      systemAgreement: {
        btts: bttsAgreement,
        overUnder: ouAgreement,
        matchResult: mrAgreement
      },
      riskLevel: extendedData.riskLevel || (Math.min(bttsAgreement, ouAgreement, mrAgreement) >= 2 ? 'low' : 'medium'),
      bestBet: extendedData.bestBet || {
        market: 'BTTS',
        selection: finalVerdict.btts.prediction,
        confidence: finalVerdict.btts.confidence,
        reason: 'En yüksek sistem uyumu'
      },
      warnings: extendedData.warnings || [],
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('DeepSeek Master Analyst error:', error);
    
    // Fallback: Use weighted average of all systems
    const allPredictions = {
      ...aiConsensus.individualPredictions,
      ...quadBrain.individualPredictions,
      ...aiAgents.individualPredictions
    };
    const fallbackConsensus = calculateConsensus(allPredictions);

    return {
      finalVerdict: fallbackConsensus,
      confidence: 55,
      reasoning: 'DeepSeek hatası - sistem ortalaması kullanıldı',
      systemAgreement: { btts: 1, overUnder: 1, matchResult: 1 },
      riskLevel: 'high',
      bestBet: {
        market: 'BTTS',
        selection: fallbackConsensus.btts.prediction,
        confidence: 55,
        reason: 'Fallback'
      },
      warnings: ['DeepSeek API hatası - sonuçlar güvenilir olmayabilir'],
      processingTime: Date.now() - startTime
    };
  }
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
      consensus_match_result: normalizeMatchResultToDb(bestAnalysis.consensus.matchResult.prediction),
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
// SAVE ANALYSIS WITH DEEPSEEK MASTER ANALYST
// ============================================================================

async function saveAnalysisWithMaster(
  match: MatchToAnalyze,
  analyses: SystemAnalysis[],
  masterAnalysis: MasterAnalysis
): Promise<boolean> {
  try {
    // Create or get prediction session
    const sessionData = {
      fixture_id: match.fixture_id,
      home_team: match.home_team,
      away_team: match.away_team,
      league: match.league,
      match_date: match.match_date,
      prediction_source: 'deepseek_master',
      session_type: 'auto',
      is_settled: false,
      created_at: new Date().toISOString()
    };

    // Check if already analyzed
    const { data: existing } = await supabase
      .from('prediction_sessions')
      .select('id')
      .eq('fixture_id', match.fixture_id)
      .eq('prediction_source', 'deepseek_master')
      .maybeSingle();

    if (existing) {
      console.log(`   ⏭️ Already analyzed by Master: ${match.home_team} vs ${match.away_team}`);
      return false;
    }

    // Use Master Analyst's final verdict as consensus
    const fullSessionData = {
      ...sessionData,
      consensus_btts: masterAnalysis.finalVerdict.btts.prediction,
      consensus_btts_confidence: masterAnalysis.finalVerdict.btts.confidence,
      consensus_over_under: masterAnalysis.finalVerdict.overUnder.prediction,
      consensus_over_under_confidence: masterAnalysis.finalVerdict.overUnder.confidence,
      consensus_match_result: normalizeMatchResultToDb(masterAnalysis.finalVerdict.matchResult.prediction),
      consensus_match_result_confidence: masterAnalysis.finalVerdict.matchResult.confidence
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
          match_result_prediction: normalizeMatchResultToDb(prediction.matchResult.prediction),
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

    // Save DeepSeek Master Analyst as a special model
    const masterModelData = {
      session_id: session.id,
      model_name: 'deepseek_master',
      model_type: 'master_analyst',
      btts_prediction: masterAnalysis.finalVerdict.btts.prediction,
      btts_confidence: masterAnalysis.finalVerdict.btts.confidence,
      btts_reasoning: masterAnalysis.finalVerdict.btts.reasoning,
      over_under_prediction: masterAnalysis.finalVerdict.overUnder.prediction,
      over_under_confidence: masterAnalysis.finalVerdict.overUnder.confidence,
      over_under_reasoning: masterAnalysis.finalVerdict.overUnder.reasoning,
      match_result_prediction: normalizeMatchResultToDb(masterAnalysis.finalVerdict.matchResult.prediction),
      match_result_confidence: masterAnalysis.finalVerdict.matchResult.confidence,
      match_result_reasoning: masterAnalysis.finalVerdict.matchResult.reasoning,
      primary_recommendation_market: masterAnalysis.bestBet.market,
      primary_recommendation_selection: masterAnalysis.bestBet.selection,
      primary_recommendation_confidence: masterAnalysis.bestBet.confidence,
      response_time_ms: masterAnalysis.processingTime,
      raw_response: {
        system: 'deepseek_master',
        overallConfidence: masterAnalysis.confidence,
        masterReasoning: masterAnalysis.reasoning,
        systemAgreement: masterAnalysis.systemAgreement,
        riskLevel: masterAnalysis.riskLevel,
        warnings: masterAnalysis.warnings
      }
    };

    await supabase.from('ai_model_predictions').insert(masterModelData);

    // Save full analysis as JSON with Master Analyst
    await supabase.from('match_full_analysis').upsert({
      fixture_id: match.fixture_id,
      home_team: match.home_team,
      away_team: match.away_team,
      league: match.league,
      match_date: match.match_date,
      ai_consensus: analyses.find(a => a.system === 'ai_consensus'),
      quad_brain: analyses.find(a => a.system === 'quad_brain'),
      ai_agents: analyses.find(a => a.system === 'ai_agents'),
      deepseek_master: {
        finalVerdict: masterAnalysis.finalVerdict,
        confidence: masterAnalysis.confidence,
        reasoning: masterAnalysis.reasoning,
        systemAgreement: masterAnalysis.systemAgreement,
        riskLevel: masterAnalysis.riskLevel,
        bestBet: masterAnalysis.bestBet,
        warnings: masterAnalysis.warnings,
        processingTime: masterAnalysis.processingTime
      },
      best_system: 'deepseek_master',
      best_btts: masterAnalysis.finalVerdict.btts.prediction,
      best_btts_confidence: masterAnalysis.finalVerdict.btts.confidence,
      best_over_under: masterAnalysis.finalVerdict.overUnder.prediction,
      best_over_under_confidence: masterAnalysis.finalVerdict.overUnder.confidence,
      best_match_result: normalizeMatchResultToDb(masterAnalysis.finalVerdict.matchResult.prediction),
      best_match_result_confidence: masterAnalysis.finalVerdict.matchResult.confidence,
      created_at: new Date().toISOString()
    }, { onConflict: 'fixture_id' });

    console.log(`   ✅ Saved Master Analysis for ${match.home_team} vs ${match.away_team}`);
    console.log(`   🎯 Risk: ${masterAnalysis.riskLevel} | Agreement: BTTS=${masterAnalysis.systemAgreement.btts}/3, O/U=${masterAnalysis.systemAgreement.overUnder}/3, MS=${masterAnalysis.systemAgreement.matchResult}/3`);
    return true;
  } catch (error) {
    console.error('Save Master error:', error);
    return false;
  }
}

// ============================================================================
// GET MATCHES TO ANALYZE
// ============================================================================

async function getMatchesToAnalyze(): Promise<MatchToAnalyze[]> {
  // Get matches from dashboard that haven't been analyzed yet
  // ⚠️ IMPORTANT: Only get matches that haven't started yet (at least 15 min buffer)
  const now = new Date();
  const minKickOffTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 dakika sonrası (30'dan 15'e düşürüldü)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Dashboard gibi bugünden 3 gün sonrasına kadar bak (dashboard 7 gün bakıyor ama cron için 3 gün yeterli)
  const endDate = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);

  console.log(`   ⏰ Current time: ${now.toISOString()}`);
  console.log(`   📅 Date range: ${todayStart.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  console.log(`   ⏰ Min kick-off: ${minKickOffTime.toISOString()} (15 min buffer)`);

  try {
    // Check existing analyses in match_full_analysis table
    // ✅ DÜZELTME: Tüm kayıtları al ve deepseek_master null olmayanları filtrele
    // Bu yöntem daha güvenilir çünkü Supabase'in null kontrolü syntax'ı bazen sorunlu olabiliyor
    const { data: allAnalyses, error: queryError } = await supabase
      .from('match_full_analysis')
      .select('fixture_id, deepseek_master');

    if (queryError) {
      console.error('   ⚠️ Error querying existing analyses:', queryError);
    }

    // deepseek_master alanı null olmayan (yani analiz edilmiş) maçları filtrele
    const analyzedFixtureIds = new Set(
      (allAnalyses || [])
        .filter((a: any) => a.deepseek_master !== null && a.deepseek_master !== undefined)
        .map((a: any) => a.fixture_id)
    );
    console.log(`   📊 Already analyzed: ${analyzedFixtureIds.size} matches`);

    // Fetch fixtures from SportMonks (bugünden 3 gün sonrasına kadar)
    const today = now.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`   📡 Fetching fixtures from SportMonks: ${today} to ${endDateStr}`);
    
    const res = await fetchFromSportmonks(`/fixtures/between/${today}/${endDateStr}`, {
      include: 'participants;league',
      per_page: '100'
    });

    if (!res || !res.data) {
      console.error('   ❌ SportMonks API returned invalid response:', res);
      return [];
    }

    const fixtures = res.data || [];
    console.log(`   📡 SportMonks returned: ${fixtures.length} fixtures`);

    // Filter matches:
    // 1. Not already analyzed with DeepSeek Master
    // 2. Match has NOT started yet (kick-off time is in the future)
    // 3. Kick-off time is at least 15 minutes from now
    const matches: MatchToAnalyze[] = fixtures
      .filter((f: any) => {
        if (!f.starting_at) {
          return false; // Tarih yoksa atla
        }

        const fixtureId = f.id;
        const kickOffTime = new Date(f.starting_at);
        
        // Geçersiz tarih kontrolü
        if (isNaN(kickOffTime.getTime())) {
          console.log(`   ⚠️ Invalid date for fixture ${fixtureId}: ${f.starting_at}`);
          return false;
        }

        const participants = f.participants || [];
        const home = participants.find((p: any) => p.meta?.location === 'home')?.name || 'Unknown';
        const away = participants.find((p: any) => p.meta?.location === 'away')?.name || 'Unknown';
        
        // Skip if already analyzed
        if (analyzedFixtureIds.has(fixtureId)) {
          return false;
        }
        
        // ⚠️ SKIP if match has already started (kick-off time is in the past)
        if (kickOffTime <= now) {
          return false; // Sessizce atla, çok fazla log olmasın
        }
        
        // Skip if match starts in less than 15 minutes
        if (kickOffTime < minKickOffTime) {
          return false; // Sessizce atla
        }
        
        return true;
      })
      .slice(0, 20) // Limit to 20 matches per run (15'ten 20'ye çıkarıldı)
      .map((f: any) => {
        const participants = f.participants || [];
        const home = participants.find((p: any) => p.meta?.location === 'home');
        const away = participants.find((p: any) => p.meta?.location === 'away');
        return {
          fixture_id: f.id,
          home_team: home?.name || 'Unknown',
          away_team: away?.name || 'Unknown',
          league: f.league?.name || 'Unknown League',
          match_date: f.starting_at?.split('T')[0] || today,
          kick_off_time: f.starting_at
        };
      });

    console.log(`   ✅ Matches to analyze: ${matches.length}`);
    if (matches.length > 0) {
      console.log(`   📋 Sample matches: ${matches.slice(0, 3).map(m => `${m.home_team} vs ${m.away_team}`).join(', ')}`);
    }
    return matches;
  } catch (error) {
    console.error('   ❌ Error fetching matches:', error);
    if (error instanceof Error) {
      console.error('   ❌ Error details:', error.message, error.stack);
    }
    return [];
  }
}

// ============================================================================
// HELPER: Check if match has already started
// ============================================================================

function hasMatchStarted(kickOffTime: string | undefined): boolean {
  if (!kickOffTime) return false;
  const kickOff = new Date(kickOffTime);
  const now = new Date();
  return kickOff <= now;
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
        // ⚠️ DOUBLE CHECK: Skip if match has already started
        if (hasMatchStarted(match.kick_off_time)) {
          console.log(`\n⏭️ Skipping (already started): ${match.home_team} vs ${match.away_team}`);
          continue;
        }

        console.log(`\n🔍 Analyzing: ${match.home_team} vs ${match.away_team}`);
        if (match.kick_off_time) {
          const kickOff = new Date(match.kick_off_time);
          const minutesUntilKickOff = Math.round((kickOff.getTime() - Date.now()) / 60000);
          console.log(`   ⏰ Kick-off in ${minutesUntilKickOff} minutes`);
        }

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

        // 🎯 DeepSeek Master Analyst - Final Decision
        console.log(`   🎯 Running DeepSeek Master Analyst...`);
        const masterAnalysis = await runDeepSeekMasterAnalyst(
          match, 
          aiConsensus, 
          quadBrain, 
          aiAgents, 
          injuryInfo
        );
        console.log(`   ✨ Master Analyst: ${masterAnalysis.processingTime}ms (Risk: ${masterAnalysis.riskLevel})`);
        console.log(`   📌 Best Bet: ${masterAnalysis.bestBet.market} - ${masterAnalysis.bestBet.selection} (%${masterAnalysis.bestBet.confidence})`);

        // Save all analyses including Master Analyst
        const saved = await saveAnalysisWithMaster(match, [aiConsensus, quadBrain, aiAgents], masterAnalysis);
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

