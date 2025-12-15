// AI Brain Engine
// Multi-AI Consensus System for Football Predictions

import {
  AIModel,
  AIPrediction,
  ConsensusPrediction,
  MatchData
} from './types';

import {
  AI_CONFIGS,
  TACTICAL_PROMPT,
  STATISTICAL_PROMPT,
  PATTERN_PROMPT,
  CONTEXTUAL_PROMPT,
  generateTacticalPackage,
  generateStatisticalPackage,
  generatePatternPackage,
  generateContextualPackage
} from './config';

// ============================================
// AI API CLIENTS
// ============================================

interface AIClient {
  analyze: (prompt: string, config: typeof AI_CONFIGS.claude) => Promise<any>;
}

// Claude Client
const claudeClient: AIClient = {
  async analyze(prompt: string, config) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    
    const data = await response.json();
    return parseAIResponse(data.content[0].text, 'claude');
  }
};

// GPT-4 Client
const gpt4Client: AIClient = {
  async analyze(prompt: string, config) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: config.specialization
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    
    const data = await response.json();
    return parseAIResponse(data.choices[0].message.content, 'gpt4');
  }
};

// Gemini Client
const geminiClient: AIClient = {
  async analyze(prompt: string, config) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: config.specialization + '\n\n' + prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens
          }
        })
      }
    );
    
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return parseAIResponse(text, 'gemini');
  }
};

// Perplexity Client
const perplexityClient: AIClient = {
  async analyze(prompt: string, config) {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: config.specialization
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature
      })
    });
    
    const data = await response.json();
    return parseAIResponse(data.choices[0].message.content, 'perplexity');
  }
};

const AI_CLIENTS: Record<AIModel, AIClient> = {
  claude: claudeClient,
  gpt4: gpt4Client,
  gemini: geminiClient,
  perplexity: perplexityClient
};

// ============================================
// RESPONSE PARSER
// ============================================

