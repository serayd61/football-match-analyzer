// ============================================================================
// UNIFIED ANALYSIS PERFORMANCE API
// Analiz performans istatistiklerini döndürür
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Settled analyses
    const { data: settled, error: settledError } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('is_settled', true)
      .gte('created_at', startDate.toISOString());

    if (settledError) throw settledError;

    // All analyses
    const { data: all, error: allError } = await supabase
      .from('unified_analysis')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (allError) throw allError;

    // Calculate stats
    const total = all?.length || 0;
    const settledCount = settled?.length || 0;
    const pending = total - settledCount;

    // Accuracy calculations
    const matchResultCorrect = settled?.filter(s => s.match_result_correct === true).length || 0;
    const overUnderCorrect = settled?.filter(s => s.over_under_correct === true).length || 0;
    const bttsCorrect = settled?.filter(s => s.btts_correct === true).length || 0;
    const scoreCorrect = settled?.filter(s => s.score_prediction_correct === true).length || 0;

    const matchResultRate = settledCount > 0 ? (matchResultCorrect / settledCount) * 100 : 0;
    const overUnderRate = settledCount > 0 ? (overUnderCorrect / settledCount) * 100 : 0;
    const bttsRate = settledCount > 0 ? (bttsCorrect / settledCount) * 100 : 0;
    const scoreRate = settledCount > 0 ? (scoreCorrect / settledCount) * 100 : 0;

    // Overall accuracy (average of all markets)
    const overallCorrect = matchResultCorrect + overUnderCorrect + bttsCorrect + scoreCorrect;
    const overallTotal = settledCount * 4;
    const overallRate = overallTotal > 0 ? (overallCorrect / overallTotal) * 100 : 0;

    // Confidence distribution
    const highConf = settled?.filter(s => s.overall_confidence >= 75).length || 0;
    const highConfCorrect = settled?.filter(s => s.overall_confidence >= 75 && s.match_result_correct === true).length || 0;
    const mediumConf = settled?.filter(s => s.overall_confidence >= 60 && s.overall_confidence < 75).length || 0;
    const mediumConfCorrect = settled?.filter(s => s.overall_confidence >= 60 && s.overall_confidence < 75 && s.match_result_correct === true).length || 0;
    const lowConf = settled?.filter(s => s.overall_confidence < 60).length || 0;
    const lowConfCorrect = settled?.filter(s => s.overall_confidence < 60 && s.match_result_correct === true).length || 0;

    const { data: recent, error: recentError } = await supabase
      .from('unified_analysis')
      .select('*')
      .order('match_date', { ascending: false })
      .limit(20);

    if (recentError) throw recentError;

    const recentAnalyses = (recent || []).map(a => ({
      fixtureId: a.fixture_id,
      homeTeam: a.home_team,
      awayTeam: a.away_team,
      league: a.league,
      matchDate: a.match_date,
      predictions: {
        matchResult: {
          prediction: a.match_result_prediction,
          confidence: a.match_result_confidence
        },
        overUnder: {
          prediction: a.over_under_prediction,
          confidence: a.over_under_confidence
        },
        btts: {
          prediction: a.btts_prediction,
          confidence: a.btts_confidence
        }
      },
      actualResults: a.is_settled ? {
        homeScore: a.actual_home_score,
        awayScore: a.actual_away_score,
        matchResult: a.actual_match_result,
        overUnder: a.actual_total_goals && a.actual_total_goals > 2.5 ? 'Over' : 'Under',
        btts: a.actual_btts
      } : undefined,
      accuracy: a.is_settled ? {
        matchResult: a.match_result_correct,
        overUnder: a.over_under_correct,
        btts: a.btts_correct,
        score: a.score_prediction_correct
      } : undefined,
      overallConfidence: a.overall_confidence,
      agreement: a.agreement,
      isSettled: a.is_settled,
      createdAt: a.created_at
    }));

    return NextResponse.json({
      success: true,
      stats: {
        overview: {
          total,
          settled: settledCount,
          pending,
          periodDays: days
        },
        accuracy: {
          matchResult: {
            total: settledCount,
            correct: matchResultCorrect,
            rate: matchResultRate
          },
          overUnder: {
            total: settledCount,
            correct: overUnderCorrect,
            rate: overUnderRate
          },
          btts: {
            total: settledCount,
            correct: bttsCorrect,
            rate: bttsRate
          },
          score: {
            total: settledCount,
            correct: scoreCorrect,
            rate: scoreRate
          },
          overall: {
            total: settledCount,
            correct: overallCorrect,
            rate: overallRate
          }
        },
        confidenceDistribution: {
          high: {
            count: highConf,
            correct: highConfCorrect,
            rate: highConf > 0 ? (highConfCorrect / highConf) * 100 : 0
          },
          medium: {
            count: mediumConf,
            correct: mediumConfCorrect,
            rate: mediumConf > 0 ? (mediumConfCorrect / mediumConf) * 100 : 0
          },
          low: {
            count: lowConf,
            correct: lowConfCorrect,
            rate: lowConf > 0 ? (lowConfCorrect / lowConf) * 100 : 0
          }
        },
        recentAnalyses
      }
    });

  } catch (error: any) {
    console.error('Performance API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

