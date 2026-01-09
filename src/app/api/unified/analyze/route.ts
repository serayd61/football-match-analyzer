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
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, league, matchDate, skipCache = false, lang = 'en' } = body;

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
      matchDate: matchDate || new Date().toISOString().split('T')[0],
      lang: lang as 'tr' | 'en' | 'de'
    };

    const result = await runUnifiedConsensus(input);

    // Veritabanına kaydet - unified_analysis tablosuna
    console.log(`💾 Attempting to save to unified_analysis for fixture ${fixtureId}...`);
    const unifiedSaveResult = await saveUnifiedAnalysis(input, result);
    console.log(`💾 Unified analysis save result: ${unifiedSaveResult ? '✅ SUCCESS' : '❌ FAILED'}`);

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

    // Analiz sayacını artır (limit kontrolü için)
    if (!skipCache) {
      await incrementAnalysisCount(session.user.email);
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