function parseAIResponse(response: string, model: AIModel): AIPrediction {
  try {
    // JSON'u çıkar
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      model,
      role: AI_CONFIGS[model].role,
      confidence: calculateOverallConfidence(parsed),
      predictions: {
        matchResult: parsed.prediction?.matchResult || {
          prediction: 'X',
          confidence: 50,
          reasoning: 'Unable to parse'
        },
        goals: parsed.prediction?.goals || {
          over25: false,
          over35: false,
          exactGoals: 2,
          confidence: 50,
          reasoning: 'Unable to parse'
        },
        btts: parsed.prediction?.btts || {
          prediction: false,
          confidence: 50,
          reasoning: 'Unable to parse'
        },
        correctScore: parsed.prediction?.correctScore || {
          prediction: '1-1',
          confidence: 20
        }
      },
      keyInsights: parsed.keyInsights || [],
      riskFactors: parsed.riskFactors || [],
      valuePlay: parsed.valueBets?.[0] || parsed.valuePlay || null,
      analysisTimestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error parsing ${model} response:`, error);
    return createFallbackPrediction(model);
  }
}

function calculateOverallConfidence(parsed: any): number {
  const confidences = [
    parsed.prediction?.matchResult?.confidence,
    parsed.prediction?.goals?.confidence,
    parsed.prediction?.btts?.confidence
  ].filter(c => c !== undefined);
  
  if (confidences.length === 0) return 50;
  return Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length);
}

function createFallbackPrediction(model: AIModel): AIPrediction {
  return {
    model,
    role: AI_CONFIGS[model].role,
    confidence: 30,
    predictions: {
      matchResult: { prediction: 'X', confidence: 30, reasoning: 'Fallback prediction' },
      goals: { over25: false, over35: false, exactGoals: 2, confidence: 30, reasoning: 'Fallback' },
      btts: { prediction: false, confidence: 30, reasoning: 'Fallback' },
      correctScore: { prediction: '1-1', confidence: 10 }
    },
    keyInsights: ['Analysis failed - using fallback'],
    riskFactors: ['Low confidence due to analysis error'],
    analysisTimestamp: new Date().toISOString()
  };
}

// ============================================
// MAIN ANALYSIS ENGINE
// ============================================

export async function analyzeMatch(matchData: MatchData): Promise<ConsensusPrediction> {
  console.log(`🧠 Starting AI Brain analysis for match ${matchData.fixtureId}`);
  
  // Parallel AI calls with role-specific data
  const analysisPromises: Promise<AIPrediction>[] = [
    // Claude - Tactical Analysis
    AI_CLIENTS.claude.analyze(
      TACTICAL_PROMPT(generateTacticalPackage(matchData)),
      AI_CONFIGS.claude
    ),
    
    // GPT-4 - Statistical Analysis
    AI_CLIENTS.gpt4.analyze(
      STATISTICAL_PROMPT(generateStatisticalPackage(matchData)),
      AI_CONFIGS.gpt4
    ),
    
    // Gemini - Pattern Analysis
    AI_CLIENTS.gemini.analyze(
      PATTERN_PROMPT(generatePatternPackage(matchData)),
      AI_CONFIGS.gemini
    ),
    
    // Perplexity - Contextual Analysis
    AI_CLIENTS.perplexity.analyze(
      CONTEXTUAL_PROMPT(generateContextualPackage(matchData)),
      AI_CONFIGS.perplexity
    )
  ];
  
  // Wait for all analyses
  const predictions = await Promise.allSettled(analysisPromises);
  
  // Extract successful predictions
  const successfulPredictions: AIPrediction[] = predictions
    .filter((p): p is PromiseFulfilledResult<AIPrediction> => p.status === 'fulfilled')
    .map(p => p.value);
  
  console.log(`✅ ${successfulPredictions.length}/4 AI analyses completed`);
  
  // Generate consensus
  return generateConsensus(matchData.fixtureId, successfulPredictions);
}

// ============================================
// CONSENSUS GENERATOR
// ============================================

function generateConsensus(
  matchId: number,
  predictions: AIPrediction[]
): ConsensusPrediction {
  
  // Match Result Consensus
  const matchResultVotes = predictions.map(p => ({
    pick: p.predictions.matchResult.prediction,
    confidence: p.predictions.matchResult.confidence,
    weight: AI_CONFIGS[p.model].weight
  }));
  
  const matchResultConsensus = calculateWeightedConsensus(matchResultVotes);
  
  // Goals Consensus
  const goalsVotes = predictions.map(p => ({
    pick: p.predictions.goals.over25 ? 'over' : 'under',
    confidence: p.predictions.goals.confidence,
    weight: AI_CONFIGS[p.model].weight
  }));
  
  const goalsConsensus = calculateWeightedConsensus(goalsVotes);
  
  // BTTS Consensus
  const bttsVotes = predictions.map(p => ({
    pick: p.predictions.btts.prediction ? 'yes' : 'no',
    confidence: p.predictions.btts.confidence,
    weight: AI_CONFIGS[p.model].weight
  }));
  
  const bttsConsensus = calculateWeightedConsensus(bttsVotes);
  
  // Find conflicting views
  const conflictingViews = findConflicts(predictions);
  
  // Find unanimous insights
  const unanimousInsights = findUnanimousInsights(predictions);
  
  // Best value play
  const bestValue = findBestValue(predictions);
  
  return {
    matchId,
    predictions,
    consensus: {
      matchResult: {
        prediction: matchResultConsensus.winner,
        confidence: matchResultConsensus.confidence,
        agreement: matchResultConsensus.agreement
      },
      goals: {
        over25: goalsConsensus.winner === 'over',
        confidence: goalsConsensus.confidence,
        agreement: goalsConsensus.agreement
      },
      btts: {
        prediction: bttsConsensus.winner === 'yes',
        confidence: bttsConsensus.confidence,
        agreement: bttsConsensus.agreement
      },
      bestValue: bestValue
    },
    overallConfidence: calculateOverallConsensusConfidence(
      matchResultConsensus,
      goalsConsensus,
      bttsConsensus
    ),
    conflictingViews,
    unanimousInsights,
    generatedAt: new Date().toISOString()
  };
}

interface Vote {
  pick: string;
  confidence: number;
  weight: number;
}

interface ConsensusResult {
  winner: string;
  confidence: number;
  agreement: number;
}

function calculateWeightedConsensus(votes: Vote[]): ConsensusResult {
  // Group by pick
  const groups: Record<string, { totalWeight: number; avgConfidence: number; count: number }> = {};
  
  for (const vote of votes) {
    if (!groups[vote.pick]) {
      groups[vote.pick] = { totalWeight: 0, avgConfidence: 0, count: 0 };
    }
    groups[vote.pick].totalWeight += vote.weight;
    groups[vote.pick].avgConfidence += vote.confidence * vote.weight;
    groups[vote.pick].count++;
  }
  
  // Find winner
  let winner = '';
  let maxWeight = 0;
  
  for (const [pick, data] of Object.entries(groups)) {
    if (data.totalWeight > maxWeight) {
      maxWeight = data.totalWeight;
      winner = pick;
    }
  }
  
  const winningGroup = groups[winner];
  
  return {
    winner,
    confidence: Math.round(winningGroup.avgConfidence / winningGroup.totalWeight),
    agreement: winningGroup.count
  };
}

function findConflicts(predictions: AIPrediction[]): string[] {
  const conflicts: string[] = [];
  
  // Check match result conflicts
  const matchPicks = new Set(predictions.map(p => p.predictions.matchResult.prediction));
  if (matchPicks.size > 2) {
    conflicts.push('AI models disagree significantly on match result');
  }
  
  // Check goals conflicts
  const goalsPicks = predictions.map(p => p.predictions.goals.over25);
  if (goalsPicks.some(g => g) && goalsPicks.some(g => !g)) {
    const overModels = predictions
      .filter(p => p.predictions.goals.over25)
      .map(p => p.model)
      .join(', ');
    const underModels = predictions
      .filter(p => !p.predictions.goals.over25)
      .map(p => p.model)
      .join(', ');
    conflicts.push(`Over 2.5: ${overModels} vs Under 2.5: ${underModels}`);
  }
  
  return conflicts;
}

function findUnanimousInsights(predictions: AIPrediction[]): string[] {
  // Find insights that appear in multiple predictions
  const allInsights = predictions.flatMap(p => p.keyInsights);
  const insightCounts: Record<string, number> = {};
  
  for (const insight of allInsights) {
    const normalized = insight.toLowerCase();
    insightCounts[normalized] = (insightCounts[normalized] || 0) + 1;
  }
  
  return Object.entries(insightCounts)
    .filter(([_, count]) => count >= 2)
    .map(([insight]) => insight);
}

function findBestValue(predictions: AIPrediction[]): { market: string; odds: number; combinedEdge: number } {
  const valuePlays = predictions
    .filter(p => p.valuePlay)
    .map(p => p.valuePlay!);
  
  if (valuePlays.length === 0) {
    return { market: 'No value identified', odds: 0, combinedEdge: 0 };
  }
  
  // Find most recommended value play
  const marketCounts: Record<string, { count: number; avgEdge: number; odds: number }> = {};
  
  for (const play of valuePlays) {
    const market = play.market;
    if (!marketCounts[market]) {
      marketCounts[market] = { count: 0, avgEdge: 0, odds: play.odds || 0 };
    }
    marketCounts[market].count++;
    marketCounts[market].avgEdge += play.edge || 0;
  }
  
  const best = Object.entries(marketCounts)
    .sort((a, b) => b[1].count - a[1].count)[0];
  
  return {
    market: best[0],
    odds: best[1].odds,
    combinedEdge: best[1].avgEdge / best[1].count
  };
}

function calculateOverallConsensusConfidence(
  matchResult: ConsensusResult,
  goals: ConsensusResult,
  btts: ConsensusResult
): number {
  // Weighted average with agreement bonus
  const baseConfidence = (
    matchResult.confidence * 0.4 +
    goals.confidence * 0.35 +
    btts.confidence * 0.25
  );
  
  // Agreement bonus (max 15%)
  const avgAgreement = (matchResult.agreement + goals.agreement + btts.agreement) / 3;
  const agreementBonus = (avgAgreement / 4) * 15;
  
  return Math.min(95, Math.round(baseConfidence + agreementBonus));
}

// ============================================
// SINGLE AI ANALYSIS (for testing)
// ============================================

export async function analyzeSingleAI(
  matchData: MatchData,
  model: AIModel
): Promise<AIPrediction> {
  const config = AI_CONFIGS[model];
  let prompt: string;
  let dataPackage: string;
  
  switch (model) {
    case 'claude':
      dataPackage = generateTacticalPackage(matchData);
      prompt = TACTICAL_PROMPT(dataPackage);
      break;
    case 'gpt4':
      dataPackage = generateStatisticalPackage(matchData);
      prompt = STATISTICAL_PROMPT(dataPackage);
      break;
    case 'gemini':
      dataPackage = generatePatternPackage(matchData);
      prompt = PATTERN_PROMPT(dataPackage);
      break;
    case 'perplexity':
      dataPackage = generateContextualPackage(matchData);
      prompt = CONTEXTUAL_PROMPT(dataPackage);
      break;
  }
  
  return AI_CLIENTS[model].analyze(prompt, config);
}

// ============================================
// EXPORTS
// ============================================

export { AI_CONFIGS, AI_CLIENTS };
export type { AIPrediction, ConsensusPrediction };
