// ============================================================================
// QUAD-BRAIN AI ENSEMBLE SYSTEM - MAIN ENGINE
// Orchestrator for 4 AI Model Consensus Architecture
// ============================================================================

import {
  AIModel,
  AIPrediction,
  BettingMarket,
  QuadBrainResult,
  EnhancedMatchData,
  DataQualityScore,
  DynamicWeight,
  ConsensusResult,
  MarketPrediction
} from './types';

import {
  AI_MODEL_CONFIGS,
  MARKET_SPECIALISTS,
  API_ENDPOINTS,
  MODEL_VERSIONS,
  CONFIDENCE_THRESHOLDS,
  getDefaultWeights
} from './config';

import { detectConflicts, runBatchDebates } from './debate';
import { assessDataQuality, calculateDynamicWeights, applyWeights, formatWeightsSummary } from './weighting';
import { fetchNewsContext } from './news';
import { recordPrediction, getAllModelPerformance } from './tracking';

// =========================
// AI MODEL CALLERS
// =========================

/**
 * Claude Tactical Analysis
 */
async function runClaudeTactical(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildTacticalPrompt(matchData, language);

  try {
    const response = await fetch(API_ENDPOINTS.ANTHROPIC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL_VERSIONS.claude,
        max_tokens: AI_MODEL_CONFIGS.claude.maxTokens,
        temperature: AI_MODEL_CONFIGS.claude.temperature,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.content?.[0]?.text;

    return parseAIPrediction(content, 'claude', startTime);
  } catch (error) {
    console.error('❌ Claude error:', error);
    return null;
  }
}

/**
 * GPT-4 Statistical Analysis
 */
async function runGPT4Statistical(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildStatisticalPrompt(matchData, language);

  try {
    const response = await fetch(API_ENDPOINTS.OPENAI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL_VERSIONS.gpt4,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: AI_MODEL_CONFIGS.gpt4.maxTokens,
        temperature: AI_MODEL_CONFIGS.gpt4.temperature
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return parseAIPrediction(content, 'gpt4', startTime);
  } catch (error) {
    console.error('❌ GPT-4 error:', error);
    return null;
  }
}

/**
 * Gemini Pattern Analysis
 */
async function runGeminiPattern(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildPatternPrompt(matchData, language);

  try {
    const response = await fetch(
      `${API_ENDPOINTS.GEMINI}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: AI_MODEL_CONFIGS.gemini.maxTokens,
            temperature: AI_MODEL_CONFIGS.gemini.temperature
          }
        })
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return parseAIPrediction(content, 'gemini', startTime);
  } catch (error) {
    console.error('❌ Gemini error:', error);
    return null;
  }
}

/**
 * Perplexity Contextual Analysis
 */
async function runPerplexityContextual(
  matchData: EnhancedMatchData,
  language: 'tr' | 'en' | 'de'
): Promise<AIPrediction | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  const startTime = Date.now();
  const prompt = buildContextualPrompt(matchData, language);

  try {
    const response = await fetch(API_ENDPOINTS.PERPLEXITY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL_VERSIONS.perplexity,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: AI_MODEL_CONFIGS.perplexity.maxTokens,
        temperature: AI_MODEL_CONFIGS.perplexity.temperature
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return parseAIPrediction(content, 'perplexity', startTime);
  } catch (error) {
    console.error('❌ Perplexity error:', error);
    return null;
  }
}

// =========================
// PROMPT BUILDERS
// =========================

function buildTacticalPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h, newsContext } = matchData;
  
  return `You are CLAUDE - THE TACTICAL ANALYST in a multi-AI football prediction system.

YOUR UNIQUE ROLE: Analyze team momentum, playing styles, psychological factors, and tactical matchups.

═══════════════════════════════════════════════════════════════════════════════
MATCH: ${homeTeam} vs ${awayTeam}
LEAGUE: ${matchData.league}
═══════════════════════════════════════════════════════════════════════════════

🏠 ${homeTeam.toUpperCase()} - TACTICAL PROFILE
• Form: ${homeForm?.form || 'N/A'} | Points: ${homeForm?.points || 0}/15
• Goals: ${homeForm?.avgGoals || 'N/A'} scored, ${homeForm?.avgConceded || 'N/A'} conceded per game
• Venue Form: ${homeForm?.venueForm || homeForm?.form || 'N/A'}
• Over 2.5: ${homeForm?.over25Percentage || 'N/A'}% | BTTS: ${homeForm?.bttsPercentage || 'N/A'}%
${newsContext?.homeTeam?.injuries?.length ? `• KEY INJURIES: ${newsContext.homeTeam.injuries.map(i => i.player).join(', ')}` : ''}

🚌 ${awayTeam.toUpperCase()} - TACTICAL PROFILE
• Form: ${awayForm?.form || 'N/A'} | Points: ${awayForm?.points || 0}/15
• Goals: ${awayForm?.avgGoals || 'N/A'} scored, ${awayForm?.avgConceded || 'N/A'} conceded per game
• Venue Form: ${awayForm?.venueForm || awayForm?.form || 'N/A'}
• Over 2.5: ${awayForm?.over25Percentage || 'N/A'}% | BTTS: ${awayForm?.bttsPercentage || 'N/A'}%
${newsContext?.awayTeam?.injuries?.length ? `• KEY INJURIES: ${newsContext.awayTeam.injuries.map(i => i.player).join(', ')}` : ''}

🔄 H2H (${h2h?.totalMatches || 0} matches)
• ${homeTeam}: ${h2h?.homeWins || 0}W | Draws: ${h2h?.draws || 0} | ${awayTeam}: ${h2h?.awayWins || 0}W
• H2H Avg Goals: ${h2h?.avgGoals || 'N/A'} | Over 2.5: ${h2h?.over25Percentage || 'N/A'}%

FOCUS ON:
1. Momentum and form trajectory (who's improving/declining?)
2. Tactical style clash (attacking vs defensive, high press vs deep block)
3. Psychological edge (confidence, pressure situations)
4. Home advantage strength
5. First half vs second half scoring patterns
6. Goal timing (early goals, late drama)

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "...", "keyFactors": ["factor1", "factor2"] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "overUnder15": { "prediction": "Over 1.5/Under 1.5", "confidence": 50-90, "reasoning": "..." },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "firstHalfGoals": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "..." },
    "htft": { "prediction": "1/1, X/1, 2/1, 1/X, X/X, 2/X, 1/2, X/2, 2/2", "confidence": 30-70, "reasoning": "..." }
  },
  "specializedInsights": {
    "momentum": { "home": 1-10, "away": 1-10, "trend": "rising/stable/falling" },
    "tacticalAdvantage": "home/away/neutral",
    "psychologicalEdge": "Brief description of who has the mental edge",
    "goalTiming": "early_goals/late_drama/spread_out"
  },
  "bestBet": { "market": "Market name", "selection": "Selection", "confidence": 50-90, "reasoning": "Why this is the strongest bet" },
  "overallAnalysis": "3-4 sentence tactical summary"
}`;
}

function buildStatisticalPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h, odds } = matchData;
  
  // xG hesaplama
  const homeGoals = parseFloat(homeForm?.avgGoals || '1.2');
  const awayGoals = parseFloat(awayForm?.avgGoals || '1.0');
  const homeConceded = parseFloat(homeForm?.avgConceded || '1.0');
  const awayConceded = parseFloat(awayForm?.avgConceded || '1.2');
  
  const homeXG = ((homeGoals + awayConceded) / 2 * 1.1).toFixed(2);
  const awayXG = ((awayGoals + homeConceded) / 2 * 0.9).toFixed(2);
  const totalXG = (parseFloat(homeXG) + parseFloat(awayXG)).toFixed(2);

  return `You are GPT-4 - THE STATISTICAL ENGINE in a multi-AI football prediction system.

YOUR UNIQUE ROLE: Pure mathematical analysis - xG, Poisson distribution, odds value calculation.

═══════════════════════════════════════════════════════════════════════════════
MATCH: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════════════════════════

📊 EXPECTED GOALS (xG) CALCULATION
• ${homeTeam} xG: ${homeXG} (avg scored: ${homeGoals}, opponent conceded: ${awayConceded})
• ${awayTeam} xG: ${awayXG} (avg scored: ${awayGoals}, opponent conceded: ${homeConceded})
• TOTAL xG: ${totalXG}

📈 RAW STATISTICS
${homeTeam}:
• Over 2.5: ${homeForm?.over25Percentage || '50'}%
• BTTS: ${homeForm?.bttsPercentage || '50'}%
• Clean Sheet: ${homeForm?.cleanSheetPercentage || '20'}%

${awayTeam}:
• Over 2.5: ${awayForm?.over25Percentage || '50'}%
• BTTS: ${awayForm?.bttsPercentage || '50'}%
• Clean Sheet: ${awayForm?.cleanSheetPercentage || '20'}%

H2H Statistics (${h2h?.totalMatches || 0} matches):
• Avg Goals: ${h2h?.avgGoals || 'N/A'}
• Over 2.5: ${h2h?.over25Percentage || 'N/A'}%
• BTTS: ${h2h?.bttsPercentage || 'N/A'}%

💰 ODDS DATA
• Match Winner: ${odds?.matchWinner?.home || 'N/A'} / ${odds?.matchWinner?.draw || 'N/A'} / ${odds?.matchWinner?.away || 'N/A'}
• Over 2.5: ${odds?.overUnder?.['2.5']?.over || 'N/A'} | Under 2.5: ${odds?.overUnder?.['2.5']?.under || 'N/A'}
• BTTS Yes: ${odds?.btts?.yes || 'N/A'} | No: ${odds?.btts?.no || 'N/A'}

FOCUS ON:
1. xG analysis - expected vs actual goals performance
2. Poisson probability calculations for ALL markets
3. Value bet identification (edge > 5%)
4. Back EVERY claim with a NUMBER
5. First half expected goals (typically 40-45% of match)
6. Team-specific goal probabilities

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "overUnder15": { "prediction": "Over 1.5/Under 1.5", "confidence": 50-90, "reasoning": "..." },
    "overUnder35": { "prediction": "Over 3.5/Under 3.5", "confidence": 50-90, "reasoning": "..." },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "firstHalfOver05": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "..." },
    "homeTeamOver05": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "..." },
    "awayTeamOver05": { "prediction": "Over 0.5/Under 0.5", "confidence": 50-90, "reasoning": "..." }
  },
  "specializedInsights": {
    "xgPrediction": { "homeXG": ${homeXG}, "awayXG": ${awayXG}, "totalXG": ${totalXG} },
    "poissonScores": [{ "score": "1-1", "probability": 12.5 }, { "score": "2-1", "probability": 10.2 }, { "score": "1-0", "probability": 8.5 }],
    "valueBets": [{ "market": "Over 2.5", "selection": "Over", "fairOdds": 1.85, "edge": 5.2 }],
    "goalProbabilities": { "0goals": 8, "1goal": 18, "2goals": 28, "3goals": 24, "4plus": 22 }
  },
  "bestBet": { "market": "Market name", "selection": "Selection", "confidence": 50-90, "reasoning": "Statistical edge explanation with numbers" },
  "overallAnalysis": "3-4 sentence statistical summary with numbers"
}`;
}

function buildPatternPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, homeForm, awayForm, h2h } = matchData;

  return `You are GEMINI - THE PATTERN HUNTER in a multi-AI football prediction system.

