// src/lib/heurist/multiModel.ts
import { heurist, HeuristModel, HeuristMessage } from './client';
import { MatchData } from './types';

// Kullanılacak modeller
const MODELS: HeuristModel[] = [
  'meta-llama/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'deepseek/deepseek-r1-distill-llama-70b',
  'mistralai/mistral-small-24b-instruct-2501',  // ✅ Çalışan model
];

export interface ModelPrediction {
  model: string;
  overUnder: 'Over' | 'Under';
  confidence: number;
  matchResult: '1' | 'X' | '2';
  btts: 'Yes' | 'No';
  reasoning: string;
}

export interface MultiModelConsensus {
  predictions: ModelPrediction[];
  consensus: {
    overUnder: { prediction: 'Over' | 'Under'; votes: number; confidence: number };
    matchResult: { prediction: '1' | 'X' | '2'; votes: number; confidence: number };
    btts: { prediction: 'Yes' | 'No'; votes: number; confidence: number };
  };
  unanimousDecisions: string[];
  conflictingDecisions: string[];
  bestBet: {
    type: string;
    selection: string;
    confidence: number;
    reasoning: string;
  };
  modelAgreement: number;
}

const PREDICTION_PROMPT = `You are a football match prediction AI. Analyze the match data and return ONLY valid JSON.

RULES:
- Use ONLY the provided statistics
- Be objective and data-driven
- Return ONLY JSON, no markdown, no explanation

Return this exact JSON format:
{
  "overUnder": "Over" or "Under",
  "overUnderConfidence": 50-100,
  "matchResult": "1" or "X" or "2",
  "matchResultConfidence": 50-100,
  "btts": "Yes" or "No",
  "bttsConfidence": 50-100,
  "reasoning": "Brief 1-2 sentence explanation"
}`;

