// AI Brain Configuration
// Her AI modeli için özel ayarlar ve prompt templates

import { AIBrainConfig, AIModel, AIRole } from './types';

// ============================================
// AI MODEL CONFIGURATIONS
// ============================================

export const AI_CONFIGS: Record<AIModel, AIBrainConfig> = {
  claude: {
    model: 'claude',
    role: 'tactical',
    weight: 0.30,              // %30 ağırlık
    temperature: 0.3,          // Daha tutarlı, analitik
    maxTokens: 2000,
    specialization: `
      You are a TACTICAL FOOTBALL ANALYST specializing in:
      - Team momentum and form analysis
      - Tactical matchups and playing styles
      - Psychological factors (pressure, confidence)
      - Match importance and motivation
      
      Your analysis should focus on HOW teams play, not just numbers.
      Look for tactical advantages, style clashes, and momentum shifts.
    `
  },
  
  gpt4: {
    model: 'gpt4',
    role: 'statistical',
    weight: 0.30,              // %30 ağırlık
    temperature: 0.2,          // En düşük, pure math
    maxTokens: 2000,
    specialization: `
      You are a STATISTICAL ENGINE specializing in:
      - xG (Expected Goals) analysis
      - Poisson distribution predictions
      - Odds value calculation and edge finding
      - Historical statistical patterns
      
      Your analysis should be DATA-DRIVEN and MATHEMATICAL.
      Calculate probabilities, find value bets, identify statistical edges.
      Use numbers to support every claim.
    `
  },
  
  gemini: {
    model: 'gemini',
    role: 'pattern',
    weight: 0.25,              // %25 ağırlık
    temperature: 0.4,          // Biraz daha yaratıcı
    maxTokens: 2000,
    specialization: `
      You are a PATTERN RECOGNITION SPECIALIST focusing on:
      - Head-to-head historical patterns
      - Seasonal and time-based trends
      - League position dynamics
      - Streak analysis and regression to mean
      
      Your analysis should identify PATTERNS and TRENDS.
      Look for recurring themes, historical precedents, and cyclical behaviors.
      Find the patterns that others miss.
    `
  },
  
  perplexity: {
    model: 'perplexity',
    role: 'contextual',
    weight: 0.15,              // %15 ağırlık (news based)
    temperature: 0.5,          // En yüksek, güncel bilgi
    maxTokens: 1500,
    specialization: `
      You are a CONTEXTUAL ANALYST specializing in:
      - Injury and suspension impact analysis
      - Recent news and team morale
      - Weather and venue factors
      - Manager tactics and recent changes
      
      Your analysis should provide CONTEXT that numbers can't show.
      Find the news that could change everything.
      Identify hidden factors that affect match outcomes.
    `
  }
};

// ============================================
// ROLE-SPECIFIC PROMPT TEMPLATES
// ============================================

export const TACTICAL_PROMPT = (matchData: string) => `
You are the TACTICAL ANALYST in a multi-AI football prediction system.

YOUR UNIQUE PERSPECTIVE: Tactical matchups, momentum, and playing styles.

MATCH DATA:
${matchData}

ANALYSIS REQUIREMENTS:
1. **Momentum Analysis** (0-10 scale for each team)
   - Recent form trajectory (improving/stable/declining)
   - Confidence level based on recent results
   - Pressure situation (relegation battle, title race, mid-table)

2. **Tactical Matchup**
   - Compare playing styles (high press vs deep block, etc.)
   - Identify potential tactical advantages
   - Predict how formations might clash

3. **Match Importance Factor**
   - Rate the match importance for each team (1-10)
   - Consider motivation levels
   - Rest days and fixture congestion

IMPORTANT RULES:
- DO NOT just analyze statistics, focus on HOW teams play
- Consider psychological factors
- Your prediction should differ from pure stats if tactics suggest otherwise
- Be contrarian when tactical analysis supports it

OUTPUT FORMAT (JSON):
{
  "tacticalAnalysis": {
    "homeMomentum": number,
    "awayMomentum": number,
    "tacticalAdvantage": "home" | "away" | "neutral",
    "keyTacticalInsight": string,
    "styleClashPrediction": string
  },
  "prediction": {
    "matchResult": { "pick": "1" | "X" | "2", "confidence": number, "reasoning": string },
    "goals": { "over25": boolean, "confidence": number, "reasoning": string },
    "btts": { "prediction": boolean, "confidence": number, "reasoning": string }
  },
  "valuePlay": { "market": string, "reasoning": string } | null,
  "keyInsights": string[],
  "riskFactors": string[]
}
`;

