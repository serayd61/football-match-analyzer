// ═══════════════════════════════════════════════════════════════════════════
// PROFESSIONAL BETTING MARKETS ENGINE
// Full market coverage for professional sports betting analysis
// ═══════════════════════════════════════════════════════════════════════════

export interface MatchStats {
  home: TeamStats;
  away: TeamStats;
  h2h?: H2HStats;
  odds?: OddsData;
}

export interface TeamStats {
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  homeAvgGoalsFor?: number;
  homeAvgGoalsAgainst?: number;
  awayAvgGoalsFor?: number;
  awayAvgGoalsAgainst?: number;
  over15Pct: number;
  over25Pct: number;
  over35Pct: number;
  bttsPct: number;
  cleanSheetPct: number;
  failedToScorePct: number;
  firstHalfGoalsPct: number;
  secondHalfGoalsPct: number;
  form: string;
  xG?: number;
  xGA?: number;
}

export interface H2HStats {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  avgGoals: number;
  over25Pct: number;
  bttsPct: number;
  homeTeamScoredFirst: number;
  awayTeamScoredFirst: number;
}

export interface OddsData {
  home: number;
  draw: number;
  away: number;
  over25: number;
  under25: number;
  over15: number;
  under15: number;
  bttsYes: number;
  bttsNo: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET PREDICTION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketPrediction {
  market: string;
  selection: string;
  confidence: number;
  odds?: number;
  value?: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'strong_bet' | 'good_bet' | 'value_bet' | 'avoid' | 'skip';
}

export interface ProfessionalAnalysis {
  // Core Markets
  matchResult: MarketPrediction;
  overUnder25: MarketPrediction;
  overUnder15: MarketPrediction;
  overUnder35: MarketPrediction;
  btts: MarketPrediction;
  
  // First Half Markets
  firstHalfResult: MarketPrediction;
  firstHalfOver05: MarketPrediction;
  firstHalfOver15: MarketPrediction;
  firstHalfBtts: MarketPrediction;
  
  // HT/FT Market
  htft: MarketPrediction;
  
  // Handicap Markets
  asianHandicap: MarketPrediction;
  europeanHandicap: MarketPrediction;
  
  // Goal Markets
  teamToScoreFirst: MarketPrediction;
  homeOver05: MarketPrediction;
  awayOver05: MarketPrediction;
  homeOver15: MarketPrediction;
  awayOver15: MarketPrediction;
  exactGoals: MarketPrediction;
  
  // Corners & Cards
  totalCorners: MarketPrediction;
  totalCards: MarketPrediction;
  
  // Combo Bets
  homeWinAndOver15: MarketPrediction;
  awayWinAndOver15: MarketPrediction;
  drawAndUnder25: MarketPrediction;
  bttsAndOver25: MarketPrediction;
  
