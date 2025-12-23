// ============================================================================
// API V2: ANALYZE - Smart Analyzer Endpoint
// Tek maç için hızlı analiz (10-15 saniye)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runSmartAnalysis, saveSmartAnalysis, SmartAnalysisResult } from '@/lib/smart-analyzer';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 saniye max

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
    
    // Mevcut analizi kontrol et
    const { data: existingDb } = await supabase
      .from('smart_analysis')
      .select('analysis')
      .eq('fixture_id', fixtureId)
      .maybeSingle();
    
    if (existingDb?.analysis) {
      console.log(`📦 Returning cached analysis for fixture ${fixtureId}`);
      return NextResponse.json({
        success: true,
        analysis: existingDb.analysis,
        processingTime: Date.now() - startTime,
        cached: true
      });
    }
    
    console.log(`🎯 Starting Smart Analysis: ${homeTeam} vs ${awayTeam}`);
    console.log(`📊 Input data: fixtureId=${fixtureId}, homeTeamId=${homeTeamId}, awayTeamId=${awayTeamId}`);
    
    // Analiz yap
    const analysis = await runSmartAnalysis({
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      matchDate
    });
    
    if (!analysis) {
      return NextResponse.json({ success: false, error: 'Analysis failed' }, { status: 500 });
    }
    
    // Supabase'e kaydet
    await saveSmartAnalysis({
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      matchDate
    }, analysis);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Analysis complete: ${homeTeam} vs ${awayTeam} in ${totalTime}ms`);
    
    return NextResponse.json({
      success: true,
      analysis,
      processingTime: totalTime,
      cached: false
    });
    
  } catch (error) {
    console.error('POST Analysis error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