YOUR UNIQUE ROLE: Find patterns in H2H history, seasonal trends, streaks, and anomalies.

═══════════════════════════════════════════════════════════════════════════════
MATCH: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════════════════════════

🔄 H2H HISTORICAL PATTERNS (${h2h?.totalMatches || 0} matches)
• ${homeTeam} wins: ${h2h?.homeWins || 0}
• Draws: ${h2h?.draws || 0}
• ${awayTeam} wins: ${h2h?.awayWins || 0}
• H2H Dominance: ${(h2h?.homeWins || 0) > (h2h?.awayWins || 0) ? homeTeam : (h2h?.awayWins || 0) > (h2h?.homeWins || 0) ? awayTeam : 'Balanced'}
• Avg Goals in H2H: ${h2h?.avgGoals || 'N/A'}
• H2H Over 2.5: ${h2h?.over25Percentage || 'N/A'}%
• H2H BTTS: ${h2h?.bttsPercentage || 'N/A'}%

📈 STREAK ANALYSIS
${homeTeam}:
• Current Form: ${homeForm?.form || 'N/A'}
• Win Streak: ${(homeForm?.form || '').match(/^W+/)?.[0]?.length || 0}
• Loss Streak: ${(homeForm?.form || '').match(/^L+/)?.[0]?.length || 0}
• Record: ${homeForm?.record || 'N/A'}

