// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - DEBATE PROTOCOL
// AI Conflict Detection & Resolution through Arbitration
// ============================================================================

import {
  AIModel,
  AIPrediction,
  BettingMarket,
  ConflictAnalysis,
  DebateInput,
  DebateResult,
  DataQualityScore
} from './types';

import {
  CONFLICT_CONFIG,
  AI_MODEL_CONFIGS,
  API_ENDPOINTS,
  MODEL_VERSIONS
} from './config';

// =========================
// CONFLICT DETECTION
// =========================

interface PredictionSummary {
  model: AIModel;
  prediction: string;
  confidence: number;
  reasoning: string;
  keyFactors: string[];
}

/**
 * Belirli bir market için çelişki analizi yapar
 */
function analyzeMarketConflict(
  market: BettingMarket,
  predictions: PredictionSummary[]
): {
  hasConflict: boolean;
  conflictLevel: 'none' | 'minor' | 'significant' | 'major';
  predictions: PredictionSummary[];
  confidenceGap: number;
  variance: number;
} {
  if (predictions.length < 2) {
    return {
      hasConflict: false,
      conflictLevel: 'none',
      predictions,
      confidenceGap: 0,
      variance: 0
    };
  }

  // Benzersiz tahminleri grupla
  const predictionGroups: Record<string, PredictionSummary[]> = {};
  for (const pred of predictions) {
    const normalized = normalizePrediction(pred.prediction, market);
    if (!predictionGroups[normalized]) {
      predictionGroups[normalized] = [];
    }
    predictionGroups[normalized].push(pred);
  }

  const uniquePredictions = Object.keys(predictionGroups);
  const hasConflict = uniquePredictions.length > 1;

  // Confidence gap hesapla
  const confidences = predictions.map(p => p.confidence);
  const maxConf = Math.max(...confidences);
  const minConf = Math.min(...confidences);
  const confidenceGap = maxConf - minConf;

  // Variance hesapla
  const avgConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const variance = Math.sqrt(
    confidences.reduce((sum, c) => sum + Math.pow(c - avgConf, 2), 0) / confidences.length
  );

  // Conflict level belirle
  let conflictLevel: 'none' | 'minor' | 'significant' | 'major' = 'none';
  
  if (!hasConflict) {
    conflictLevel = 'none';
  } else if (confidenceGap >= CONFLICT_CONFIG.MAJOR_CONFLICT_THRESHOLD) {
    conflictLevel = 'major';
  } else if (confidenceGap >= CONFLICT_CONFIG.SIGNIFICANT_CONFLICT_THRESHOLD) {
    conflictLevel = 'significant';
  } else if (confidenceGap >= CONFLICT_CONFIG.MINOR_CONFLICT_THRESHOLD) {
    conflictLevel = 'minor';
  } else if (uniquePredictions.length > 2) {
    // 3+ farklı tahmin varsa en az significant
    conflictLevel = 'significant';
  } else {
    conflictLevel = 'minor';
  }

  return {
    hasConflict,
    conflictLevel,
    predictions,
    confidenceGap,
    variance
  };
}

/**
 * Tahminleri normalize eder (farklı formatları standartlaştırır)
 */
function normalizePrediction(prediction: string, market: BettingMarket): string {
  const upper = prediction.toUpperCase().trim();
  
  switch (market) {
    case 'MATCH_RESULT':
      if (upper.includes('HOME') || upper === '1') return 'HOME';
      if (upper.includes('AWAY') || upper === '2') return 'AWAY';
      if (upper.includes('DRAW') || upper === 'X') return 'DRAW';
      return upper;
      
    case 'OVER_UNDER_25':
      if (upper.includes('OVER')) return 'OVER';
      if (upper.includes('UNDER')) return 'UNDER';
      return upper;
      
    case 'BTTS':
      if (upper.includes('YES') || upper === 'EVET') return 'YES';
      if (upper.includes('NO') || upper === 'HAYIR') return 'NO';
      return upper;
      
    default:
      return upper;
  }
}

/**
 * Tüm AI tahminlerini analiz ederek çelişkileri tespit eder
 */