export const STATISTICAL_PROMPT = (matchData: string) => `
You are the STATISTICAL ENGINE in a multi-AI football prediction system.

YOUR UNIQUE PERSPECTIVE: Pure numbers, probabilities, and value betting.

MATCH DATA:
${matchData}

ANALYSIS REQUIREMENTS:
1. **xG Analysis** (if available)
   - Compare expected goals vs actual
   - Identify over/under performers
   - Calculate expected match outcome

2. **Poisson Distribution**
   - Calculate goal probabilities for each team
   - Generate score probability matrix
   - Identify most likely scorelines

3. **Odds Value Analysis**
   - Convert odds to implied probabilities
   - Compare with your calculated probabilities
   - Identify value bets (edge > 5%)

4. **Statistical Trends**
   - Goals per game trends
   - Clean sheet probabilities
   - BTTS probability based on data

IMPORTANT RULES:
- Every claim MUST be backed by a number
- Calculate Kelly Criterion for value bets
- Be objective, ignore narrative and hype
- If no value exists, say so clearly

OUTPUT FORMAT (JSON):
{
  "statisticalAnalysis": {
    "homeExpectedGoals": number,
    "awayExpectedGoals": number,
    "poissonMostLikely": string,
    "over25Probability": number,
    "bttsProbability": number,
    "impliedProbabilities": { "home": number, "draw": number, "away": number }
  },
  "prediction": {
    "matchResult": { "pick": "1" | "X" | "2", "confidence": number, "reasoning": string },
    "goals": { "over25": boolean, "confidence": number, "reasoning": string },
    "btts": { "prediction": boolean, "confidence": number, "reasoning": string }
  },
  "valueBets": [
    { "market": string, "odds": number, "calculatedProb": number, "edge": number }
  ],
  "keyInsights": string[],
  "riskFactors": string[]
}
`;

export const PATTERN_PROMPT = (matchData: string) => `
You are the PATTERN HUNTER in a multi-AI football prediction system.

YOUR UNIQUE PERSPECTIVE: Historical patterns, trends, and cyclical behaviors.

MATCH DATA:
${matchData}

ANALYSIS REQUIREMENTS:
1. **Head-to-Head Patterns**
   - Historical dominance
   - Scoring patterns in H2H
   - Venue-specific trends

2. **Seasonal Patterns**
   - Month/week of season trends
   - Day of week impact
   - Time of match effects

3. **League Position Dynamics**
   - Top vs bottom patterns
   - Mid-table teams behavior
   - Relegation/title fight patterns

4. **Streak Analysis**
   - Current streak significance
   - Regression to mean probability
   - Pattern break indicators

IMPORTANT RULES:
- Focus on PATTERNS, not single data points
- Look for recurring themes across seasons
- Identify when patterns are likely to break
- Consider sample size for pattern validity

OUTPUT FORMAT (JSON):
{
  "patternAnalysis": {
    "h2hDominance": "home" | "away" | "balanced",
    "h2hPattern": string,
    "seasonalTrend": string,
    "streakAnalysis": string,
    "patternStrength": number
  },
  "prediction": {
    "matchResult": { "pick": "1" | "X" | "2", "confidence": number, "reasoning": string },
    "goals": { "over25": boolean, "confidence": number, "reasoning": string },
    "btts": { "prediction": boolean, "confidence": number, "reasoning": string }
  },
  "historicalInsight": {
    "pattern": string,
    "occurrenceRate": number,
    "lastOccurrence": string
  },
  "keyInsights": string[],
  "riskFactors": string[]
}
`;

