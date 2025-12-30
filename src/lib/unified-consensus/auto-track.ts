// ============================================================================
// AUTO TRACKING - Otomatik Performans Takibi
// Tüm analizler unified_analysis tablosuna kaydedilir
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Agent Analysis sonucunu unified_analysis'a kaydet
 */
export async function trackAgentAnalysis(
  fixtureId: number,
  homeTeam: string,
  awayTeam: string,
  league: string,
  matchDate: string,
  agentResult: any
): Promise<boolean> {
  try {
    // Agent Analysis'i unified format'a dönüştür
    const unifiedFormat = {
      predictions: {
        matchResult: {
          prediction: agentResult.matchResult?.prediction || agentResult.agents?.stats?.matchResult || 'X',
          confidence: agentResult.matchResult?.confidence || agentResult.agents?.stats?.matchResultConfidence || 50,
          reasoning: agentResult.matchResult?.reasoning || '',
          scorePrediction: agentResult.agents?.geniusAnalyst?.predictions?.correctScore?.mostLikely || 
                          agentResult.agents?.deepAnalysis?.scorePrediction?.score || '1-1'
        },
        overUnder: {
          prediction: agentResult.overUnder?.prediction || agentResult.agents?.stats?.overUnder || 'Over',
          confidence: agentResult.overUnder?.confidence || agentResult.agents?.stats?.overUnderConfidence || 50,
          reasoning: agentResult.overUnder?.reasoning || '',
          expectedGoals: agentResult.agents?.stats?._calculatedStats?.expectedTotal 
            ? parseFloat(agentResult.agents.stats._calculatedStats.expectedTotal) 
            : 2.5
        },
        btts: {
          prediction: agentResult.btts?.prediction || agentResult.agents?.stats?.btts || 'Yes',
          confidence: agentResult.btts?.confidence || agentResult.agents?.stats?.bttsConfidence || 50,
          reasoning: agentResult.btts?.reasoning || ''
        }
      },
      bestBet: {
        market: agentResult.bestBet?.market || 'Match Result',
        selection: agentResult.bestBet?.selection || 'Draw',
        confidence: agentResult.bestBet?.confidence || 50,
        value: 'medium' as const,
        reasoning: agentResult.bestBet?.reason || '',
        recommendedStake: 'low' as const
      },
      systemPerformance: {
        overallConfidence: agentResult.overallConfidence || 60,
        agreement: agentResult.agreement || 50,
        riskLevel: agentResult.riskLevel || 'medium',
        dataQuality: agentResult.dataQuality || 'fair'
      },
      sources: {
        agents: agentResult.agents || {}
      },
      metadata: {
        processingTime: agentResult.processingTime || 0,
        analyzedAt: agentResult.analyzedAt || new Date().toISOString(),
        systemsUsed: ['agents']
      }
    };

    const { error } = await supabase
      .from('unified_analysis')
      .upsert({
        fixture_id: fixtureId,
        home_team: homeTeam,
        away_team: awayTeam,
        league: league,
        match_date: matchDate,
        analysis: unifiedFormat,
        match_result_prediction: unifiedFormat.predictions.matchResult.prediction,
        match_result_confidence: unifiedFormat.predictions.matchResult.confidence,
        over_under_prediction: unifiedFormat.predictions.overUnder.prediction,
        over_under_confidence: unifiedFormat.predictions.overUnder.confidence,
        btts_prediction: unifiedFormat.predictions.btts.prediction,
        btts_confidence: unifiedFormat.predictions.btts.confidence,
        best_bet_market: unifiedFormat.bestBet.market,
        best_bet_selection: unifiedFormat.bestBet.selection,
        best_bet_confidence: unifiedFormat.bestBet.confidence,
        overall_confidence: unifiedFormat.systemPerformance.overallConfidence,
        agreement: unifiedFormat.systemPerformance.agreement,
        risk_level: unifiedFormat.systemPerformance.riskLevel,
        data_quality: unifiedFormat.systemPerformance.dataQuality,
        processing_time: unifiedFormat.metadata.processingTime,
        systems_used: unifiedFormat.metadata.systemsUsed,
        is_settled: false,
        created_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });

    if (error) {
      console.error('❌ Error tracking agent analysis:', error);
      return false;
    }

    console.log('✅ Agent analysis tracked to unified_analysis');
    return true;
  } catch (error) {
    console.error('❌ Exception tracking agent analysis:', error);
    return false;
  }
}