export function detectConflicts(
  predictions: {
    claude?: AIPrediction;
    gpt4?: AIPrediction;
    gemini?: AIPrediction;
    perplexity?: AIPrediction;
  }
): ConflictAnalysis {
  const markets: BettingMarket[] = ['MATCH_RESULT', 'OVER_UNDER_25', 'BTTS'];
  const conflicts: ConflictAnalysis['conflicts'] = [];
  
  let hasAnyConflict = false;
  let maxConflictLevel: 'none' | 'minor' | 'significant' | 'major' = 'none';

  for (const market of markets) {
    const marketPredictions: PredictionSummary[] = [];

    // Her modelin bu market için tahminini topla
    if (predictions.claude) {
      const pred = getMarketPrediction(predictions.claude, market);
      if (pred) {
        marketPredictions.push({
          model: 'claude',
          ...pred
        });
      }
    }

    if (predictions.gpt4) {
      const pred = getMarketPrediction(predictions.gpt4, market);
      if (pred) {
        marketPredictions.push({
          model: 'gpt4',
          ...pred
        });
      }
    }

    if (predictions.gemini) {
      const pred = getMarketPrediction(predictions.gemini, market);
      if (pred) {
        marketPredictions.push({
          model: 'gemini',
          ...pred
        });
      }
    }

    if (predictions.perplexity) {
      const pred = getMarketPrediction(predictions.perplexity, market);
      if (pred) {
        marketPredictions.push({
          model: 'perplexity',
          ...pred
        });
      }
    }

    const analysis = analyzeMarketConflict(market, marketPredictions);

    if (analysis.hasConflict) {
      hasAnyConflict = true;
      conflicts.push({
        market,
        predictions: analysis.predictions.map(p => ({
          model: p.model,
          prediction: p.prediction,
          confidence: p.confidence
        })),
        confidenceGap: analysis.confidenceGap,
        variance: analysis.variance
      });

      // En yüksek conflict level'ı güncelle
      const levelOrder = { none: 0, minor: 1, significant: 2, major: 3 };
      if (levelOrder[analysis.conflictLevel] > levelOrder[maxConflictLevel]) {
        maxConflictLevel = analysis.conflictLevel;
      }
    }
  }

  // Debate tetikleme kararı
  let triggerDebate = false;
  let debateReason: string | undefined;

  if (maxConflictLevel === 'major') {
    triggerDebate = true;
    debateReason = 'Major conflict detected with high confidence gap';
  } else if (maxConflictLevel === 'significant' && CONFLICT_CONFIG.TRIGGER_DEBATE_ON_SPLIT_VOTE) {
    // Split vote kontrolü (2-2 veya benzeri)
    const hasSplitVote = conflicts.some(c => {
      const predCounts: Record<string, number> = {};
      for (const p of c.predictions) {
        const norm = normalizePrediction(p.prediction, c.market);
        predCounts[norm] = (predCounts[norm] || 0) + 1;
      }
      const counts = Object.values(predCounts);
      return counts.length === 2 && Math.abs(counts[0] - counts[1]) <= 1;
    });
    
    if (hasSplitVote) {
      triggerDebate = true;
      debateReason = 'Split vote detected between AI models';
    }
  }

  return {
    hasConflict: hasAnyConflict,
    conflictLevel: maxConflictLevel,
    conflicts,
    triggerDebate,
    debateReason
  };
}

/**
 * AI prediction'dan belirli bir market için tahmin çıkarır
 */
function getMarketPrediction(
  prediction: AIPrediction,
  market: BettingMarket
): { prediction: string; confidence: number; reasoning: string; keyFactors: string[] } | null {
  switch (market) {
    case 'MATCH_RESULT':
      return prediction.predictions.matchResult ? {
        prediction: prediction.predictions.matchResult.prediction,
        confidence: prediction.predictions.matchResult.confidence,
        reasoning: prediction.predictions.matchResult.reasoning,
        keyFactors: prediction.predictions.matchResult.keyFactors
      } : null;
      
    case 'OVER_UNDER_25':
      return prediction.predictions.overUnder25 ? {
        prediction: prediction.predictions.overUnder25.prediction,
        confidence: prediction.predictions.overUnder25.confidence,
        reasoning: prediction.predictions.overUnder25.reasoning,
        keyFactors: prediction.predictions.overUnder25.keyFactors
      } : null;
      
    case 'BTTS':
      return prediction.predictions.btts ? {
        prediction: prediction.predictions.btts.prediction,
        confidence: prediction.predictions.btts.confidence,
        reasoning: prediction.predictions.btts.reasoning,
        keyFactors: prediction.predictions.btts.keyFactors
      } : null;
      
    default:
      return null;
  }
}