  // Best Bets Summary
  bestBets: MarketPrediction[];
  valueBets: MarketPrediction[];
  safeBets: MarketPrediction[];
  riskyBets: MarketPrediction[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PROBABILITY CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate Poisson probability for exact goals
 */
function poissonProb(lambda: number, k: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Calculate expected goals using xG or averages
 */
function calculateExpectedGoals(stats: MatchStats): { home: number; away: number; total: number } {
  const homeXG = stats.home.xG || stats.home.avgGoalsFor;
  const awayXG = stats.away.xG || stats.away.avgGoalsFor;
  
  // Adjust for opponent strength
  const homeDefense = stats.away.avgGoalsAgainst / 1.5; // Normalize
  const awayDefense = stats.home.avgGoalsAgainst / 1.5;
  
  const adjustedHome = homeXG * (homeDefense + 1) / 2;
  const adjustedAway = awayXG * (awayDefense + 1) / 2;
  
  return {
    home: Math.max(0.5, Math.min(4, adjustedHome)),
    away: Math.max(0.3, Math.min(3.5, adjustedAway)),
    total: adjustedHome + adjustedAway
  };
}

/**
 * Calculate Over/Under probabilities using Poisson
 */
function calculateOverUnderProbs(expectedTotal: number): Record<string, number> {
  let under05 = 0, under15 = 0, under25 = 0, under35 = 0, under45 = 0;
  
  for (let goals = 0; goals <= 10; goals++) {
    const prob = poissonProb(expectedTotal, goals);
    if (goals <= 0) under05 += prob;
    if (goals <= 1) under15 += prob;
    if (goals <= 2) under25 += prob;
    if (goals <= 3) under35 += prob;
    if (goals <= 4) under45 += prob;
  }
  
  return {
    under05: under05 * 100,
    over05: (1 - under05) * 100,
    under15: under15 * 100,
    over15: (1 - under15) * 100,
    under25: under25 * 100,
    over25: (1 - under25) * 100,
    under35: under35 * 100,
    over35: (1 - under35) * 100,
    under45: under45 * 100,
    over45: (1 - under45) * 100
  };
}

/**
 * Calculate BTTS probability
 */
function calculateBttsProb(homeExpected: number, awayExpected: number): number {
  const homeScoresProb = 1 - poissonProb(homeExpected, 0);
  const awayScoresProb = 1 - poissonProb(awayExpected, 0);
  return homeScoresProb * awayScoresProb * 100;
}

/**
 * Calculate match result probabilities
 */
function calculateMatchResultProbs(homeExp: number, awayExp: number): { home: number; draw: number; away: number } {
  let homeWin = 0, draw = 0, awayWin = 0;
  
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const prob = poissonProb(homeExp, h) * poissonProb(awayExp, a);
      if (h > a) homeWin += prob;
      else if (h < a) awayWin += prob;
      else draw += prob;
    }
  }
  
  return {
    home: homeWin * 100,
    draw: draw * 100,
    away: awayWin * 100
  };
}

/**
 * Calculate first half probabilities (typically 45-50% of full game)
 */
function calculateFirstHalfProbs(stats: MatchStats, expectedGoals: { home: number; away: number }) {
  const firstHalfRatio = 0.45; // Goals typically 45% in first half
  
  const homeFirstHalf = expectedGoals.home * firstHalfRatio;
  const awayFirstHalf = expectedGoals.away * firstHalfRatio;
  const totalFirstHalf = homeFirstHalf + awayFirstHalf;
  
  return {
    expectedGoals: totalFirstHalf,
    over05: (1 - poissonProb(totalFirstHalf, 0)) * 100,
    over15: (1 - poissonProb(totalFirstHalf, 0) - poissonProb(totalFirstHalf, 1)) * 100,
    btts: calculateBttsProb(homeFirstHalf, awayFirstHalf),
    resultProbs: calculateMatchResultProbs(homeFirstHalf, awayFirstHalf)
  };
}

/**
 * Calculate HT/FT probabilities
 */
function calculateHtFtProbs(stats: MatchStats, expectedGoals: { home: number; away: number }) {
  const htProbs = calculateMatchResultProbs(expectedGoals.home * 0.45, expectedGoals.away * 0.45);
  const ftProbs = calculateMatchResultProbs(expectedGoals.home, expectedGoals.away);
  
  // Most common HT/FT combinations
  const combinations = [
    { ht: '1', ft: '1', prob: htProbs.home * ftProbs.home / 100 * 1.2 }, // 1/1
    { ht: 'X', ft: '1', prob: htProbs.draw * ftProbs.home / 100 * 0.9 }, // X/1
    { ht: '2', ft: '1', prob: htProbs.away * ftProbs.home / 100 * 0.3 }, // 2/1
    { ht: '1', ft: 'X', prob: htProbs.home * ftProbs.draw / 100 * 0.4 }, // 1/X
    { ht: 'X', ft: 'X', prob: htProbs.draw * ftProbs.draw / 100 * 1.1 }, // X/X
    { ht: '2', ft: 'X', prob: htProbs.away * ftProbs.draw / 100 * 0.4 }, // 2/X
    { ht: '1', ft: '2', prob: htProbs.home * ftProbs.away / 100 * 0.3 }, // 1/2
    { ht: 'X', ft: '2', prob: htProbs.draw * ftProbs.away / 100 * 0.9 }, // X/2
    { ht: '2', ft: '2', prob: htProbs.away * ftProbs.away / 100 * 1.2 }, // 2/2
  ];
  
  // Normalize
  const total = combinations.reduce((sum, c) => sum + c.prob, 0);
  combinations.forEach(c => c.prob = (c.prob / total) * 100);
  
  return combinations.sort((a, b) => b.prob - a.prob);
}

/**
 * Calculate Asian Handicap recommendation
 */
function calculateAsianHandicap(homeProb: number, awayProb: number, expectedGoals: { home: number; away: number }) {
  const goalDiff = expectedGoals.home - expectedGoals.away;
  
  let line: number;
  let selection: 'home' | 'away';
  
  if (goalDiff > 1) {
    line = -1.5;
    selection = 'home';
  } else if (goalDiff > 0.5) {
    line = -1;
    selection = 'home';
  } else if (goalDiff > 0) {
    line = -0.5;
    selection = 'home';
  } else if (goalDiff > -0.5) {
    line = 0;
    selection = homeProb > awayProb ? 'home' : 'away';
  } else if (goalDiff > -1) {
    line = 0.5;
    selection = 'away';
  } else {
    line = 1;
    selection = 'away';
  }
  
  return { line, selection, confidence: Math.abs(goalDiff * 20) + 50 };
}

/**
 * Calculate team to score first probability
 */
function calculateFirstGoalProbs(expectedGoals: { home: number; away: number }): { home: number; away: number; none: number } {
  const noGoalProb = poissonProb(expectedGoals.home, 0) * poissonProb(expectedGoals.away, 0);
  const remaining = 1 - noGoalProb;
  
  const homeShare = expectedGoals.home / (expectedGoals.home + expectedGoals.away);
  const awayShare = expectedGoals.away / (expectedGoals.home + expectedGoals.away);
  
  return {
    home: homeShare * remaining * 100,
    away: awayShare * remaining * 100,
    none: noGoalProb * 100
  };
}

/**
 * Calculate value from odds
 */
function calculateValue(probability: number, odds: number): number {
  const impliedProb = 100 / odds;
  return probability - impliedProb;
}

/**
 * Determine confidence level
 */
function getConfidenceLevel(probability: number): number {
  if (probability >= 75) return 85;
  if (probability >= 65) return 75;
  if (probability >= 55) return 65;
  if (probability >= 45) return 55;
  return 45;
}

/**
 * Get recommendation based on value and confidence
 */
function getRecommendation(confidence: number, value: number): MarketPrediction['recommendation'] {
  if (confidence >= 75 && value >= 10) return 'strong_bet';
  if (confidence >= 65 && value >= 5) return 'good_bet';
  if (value >= 15) return 'value_bet';
  if (confidence < 50 || value < -10) return 'avoid';
  return 'skip';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function generateProfessionalAnalysis(
  stats: MatchStats,
  language: 'tr' | 'en' | 'de' = 'en'
): ProfessionalAnalysis {
  // Calculate expected goals
  const expectedGoals = calculateExpectedGoals(stats);
  
  // Calculate all probabilities
  const ouProbs = calculateOverUnderProbs(expectedGoals.total);
  const bttsProb = calculateBttsProb(expectedGoals.home, expectedGoals.away);
  const resultProbs = calculateMatchResultProbs(expectedGoals.home, expectedGoals.away);
  const firstHalf = calculateFirstHalfProbs(stats, expectedGoals);
  const htft = calculateHtFtProbs(stats, expectedGoals);
  const asianHc = calculateAsianHandicap(resultProbs.home, resultProbs.away, expectedGoals);
  const firstGoal = calculateFirstGoalProbs(expectedGoals);
  
  const labels = getLabels(language);
  
  // Build predictions
  const predictions: ProfessionalAnalysis = {
    // Match Result
    matchResult: {
      market: labels.matchResult,
      selection: resultProbs.home > resultProbs.away ? 
        (resultProbs.home > resultProbs.draw ? '1' : 'X') :
        (resultProbs.away > resultProbs.draw ? '2' : 'X'),
      confidence: Math.max(resultProbs.home, resultProbs.draw, resultProbs.away),
      reasoning: buildReasoning('matchResult', resultProbs, language),
      riskLevel: resultProbs.home >= 60 || resultProbs.away >= 60 ? 'low' : 'medium',
      recommendation: getRecommendation(Math.max(resultProbs.home, resultProbs.draw, resultProbs.away), 0)
    },
    
    // Over/Under 2.5
    overUnder25: {
      market: labels.overUnder25,
      selection: ouProbs.over25 > 50 ? `${labels.over} 2.5` : `${labels.under} 2.5`,
      confidence: Math.max(ouProbs.over25, ouProbs.under25),
      reasoning: buildReasoning('overUnder', { over: ouProbs.over25, total: expectedGoals.total }, language),
      riskLevel: Math.abs(ouProbs.over25 - 50) > 15 ? 'low' : 'medium',
      recommendation: getRecommendation(Math.max(ouProbs.over25, ouProbs.under25), 0)
    },
    
    // Over/Under 1.5
    overUnder15: {
      market: labels.overUnder15,
      selection: ouProbs.over15 > 50 ? `${labels.over} 1.5` : `${labels.under} 1.5`,
      confidence: Math.max(ouProbs.over15, ouProbs.under15),
      reasoning: `${labels.expectedGoals}: ${expectedGoals.total.toFixed(2)}`,
      riskLevel: ouProbs.over15 >= 70 ? 'low' : 'medium',
      recommendation: getRecommendation(Math.max(ouProbs.over15, ouProbs.under15), 0)
    },
    
    // Over/Under 3.5
    overUnder35: {
      market: labels.overUnder35,
      selection: ouProbs.over35 > 50 ? `${labels.over} 3.5` : `${labels.under} 3.5`,
      confidence: Math.max(ouProbs.over35, ouProbs.under35),
      reasoning: `${labels.expectedGoals}: ${expectedGoals.total.toFixed(2)}`,
      riskLevel: 'medium',
      recommendation: getRecommendation(Math.max(ouProbs.over35, ouProbs.under35), 0)
    },
    
    // BTTS
    btts: {
      market: labels.btts,
      selection: bttsProb > 50 ? labels.bttsYes : labels.bttsNo,
      confidence: Math.max(bttsProb, 100 - bttsProb),
      reasoning: buildReasoning('btts', { btts: bttsProb, home: expectedGoals.home, away: expectedGoals.away }, language),
      riskLevel: Math.abs(bttsProb - 50) > 15 ? 'low' : 'medium',
      recommendation: getRecommendation(Math.max(bttsProb, 100 - bttsProb), 0)
    },
    
    // First Half Result
    firstHalfResult: {
      market: labels.firstHalfResult,
      selection: firstHalf.resultProbs.home > firstHalf.resultProbs.away ?
        (firstHalf.resultProbs.home > firstHalf.resultProbs.draw ? '1' : 'X') :
        (firstHalf.resultProbs.away > firstHalf.resultProbs.draw ? '2' : 'X'),
      confidence: Math.max(firstHalf.resultProbs.home, firstHalf.resultProbs.draw, firstHalf.resultProbs.away),
      reasoning: `${labels.firstHalfExpected}: ${firstHalf.expectedGoals.toFixed(2)} ${labels.goals}`,
      riskLevel: firstHalf.resultProbs.draw >= 40 ? 'low' : 'medium',
      recommendation: getRecommendation(Math.max(firstHalf.resultProbs.home, firstHalf.resultProbs.draw, firstHalf.resultProbs.away), 0)
    },
    
    // First Half Over 0.5
    firstHalfOver05: {
      market: labels.firstHalfOver05,
      selection: firstHalf.over05 > 50 ? `${labels.over} 0.5` : `${labels.under} 0.5`,
      confidence: Math.max(firstHalf.over05, 100 - firstHalf.over05),
      reasoning: `${labels.firstHalfGoalProb}: ${firstHalf.over05.toFixed(1)}%`,
      riskLevel: firstHalf.over05 >= 70 ? 'low' : 'medium',
      recommendation: getRecommendation(Math.max(firstHalf.over05, 100 - firstHalf.over05), 0)
    },
    
    // First Half Over 1.5
    firstHalfOver15: {
      market: labels.firstHalfOver15,
      selection: firstHalf.over15 > 50 ? `${labels.over} 1.5` : `${labels.under} 1.5`,
      confidence: Math.max(firstHalf.over15, 100 - firstHalf.over15),
      reasoning: `${labels.firstHalfExpected}: ${firstHalf.expectedGoals.toFixed(2)} ${labels.goals}`,
      riskLevel: 'medium',
      recommendation: getRecommendation(Math.max(firstHalf.over15, 100 - firstHalf.over15), 0)
    },
    
    // First Half BTTS
    firstHalfBtts: {
      market: labels.firstHalfBtts,
      selection: firstHalf.btts > 50 ? labels.bttsYes : labels.bttsNo,
      confidence: Math.max(firstHalf.btts, 100 - firstHalf.btts),
      reasoning: `${labels.firstHalfBttsProb}: ${firstHalf.btts.toFixed(1)}%`,
      riskLevel: 'high',
      recommendation: getRecommendation(Math.max(firstHalf.btts, 100 - firstHalf.btts), 0)
    },
    
    // HT/FT
    htft: {
      market: labels.htft,
      selection: `${htft[0].ht}/${htft[0].ft}`,
      confidence: htft[0].prob,
      reasoning: `${labels.mostLikely}: ${htft[0].ht}/${htft[0].ft} (${htft[0].prob.toFixed(1)}%)`,
      riskLevel: htft[0].prob >= 25 ? 'medium' : 'high',
      recommendation: getRecommendation(htft[0].prob, 0)
    },
    
    // Asian Handicap
    asianHandicap: {
      market: labels.asianHandicap,
      selection: `${asianHc.selection === 'home' ? labels.homeTeam : labels.awayTeam} ${asianHc.line > 0 ? '+' : ''}${asianHc.line}`,
      confidence: asianHc.confidence,
      reasoning: `${labels.expectedDiff}: ${(expectedGoals.home - expectedGoals.away).toFixed(2)}`,
      riskLevel: Math.abs(asianHc.line) >= 1 ? 'medium' : 'low',
      recommendation: getRecommendation(asianHc.confidence, 0)
    },
    
    // European Handicap
    europeanHandicap: {
      market: labels.europeanHandicap,
      selection: resultProbs.home > resultProbs.away ? `1 (${Math.round(asianHc.line)})` : `2 (${Math.round(-asianHc.line)})`,
      confidence: Math.max(resultProbs.home, resultProbs.away) * 0.9,
      reasoning: labels.europeanHcReasoning,
      riskLevel: 'medium',
      recommendation: 'skip'
    },
    
    // Team to Score First
    teamToScoreFirst: {
      market: labels.teamToScoreFirst,
      selection: firstGoal.home > firstGoal.away ? labels.homeTeam : labels.awayTeam,
      confidence: Math.max(firstGoal.home, firstGoal.away),
      reasoning: `${labels.homeTeam}: ${firstGoal.home.toFixed(1)}%, ${labels.awayTeam}: ${firstGoal.away.toFixed(1)}%`,
      riskLevel: 'medium',
      recommendation: getRecommendation(Math.max(firstGoal.home, firstGoal.away), 0)
    },
    
    // Home Over 0.5
    homeOver05: {
      market: labels.homeOver05,
      selection: (1 - poissonProb(expectedGoals.home, 0)) * 100 > 50 ? `${labels.over} 0.5` : `${labels.under} 0.5`,
      confidence: Math.max((1 - poissonProb(expectedGoals.home, 0)) * 100, poissonProb(expectedGoals.home, 0) * 100),
      reasoning: `${labels.homeExpected}: ${expectedGoals.home.toFixed(2)} ${labels.goals}`,
      riskLevel: 'low',
      recommendation: getRecommendation(Math.max((1 - poissonProb(expectedGoals.home, 0)) * 100, poissonProb(expectedGoals.home, 0) * 100), 0)
    },
    
    // Away Over 0.5
    awayOver05: {
      market: labels.awayOver05,
      selection: (1 - poissonProb(expectedGoals.away, 0)) * 100 > 50 ? `${labels.over} 0.5` : `${labels.under} 0.5`,
      confidence: Math.max((1 - poissonProb(expectedGoals.away, 0)) * 100, poissonProb(expectedGoals.away, 0) * 100),
      reasoning: `${labels.awayExpected}: ${expectedGoals.away.toFixed(2)} ${labels.goals}`,
      riskLevel: 'low',
      recommendation: getRecommendation(Math.max((1 - poissonProb(expectedGoals.away, 0)) * 100, poissonProb(expectedGoals.away, 0) * 100), 0)
    },
    
    // Home Over 1.5
    homeOver15: {
      market: labels.homeOver15,
      selection: (1 - poissonProb(expectedGoals.home, 0) - poissonProb(expectedGoals.home, 1)) * 100 > 50 ? `${labels.over} 1.5` : `${labels.under} 1.5`,
      confidence: 55,
      reasoning: `${labels.homeExpected}: ${expectedGoals.home.toFixed(2)} ${labels.goals}`,
      riskLevel: 'medium',
      recommendation: 'skip'
    },
    
    // Away Over 1.5
    awayOver15: {
      market: labels.awayOver15,
      selection: (1 - poissonProb(expectedGoals.away, 0) - poissonProb(expectedGoals.away, 1)) * 100 > 50 ? `${labels.over} 1.5` : `${labels.under} 1.5`,
      confidence: 55,
      reasoning: `${labels.awayExpected}: ${expectedGoals.away.toFixed(2)} ${labels.goals}`,
      riskLevel: 'medium',
      recommendation: 'skip'
    },
    
    // Exact Goals
    exactGoals: {
      market: labels.exactGoals,
      selection: `${Math.round(expectedGoals.total)} ${labels.goals}`,
      confidence: 35,
      reasoning: `${labels.expectedGoals}: ${expectedGoals.total.toFixed(2)}`,
      riskLevel: 'high',
      recommendation: 'skip'
    },
    
    // Corners (estimate based on attacking style)
    totalCorners: {
      market: labels.totalCorners,
      selection: `${labels.over} 9.5`,
      confidence: 55,
      reasoning: labels.cornersReasoning,
      riskLevel: 'medium',
      recommendation: 'skip'
    },
    
    // Cards (estimate)
    totalCards: {
      market: labels.totalCards,
      selection: `${labels.over} 3.5`,
      confidence: 55,
      reasoning: labels.cardsReasoning,
      riskLevel: 'medium',
      recommendation: 'skip'
    },
    
    // Combo: Home Win + Over 1.5
    homeWinAndOver15: {
      market: labels.homeWinAndOver15,
      selection: `1 & ${labels.over} 1.5`,
      confidence: resultProbs.home * ouProbs.over15 / 100,
      reasoning: labels.comboReasoning,
      riskLevel: 'medium',
      recommendation: getRecommendation(resultProbs.home * ouProbs.over15 / 100, 0)
    },
    
    // Combo: Away Win + Over 1.5
    awayWinAndOver15: {
      market: labels.awayWinAndOver15,
      selection: `2 & ${labels.over} 1.5`,
      confidence: resultProbs.away * ouProbs.over15 / 100,
      reasoning: labels.comboReasoning,
      riskLevel: 'medium',
      recommendation: getRecommendation(resultProbs.away * ouProbs.over15 / 100, 0)
    },
    
    // Combo: Draw + Under 2.5
    drawAndUnder25: {
      market: labels.drawAndUnder25,
      selection: `X & ${labels.under} 2.5`,
      confidence: resultProbs.draw * ouProbs.under25 / 100,
      reasoning: labels.comboReasoning,
      riskLevel: 'medium',
      recommendation: getRecommendation(resultProbs.draw * ouProbs.under25 / 100, 0)
    },
    
    // Combo: BTTS + Over 2.5
    bttsAndOver25: {
      market: labels.bttsAndOver25,
      selection: `${labels.bttsYes} & ${labels.over} 2.5`,
      confidence: bttsProb * ouProbs.over25 / 100,
      reasoning: labels.comboReasoning,
      riskLevel: 'medium',
      recommendation: getRecommendation(bttsProb * ouProbs.over25 / 100, 0)
    },
    
    // Initialize arrays
    bestBets: [],
    valueBets: [],
    safeBets: [],
    riskyBets: []
  };
  
  // Categorize bets
  const allPredictions = [
    predictions.matchResult,
    predictions.overUnder25,
    predictions.overUnder15,
    predictions.btts,
    predictions.firstHalfResult,
    predictions.firstHalfOver05,
    predictions.htft,
    predictions.asianHandicap,
    predictions.teamToScoreFirst,
    predictions.homeOver05,
    predictions.awayOver05,
    predictions.homeWinAndOver15,
    predictions.awayWinAndOver15,
    predictions.bttsAndOver25
  ];
  
  predictions.bestBets = allPredictions
    .filter(p => p.recommendation === 'strong_bet' || p.recommendation === 'good_bet')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  
  predictions.safeBets = allPredictions
    .filter(p => p.riskLevel === 'low' && p.confidence >= 65)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  
  predictions.riskyBets = allPredictions
    .filter(p => p.riskLevel === 'high' && p.confidence >= 50)
    .slice(0, 3);
  
  return predictions;
}

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE LABELS
// ═══════════════════════════════════════════════════════════════════════════

function getLabels(language: 'tr' | 'en' | 'de') {
  const labels = {
    tr: {
      matchResult: 'Maç Sonucu',
      overUnder25: 'Üst/Alt 2.5 Gol',
      overUnder15: 'Üst/Alt 1.5 Gol',
      overUnder35: 'Üst/Alt 3.5 Gol',
      btts: 'Karşılıklı Gol',
      bttsYes: 'KG Var',
      bttsNo: 'KG Yok',
      over: 'Üst',
      under: 'Alt',
      firstHalfResult: 'İlk Yarı Sonucu',
      firstHalfOver05: 'İY Üst/Alt 0.5',
      firstHalfOver15: 'İY Üst/Alt 1.5',
      firstHalfBtts: 'İY Karşılıklı Gol',
      htft: 'İY/MS',
      asianHandicap: 'Asya Handikap',
      europeanHandicap: 'Avrupa Handikap',
      teamToScoreFirst: 'İlk Golü Atan',
      homeOver05: 'Ev Sahibi Üst 0.5',
      awayOver05: 'Deplasman Üst 0.5',
      homeOver15: 'Ev Sahibi Üst 1.5',
      awayOver15: 'Deplasman Üst 1.5',
      exactGoals: 'Toplam Gol Sayısı',
      totalCorners: 'Toplam Korner',
      totalCards: 'Toplam Kart',
      homeWinAndOver15: '1 & Üst 1.5',
      awayWinAndOver15: '2 & Üst 1.5',
      drawAndUnder25: 'X & Alt 2.5',
      bttsAndOver25: 'KG Var & Üst 2.5',
      homeTeam: 'Ev Sahibi',
      awayTeam: 'Deplasman',
      expectedGoals: 'Beklenen Gol',
      goals: 'gol',
      mostLikely: 'En Muhtemel',
      expectedDiff: 'Beklenen Fark',
      europeanHcReasoning: 'Avrupa handikap analizi',
      homeExpected: 'Ev sahibi beklenti',
      awayExpected: 'Deplasman beklenti',
      firstHalfExpected: 'İlk yarı beklenti',
      firstHalfGoalProb: 'İlk yarı gol olasılığı',
      firstHalfBttsProb: 'İlk yarı KG olasılığı',
      cornersReasoning: 'Korner analizi yapıldı',
      cardsReasoning: 'Kart analizi yapıldı',
      comboReasoning: 'Kombine bahis analizi'
    },
    en: {
      matchResult: 'Match Result',
      overUnder25: 'Over/Under 2.5 Goals',
      overUnder15: 'Over/Under 1.5 Goals',
      overUnder35: 'Over/Under 3.5 Goals',
      btts: 'Both Teams to Score',
      bttsYes: 'BTTS Yes',
      bttsNo: 'BTTS No',
      over: 'Over',
      under: 'Under',
      firstHalfResult: 'First Half Result',
      firstHalfOver05: 'FH Over/Under 0.5',
      firstHalfOver15: 'FH Over/Under 1.5',
      firstHalfBtts: 'FH Both Teams Score',
      htft: 'HT/FT',
      asianHandicap: 'Asian Handicap',
      europeanHandicap: 'European Handicap',
      teamToScoreFirst: 'Team to Score First',
      homeOver05: 'Home Over 0.5',
      awayOver05: 'Away Over 0.5',
      homeOver15: 'Home Over 1.5',
      awayOver15: 'Away Over 1.5',
      exactGoals: 'Exact Total Goals',
      totalCorners: 'Total Corners',
      totalCards: 'Total Cards',
      homeWinAndOver15: 'Home & Over 1.5',
      awayWinAndOver15: 'Away & Over 1.5',
      drawAndUnder25: 'Draw & Under 2.5',
      bttsAndOver25: 'BTTS & Over 2.5',
      homeTeam: 'Home',
      awayTeam: 'Away',
      expectedGoals: 'Expected Goals',
      goals: 'goals',
      mostLikely: 'Most Likely',
      expectedDiff: 'Expected Difference',
      europeanHcReasoning: 'European handicap analysis',
      homeExpected: 'Home expected',
      awayExpected: 'Away expected',
      firstHalfExpected: 'First half expected',
      firstHalfGoalProb: 'First half goal probability',
      firstHalfBttsProb: 'First half BTTS probability',
      cornersReasoning: 'Corner analysis completed',
      cardsReasoning: 'Card analysis completed',
      comboReasoning: 'Combo bet analysis'
    },
    de: {
      matchResult: 'Spielergebnis',
      overUnder25: 'Über/Unter 2.5 Tore',
      overUnder15: 'Über/Unter 1.5 Tore',
      overUnder35: 'Über/Unter 3.5 Tore',
      btts: 'Beide Teams treffen',
      bttsYes: 'BTT Ja',
      bttsNo: 'BTT Nein',
      over: 'Über',
      under: 'Unter',
      firstHalfResult: 'Halbzeitergebnis',
      firstHalfOver05: 'HZ Über/Unter 0.5',
      firstHalfOver15: 'HZ Über/Unter 1.5',
      firstHalfBtts: 'HZ Beide Teams treffen',
      htft: 'HZ/Ende',
      asianHandicap: 'Asiatisches Handicap',
      europeanHandicap: 'Europäisches Handicap',
      teamToScoreFirst: 'Erstes Tor',
      homeOver05: 'Heim Über 0.5',
      awayOver05: 'Gast Über 0.5',
      homeOver15: 'Heim Über 1.5',
      awayOver15: 'Gast Über 1.5',
      exactGoals: 'Genaue Torzahl',
      totalCorners: 'Gesamtecken',
      totalCards: 'Gesamtkarten',
      homeWinAndOver15: 'Heim & Über 1.5',
      awayWinAndOver15: 'Gast & Über 1.5',
      drawAndUnder25: 'Unent. & Unter 2.5',
      bttsAndOver25: 'BTT & Über 2.5',
      homeTeam: 'Heim',
      awayTeam: 'Gast',
      expectedGoals: 'Erwartete Tore',
      goals: 'Tore',
      mostLikely: 'Am wahrscheinlichsten',
      expectedDiff: 'Erwartete Differenz',
      europeanHcReasoning: 'Europäische Handicap-Analyse',
      homeExpected: 'Heim erwartet',
      awayExpected: 'Gast erwartet',
      firstHalfExpected: 'Halbzeit erwartet',
      firstHalfGoalProb: 'HZ Torwahrscheinlichkeit',
      firstHalfBttsProb: 'HZ BTT Wahrscheinlichkeit',
      cornersReasoning: 'Ecken-Analyse abgeschlossen',
      cardsReasoning: 'Karten-Analyse abgeschlossen',
      comboReasoning: 'Kombi-Wett-Analyse'
    }
  };
  
  return labels[language];
}

function buildReasoning(type: string, data: any, language: 'tr' | 'en' | 'de'): string {
  const templates = {
    tr: {
      matchResult: `Ev: %${data.home?.toFixed(1)}, X: %${data.draw?.toFixed(1)}, Dep: %${data.away?.toFixed(1)}`,
      overUnder: `Üst 2.5: %${data.over?.toFixed(1)}, Beklenen: ${data.total?.toFixed(2)} gol`,
      btts: `KG Olasılığı: %${data.btts?.toFixed(1)}, Ev: ${data.home?.toFixed(2)}, Dep: ${data.away?.toFixed(2)}`
    },
    en: {
      matchResult: `Home: ${data.home?.toFixed(1)}%, Draw: ${data.draw?.toFixed(1)}%, Away: ${data.away?.toFixed(1)}%`,
      overUnder: `Over 2.5: ${data.over?.toFixed(1)}%, Expected: ${data.total?.toFixed(2)} goals`,
      btts: `BTTS Prob: ${data.btts?.toFixed(1)}%, Home: ${data.home?.toFixed(2)}, Away: ${data.away?.toFixed(2)}`
    },
    de: {
      matchResult: `Heim: ${data.home?.toFixed(1)}%, Unent.: ${data.draw?.toFixed(1)}%, Gast: ${data.away?.toFixed(1)}%`,
      overUnder: `Über 2.5: ${data.over?.toFixed(1)}%, Erwartet: ${data.total?.toFixed(2)} Tore`,
      btts: `BTT Wahr.: ${data.btts?.toFixed(1)}%, Heim: ${data.home?.toFixed(2)}, Gast: ${data.away?.toFixed(2)}`
    }
  };
  
  return templates[language][type as keyof typeof templates.tr] || '';
}

// Export for use
export default {
  generateProfessionalAnalysis
};