/**
 * Smart Analysis sonucunu unified_analysis'a kaydet
 */
export async function trackSmartAnalysis(
  fixtureId: number,
  homeTeam: string,
  awayTeam: string,
  league: string,
  matchDate: string,
  smartResult: any
): Promise<boolean> {
  try {
    const unifiedFormat = {
      predictions: {
        matchResult: {
          prediction: smartResult.matchResult?.prediction || 'X',
          confidence: smartResult.matchResult?.confidence || 50,
          reasoning: smartResult.matchResult?.reasoning || '',
          scorePrediction: '1-1'
        },
        overUnder: {
          prediction: smartResult.overUnder?.prediction || 'Over',
          confidence: smartResult.overUnder?.confidence || 50,
          reasoning: smartResult.overUnder?.reasoning || '',
          expectedGoals: 2.5
        },
        btts: {
          prediction: smartResult.btts?.prediction || 'Yes',
          confidence: smartResult.btts?.confidence || 50,
          reasoning: smartResult.btts?.reasoning || ''
        }
      },
      bestBet: {
        market: smartResult.bestBet?.market || 'Match Result',
        selection: smartResult.bestBet?.selection || 'Draw',
        confidence: smartResult.bestBet?.confidence || 50,
        value: 'medium' as const,
        reasoning: smartResult.bestBet?.reason || '',
        recommendedStake: 'low' as const
      },
      systemPerformance: {
        overallConfidence: smartResult.overallConfidence || 60,
        agreement: smartResult.agreement || 50,
        riskLevel: smartResult.riskLevel || 'medium',
        dataQuality: smartResult.dataQuality || 'fair'
      },
      sources: {
        ai: { smart: smartResult }
      },
      metadata: {
        processingTime: smartResult.processingTime || 0,
        analyzedAt: smartResult.analyzedAt || new Date().toISOString(),
        systemsUsed: ['smart']
      }
    };

    const { error } = await supabase
      .from('unified_analysis')
      .upsert({
        fixture_id: fixtureId,
        home_team: homeTeam,
        away_team: awayTeam,
        league: league,
        match_date: matchDate,
        analysis: unifiedFormat,
        match_result_prediction: unifiedFormat.predictions.matchResult.prediction,
        match_result_confidence: unifiedFormat.predictions.matchResult.confidence,
        over_under_prediction: unifiedFormat.predictions.overUnder.prediction,
        over_under_confidence: unifiedFormat.predictions.overUnder.confidence,
        btts_prediction: unifiedFormat.predictions.btts.prediction,
        btts_confidence: unifiedFormat.predictions.btts.confidence,
        best_bet_market: unifiedFormat.bestBet.market,
        best_bet_selection: unifiedFormat.bestBet.selection,
        best_bet_confidence: unifiedFormat.bestBet.confidence,
        overall_confidence: unifiedFormat.systemPerformance.overallConfidence,
        agreement: unifiedFormat.systemPerformance.agreement,
        risk_level: unifiedFormat.systemPerformance.riskLevel,
        data_quality: unifiedFormat.systemPerformance.dataQuality,
        processing_time: unifiedFormat.metadata.processingTime,
        systems_used: unifiedFormat.metadata.systemsUsed,
        is_settled: false,
        created_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });

    if (error) {
      console.error('❌ Error tracking smart analysis:', error);
      return false;
    }

    console.log('✅ Smart analysis tracked to unified_analysis');
    return true;
  } catch (error) {
    console.error('❌ Exception tracking smart analysis:', error);
    return false;
  }
}

