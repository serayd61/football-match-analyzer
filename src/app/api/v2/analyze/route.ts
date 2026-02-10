// ============================================================================
// API V2: ANALYZE - Ana Analiz Endpoint
// ÖNCELİK: Agent Analysis (ana sistem)
// FALLBACK: Smart Analysis (yedek sistem)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runSmartAnalysis, saveSmartAnalysis, SmartAnalysisResult } from '@/lib/smart-analyzer';
import { runAgentAnalysis, saveAgentAnalysis } from '@/lib/agent-analyzer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 saniye max (Vercel Pro plan limiti) - Agent Analysis timeout handling ile yönetiliyor

let _sb: SupabaseClient | null = null;
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return _sb;
}
const supabase = new Proxy({} as SupabaseClient, { get(_, p) { return (getSupabase() as any)[p]; } });

// ============================================================================
// POST - Yeni analiz yap
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, matchDate, preferAnalysis, skipCache = false } = body;
    
    if (!fixtureId || !homeTeam || !awayTeam) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // 🆕 Eğer preferAnalysis === 'smart' ise direkt Smart Analysis çalıştır (AI Analysis için)
    if (preferAnalysis === 'smart') {
      console.log(`📊 AI Analysis requested - Running Smart Analysis directly`);
      
      // Smart Analysis cache kontrolü
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
      
      // Smart Analysis çalıştır
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
        return NextResponse.json({ success: false, error: 'Smart Analysis failed' }, { status: 500 });
      }
      
      // Smart Analysis'i kaydet (otomatik olarak unified_analysis'a da kaydedilir)
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
    }
    
    // Önce Agent Analysis'i kontrol et (ana sistem) - skipCache=true ise bypass
    if (!skipCache) {
      const { data: existingAgent } = await supabase
        .from('agent_analysis')
        .select('agent_results, match_result_prediction, match_result_confidence, match_result_reasoning, best_bet_market, best_bet_selection, best_bet_confidence, best_bet_reason, agreement, risk_level, overall_confidence, data_quality, processing_time, analyzed_at')
        .eq('fixture_id', fixtureId)
        .maybeSingle();
      
      if (existingAgent?.agent_results) {
        // 🆕 Eğer cache'de masterStrategist veya geniusAnalyst yoksa, cache'i bypass et (yeni agent'lar eklendi)
        const agentData = existingAgent.agent_results;
        const agents = agentData?.agents || agentData; // Eski format: direkt agents, yeni format: data.agents
        const hasNewAgents = agents?.masterStrategist || agents?.geniusAnalyst;
        
        if (hasNewAgents) {
          console.log(`📦 Returning cached Agent Analysis for fixture ${fixtureId} (includes new agents)`);
      // Agent Analysis formatını Smart Analysis formatına dönüştür
      const agentData = existingAgent.agent_results;
      
      // Backward compatibility: Eski kayıtlarda agent_results içinde sadece agents olabilir
      // Yeni kayıtlarda agent_results içinde agents, matchResult, top3Predictions, vb. var
      const isNewFormat = agentData.agents !== undefined && agentData.matchResult !== undefined;
      
      return NextResponse.json({
        success: true,
        analysis: {
          fixtureId,
          homeTeam,
          awayTeam,
          league,
          matchDate: existingAgent.analyzed_at || matchDate,
          agents: isNewFormat ? (agentData.agents || {}) : (agentData || {}), // Eski format: agent_results direkt agents
          matchResult: isNewFormat ? agentData.matchResult : (existingAgent.match_result_prediction ? {
            prediction: existingAgent.match_result_prediction,
            confidence: existingAgent.match_result_confidence || 50,
            reasoning: existingAgent.match_result_reasoning || ''
          } : undefined),
          top3Predictions: isNewFormat ? (agentData.top3Predictions || []) : [],
          bestBet: {
            market: existingAgent.best_bet_market || agentData.bestBet?.market || 'Maç Sonucu',
            selection: existingAgent.best_bet_selection || agentData.bestBet?.selection || 'Beraberlik',
            confidence: existingAgent.best_bet_confidence || agentData.bestBet?.confidence || 50,
            reason: existingAgent.best_bet_reason || agentData.bestBet?.reason || ''
          },
          agreement: isNewFormat ? (agentData.agreement || 0) : (existingAgent.agreement || 0),
          riskLevel: isNewFormat ? (agentData.riskLevel || 'medium') : (existingAgent.risk_level || 'medium'),
          overallConfidence: isNewFormat ? (agentData.overallConfidence || 60) : (existingAgent.overall_confidence || 60),
          dataQuality: isNewFormat ? (agentData.dataQuality || 'minimal') : (existingAgent.data_quality || 'minimal'),
          processingTime: isNewFormat ? (agentData.processingTime || 0) : (existingAgent.processing_time || 0),
          analyzedAt: existingAgent.analyzed_at || new Date().toISOString()
        },
        processingTime: Date.now() - startTime,
        cached: true,
        analysisType: 'agent'
      });
        } else {
          console.log(`🔄 CACHE OUTDATED - Missing new agents (masterStrategist/geniusAnalyst), running fresh analysis`);
        }
      }
    } else {
      console.log(`📦 CACHE BYPASS - skipCache=true, running fresh analysis`);
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
        // Timeout handling: 50 saniye timeout (Vercel Pro plan limiti 60 saniye)
        const AGENT_TIMEOUT_MS = 50000;
        const agentAnalysisPromise = runAgentAnalysis(fixtureId, homeTeamId, awayTeamId);
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Agent Analysis timeout after 50 seconds')), AGENT_TIMEOUT_MS)
        );
        
        let agentAnalysis;
        try {
          agentAnalysis = await Promise.race([agentAnalysisPromise, timeoutPromise]);
        } catch (timeoutError: any) {
          if (timeoutError?.message?.includes('timeout')) {
            console.warn('⏱️ Agent Analysis timeout after 50s, falling back to Smart Analysis');
          } else {
            throw timeoutError; // Diğer hataları yukarı fırlat
          }
        }
        
        if (agentAnalysis) {
          console.log(`✅ Agent Analysis successful in ${Date.now() - startTime}ms`);
          
          // Agent Analysis'i kaydet (otomatik olarak unified_analysis'a da kaydedilir)
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
      } catch (agentError: any) {
        console.warn('⚠️ Agent Analysis failed, falling back to Smart Analysis:', agentError?.message || agentError);
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
