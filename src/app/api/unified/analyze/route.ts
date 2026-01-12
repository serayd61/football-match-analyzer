// ============================================================================
// UNIFIED ANALYSIS API
// Agent'lar ve AI'ları birleştiren tek analiz endpoint'i
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runUnifiedConsensus, saveUnifiedAnalysis, UnifiedAnalysisInput } from '@/lib/unified-consensus';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { saveAnalysisToPerformance, AnalysisRecord } from '@/lib/performance';
import { checkUserAccess, incrementAnalysisCount } from '@/lib/accessControl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lazy-loaded Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials missing for unified/analyze API!');
      throw new Error('Supabase credentials not configured');
    }

    console.log('🔗 Initializing Supabase client for unified/analyze API...');
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

/**
 * Performance tracking helper
 */
async function trackPerformance(result: any, input: UnifiedAnalysisInput) {
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
      fixtureId: input.fixtureId,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      league: input.league || 'Unknown',
      matchDate: input.matchDate || new Date().toISOString(),

      statsAgent: extractAgentPred(result.sources?.agents?.stats),
      oddsAgent: extractAgentPred(result.sources?.agents?.odds),
      deepAnalysisAgent: extractAgentPred(result.sources?.agents?.deepAnalysis),
      geniusAnalyst: extractAgentPred(result.sources?.agents?.geniusAnalyst),
      masterStrategist: extractAgentPred(result.sources?.agents?.masterStrategist),
      devilsAdvocate: extractAgentPred(result.sources?.agents?.devilsAdvocate),
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
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Access control - limit kontrolü
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    const access = await checkUserAccess(session.user.email, ip);

    if (!access.canAnalyze) {
      // Pro kontrolü - sadece Pro aboneler analiz yapabilir
      if (!access.isPro) {
        return NextResponse.json(
          {
            success: false,
            error: access.message || 'Maç analizi için Pro abonelik gereklidir',
            code: 'PRO_REQUIRED',
            access: {
              isPro: false,
              canAnalyze: false,
              message: access.message || 'Pro abonelik gereklidir',
              redirectTo: access.redirectTo || '/pricing'
            }
          },
          { status: 403 }
        );
      }
      
      // Pro kullanıcı ama limit dolmuş (nadir durum)
      return NextResponse.json(
        {
          success: false,
          error: 'Daily analysis limit reached',
          code: 'LIMIT_REACHED',
          access: {
            analysesUsed: access.analysesUsed,
            analysesLimit: access.analysesLimit,
            isPro: access.isPro
          }
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, matchDate, skipCache = false, lang = 'en', stream = false } = body;

    if (!fixtureId || !homeTeam || !awayTeam || !homeTeamId || !awayTeamId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Cache kontrolü
    if (!skipCache) {
      const supabase = getSupabase();
      const { data: cached } = await supabase
        .from('unified_analysis')
        .select('analysis, overall_confidence, agreement, created_at')
        .eq('fixture_id', fixtureId)
        .maybeSingle();

      if (cached?.analysis) {
        // Enforce 2-hour TTL for L2 Cache
        const cachedAt = new Date(cached.created_at).getTime();
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000;

        if (now - cachedAt < twoHours) {
          console.log(`📦 Returning valid cached unified analysis for fixture ${fixtureId} (${Math.round((now - cachedAt) / 60000)} min old)`);

          if (stream) {
            // Stream mode'da bile cache sonucunu gönder ama stream olarak
            const encoder = new TextEncoder();
            const customStream = new ReadableStream({
              start(controller) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ stage: 'cache', message: 'Önbellekten yükleniyor...' })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ success: true, analysis: cached.analysis, cached: true })}\n\n`));
                controller.close();
              }
            });
            return new Response(customStream, {
              headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
            });
          }

          return NextResponse.json({
            success: true,
            analysis: cached.analysis,
            processingTime: Date.now() - startTime,
            cached: true,
            cachedAt: cached.created_at
          });
        }
      }
    }

    console.log(`🎯 Starting Unified Analysis: ${homeTeam} vs ${awayTeam}`);

    // Unified consensus datası
    const input: UnifiedAnalysisInput = {
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league: league || 'Unknown',
      matchDate: matchDate || new Date().toISOString().split('T')[0],
      lang: lang as 'tr' | 'en' | 'de'
    };

    // Timeout handling: 55 saniye timeout (Vercel limiti 60 saniye, 5 saniye buffer)
    // Loglardan görünen: Agent Analysis ~40s, Smart Analysis ~10-15s = toplam ~55s
    const UNIFIED_TIMEOUT_MS = 55000;
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Unified Analysis timeout after 55 seconds')), UNIFIED_TIMEOUT_MS)
    );

    if (stream) {
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          const send = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            // Progress callback
            const onProgress = (data: { stage: string; message: string; data?: any }) => {
              send(data);
            };

            // Timeout handling for stream mode too
            const streamTimeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Unified Analysis timeout after 55 seconds')), UNIFIED_TIMEOUT_MS)
            );

            const result = await Promise.race([
              runUnifiedConsensus(input, onProgress),
              streamTimeoutPromise
            ]);

            // DB'ye kaydet (arka planda)
            saveUnifiedAnalysis(input, result).catch(e => console.error('Error saving in stream:', e));

            // Performance tracking (arka planda)
            if (session?.user?.email) {
              trackPerformance(result, input).catch(e => console.error('Error tracking performance:', e));
              incrementAnalysisCount(session.user.email).catch(e => console.error('Error incrementing count:', e));
            }

            // Sonucu gönder
            send({ success: true, analysis: result, cached: false });
            controller.close();
          } catch (error: any) {
            send({ success: false, error: error?.message || 'Analysis failed' });
            controller.close();
          }
        }
      });

      return new Response(customStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // normal flow - Timeout handling ile
    let result;
    try {
      result = await Promise.race([
        runUnifiedConsensus(input),
        timeoutPromise
      ]);
    } catch (timeoutError: any) {
      if (timeoutError?.message?.includes('timeout')) {
        console.warn('⏱️ Unified Analysis timeout after 55s');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Analiz zaman aşımına uğradı. Lütfen tekrar deneyin veya daha sonra tekrar deneyin.',
            code: 'TIMEOUT',
            timeout: true
          },
          { status: 504 }
        );
      }
      throw timeoutError; // Diğer hataları yukarı fırlat
    }

    // Veritabanına kaydet
    await saveUnifiedAnalysis(input, result);

    // Performance tracking
    if (session?.user?.email) {
      trackPerformance(result, input).catch(e => console.error('Error tracking performance:', e));
      await incrementAnalysisCount(session.user.email);
    }

    return NextResponse.json({
      success: true,
      analysis: result,
      processingTime: Date.now() - startTime,
      cached: false
    });

  } catch (error: any) {
    console.error('❌ Unified Analysis error:', error);
    
    // Timeout hatası için özel mesaj
    if (error?.message?.includes('timeout') || error?.code === 'TIMEOUT') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Analiz zaman aşımına uğradı. Lütfen tekrar deneyin.',
          code: 'TIMEOUT',
          timeout: true
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error?.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}