export const CONTEXTUAL_PROMPT = (matchData: string) => `
You are the CONTEXTUAL ANALYST in a multi-AI football prediction system.

YOUR UNIQUE PERSPECTIVE: News, injuries, and factors beyond statistics.

MATCH DATA:
${matchData}

ANALYSIS REQUIREMENTS:
1. **Injury Impact**
   - Key player absences
   - Importance of missing players (1-10)
   - Replacement quality assessment

2. **Recent News Analysis**
   - Team morale indicators
   - Manager comments and pressure
   - Transfer rumors impact

3. **External Factors**
   - Weather conditions impact
   - Travel fatigue
   - Fan support/atmosphere

4. **Manager Dynamics**
   - Tactical changes recently
   - Manager vs manager history
   - New manager bounce/decline

IMPORTANT RULES:
- Focus on CONTEXT that stats can't capture
- Be skeptical of media narratives
- Quantify impact where possible
- Identify game-changing factors

OUTPUT FORMAT (JSON):
{
  "contextualAnalysis": {
    "injuryImpact": { "home": number, "away": number },
    "moraleAssessment": { "home": string, "away": string },
    "externalFactors": string[],
    "hiddenAdvantage": "home" | "away" | null
  },
  "prediction": {
    "matchResult": { "pick": "1" | "X" | "2", "confidence": number, "reasoning": string },
    "goals": { "over25": boolean, "confidence": number, "reasoning": string },
    "btts": { "prediction": boolean, "confidence": number, "reasoning": string }
  },
  "contextualWarnings": string[],
  "keyInsights": string[],
  "riskFactors": string[]
}
`;

// ============================================
// DATA PACKAGE GENERATORS
// ============================================

export function generateTacticalPackage(matchData: any): string {
  // Claude için taktik odaklı veri paketi
  return JSON.stringify({
    homeTeam: {
      name: matchData.homeTeam.name,
      form: matchData.homeTeam.form,
      momentum: calculateMomentum(matchData.homeTeam.lastMatches),
      lastMatches: matchData.homeTeam.lastMatches.slice(0, 5),
      tacticalStyle: inferTacticalStyle(matchData.homeTeam.stats)
    },
    awayTeam: {
      name: matchData.awayTeam.name,
      form: matchData.awayTeam.form,
      momentum: calculateMomentum(matchData.awayTeam.lastMatches),
      lastMatches: matchData.awayTeam.lastMatches.slice(0, 5),
      tacticalStyle: inferTacticalStyle(matchData.awayTeam.stats)
    },
    matchContext: {
      league: matchData.league.name,
      importance: matchData.importance || 5,
      datetime: matchData.datetime
    }
  }, null, 2);
}

export function generateStatisticalPackage(matchData: any): string {
  // GPT-4 için istatistik odaklı veri paketi
  return JSON.stringify({
    homeTeam: {
      name: matchData.homeTeam.name,
      stats: matchData.homeTeam.stats,
      avgGoals: matchData.homeTeam.stats.avgGoalsScored,
      avgConceded: matchData.homeTeam.stats.avgGoalsConceded,
      xG: matchData.homeTeam.stats.xG || null,
      xGA: matchData.homeTeam.stats.xGA || null
    },
    awayTeam: {
      name: matchData.awayTeam.name,
      stats: matchData.awayTeam.stats,
      avgGoals: matchData.awayTeam.stats.avgGoalsScored,
      avgConceded: matchData.awayTeam.stats.avgGoalsConceded,
      xG: matchData.awayTeam.stats.xG || null,
      xGA: matchData.awayTeam.stats.xGA || null
    },
    odds: matchData.odds,
    leagueAverages: {
      avgGoals: matchData.league.avgGoals,
      homeWinRate: matchData.league.homeWinRate,
      drawRate: matchData.league.drawRate,
      awayWinRate: matchData.league.awayWinRate
    }
  }, null, 2);
}

