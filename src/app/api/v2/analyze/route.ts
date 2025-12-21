// ============================================================================
// API V2: ANALYZE - Smart Analyzer Endpoint
// Tek maç için hızlı analiz (10-15 saniye)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { analyzeMatch, SmartAnalysis } from '@/lib/smart-analyzer';
import { getOrSet, CACHE_KEYS, CACHE_TTL, setAnalysisStatus, getAnalysisStatus } from '@/lib/cache/redis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 saniye max

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// GET - Mevcut analizi getir
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixture_id');
    
    if (!fixtureId) {
      return NextResponse.json({ success: false, error: 'fixture_id required' }, { status: 400 });
    }
    
    const fixtureIdNum = parseInt(fixtureId);
    
    // 1. Önce cache'den kontrol et
    const cacheKey = CACHE_KEYS.ANALYSIS(fixtureIdNum);
    
    const cached = await getOrSet<SmartAnalysis | null>(
      cacheKey,
      async () => {
        // 2. Cache'de yoksa Supabase'den al
        const { data, error } = await supabase
          .from('smart_analysis')
          .select('*')
          .eq('fixture_id', fixtureIdNum)
          .maybeSingle();
        
        if (error || !data) return null;
        
        return data.analysis as SmartAnalysis;
      },
      CACHE_TTL.ANALYSIS
    );
    
    if (!cached) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found',
        fixture_id: fixtureIdNum
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      analysis: cached,
      processingTime: Date.now() - startTime,
      cached: true
    });
    
  } catch (error) {
    console.error('GET Analysis error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

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
    
    // Önce mevcut analizi kontrol et
    const status = await getAnalysisStatus(fixtureId);
    
    if (status.status === 'processing') {
      return NextResponse.json({
        success: false,
        error: 'Analysis already in progress',
        status: 'processing'
      }, { status: 409 });
    }
    
    // Cache'de var mı?
    const cacheKey = CACHE_KEYS.ANALYSIS(fixtureId);
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
    
    // Processing durumuna al
    await setAnalysisStatus(fixtureId, 'processing');
    
    console.log(`🎯 Starting Smart Analysis: ${homeTeam} vs ${awayTeam}`);
    
    // Analiz yap
    const analysis = await analyzeMatch({
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      matchDate
    });
    
    // Supabase'e kaydet
    const { error: saveError } = await supabase
      .from('smart_analysis')
      .upsert({
        fixture_id: fixtureId,
        home_team: homeTeam,
        away_team: awayTeam,
        league,
        match_date: matchDate,
        analysis,
        btts_prediction: analysis.btts.prediction,
        btts_confidence: analysis.btts.confidence,
        over_under_prediction: analysis.overUnder.prediction,
        over_under_confidence: analysis.overUnder.confidence,
        match_result_prediction: analysis.matchResult.prediction,
        match_result_confidence: analysis.matchResult.confidence,
        agreement: analysis.agreement,
        risk_level: analysis.riskLevel,
        overall_confidence: analysis.overallConfidence,
        processing_time: analysis.processingTime,
        models_used: analysis.modelsUsed,
        created_at: new Date().toISOString()
      }, { onConflict: 'fixture_id' });
    
    if (saveError) {
      console.error('Save error:', saveError);
    }
    
    // Durumu güncelle
    await setAnalysisStatus(fixtureId, 'completed', { analysisId: fixtureId });
    
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

