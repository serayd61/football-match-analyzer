/**
 * BACKTEST API
 * Geçmiş tahminleri test et, performans ölç
 */

import { NextRequest, NextResponse } from 'next/server';
import { runBacktest, evaluateAgentAccuracy, calibrationScore, BacktestMatch } from '@/lib/backtesting';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matches, action } = body;

    if (!matches || !Array.isArray(matches)) {
      return NextResponse.json({ error: 'matches array required' }, { status: 400 });
    }

    if (action === 'evaluate') {
      // Run full backtest
      const results = runBacktest(matches as BacktestMatch[]);
      
      return NextResponse.json({
        success: true,
        summary: {
          totalMatches: results.totalMatches,
          correctPredictions: results.correctPredictions,
          accuracy: `${results.accuracy}%`,
          profitPerMatch: `${results.profitPerMatch} units`,
          roi: `${results.roi}%`
        },
        confidenceAnalysis: {
          highConfidence: `${results.confidenceCalibration.high.accuracy}% (${results.confidenceCalibration.high.correct}/${results.confidenceCalibration.high.attempted})`,
          mediumConfidence: `${results.confidenceCalibration.medium.accuracy}% (${results.confidenceCalibration.medium.correct}/${results.confidenceCalibration.medium.attempted})`,
          lowConfidence: `${results.confidenceCalibration.low.accuracy}% (${results.confidenceCalibration.low.correct}/${results.confidenceCalibration.low.attempted})`
        },
        bestPerformers: results.bestBets,
        worstPerformers: results.worstBets,
        fullResults: results
      });
    }

    if (action === 'agent-accuracy') {
      // Evaluate single agent
      const { agentName, correct, total } = body;
      const evaluation = evaluateAgentAccuracy(agentName, correct, total);

      return NextResponse.json({
        agent: agentName,
        accuracy: `${evaluation.accuracy.toFixed(2)}%`,
        adjustment: evaluation.adjustment > 0 ? `+${evaluation.adjustment}` : evaluation.adjustment,
        recommendation: evaluation.recommendation
      });
    }

    if (action === 'calibration') {
      // Check if agent is well-calibrated
      const { confidences, accuracies } = body;
      const calibration = calibrationScore(confidences, accuracies);

      return NextResponse.json({
        calibrationError: calibration.calibrationError,
        interpretation: calibration.recommendation,
        status: calibration.calibrationError < 10 ? '✅ Good' : '⚠️ Needs adjustment'
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Backtest error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'schema') {
    return NextResponse.json({
      description: 'Backtest API for evaluating prediction accuracy',
      endpoints: {
        evaluate: {
          method: 'POST',
          body: {
            matches: [
              {
                id: 'match_1',
                homeTeam: 'Arsenal',
                awayTeam: 'Chelsea',
                league: 'Premier League',
                date: '2024-01-15',
                prediction: 'home',
                confidence: 75,
                actualResult: 'home',
                actualGoals: 2,
                odds: 1.85,
                notes: 'Correct prediction'
              }
            ],
            action: 'evaluate'
          },
          description: 'Run full backtest on historical predictions'
        },
        agentAccuracy: {
          method: 'POST',
          body: { agentName: 'statistics', correct: 45, total: 60, action: 'agent-accuracy' },
          description: 'Evaluate single agent accuracy'
        },
        calibration: {
          method: 'POST',
          body: { confidences: [80, 75, 60], accuracies: [85, 70, 55], action: 'calibration' },
          description: 'Check confidence calibration'
        }
      }
    });
  }

  return NextResponse.json({
    message: 'Use POST to run backtest. GET ?action=schema for API docs'
  });
}
