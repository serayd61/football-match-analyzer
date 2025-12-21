// ============================================================================
// API V2: PROCESS ANALYSIS - QStash Webhook Receiver
// Background job olarak çalışır, timeout sorunu yok
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { analyzeMatch } from '@/lib/smart-analyzer';
import { setAnalysisStatus } from '@/lib/cache/redis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 dakika max (QStash background)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// QStash signature verification
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

// ============================================================================
// POST - QStash'ten gelen job'ı işle
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify QStash signature (production'da zorunlu)
    const signature = request.headers.get('upstash-signature');
    const body = await request.text();
    
    // Development modunda signature kontrolünü atla
    if (process.env.NODE_ENV === 'production' && signature) {
      try {
        const isValid = await receiver.verify({
          signature,
          body,
        });
        
        if (!isValid) {
          console.error('❌ Invalid QStash signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } catch (verifyError) {
        console.error('❌ Signature verification error:', verifyError);
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
      }
    }
    
    // Parse job data
    const job = JSON.parse(body);
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, matchDate } = job;
    
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
    
    // Processing durumuna al
    await setAnalysisStatus(fixtureId, 'processing');
    
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
      await setAnalysisStatus(fixtureId, 'failed', { error: saveError.message });
      return NextResponse.json({ success: false, error: saveError.message }, { status: 500 });
    }
    
    // Durumu güncelle
    await setAnalysisStatus(fixtureId, 'completed');
    
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