${awayTeam}:
• Current Form: ${awayForm?.form || 'N/A'}
• Win Streak: ${(awayForm?.form || '').match(/^W+/)?.[0]?.length || 0}
• Loss Streak: ${(awayForm?.form || '').match(/^L+/)?.[0]?.length || 0}
• Record: ${awayForm?.record || 'N/A'}

FOCUS ON:
1. H2H patterns - who historically dominates?
2. Streak analysis - regression to mean?
3. Recurring themes in this matchup (always BTTS? usually low scoring?)
4. Any anomalies or pattern breaks
5. First half patterns in H2H
6. Common scorelines in this fixture

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "overUnder15": { "prediction": "Over 1.5/Under 1.5", "confidence": 50-90, "reasoning": "..." },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "correctScore": { "prediction": "1-1 or 2-1 or etc", "confidence": 20-50, "reasoning": "Based on H2H patterns" },
    "doubleChance": { "prediction": "1X/X2/12", "confidence": 60-85, "reasoning": "Safer bet option" }
  },
  "specializedInsights": {
    "h2hPattern": "Description of H2H pattern",
    "streakAnalysis": "Who's on a hot/cold streak",
    "regressionRisk": "Is regression to mean likely?",
    "anomalyDetected": false,
    "commonScorelines": ["1-1", "2-1", "1-0"]
  },
  "bestBet": { "market": "Market name", "selection": "Selection", "confidence": 50-90, "reasoning": "Pattern-based recommendation" },
  "overallAnalysis": "3-4 sentence pattern analysis summary"
}`;
}

function buildContextualPrompt(matchData: EnhancedMatchData, language: 'tr' | 'en' | 'de'): string {
  const { homeTeam, awayTeam, newsContext } = matchData;

  const homeInjuries = newsContext?.homeTeam?.injuries?.map(i => `${i.player} (${i.status})`).join(', ') || 'No confirmed injuries';
  const awayInjuries = newsContext?.awayTeam?.injuries?.map(i => `${i.player} (${i.status})`).join(', ') || 'No confirmed injuries';
  const homeNews = newsContext?.homeTeam?.news?.map(n => `- ${n.headline}`).join('\n') || 'No recent news';
  const awayNews = newsContext?.awayTeam?.news?.map(n => `- ${n.headline}`).join('\n') || 'No recent news';

  return `You are PERPLEXITY - THE CONTEXT SCOUT in a multi-AI football prediction system.