async function getModelPrediction(
  model: HeuristModel,
  match: MatchData
): Promise<ModelPrediction | null> {
  const homeGoals = parseFloat(match.homeForm?.avgGoals || '0') || 1.2;
  const awayGoals = parseFloat(match.awayForm?.avgGoals || '0') || 1.0;
  const expectedTotal = homeGoals + awayGoals;
  const h2hGoals = parseFloat(match.h2h?.avgGoals || '0') || 2.5;

  const userPrompt = `MATCH: ${match.homeTeam} vs ${match.awayTeam}
LEAGUE: ${match.league || 'Unknown'}

STATISTICS:
- ${match.homeTeam} Form: ${match.homeForm?.form || 'N/A'} | Avg Goals: ${homeGoals} | Over 2.5: ${match.homeForm?.over25Percentage || 50}%
- ${match.awayTeam} Form: ${match.awayForm?.form || 'N/A'} | Avg Goals: ${awayGoals} | Over 2.5: ${match.awayForm?.over25Percentage || 50}%
- Expected Total Goals: ${expectedTotal.toFixed(2)}
- H2H Matches: ${match.h2h?.totalMatches || 0} | H2H Avg Goals: ${h2hGoals}
- H2H Home Wins: ${match.h2h?.homeWins || 0} | Away Wins: ${match.h2h?.awayWins || 0} | Draws: ${match.h2h?.draws || 0}

ODDS (if available):
- 1X2: ${match.odds?.matchWinner?.home || 'N/A'} / ${match.odds?.matchWinner?.draw || 'N/A'} / ${match.odds?.matchWinner?.away || 'N/A'}
- Over/Under 2.5: ${match.odds?.overUnder?.['2.5']?.over || 'N/A'} / ${match.odds?.overUnder?.['2.5']?.under || 'N/A'}

Analyze and return JSON prediction:`;

  const messages: HeuristMessage[] = [
    { role: 'system', content: PREDICTION_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  try {
    const response = await heurist.chat(messages, {
      model,
      temperature: 0.3,
      maxTokens: 500,
    });

    if (!response) return null;

    let cleaned = response
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      model: model.split('/')[1] || model,
      overUnder: parsed.overUnder === 'Over' ? 'Over' : 'Under',
      confidence: parsed.overUnderConfidence || 60,
      matchResult: ['1', 'X', '2'].includes(parsed.matchResult) ? parsed.matchResult : '1',
      btts: parsed.btts === 'Yes' ? 'Yes' : 'No',
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error(`❌ Model ${model} failed:`, error);
    return null;
  }
}

function calculateConsensus(predictions: ModelPrediction[]): MultiModelConsensus['consensus'] {
  const overVotes = predictions.filter(p => p.overUnder === 'Over').length;
  const underVotes = predictions.length - overVotes;
  const overUnderPrediction = overVotes >= underVotes ? 'Over' : 'Under';
  const overUnderVotes = Math.max(overVotes, underVotes);
  const overUnderConfidence = Math.round(
    predictions
      .filter(p => p.overUnder === overUnderPrediction)
      .reduce((sum, p) => sum + p.confidence, 0) / overUnderVotes
  );

  const resultCounts = { '1': 0, 'X': 0, '2': 0 };
  predictions.forEach(p => resultCounts[p.matchResult]++);
  const matchResultPrediction = Object.entries(resultCounts)
    .sort((a, b) => b[1] - a[1])[0][0] as '1' | 'X' | '2';
  const matchResultVotes = resultCounts[matchResultPrediction];
  const matchResultConfidence = Math.round(
    predictions
      .filter(p => p.matchResult === matchResultPrediction)
      .reduce((sum, p) => sum + 65, 0) / matchResultVotes
  );

  const bttsYesVotes = predictions.filter(p => p.btts === 'Yes').length;
  const bttsNoVotes = predictions.length - bttsYesVotes;
  const bttsPrediction = bttsYesVotes >= bttsNoVotes ? 'Yes' : 'No';
  const bttsVotes = Math.max(bttsYesVotes, bttsNoVotes);

  return {
    overUnder: { prediction: overUnderPrediction, votes: overUnderVotes, confidence: overUnderConfidence },
    matchResult: { prediction: matchResultPrediction, votes: matchResultVotes, confidence: matchResultConfidence },
    btts: { prediction: bttsPrediction, votes: bttsVotes, confidence: 65 },
  };
}

export async function runMultiModelAnalysis(match: MatchData): Promise<MultiModelConsensus> {
  console.log(`🔮 Running Multi-Model Analysis for ${match.homeTeam} vs ${match.awayTeam}`);
  console.log(`📊 Using ${MODELS.length} AI models...`);

  const startTime = Date.now();
  const results = await Promise.all(
    MODELS.map(model => getModelPrediction(model, match))
  );

  const predictions = results.filter((p): p is ModelPrediction => p !== null);
  const elapsed = Date.now() - startTime;

  console.log(`✅ ${predictions.length}/${MODELS.length} models responded in ${elapsed}ms`);

  if (predictions.length === 0) {
    const homeGoals = parseFloat(match.homeForm?.avgGoals || '0') || 1.2;
    const awayGoals = parseFloat(match.awayForm?.avgGoals || '0') || 1.0;
    const expectedTotal = homeGoals + awayGoals;

    return {
      predictions: [],
      consensus: {
        overUnder: { prediction: expectedTotal >= 2.5 ? 'Over' : 'Under', votes: 0, confidence: 55 },
        matchResult: { prediction: '1', votes: 0, confidence: 50 },
        btts: { prediction: 'Yes', votes: 0, confidence: 50 },
      },
      unanimousDecisions: [],
      conflictingDecisions: ['No model responses'],
      bestBet: {
        type: 'Over/Under 2.5',
        selection: expectedTotal >= 2.5 ? 'Over' : 'Under',
        confidence: 55,
        reasoning: 'Fallback based on statistics only',
      },
      modelAgreement: 0,
    };
  }

  const consensus = calculateConsensus(predictions);

  const unanimousDecisions: string[] = [];
  const conflictingDecisions: string[] = [];

  if (consensus.overUnder.votes === predictions.length) {
    unanimousDecisions.push(`Over/Under: ${consensus.overUnder.prediction} (${predictions.length}/${predictions.length})`);
  } else {
    conflictingDecisions.push(`Over/Under: ${consensus.overUnder.votes}/${predictions.length} for ${consensus.overUnder.prediction}`);
  }

  if (consensus.matchResult.votes === predictions.length) {
    unanimousDecisions.push(`Match Result: ${consensus.matchResult.prediction} (${predictions.length}/${predictions.length})`);
  } else {
    conflictingDecisions.push(`Match Result: ${consensus.matchResult.votes}/${predictions.length} for ${consensus.matchResult.prediction}`);
  }

  if (consensus.btts.votes === predictions.length) {
    unanimousDecisions.push(`BTTS: ${consensus.btts.prediction} (${predictions.length}/${predictions.length})`);
  } else {
    conflictingDecisions.push(`BTTS: ${consensus.btts.votes}/${predictions.length} for ${consensus.btts.prediction}`);
  }

  const bets = [
    { type: 'Over/Under 2.5', selection: consensus.overUnder.prediction, confidence: consensus.overUnder.confidence, votes: consensus.overUnder.votes },
    { type: 'Match Result', selection: consensus.matchResult.prediction, confidence: consensus.matchResult.confidence, votes: consensus.matchResult.votes },
    { type: 'BTTS', selection: consensus.btts.prediction, confidence: consensus.btts.confidence, votes: consensus.btts.votes },
  ];

  const bestBet = bets.sort((a, b) => (b.votes * b.confidence) - (a.votes * a.confidence))[0];

  const totalVotes = consensus.overUnder.votes + consensus.matchResult.votes + consensus.btts.votes;
  const maxPossibleVotes = predictions.length * 3;
  const modelAgreement = Math.round((totalVotes / maxPossibleVotes) * 100);

  console.log(`🎯 Consensus: Over/Under=${consensus.overUnder.prediction} (${consensus.overUnder.votes}/${predictions.length})`);
  console.log(`🎯 Consensus: Match=${consensus.matchResult.prediction} (${consensus.matchResult.votes}/${predictions.length})`);
  console.log(`🎯 Model Agreement: ${modelAgreement}%`);

  return {
    predictions,
    consensus,
    unanimousDecisions,
    conflictingDecisions,
    bestBet: {
      type: bestBet.type,
      selection: bestBet.selection,
      confidence: bestBet.confidence,
      reasoning: `${bestBet.votes}/${predictions.length} AI models agree on this prediction`,
    },
    modelAgreement,
  };
}
