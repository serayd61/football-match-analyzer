// ============================================================================
// API V2: PROCESS ANALYSIS - QStash Webhook Receiver
// Background job olarak çalışır, timeout sorunu yok
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runSmartAnalysis, saveSmartAnalysis } from '@/lib/smart-analyzer';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 dakika max

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================================
// POST - QStash'ten gelen job'ı işle
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse job data
    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, matchDate } = body;
    
    if (!fixtureId || !homeTeam || !awayTeam) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    console.log(`📥 Processing job: ${homeTeam} vs ${awayTeam} (${fixtureId})`);
    
    // Zaten analiz edilmiş mi?
    const { data: existing } = await supabase
      .from('smart_analysis')
      .select('id')
      .eq('fixture_id', fixtureId)
      .maybeSingle();
    
    if (existing) {
      console.log(`⏭️ Already analyzed: ${homeTeam} vs ${awayTeam}`);
      return NextResponse.json({ success: true, skipped: true, reason: 'Already analyzed' });
    }
    
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
      console.error('Analysis failed');
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
    console.log(`✅ Job complete: ${homeTeam} vs ${awayTeam} in ${totalTime}ms`);
    
    return NextResponse.json({
      success: true,
      fixtureId,
      processingTime: totalTime
    });
    
  } catch (error) {
    console.error('Process analysis error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
