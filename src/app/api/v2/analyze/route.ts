// ============================================================================
// API V2: ANALYZE - Ana Analiz Endpoint
// ÖNCELİK: Agent Analysis (ana sistem)
// FALLBACK: Smart Analysis (yedek sistem)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runSmartAnalysis, saveSmartAnalysis, SmartAnalysisResult } from '@/lib/smart-analyzer';
import { runAgentAnalysis, saveAgentAnalysis } from '@/lib/agent-analyzer';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 120 saniye max (Agent Analysis daha uzun sürebilir)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// POST - Yeni analiz yap
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, matchDate } = body;
    
    if (!fixtureId || !homeTeam || !awayTeam) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // Önce Agent Analysis'i kontrol et (ana sistem)
    const { data: existingAgent } = await supabase
      .from('agent_analysis')
      .select('agent_results, match_result_prediction, best_bet_market, best_bet_selection, best_bet_confidence, analyzed_at')
      .eq('fixture_id', fixtureId)
      .maybeSingle();
    
    if (existingAgent?.agent_results) {
      console.log(`📦 Returning cached Agent Analysis for fixture ${fixtureId}`);
      // Agent Analysis formatını Smart Analysis formatına dönüştür
      const agentData = existingAgent.agent_results;
      return NextResponse.json({
        success: true,
        analysis: {
          fixtureId,
          homeTeam,
          awayTeam,
          league,
          matchDate: existingAgent.analyzed_at || matchDate,
          agents: agentData.agents || {},
          matchResult: agentData.matchResult,
          top3Predictions: agentData.top3Predictions || [],
          bestBet: {
            market: existingAgent.best_bet_market || agentData.bestBet?.market,
            selection: existingAgent.best_bet_selection || agentData.bestBet?.selection,
            confidence: existingAgent.best_bet_confidence || agentData.bestBet?.confidence,
            reason: agentData.bestBet?.reason || ''
          },
          agreement: agentData.agreement || 0,
          riskLevel: agentData.riskLevel || 'medium',
          overallConfidence: agentData.overallConfidence || 60,
          dataQuality: agentData.dataQuality || 'minimal',
          processingTime: agentData.processingTime || 0,
          analyzedAt: existingAgent.analyzed_at || new Date().toISOString()
        },
        processingTime: Date.now() - startTime,
        cached: true,
        analysisType: 'agent'
      });
    }
    
    // Smart Analysis cache kontrolü (fallback için)
    const { data: existingSmart } = await supabase
      .from('smart_analysis')
      .select('analysis')
      .eq('fixture_id', fixtureId)
      .maybeSingle();
    
    if (existingSmart?.analysis) {
      console.log(`📦 Returning cached Smart Analysis for fixture ${fixtureId}`);
      return NextResponse.json({
        success: true,
        analysis: existingSmart.analysis,
        processingTime: Date.now() - startTime,
        cached: true,
        analysisType: 'smart'
      });
    }
    
    console.log(`🎯 Starting Analysis: ${homeTeam} vs ${awayTeam}`);
    console.log(`📊 Input data: fixtureId=${fixtureId}, homeTeamId=${homeTeamId}, awayTeamId=${awayTeamId}`);
    
    // ÖNCELİK 1: Agent Analysis (ana sistem)
    if (homeTeamId && awayTeamId) {
      console.log('🤖 Attempting Agent Analysis (primary system)...');
      try {
        const agentAnalysis = await runAgentAnalysis(fixtureId, homeTeamId, awayTeamId);
        
        if (agentAnalysis) {
          console.log(`✅ Agent Analysis successful in ${Date.now() - startTime}ms`);
          
          // Agent Analysis'i kaydet
          await saveAgentAnalysis(agentAnalysis);
          
          // Agent Analysis formatını response formatına dönüştür
          return NextResponse.json({
            success: true,
            analysis: agentAnalysis,
            processingTime: Date.now() - startTime,
            cached: false,
            analysisType: 'agent'
          });
        }
      } catch (agentError) {
        console.warn('⚠️ Agent Analysis failed, falling back to Smart Analysis:', agentError);
        // Fallback'e geç
      }
    } else {
      console.warn('⚠️ Missing team IDs, skipping Agent Analysis');
    }
    
    // FALLBACK: Smart Analysis (yedek sistem)
    console.log('📊 Falling back to Smart Analysis...');
    const smartAnalysis = await runSmartAnalysis({
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      matchDate
    });
    
    if (!smartAnalysis) {
      return NextResponse.json({ success: false, error: 'Both analysis systems failed' }, { status: 500 });
    }
    
    // Smart Analysis'i kaydet
    await saveSmartAnalysis({
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      matchDate
    }, smartAnalysis);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Smart Analysis complete: ${homeTeam} vs ${awayTeam} in ${totalTime}ms`);
    
    return NextResponse.json({
      success: true,
      analysis: smartAnalysis,
      processingTime: totalTime,
      cached: false,
      analysisType: 'smart'
    });
    
  } catch (error) {
    console.error('POST Analysis error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