YOUR UNIQUE ROLE: Analyze news, injuries, external factors that statistics can't capture.

═══════════════════════════════════════════════════════════════════════════════
MATCH: ${homeTeam} vs ${awayTeam}
═══════════════════════════════════════════════════════════════════════════════

🏥 INJURY & SUSPENSION REPORT

${homeTeam}:
${homeInjuries}

${awayTeam}:
${awayInjuries}

📰 RECENT NEWS

${homeTeam}:
${homeNews}

${awayTeam}:
${awayNews}

${newsContext?.matchPreview?.expertPredictions?.length ? `
🎯 EXPERT PREDICTIONS
${newsContext.matchPreview.expertPredictions.join('\n')}
` : ''}

${newsContext?.matchPreview?.weatherConditions ? `
🌤️ WEATHER CONDITIONS
Temperature: ${newsContext.matchPreview.weatherConditions.temperature}°C
Condition: ${newsContext.matchPreview.weatherConditions.condition}
Impact: ${newsContext.matchPreview.weatherConditions.impact}
` : ''}

FOCUS ON:
1. Impact of injuries on team strength (especially key players)
2. Team morale from recent news
3. External factors (weather, venue, travel)
4. Any game-changing context
5. Expert predictions and consensus
6. Motivation levels (title race, relegation, cup importance)

