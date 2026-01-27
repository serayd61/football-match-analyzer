/**
 * BACKTESTING ENGINE
 * Geçmiş tahminleri test et, agent accuracy'sini ölç
 */

export interface BacktestMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  date: string;
  prediction: 'home' | 'draw' | 'away';
  confidence: number;
  actualResult: 'home' | 'draw' | 'away';
  actualGoals: number;
  odds?: number;
  notes?: string;
}

export interface BacktestResults {
  totalMatches: number;
  correctPredictions: number;
  accuracy: number;
  profitPerMatch: number;
  roi: number;
  confidenceCalibration: {
    high: { attempted: number; correct: number; accuracy: number };
    medium: { attempted: number; correct: number; accuracy: number };
    low: { attempted: number; correct: number; accuracy: number };
  };
  bestBets: string[];
  worstBets: string[];
}

/**
 * Tahminleri test et
 */
export function evaluateMatch(prediction: BacktestMatch): boolean {
  return prediction.prediction === prediction.actualResult;
}

/**
 * Batch backtesting
 */
export function runBacktest(matches: BacktestMatch[]): BacktestResults {
  if (matches.length === 0) {
    return {
      totalMatches: 0,
      correctPredictions: 0,
      accuracy: 0,
      profitPerMatch: 0,
      roi: 0,
      confidenceCalibration: {
        high: { attempted: 0, correct: 0, accuracy: 0 },
        medium: { attempted: 0, correct: 0, accuracy: 0 },
        low: { attempted: 0, correct: 0, accuracy: 0 }
      },
      bestBets: [],
      worstBets: []
    };
  }

  let correctPredictions = 0;
  let totalStake = 0;
  let totalReturns = 0;

  const confidenceBuckets = {
    high: { attempted: 0, correct: 0 },    // 75-100
    medium: { attempted: 0, correct: 0 },  // 50-75
    low: { attempted: 0, correct: 0 }      // <50
  };

  const results: { match: string; correct: boolean; stake: number; return: number }[] = [];

  matches.forEach(match => {
    const isCorrect = evaluateMatch(match);
    const stake = 10; // 10 unit per match (assumption)
    const returns = isCorrect && match.odds ? stake * match.odds : 0;

    totalStake += stake;
    totalReturns += returns;
    if (isCorrect) correctPredictions++;

    results.push({
      match: `${match.homeTeam} vs ${match.awayTeam}`,
      correct: isCorrect,
      stake,
      return: returns
    });

    // Confidence bucketing
    if (match.confidence >= 75) {
      confidenceBuckets.high.attempted++;
      if (isCorrect) confidenceBuckets.high.correct++;
    } else if (match.confidence >= 50) {
      confidenceBuckets.medium.attempted++;
      if (isCorrect) confidenceBuckets.medium.correct++;
    } else {
      confidenceBuckets.low.attempted++;
      if (isCorrect) confidenceBuckets.low.correct++;
    }
  });

  const accuracy = correctPredictions / matches.length;
  const profitPerMatch = (totalReturns - totalStake) / matches.length;
  const roi = totalStake > 0 ? ((totalReturns - totalStake) / totalStake) * 100 : 0;

  // Find best and worst performing bets
  const sorted = results.sort((a, b) => b.return - a.return);
  const bestBets = sorted.slice(0, 5).map(r => `${r.match} (${r.correct ? '✅' : '❌'} +${r.return.toFixed(2)})`);
  const worstBets = sorted.slice(-5).reverse().map(r => `${r.match} (${r.correct ? '✅' : '❌'} ${r.return.toFixed(2)})`);

  return {
    totalMatches: matches.length,
    correctPredictions,
    accuracy: parseFloat((accuracy * 100).toFixed(2)),
    profitPerMatch: parseFloat(profitPerMatch.toFixed(2)),
    roi: parseFloat(roi.toFixed(2)),
    confidenceCalibration: {
      high: {
        attempted: confidenceBuckets.high.attempted,
        correct: confidenceBuckets.high.correct,
        accuracy: confidenceBuckets.high.attempted > 0 
          ? parseFloat((confidenceBuckets.high.correct / confidenceBuckets.high.attempted * 100).toFixed(2))
          : 0
      },
      medium: {
        attempted: confidenceBuckets.medium.attempted,
        correct: confidenceBuckets.medium.correct,
        accuracy: confidenceBuckets.medium.attempted > 0
          ? parseFloat((confidenceBuckets.medium.correct / confidenceBuckets.medium.attempted * 100).toFixed(2))
          : 0
      },
      low: {
        attempted: confidenceBuckets.low.attempted,
        correct: confidenceBuckets.low.correct,
        accuracy: confidenceBuckets.low.attempted > 0
          ? parseFloat((confidenceBuckets.low.correct / confidenceBuckets.low.attempted * 100).toFixed(2))
          : 0
      }
    },
    bestBets,
    worstBets
  };
}

/**
 * Tahminin iyi olup olmadığını değerlendir (future use: adjustment weights)
 */
export function evaluateAgentAccuracy(agent: string, correctCount: number, totalCount: number): {
  accuracy: number;
  adjustment: number; // Weight adjustment
  recommendation: string;
} {
  const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
  let adjustment = 0;
  let recommendation = 'Keep current weight';

  if (accuracy > 65) {
    adjustment = +0.05; // Increase weight
    recommendation = 'Increase agent weight';
  } else if (accuracy < 40) {
    adjustment = -0.10; // Decrease weight
    recommendation = 'Decrease agent weight significantly';
  }

  return { accuracy, adjustment, recommendation };
}

/**
 * Confidence calibration check
 * Eğer %80 confidence ile tahmin ettiysen, %80 oranında doğru çıkmalı
 */
export function calibrationScore(
  confidenceLevels: number[],
  actualAccuracies: number[]
): { calibrationError: number; recommendation: string } {
  if (confidenceLevels.length !== actualAccuracies.length) {
    return { calibrationError: -1, recommendation: 'Data mismatch' };
  }

  let totalError = 0;
  confidenceLevels.forEach((conf, i) => {
    const error = Math.abs(conf - actualAccuracies[i]);
    totalError += error;
  });

  const calibrationError = totalError / confidenceLevels.length;
  let recommendation = 'Well calibrated';

  if (calibrationError > 20) {
    recommendation = 'Over-confident';
  } else if (calibrationError > 10) {
    recommendation = 'Slightly over-confident';
  }

  return { calibrationError: parseFloat(calibrationError.toFixed(2)), recommendation };
}
