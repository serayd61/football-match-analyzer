// ============================================================================
// AGENT ANALYSIS API - Heurist Blockchain Agents ile analiz
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runAgentAnalysis, saveAgentAnalysis } from '@/lib/agent-analyzer';
import { getOrSet, CACHE_KEYS, CACHE_TTL, setAnalysisStatus, getAnalysisStatus, getRedisClient } from '@/lib/cache/redis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET: Mevcut agent analizini çek
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fixtureId = parseInt(searchParams.get('fixtureId') || '0');
    
    if (!fixtureId) {
      return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
    }
    
    // Cache'den kontrol et
    const cacheKey = CACHE_KEYS.AGENT_ANALYSIS(fixtureId);
    const cached = await getOrSet(cacheKey, async () => {
      const { data, error } = await supabase
        .from('agent_analysis')
        .select('*')
        .eq('fixture_id', fixtureId)
        .single();
      
      if (error || !data) return null;
      return data;
    }, CACHE_TTL.ANALYSIS);
    
    if (cached) {
      return NextResponse.json({
        success: true,
        analysis: cached,
        cached: true
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Analysis not found'
    });
    
  } catch (error: any) {
    console.error('❌ GET agent analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agent analysis' },
      { status: 500 }
    );
  }
}

// POST: Yeni agent analizi başlat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId, homeTeamId, awayTeamId } = body;
    
    if (!fixtureId || !homeTeamId || !awayTeamId) {
      return NextResponse.json(
        { error: 'fixtureId, homeTeamId, and awayTeamId are required' },
        { status: 400 }
      );
    }
    
    // Analysis status kontrolü
    const existingStatus = await getAnalysisStatus(fixtureId);
    
    if (existingStatus && existingStatus.status === 'processing') {
      return NextResponse.json({
        success: false,
        message: 'Analysis already in progress',
        status: 'processing'
      });
    }
    
    // Mevcut analizi kontrol et
    const cacheKey = CACHE_KEYS.AGENT_ANALYSIS(fixtureId);
    const existing = await getOrSet(cacheKey, async () => {
      const { data } = await supabase
        .from('agent_analysis')
        .select('*')
        .eq('fixture_id', fixtureId)
        .single();
      return data;
    }, CACHE_TTL.ANALYSIS);
    
    if (existing) {
      return NextResponse.json({
        success: true,
        analysis: existing,
        cached: true
      });
    }
    
    // Status'u processing olarak işaretle
    await setAnalysisStatus(fixtureId, 'processing');
    
    try {
      // Agent analizini çalıştır
      console.log(`🤖 Starting agent analysis for fixture ${fixtureId}...`);
      const analysis = await runAgentAnalysis(fixtureId, homeTeamId, awayTeamId);
      
      if (!analysis) {
        await setAnalysisStatus(fixtureId, 'failed');
        return NextResponse.json(
          { error: 'Agent analysis failed' },
          { status: 500 }
        );
      }
      
      // Database'e kaydet
      await saveAgentAnalysis(analysis);
      
      // Cache'e kaydet
      const cacheKey = CACHE_KEYS.AGENT_ANALYSIS(fixtureId);
      const redis = getRedisClient();
      await redis.set(cacheKey, analysis, { ex: CACHE_TTL.ANALYSIS });
      
      // Status'u completed olarak işaretle
      await setAnalysisStatus(fixtureId, 'completed');
      
      return NextResponse.json({
        success: true,
        analysis,
        cached: false
      });
      
    } catch (analysisError: any) {
      await setAnalysisStatus(fixtureId, 'failed');
      throw analysisError;
    }
    
  } catch (error: any) {
    console.error('❌ POST agent analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run agent analysis' },
      { status: 500 }
    );
  }
}