export function generatePatternPackage(matchData: any): string {
  // Gemini için pattern odaklı veri paketi
  return JSON.stringify({
    h2h: matchData.h2h || { totalMatches: 0 },
    homeTeam: {
      name: matchData.homeTeam.name,
      lastMatches: matchData.homeTeam.lastMatches.slice(0, 10),
      currentStreak: calculateStreak(matchData.homeTeam.form),
      seasonPosition: matchData.homeTeam.position || null
    },
    awayTeam: {
      name: matchData.awayTeam.name,
      lastMatches: matchData.awayTeam.lastMatches.slice(0, 10),
      currentStreak: calculateStreak(matchData.awayTeam.form),
      seasonPosition: matchData.awayTeam.position || null
    },
    seasonalContext: {
      month: new Date(matchData.datetime).getMonth() + 1,
      dayOfWeek: new Date(matchData.datetime).getDay(),
      leaguePhase: determineLeaguePhase(matchData)
    }
  }, null, 2);
}

export function generateContextualPackage(matchData: any): string {
  // Perplexity için context odaklı veri paketi
  return JSON.stringify({
    homeTeam: {
      name: matchData.homeTeam.name,
      injuries: matchData.injuries?.home || [],
      suspensions: matchData.suspensions?.home || [],
      manager: matchData.homeTeam.manager || 'Unknown',
      recentNews: matchData.news?.filter((n: any) => n.team === 'home') || []
    },
    awayTeam: {
      name: matchData.awayTeam.name,
      injuries: matchData.injuries?.away || [],
      suspensions: matchData.suspensions?.away || [],
      manager: matchData.awayTeam.manager || 'Unknown',
      recentNews: matchData.news?.filter((n: any) => n.team === 'away') || []
    },
    matchContext: {
      venue: matchData.venue || 'Unknown',
      weather: matchData.weather || null,
      datetime: matchData.datetime
    }
  }, null, 2);
}

// Helper functions
function calculateMomentum(lastMatches: any[]): number {
  if (!lastMatches || lastMatches.length === 0) return 0;
  
  const weights = [5, 4, 3, 2, 1]; // Son maçlar daha önemli
  let momentum = 0;
  
  lastMatches.slice(0, 5).forEach((match, i) => {
    const weight = weights[i] || 1;
    if (match.result === 'W') momentum += 3 * weight;
    else if (match.result === 'D') momentum += 1 * weight;
    else momentum -= 2 * weight;
  });
  
  // Normalize to -10 to +10
  return Math.max(-10, Math.min(10, momentum / 3));
}

function inferTacticalStyle(stats: any): string {
  if (!stats) return 'balanced';
  
  const goalRatio = stats.goalsScored / (stats.goalsConceded || 1);
  
  if (goalRatio > 1.5 && stats.avgGoalsScored > 1.5) return 'attacking';
  if (goalRatio < 0.8 || stats.cleanSheets > 0.4) return 'defensive';
  return 'balanced';
}

function calculateStreak(form: string): string {
  if (!form) return 'N/A';
  
  const current = form[0];
  let count = 1;
  
  for (let i = 1; i < form.length; i++) {
    if (form[i] === current) count++;
    else break;
  }
  
  return `${current}${count}`;
}

function determineLeaguePhase(matchData: any): string {
  const month = new Date(matchData.datetime).getMonth() + 1;
  
  if (month >= 8 && month <= 10) return 'early_season';
  if (month >= 11 || month <= 1) return 'mid_season';
  if (month >= 2 && month <= 4) return 'late_season';
  return 'end_season';
}