RETURN ONLY THIS JSON FORMAT:
{
  "predictions": {
    "matchResult": { "prediction": "Home Win/Draw/Away Win", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "overUnder25": { "prediction": "Over 2.5/Under 2.5", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "btts": { "prediction": "Yes/No", "confidence": 50-90, "reasoning": "...", "keyFactors": [] },
    "cleanSheet": { "prediction": "Home/Away/Neither", "confidence": 50-90, "reasoning": "Based on injuries and form" },
    "cornersBet": { "prediction": "Over 9.5/Under 9.5", "confidence": 50-80, "reasoning": "Based on playing styles" }
  },
  "specializedInsights": {
    "recentNews": ["Key news item 1", "Key news item 2"],
    "confirmedInjuries": ["Player 1", "Player 2"],
    "expertConsensus": "What do experts generally predict?",
    "lastMinuteFactors": ["Any last minute factors"],
    "motivationLevel": { "home": "high/normal/low", "away": "high/normal/low" }
  },
  "bestBet": { "market": "Market name", "selection": "Selection", "confidence": 50-90, "reasoning": "Context-based recommendation" },
  "overallAnalysis": "3-4 sentence contextual summary"
}`;
}

// =========================
// RESPONSE PARSER
// =========================

function parseAIPrediction(
  content: string | null,
  model: AIModel,
  startTime: number
): AIPrediction | null {
  if (!content) return null;

  try {
    // JSON çıkar
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Confidence sınırları
    const clampConfidence = (c: number) => Math.min(90, Math.max(50, c || 60));

    const predictions = {
      matchResult: {
        prediction: parsed.predictions?.matchResult?.prediction || 'Draw',
        confidence: clampConfidence(parsed.predictions?.matchResult?.confidence),
        reasoning: parsed.predictions?.matchResult?.reasoning || '',
        keyFactors: parsed.predictions?.matchResult?.keyFactors || [],
        riskFactors: []
      },
      overUnder25: {
        prediction: parsed.predictions?.overUnder25?.prediction || 'Under 2.5',
        confidence: clampConfidence(parsed.predictions?.overUnder25?.confidence),
        reasoning: parsed.predictions?.overUnder25?.reasoning || '',
        keyFactors: parsed.predictions?.overUnder25?.keyFactors || [],
        riskFactors: []
      },
      btts: {
        prediction: parsed.predictions?.btts?.prediction || 'No',
        confidence: clampConfidence(parsed.predictions?.btts?.confidence),
        reasoning: parsed.predictions?.btts?.reasoning || '',
        keyFactors: parsed.predictions?.btts?.keyFactors || [],
        riskFactors: []
      }
    };

    const avgConfidence = (
      predictions.matchResult.confidence +
      predictions.overUnder25.confidence +
      predictions.btts.confidence
    ) / 3;

    return {
      model,
      role: AI_MODEL_CONFIGS[model].role,
      timestamp: new Date().toISOString(),
      predictions,
      specializedInsights: parsed.specializedInsights || {},
      overallAnalysis: parsed.overallAnalysis || '',
      confidenceLevel: avgConfidence >= 75 ? 'high' : avgConfidence >= 65 ? 'medium' : 'low',
      responseTime: Date.now() - startTime,
      rawResponse: content
    };
  } catch (error) {
    console.error(`❌ Parse error for ${model}:`, error);
    return null;
  }
}

// =========================
// CONSENSUS CALCULATION
// =========================

function buildConsensus(
  market: BettingMarket,
  predictions: { claude?: AIPrediction; gpt4?: AIPrediction; gemini?: AIPrediction; perplexity?: AIPrediction },
  weights: DynamicWeight[]
): ConsensusResult {
  const votes: ConsensusResult['votes'] = [];
  
  const models: AIModel[] = ['claude', 'gpt4', 'gemini', 'perplexity'];
  
  for (const model of models) {
    const pred = predictions[model];
    if (!pred) continue;
    
    let marketPred: MarketPrediction | undefined;
    
    switch (market) {
      case 'MATCH_RESULT':
        marketPred = pred.predictions.matchResult;
        break;
      case 'OVER_UNDER_25':
        marketPred = pred.predictions.overUnder25;
        break;
      case 'BTTS':
        marketPred = pred.predictions.btts;
        break;
    }
    
    if (marketPred) {
      const weight = weights.find(w => w.model === model)?.finalWeight || 0.25;
      votes.push({
        model,
        prediction: marketPred.prediction,
        confidence: marketPred.confidence,
        weight
      });
    }
  }

  // Apply weighted voting
  const result = applyWeights(
    votes.map(v => ({ model: v.model, prediction: v.prediction, data: { confidence: v.confidence } })),
    weights
  );

  // Collect reasonings
  const reasonings: string[] = [];
  for (const vote of votes) {
    if (vote.prediction === result.prediction) {
      const pred = predictions[vote.model];
      const marketPred = market === 'MATCH_RESULT' ? pred?.predictions.matchResult :
                         market === 'OVER_UNDER_25' ? pred?.predictions.overUnder25 :
                         pred?.predictions.btts;
      if (marketPred?.reasoning) {
        reasonings.push(`[${AI_MODEL_CONFIGS[vote.model].displayName}] ${marketPred.reasoning}`);
      }
    }
  }

  return {
    market,
    prediction: result.prediction,
    confidence: result.confidence,
    votes,
    agreement: {
      unanimous: new Set(votes.map(v => v.prediction)).size === 1,
      majoritySize: votes.filter(v => v.prediction === result.prediction).length,
      totalModels: votes.length,
      weightedAgreement: result.weightedAgreement
    },
    reasoning: reasonings
  };
}

// =========================
// MAIN ENGINE
// =========================

/**
 * Ana Quad-Brain analiz fonksiyonu
 */
export async function runQuadBrainAnalysis(
  matchData: EnhancedMatchData,
  options: {
    language?: 'tr' | 'en' | 'de';
    fetchNews?: boolean;
    trackPerformance?: boolean;
  } = {}
): Promise<QuadBrainResult> {
  const language = options.language || 'en';
  const startTime = Date.now();
  
  console.log('\n' + '═'.repeat(60));
  console.log(`🧠 QUAD-BRAIN ANALYSIS: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
  console.log('═'.repeat(60));

  const timing: QuadBrainResult['timing'] = {
    dataFetch: 0,
    aiCalls: 0,
    conflictDetection: 0,
    consensus: 0,
    total: 0
  };

  // 1. NEWS CONTEXT (opsiyonel)
  const newsFetchStart = Date.now();
  if (options.fetchNews !== false && !matchData.newsContext) {
    try {
      matchData.newsContext = await fetchNewsContext(matchData.homeTeam, matchData.awayTeam);
    } catch (error) {
      console.warn('⚠️ News fetch failed, continuing without news context');
    }
  }
  timing.dataFetch = Date.now() - newsFetchStart;

  // 2. DATA QUALITY ASSESSMENT
  const dataQuality = assessDataQuality(matchData);
  console.log(`\n📊 Data Quality: ${dataQuality.overall}/100`);

  // 3. HISTORICAL PERFORMANCE (for weight adjustment)
  let modelPerformance: Record<AIModel, any> | null = null;
  if (options.trackPerformance !== false) {
    try {
      modelPerformance = await getAllModelPerformance('30d');
    } catch (error) {
      console.warn('⚠️ Could not fetch model performance');
    }
  }

  // 4. PARALLEL AI CALLS
  console.log('\n🤖 Running 4 AI models in parallel...');
  const aiStart = Date.now();

  const [claudeResult, gpt4Result, geminiResult, perplexityResult] = await Promise.all([
    runClaudeTactical(matchData, language),
    runGPT4Statistical(matchData, language),
    runGeminiPattern(matchData, language),
    runPerplexityContextual(matchData, language)
  ]);

  timing.aiCalls = Date.now() - aiStart;

  const predictions = {
    claude: claudeResult || undefined,
    gpt4: gpt4Result || undefined,
    gemini: geminiResult || undefined,
    perplexity: perplexityResult || undefined
  };

  const modelsUsed: AIModel[] = [];
  if (claudeResult) modelsUsed.push('claude');
  if (gpt4Result) modelsUsed.push('gpt4');
  if (geminiResult) modelsUsed.push('gemini');
  if (perplexityResult) modelsUsed.push('perplexity');

  console.log(`✅ ${modelsUsed.length}/4 AI models responded`);
  modelsUsed.forEach(m => {
    const pred = predictions[m];
    if (pred) {
      console.log(`   ${m}: ${pred.predictions.overUnder25.prediction} (${pred.predictions.overUnder25.confidence}%) - ${pred.responseTime}ms`);
    }
  });

  if (modelsUsed.length === 0) {
    return {
      success: false,
      matchInfo: {
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        fixtureId: matchData.fixtureId
      },
      dataQuality,
      individualPredictions: {},
      conflictAnalysis: { hasConflict: false, conflictLevel: 'none', conflicts: [], triggerDebate: false },
      debates: [],
      dynamicWeights: [],
      consensus: {} as any,
      bestBets: [],
      riskAssessment: { overall: 'extreme', factors: ['No AI responses'], warnings: ['All AI models failed'] },
      modelsUsed: [],
      totalModels: 0,
      timing,
      analyzedAt: new Date().toISOString(),
      version: '2.0'
    };
  }

  // 5. CONFLICT DETECTION
  const conflictStart = Date.now();
  const conflictAnalysis = detectConflicts(predictions);
  timing.conflictDetection = Date.now() - conflictStart;

  console.log(`\n🔍 Conflict Analysis: ${conflictAnalysis.conflictLevel}`);
  if (conflictAnalysis.triggerDebate) {
    console.log(`   ⚠️ Debate triggered: ${conflictAnalysis.debateReason}`);
  }

  // 6. DEBATES (if needed)
  let debates: QuadBrainResult['debates'] = [];
  if (conflictAnalysis.triggerDebate) {
    const debateStart = Date.now();
    debates = await runBatchDebates(
      conflictAnalysis.conflicts,
      predictions,
      {
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        fixtureId: matchData.fixtureId
      },
      dataQuality
    );
    timing.debate = Date.now() - debateStart;
    console.log(`   ✅ ${debates.length} debates resolved`);
  }

  // 7. DYNAMIC WEIGHTS
  const markets: BettingMarket[] = ['MATCH_RESULT', 'OVER_UNDER_25', 'BTTS'];
  const allWeights: DynamicWeight[] = [];

  // Use OVER_UNDER_25 weights as representative (or average across markets)
  const representativeWeights = calculateDynamicWeights('OVER_UNDER_25', dataQuality, modelPerformance || undefined);
  allWeights.push(...representativeWeights);

  console.log('\n' + formatWeightsSummary(representativeWeights));

  // 8. CONSENSUS CALCULATION
  const consensusStart = Date.now();
  const consensus: QuadBrainResult['consensus'] = {
    matchResult: buildConsensus('MATCH_RESULT', predictions, calculateDynamicWeights('MATCH_RESULT', dataQuality)),
    overUnder25: buildConsensus('OVER_UNDER_25', predictions, calculateDynamicWeights('OVER_UNDER_25', dataQuality)),
    btts: buildConsensus('BTTS', predictions, calculateDynamicWeights('BTTS', dataQuality))
  };

  // Apply debate results if any
  for (const debate of debates) {
    if (debate.market === 'MATCH_RESULT') {
      consensus.matchResult.prediction = debate.resolution.finalPrediction;
      consensus.matchResult.confidence = debate.resolution.finalConfidence;
      consensus.matchResult.debateResult = debate;
    } else if (debate.market === 'OVER_UNDER_25') {
      consensus.overUnder25.prediction = debate.resolution.finalPrediction;
      consensus.overUnder25.confidence = debate.resolution.finalConfidence;
      consensus.overUnder25.debateResult = debate;
    } else if (debate.market === 'BTTS') {
      consensus.btts.prediction = debate.resolution.finalPrediction;
      consensus.btts.confidence = debate.resolution.finalConfidence;
      consensus.btts.debateResult = debate;
    }
  }

  timing.consensus = Date.now() - consensusStart;

  // 9. BEST BETS RANKING
  const bestBets: QuadBrainResult['bestBets'] = [
    {
      rank: 1,
      market: 'OVER_UNDER_25' as BettingMarket,
      selection: consensus.overUnder25.prediction,
      confidence: consensus.overUnder25.confidence,
      weightedAgreement: consensus.overUnder25.agreement.weightedAgreement,
      consensusStrength: (consensus.overUnder25.agreement.weightedAgreement >= 70 ? 'strong' : 
                         consensus.overUnder25.agreement.weightedAgreement >= 50 ? 'moderate' : 'weak') as 'strong' | 'moderate' | 'weak',
      reasoning: consensus.overUnder25.reasoning[0] || '',
      valueBet: false
    },
    {
      rank: 2,
      market: 'MATCH_RESULT' as BettingMarket,
      selection: consensus.matchResult.prediction,
      confidence: consensus.matchResult.confidence,
      weightedAgreement: consensus.matchResult.agreement.weightedAgreement,
      consensusStrength: (consensus.matchResult.agreement.weightedAgreement >= 70 ? 'strong' : 
                         consensus.matchResult.agreement.weightedAgreement >= 50 ? 'moderate' : 'weak') as 'strong' | 'moderate' | 'weak',
      reasoning: consensus.matchResult.reasoning[0] || '',
      valueBet: false
    },
    {
      rank: 3,
      market: 'BTTS' as BettingMarket,
      selection: consensus.btts.prediction,
      confidence: consensus.btts.confidence,
      weightedAgreement: consensus.btts.agreement.weightedAgreement,
      consensusStrength: (consensus.btts.agreement.weightedAgreement >= 70 ? 'strong' : 
                         consensus.btts.agreement.weightedAgreement >= 50 ? 'moderate' : 'weak') as 'strong' | 'moderate' | 'weak',
      reasoning: consensus.btts.reasoning[0] || '',
      valueBet: false
    }
  ].sort((a, b) => (b.weightedAgreement + b.confidence) - (a.weightedAgreement + a.confidence));

  // Update ranks
  bestBets.forEach((bet, i) => bet.rank = i + 1);

  // 10. RISK ASSESSMENT
  const avgConfidence = (
    consensus.matchResult.confidence +
    consensus.overUnder25.confidence +
    consensus.btts.confidence
  ) / 3;

  const avgAgreement = (
    consensus.matchResult.agreement.weightedAgreement +
    consensus.overUnder25.agreement.weightedAgreement +
    consensus.btts.agreement.weightedAgreement
  ) / 3;

  let overallRisk: QuadBrainResult['riskAssessment']['overall'] = 'medium';
  if (avgConfidence >= 70 && avgAgreement >= 60) overallRisk = 'low';
  else if (avgConfidence < 55 || avgAgreement < 40) overallRisk = 'high';

  const riskFactors: string[] = [];
  const warnings: string[] = [];

  if (dataQuality.overall < 50) {
    riskFactors.push('Low data quality');
    warnings.push('Predictions may be less reliable due to limited data');
  }
  if (conflictAnalysis.conflictLevel === 'major') {
    riskFactors.push('Major AI disagreement');
    warnings.push('AI models significantly disagree on predictions');
  }
  if (modelsUsed.length < 3) {
    riskFactors.push('Limited AI coverage');
    warnings.push(`Only ${modelsUsed.length}/4 AI models responded`);
  }

  timing.total = Date.now() - startTime;

  // 11. RECORD PREDICTION (if tracking enabled)
  if (options.trackPerformance !== false) {
    try {
      await recordPrediction({
        fixtureId: matchData.fixtureId,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        matchDate: matchData.matchDate || new Date().toISOString(),
        predictions: modelsUsed.flatMap(model => {
          const pred = predictions[model];
          if (!pred) return [];
          return [
            { model, market: 'MATCH_RESULT' as BettingMarket, prediction: pred.predictions.matchResult.prediction, confidence: pred.predictions.matchResult.confidence, weight: representativeWeights.find(w => w.model === model)?.finalWeight || 0.25 },
            { model, market: 'OVER_UNDER_25' as BettingMarket, prediction: pred.predictions.overUnder25.prediction, confidence: pred.predictions.overUnder25.confidence, weight: representativeWeights.find(w => w.model === model)?.finalWeight || 0.25 },
            { model, market: 'BTTS' as BettingMarket, prediction: pred.predictions.btts.prediction, confidence: pred.predictions.btts.confidence, weight: representativeWeights.find(w => w.model === model)?.finalWeight || 0.25 }
          ];
        }),
        consensus: [
          { market: 'MATCH_RESULT' as BettingMarket, prediction: consensus.matchResult.prediction, confidence: consensus.matchResult.confidence, hadDebate: !!consensus.matchResult.debateResult },
          { market: 'OVER_UNDER_25' as BettingMarket, prediction: consensus.overUnder25.prediction, confidence: consensus.overUnder25.confidence, hadDebate: !!consensus.overUnder25.debateResult },
          { market: 'BTTS' as BettingMarket, prediction: consensus.btts.prediction, confidence: consensus.btts.confidence, hadDebate: !!consensus.btts.debateResult }
        ]
      });
    } catch (error) {
      console.warn('⚠️ Could not record prediction');
    }
  }

  // 12. FINAL RESULT
  console.log('\n' + '═'.repeat(60));
  console.log(`✅ QUAD-BRAIN ANALYSIS COMPLETE (${timing.total}ms)`);
  console.log(`   Match Result: ${consensus.matchResult.prediction} (${consensus.matchResult.confidence}%)`);
  console.log(`   Over/Under: ${consensus.overUnder25.prediction} (${consensus.overUnder25.confidence}%)`);
  console.log(`   BTTS: ${consensus.btts.prediction} (${consensus.btts.confidence}%)`);
  console.log(`   Risk Level: ${overallRisk.toUpperCase()}`);
  console.log('═'.repeat(60) + '\n');

  return {
    success: true,
    matchInfo: {
      homeTeam: matchData.homeTeam,
      awayTeam: matchData.awayTeam,
      league: matchData.league,
      fixtureId: matchData.fixtureId,
      matchDate: matchData.matchDate
    },
    dataQuality,
    individualPredictions: predictions,
    conflictAnalysis,
    debates,
    dynamicWeights: allWeights,
    consensus,
    bestBets,
    riskAssessment: {
      overall: overallRisk,
      factors: riskFactors,
      warnings
    },
    modelsUsed,
    totalModels: modelsUsed.length,
    timing,
    analyzedAt: new Date().toISOString(),
    version: '2.0'
  };
}

// =========================
// EXPORTS
// =========================

export {
  runClaudeTactical,
  runGPT4Statistical,
  runGeminiPattern,
  runPerplexityContextual,
  buildTacticalPrompt,
  buildStatisticalPrompt,
  buildPatternPrompt,
  buildContextualPrompt,
  parseAIPrediction,
  buildConsensus
};

