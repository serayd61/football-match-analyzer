// ============================================================================
// UNIFIED ANALYSIS API
// Agent'lar ve AI'ları birleştiren tek analiz endpoint'i
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runUnifiedConsensus, saveUnifiedAnalysis, UnifiedAnalysisInput } from '@/lib/unified-consensus';
import { createClient } from '@supabase/supabase-js';
import { saveAnalysisToPerformance, AnalysisRecord } from '@/lib/performance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, matchDate, skipCache = false } = body;
    
    if (!fixtureId || !homeTeam || !awayTeam || !homeTeamId || !awayTeamId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Cache kontrolü
    if (!skipCache) {
      const { data: cached } = await supabase
        .from('unified_analysis')
        .select('analysis, overall_confidence, agreement, created_at')
        .eq('fixture_id', fixtureId)
        .maybeSingle();
      
      if (cached?.analysis) {
        console.log(`📦 Returning cached unified analysis for fixture ${fixtureId}`);
        return NextResponse.json({
          success: true,
          analysis: cached.analysis,
          processingTime: Date.now() - startTime,
          cached: true,
          cachedAt: cached.created_at
        });
      }
    }
    
    console.log(`🎯 Starting Unified Analysis: ${homeTeam} vs ${awayTeam}`);
    
    // Unified consensus çalıştır
    const input: UnifiedAnalysisInput = {
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league: league || 'Unknown',
      matchDate: matchDate || new Date().toISOString().split('T')[0]
    };
    
    const result = await runUnifiedConsensus(input);
    
    // Veritabanına kaydet
    await saveUnifiedAnalysis(input, result);
    
    // 🆕 Performance Tracking'e kaydet
    try {
      const extractAgentPred = (agent: any) => {
        if (!agent) return undefined;
        return {
          matchResult: agent.matchResult || agent.finalConsensus?.matchResult?.prediction || '',
          overUnder: agent.overUnder || agent.finalConsensus?.overUnder?.prediction || '',
          btts: agent.btts || agent.finalConsensus?.btts?.prediction || '',
          confidence: agent.confidence || agent.overallConfidence || 50,
          reasoning: agent.agentSummary || agent.recommendation || ''
        };
      };
      
      const performanceRecord: AnalysisRecord = {
        fixtureId,
        homeTeam,
        awayTeam,
        league: league || 'Unknown',
        matchDate: matchDate || new Date().toISOString(),
        
        statsAgent: extractAgentPred(result.sources?.agents?.stats),
        oddsAgent: extractAgentPred(result.sources?.agents?.odds),
        deepAnalysisAgent: extractAgentPred(result.sources?.agents?.deepAnalysis),
        geniusAnalyst: extractAgentPred(result.sources?.agents?.geniusAnalyst),
        masterStrategist: extractAgentPred(result.sources?.agents?.masterStrategist),
        aiSmart: extractAgentPred(result.sources?.ai?.smart),
        
        consensusMatchResult: result.predictions?.matchResult?.prediction || '',
        consensusOverUnder: result.predictions?.overUnder?.prediction || '',
        consensusBtts: result.predictions?.btts?.prediction || '',
        consensusConfidence: result.systemPerformance?.overallConfidence || 50,
        consensusScorePrediction: result.predictions?.matchResult?.scorePrediction || ''
      };
      
      await saveAnalysisToPerformance(performanceRecord);
      console.log(`   💾 Saved to performance tracking`);
    } catch (perfError) {
      console.error('⚠️ Performance tracking save failed (non-critical):', perfError);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Unified Analysis complete in ${totalTime}ms`);
    console.log(`   🎯 Overall confidence: ${result.systemPerformance.overallConfidence}%`);
    console.log(`   🤝 Agreement: ${result.systemPerformance.agreement}%`);
    console.log(`   📊 Best bet: ${result.bestBet.market} - ${result.bestBet.selection} (${result.bestBet.confidence}%)`);
    
    return NextResponse.json({
      success: true,
      analysis: result,
      processingTime: totalTime,
      cached: false
    });
    
  } catch (error: any) {
    console.error('❌ Unified Analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Analysis failed',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