// =========================
// DEBATE PROTOCOL
// =========================

/**
 * Claude'u arbitratör olarak kullanarak debate yürütür
 */
export async function runDebate(input: DebateInput): Promise<DebateResult | null> {
  console.log(`🗣️ Starting debate for ${input.market}...`);
  const startTime = Date.now();

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found for debate');
    return null;
  }

  // Debate prompt oluştur
  const prompt = buildDebatePrompt(input);

  try {
    const response = await fetch(API_ENDPOINTS.ANTHROPIC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL_VERSIONS.claude,
        max_tokens: 2000,
        temperature: 0.2, // Düşük temperature = daha analitik karar
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      console.error(`❌ Debate API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      console.error('❌ No content in debate response');
      return null;
    }

    // Parse debate result
    const result = parseDebateResponse(content, input, startTime);
    
    if (result) {
      console.log(`✅ Debate resolved: ${result.resolution.finalPrediction} (${result.resolution.finalConfidence}%)`);
    }

    return result;

  } catch (error) {
    console.error('❌ Debate error:', error);
    return null;
  }
}

/**
 * Debate prompt'u oluşturur
 */
function buildDebatePrompt(input: DebateInput): string {
  const { matchInfo, market, predictions, dataQuality } = input;

  const modelNames: Record<AIModel, string> = {
    claude: 'Claude (Tactical Analyst)',
    gpt4: 'GPT-4 (Statistical Engine)',
    gemini: 'Gemini (Pattern Hunter)',
    perplexity: 'Perplexity (Context Scout)'
  };

  const predictionsText = predictions.map(p => `
📊 ${modelNames[p.model]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Prediction: ${p.prediction}
Confidence: ${p.confidence}%
Reasoning: ${p.reasoning}
Key Factors: ${p.keyFactors.join(', ')}
`).join('\n');

  return `
You are the SUPREME ARBITRATOR in a multi-AI football prediction system.

═══════════════════════════════════════════════════════════════════════════════
🏆 ARBITRATION REQUEST
═══════════════════════════════════════════════════════════════════════════════

MATCH: ${matchInfo.homeTeam} vs ${matchInfo.awayTeam}
LEAGUE: ${matchInfo.league}
MARKET: ${market}

═══════════════════════════════════════════════════════════════════════════════
📊 CONFLICTING PREDICTIONS FROM AI MODELS
═══════════════════════════════════════════════════════════════════════════════

${predictionsText}

═══════════════════════════════════════════════════════════════════════════════
📈 DATA QUALITY ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

Overall Quality: ${dataQuality.overall}/100
Form Data: ${dataQuality.formData}/100
H2H Data: ${dataQuality.h2hData}/100
Odds Data: ${dataQuality.oddsData}/100
News Data: ${dataQuality.newsData}/100

Flags:
- Rich Form Data: ${dataQuality.flags.hasRichFormData ? 'YES' : 'NO'}
- H2H History: ${dataQuality.flags.hasH2HHistory ? 'YES' : 'NO'}
- Odds Movement: ${dataQuality.flags.hasOddsMovement ? 'YES' : 'NO'}
- Recent News: ${dataQuality.flags.hasRecentNews ? 'YES' : 'NO'}
- Significant Absences: ${dataQuality.flags.significantAbsences ? 'YES' : 'NO'}

═══════════════════════════════════════════════════════════════════════════════
🎯 YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

Analyze ALL perspectives and determine which prediction has the STRONGEST evidence.

Consider:
1. Which arguments are backed by the most reliable data?
2. Which model's expertise is most relevant for this specific market?
3. Are there any arguments that should be dismissed due to weak evidence?
4. How does data quality affect each model's reliability?

RULES:
- You MUST pick one prediction as the final answer
- You MUST explain which arguments won and which were dismissed
- You MUST suggest weight adjustments for future predictions
- Confidence should be between 50-90% (be realistic, not overconfident)

═══════════════════════════════════════════════════════════════════════════════
📝 RESPOND IN THIS EXACT JSON FORMAT:
═══════════════════════════════════════════════════════════════════════════════

{
  "finalPrediction": "Over 2.5" or "Under 2.5" or "Home Win" etc.,
  "finalConfidence": 65,
  "reasoning": "Detailed explanation of why this prediction wins the debate",
  "winningArguments": ["Argument 1 from winning side", "Argument 2"],
  "dismissedArguments": ["Argument that was weak or unsupported"],
  "weightAdjustments": [
    { "model": "claude", "adjustment": 0.05, "reason": "Strong tactical insight" },
    { "model": "gpt4", "adjustment": -0.03, "reason": "Statistical model less relevant here" }
  ],
  "arbitratorNotes": "Any additional observations"
}

Return ONLY the JSON object, no markdown or explanation.
`;
}

/**
 * Debate response'unu parse eder
 */
function parseDebateResponse(
  content: string,
  input: DebateInput,
  startTime: number
): DebateResult | null {
  try {
    // JSON çıkar
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in debate response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      market: input.market,
      arbitrator: 'claude',
      originalConflict: {
        predictions: input.predictions.map(p => ({
          model: p.model,
          prediction: p.prediction
        })),
        confidenceGap: Math.max(...input.predictions.map(p => p.confidence)) - 
                       Math.min(...input.predictions.map(p => p.confidence))
      },
      resolution: {
        finalPrediction: parsed.finalPrediction,
        finalConfidence: Math.min(90, Math.max(50, parsed.finalConfidence)),
        reasoning: parsed.reasoning,
        weightAdjustments: (parsed.weightAdjustments || []).map((wa: any) => ({
          model: wa.model as AIModel,
          adjustment: wa.adjustment
        })),
        winningArguments: parsed.winningArguments || [],
        dismissedArguments: parsed.dismissedArguments || []
      },
      debateTimestamp: new Date().toISOString(),
      debateDuration: Date.now() - startTime
    };

  } catch (error) {
    console.error('❌ Debate response parse error:', error);
    return null;
  }
}

// =========================
// BATCH DEBATE
// =========================

/**
 * Birden fazla market için debate yürütür
 */
export async function runBatchDebates(
  conflicts: ConflictAnalysis['conflicts'],
  predictions: {
    claude?: AIPrediction;
    gpt4?: AIPrediction;
    gemini?: AIPrediction;
    perplexity?: AIPrediction;
  },
  matchInfo: DebateInput['matchInfo'],
  dataQuality: DataQualityScore
): Promise<DebateResult[]> {
  const results: DebateResult[] = [];

  for (const conflict of conflicts) {
    if (conflict.confidenceGap < CONFLICT_CONFIG.SIGNIFICANT_CONFLICT_THRESHOLD) {
      // Minor conflict - debate gerekmez
      continue;
    }

    // Debate input oluştur
    const debateInput: DebateInput = {
      matchInfo,
      market: conflict.market,
      predictions: conflict.predictions.map(p => {
        const fullPred = predictions[p.model];
        const marketPred = fullPred ? getMarketPrediction(fullPred, conflict.market) : null;
        
        return {
          model: p.model,
          prediction: p.prediction,
          confidence: p.confidence,
          reasoning: marketPred?.reasoning || 'No reasoning provided',
          keyFactors: marketPred?.keyFactors || []
        };
      }),
      dataQuality
    };

    const result = await runDebate(debateInput);
    if (result) {
      results.push(result);
    }

    // Rate limiting - API calls arasında kısa bekleme
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

// =========================
// EXPORTS
// =========================

export {
  analyzeMarketConflict,
  normalizePrediction,
  getMarketPrediction,
  buildDebatePrompt
};

