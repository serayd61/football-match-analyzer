// ============================================================================
// API: Smart Analysis Performance Statistics
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
    
    // Get all smart analyses
    const { data: smartAnalyses, error: smartError } = await supabase
      .from('smart_analysis')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    
    if (smartError) {
      console.error('Error fetching smart analyses:', smartError);
    }
    
    // Get all agent analyses
    const { data: agentAnalyses, error: agentError } = await supabase
      .from('agent_analysis')
      .select('*')
      .gte('analyzed_at', startDate.toISOString())
      .order('analyzed_at', { ascending: false });
    
    if (agentError) {
      console.error('Error fetching agent analyses:', agentError);
    }
    
    // Combine both types of analyses
    const analyses = [
      ...(smartAnalyses || []).map(a => ({ ...a, type: 'smart' })),
      ...(agentAnalyses || []).map(a => ({ ...a, type: 'agent' }))
    ];
    
    const totalAnalyses = analyses.length;
    const settledAnalyses = analyses.filter(a => a.is_settled) || [];
    const pendingAnalyses = analyses.filter(a => !a.is_settled) || [];
    
    // Calculate accuracy for settled predictions
    let bttsCorrect = 0;
    let bttsTotal = 0;
    let ouCorrect = 0;
    let ouTotal = 0;
    let mrCorrect = 0;
    let mrTotal = 0;
    
    // Confidence distribution
    const confidenceDistribution = {
      high: { count: 0, correct: 0 },    // >70%
      medium: { count: 0, correct: 0 },  // 60-70%
      low: { count: 0, correct: 0 }      // <60%
    };
    
    // Processing times
    const processingTimes: number[] = [];
    
    // Models usage
    const modelsUsage: Record<string, number> = {};
    
    for (const analysis of analyses || []) {
      // Processing time
      if (analysis.processing_time) {
        processingTimes.push(analysis.processing_time);
      }
      
      // Models usage
      if (analysis.models_used) {
        for (const model of analysis.models_used) {
          modelsUsage[model] = (modelsUsage[model] || 0) + 1;
        }
      }
      
      // Only count settled for accuracy
      if (analysis.is_settled) {
        // BTTS
        const bttsPred = analysis.btts_prediction;
        const actualBtts = analysis.actual_btts;
        if (bttsPred && actualBtts !== null && actualBtts !== undefined) {
          bttsTotal++;
          const predictedBtts = bttsPred === 'yes' || bttsPred === 'Yes';
          const actualBttsBool = actualBtts === 'yes' || actualBtts === 'Yes' || actualBtts === true;
          if (predictedBtts === actualBttsBool) bttsCorrect++;
          
          // Confidence tracking
          const conf = analysis.btts_confidence || 50;
          if (conf > 70) {
            confidenceDistribution.high.count++;
            if (predictedBtts === actualBttsBool) confidenceDistribution.high.correct++;
          } else if (conf >= 60) {
            confidenceDistribution.medium.count++;
            if (predictedBtts === actualBttsBool) confidenceDistribution.medium.correct++;
          } else {
            confidenceDistribution.low.count++;
            if (predictedBtts === actualBttsBool) confidenceDistribution.low.correct++;
          }
        }
        
        // Over/Under
        const ouPred = analysis.over_under_prediction;
        const actualGoals = analysis.actual_total_goals;
        if (ouPred && actualGoals !== null && actualGoals !== undefined) {
          ouTotal++;
          const predictedOver = ouPred.toLowerCase() === 'over';
          const actualOver = actualGoals > 2.5;
          if (predictedOver === actualOver) ouCorrect++;
        }
        
        // Match Result
        const mrPred = analysis.match_result_prediction;
        const actualMr = analysis.actual_match_result;
        if (mrPred && actualMr) {
          mrTotal++;
          // Normalize match result format (1/X/2 vs home/draw/away)
          const normalizedPred = mrPred === '1' || mrPred === 'home' ? '1' : 
                                 mrPred === '2' || mrPred === 'away' ? '2' : 'X';
          const normalizedActual = actualMr === '1' || actualMr === 'home' ? '1' : 
                                   actualMr === '2' || actualMr === 'away' ? '2' : 'X';
          if (normalizedPred === normalizedActual) mrCorrect++;
        }
      }
    }
    
    // Calculate averages
    const avgProcessingTime = processingTimes.length > 0 
      ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
      : 0;
    
    const avgConfidence = analyses && analyses.length > 0
      ? Math.round(analyses.reduce((sum, a) => sum + (a.overall_confidence || 0), 0) / analyses.length)
      : 0;
    
    // Recent analyses (last 10)
    const recentAnalyses = (analyses || []).slice(0, 10).map(a => ({
      fixtureId: a.fixture_id,
      homeTeam: a.home_team,
      awayTeam: a.away_team,
      league: a.league,
      matchDate: a.match_date || a.matchDate,
      btts: { prediction: a.btts_prediction, confidence: a.btts_confidence },
      overUnder: { prediction: a.over_under_prediction, confidence: a.over_under_confidence },
      matchResult: { prediction: a.match_result_prediction, confidence: a.match_result_confidence },
      riskLevel: a.risk_level || a.riskLevel,
      overallConfidence: a.overall_confidence || a.overallConfidence,
      processingTime: a.processing_time || a.processingTime,
      isSettled: a.is_settled,
      createdAt: a.created_at || a.analyzed_at
    }));
    
    return NextResponse.json({
      success: true,
      stats: {
        overview: {
          total: totalAnalyses,
          settled: settledAnalyses.length,
          pending: pendingAnalyses.length,
          periodDays: days
        },
        accuracy: {
          btts: {
            total: bttsTotal,
            correct: bttsCorrect,
            rate: bttsTotal > 0 ? ((bttsCorrect / bttsTotal) * 100).toFixed(1) : '0'
          },
          overUnder: {
            total: ouTotal,
            correct: ouCorrect,
            rate: ouTotal > 0 ? ((ouCorrect / ouTotal) * 100).toFixed(1) : '0'
          },
          matchResult: {
            total: mrTotal,
            correct: mrCorrect,
            rate: mrTotal > 0 ? ((mrCorrect / mrTotal) * 100).toFixed(1) : '0'
          },
          overall: {
            total: bttsTotal + ouTotal + mrTotal,
            correct: bttsCorrect + ouCorrect + mrCorrect,
            rate: (bttsTotal + ouTotal + mrTotal) > 0 
              ? (((bttsCorrect + ouCorrect + mrCorrect) / (bttsTotal + ouTotal + mrTotal)) * 100).toFixed(1) 
              : '0'
          }
        },
        confidenceDistribution: {
          high: {
            count: confidenceDistribution.high.count,
            correct: confidenceDistribution.high.correct,
            rate: confidenceDistribution.high.count > 0 
              ? ((confidenceDistribution.high.correct / confidenceDistribution.high.count) * 100).toFixed(1)
              : '0'
          },
          medium: {
            count: confidenceDistribution.medium.count,
            correct: confidenceDistribution.medium.correct,
            rate: confidenceDistribution.medium.count > 0 
              ? ((confidenceDistribution.medium.correct / confidenceDistribution.medium.count) * 100).toFixed(1)
              : '0'
          },
          low: {
            count: confidenceDistribution.low.count,
            correct: confidenceDistribution.low.correct,
            rate: confidenceDistribution.low.count > 0 
              ? ((confidenceDistribution.low.correct / confidenceDistribution.low.count) * 100).toFixed(1)
              : '0'
          }
        },
        performance: {
          avgProcessingTime,
          avgConfidence,
          modelsUsage
        },
        recentAnalyses
      }
    });
    
  } catch (error) {
    console.error('Performance API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

