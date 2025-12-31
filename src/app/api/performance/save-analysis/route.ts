// ============================================================================
// API: Save Analysis to Performance Tracking
// POST /api/performance/save-analysis
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { saveAnalysisToPerformance, AnalysisRecord } from '@/lib/performance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.fixtureId || !body.homeTeam || !body.awayTeam) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: fixtureId, homeTeam, awayTeam' },
        { status: 400 }
      );
    }
    
    // Extract predictions from the unified analysis format
    const extractAgentPrediction = (agent: any) => {
      if (!agent) return undefined;
      
      return {
        matchResult: agent.matchResult?.toString() || agent.prediction?.matchResult?.prediction || '',
        overUnder: agent.overUnder?.toString() || agent.prediction?.overUnder?.prediction || '',
        btts: agent.btts?.toString() || agent.prediction?.btts?.prediction || '',
        confidence: agent.confidence || agent.overallConfidence || 50,
        reasoning: agent.agentSummary || agent.recommendation || ''
      };
    };
    
    const analysisRecord: AnalysisRecord = {
      fixtureId: body.fixtureId,
      homeTeam: body.homeTeam,
      awayTeam: body.awayTeam,
      league: body.league || 'Unknown',
      matchDate: body.matchDate || new Date().toISOString(),
      
      // Agent predictions
      statsAgent: extractAgentPrediction(body.agents?.stats),
      oddsAgent: extractAgentPrediction(body.agents?.odds),
      deepAnalysisAgent: extractAgentPrediction(body.agents?.deepAnalysis),
      geniusAnalyst: extractAgentPrediction(body.agents?.geniusAnalyst),
      masterStrategist: extractAgentPrediction(body.agents?.masterStrategist),
      aiSmart: extractAgentPrediction(body.ai?.smart),
      
      // Consensus
      consensusMatchResult: body.predictions?.matchResult?.prediction || '',
      consensusOverUnder: body.predictions?.overUnder?.prediction || '',
      consensusBtts: body.predictions?.btts?.prediction || '',
      consensusConfidence: body.systemPerformance?.overallConfidence || 50,
      consensusScorePrediction: body.predictions?.matchResult?.scorePrediction || ''
    };
    
    const result = await saveAnalysisToPerformance(analysisRecord);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Analysis saved for ${body.homeTeam} vs ${body.awayTeam}` 
    });
    
  } catch (error: any) {
    console.error('❌ Save analysis API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

