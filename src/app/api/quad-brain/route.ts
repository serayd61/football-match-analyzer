// ============================================================================
// QUAD-BRAIN API ENDPOINT
// 4 AI Model Consensus Architecture for Football Predictions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runQuadBrainAnalysis, EnhancedMatchData, QuadBrainAPIResponse } from '@/lib/quad-brain';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/analysisCache';
import { fetchCompleteMatchData, fetchMatchDataByFixtureId } from '@/lib/heurist/sportmonks-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 saniye timeout

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<QuadBrainAPIResponse>> {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      leagueId,
      fixtureId,
      language = 'en',
      fetchNews = true,
      trackPerformance = true,
      matchData: providedMatchData
    } = body;

    console.log('\n' + '═'.repeat(70));
    console.log('🧠 QUAD-BRAIN API REQUEST');
    console.log('═'.repeat(70));
    console.log(`Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`Fixture ID: ${fixtureId || 'N/A'}`);
    console.log(`Language: ${language}`);
    console.log('═'.repeat(70));

    // Validation
    if (!homeTeam || !awayTeam) {
      return NextResponse.json({
        success: false,
        error: language === 'tr' 
          ? 'Takım adları gerekli.' 
          : language === 'de' 
          ? 'Teamnamen erforderlich.' 
          : 'Team names required.'
      }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📦 CACHE KONTROLÜ
    // ═══════════════════════════════════════════════════════════════════════
    const cacheKey = fixtureId || `${homeTeamId}-${awayTeamId}`;
    const cached = getCachedAnalysis(cacheKey, language, 'quad-brain');
    
    if (cached) {
      console.log(`📦 CACHE HIT - Returning cached analysis from ${cached.cachedAt.toLocaleTimeString()}`);
      return NextResponse.json({
        success: true,
        result: cached.data,
        cached: true,
        cachedAt: cached.cachedAt.toISOString()
      });
    }
    console.log('📦 CACHE MISS - Running fresh Quad-Brain analysis');

    // ═══════════════════════════════════════════════════════════════════════
    // 📊 VERİ HAZIRLAMA
    // ═══════════════════════════════════════════════════════════════════════
    let matchData: EnhancedMatchData;

    if (providedMatchData) {
      // Veri zaten sağlanmış - direkt kullan
      console.log('📊 Using PROVIDED match data');
      matchData = convertToEnhancedMatchData(providedMatchData, homeTeam, awayTeam, league, fixtureId);
    } else if (fixtureId && homeTeamId && awayTeamId) {
      // SportMonks'tan veri çek
      console.log('📊 Fetching data from SportMonks...');
      const sportmonksData = await fetchCompleteMatchData(
        fixtureId,
        homeTeamId,
        awayTeamId,
        homeTeam,
        awayTeam,
        league || 'Unknown',
        leagueId
      );
      matchData = convertToEnhancedMatchData(sportmonksData, homeTeam, awayTeam, league, fixtureId);
    } else if (fixtureId) {
      // Sadece fixture ID ile veri çek
      console.log('📊 Fetching data by fixture ID...');
      const sportmonksData = await fetchMatchDataByFixtureId(fixtureId);
      if (!sportmonksData) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch match data'
        }, { status: 500 });
      }
      matchData = convertToEnhancedMatchData(sportmonksData, homeTeam, awayTeam, league, fixtureId);
    } else {
      // Minimum veri ile devam et
      console.log('📊 Using minimum match data');
      matchData = {
        fixtureId: 0,
        homeTeam,
        awayTeam,
        homeTeamId: homeTeamId || 0,
        awayTeamId: awayTeamId || 0,
        league: league || 'Unknown',
        homeForm: {
          form: 'DDDDD',
          points: 5,
          wins: 1,
          draws: 2,
          losses: 2,
          avgGoals: '1.2',
          avgConceded: '1.2',
          over25Percentage: '50',
          bttsPercentage: '50',
          cleanSheetPercentage: '20'
        },
        awayForm: {
          form: 'DDDDD',
          points: 5,
          wins: 1,
          draws: 2,
          losses: 2,
          avgGoals: '1.0',
          avgConceded: '1.0',
          over25Percentage: '50',
          bttsPercentage: '50',
          cleanSheetPercentage: '20'
        }
      };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🧠 QUAD-BRAIN ANALİZ
    // ═══════════════════════════════════════════════════════════════════════
    const result = await runQuadBrainAnalysis(matchData, {
      language,
      fetchNews,
      trackPerformance
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 📦 CACHE'E KAYDET
    // ═══════════════════════════════════════════════════════════════════════
    if (result.success) {
      setCachedAnalysis(cacheKey, language, 'quad-brain', result);
      console.log(`📦 Analysis cached for ${cacheKey}:${language}`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ API Request completed in ${totalTime}ms\n`);

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error: any) {
    console.error('❌ QUAD-BRAIN API ERROR:', error);
    return NextResponse.json({
      success: false,
      error: `Error: ${error.message}`
    }, { status: 500 });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * SportMonks verisini EnhancedMatchData formatına dönüştürür
 */
function convertToEnhancedMatchData(
  data: any,
  homeTeam: string,
  awayTeam: string,
  league: string | undefined,
  fixtureId: number | undefined
): EnhancedMatchData {
  return {
    fixtureId: fixtureId || data.fixtureId || 0,
    homeTeam: homeTeam || data.homeTeam,
    awayTeam: awayTeam || data.awayTeam,
    homeTeamId: data.homeTeamId || 0,
    awayTeamId: data.awayTeamId || 0,
    league: league || data.league || 'Unknown',
    leagueId: data.leagueId,
    matchDate: data.matchDate,

    homeForm: {
      form: data.homeForm?.form || 'DDDDD',
      points: data.homeForm?.points || 5,
      wins: data.homeForm?.wins || 1,
      draws: data.homeForm?.draws || 2,
      losses: data.homeForm?.losses || 2,
      avgGoals: String(data.homeForm?.avgGoals || '1.2'),
      avgConceded: String(data.homeForm?.avgConceded || '1.2'),
      over25Percentage: String(data.homeForm?.over25Percentage || '50'),
      bttsPercentage: String(data.homeForm?.bttsPercentage || '50'),
      cleanSheetPercentage: String(data.homeForm?.cleanSheetPercentage || '20'),
      venueForm: data.homeForm?.venueForm,
      venueAvgScored: data.homeForm?.venueAvgScored,
      venueAvgConceded: data.homeForm?.venueAvgConceded,
      venueOver25Pct: data.homeForm?.venueOver25Pct,
      venueBttsPct: data.homeForm?.venueBttsPct,
      matches: data.homeForm?.matches,
      record: data.homeForm?.record,
      matchCount: data.homeForm?.matchCount
    },

    awayForm: {
      form: data.awayForm?.form || 'DDDDD',
      points: data.awayForm?.points || 5,
      wins: data.awayForm?.wins || 1,
      draws: data.awayForm?.draws || 2,
      losses: data.awayForm?.losses || 2,
      avgGoals: String(data.awayForm?.avgGoals || '1.0'),
      avgConceded: String(data.awayForm?.avgConceded || '1.0'),
      over25Percentage: String(data.awayForm?.over25Percentage || '50'),
      bttsPercentage: String(data.awayForm?.bttsPercentage || '50'),
      cleanSheetPercentage: String(data.awayForm?.cleanSheetPercentage || '20'),
      venueForm: data.awayForm?.venueForm,
      venueAvgScored: data.awayForm?.venueAvgScored,
      venueAvgConceded: data.awayForm?.venueAvgConceded,
      venueOver25Pct: data.awayForm?.venueOver25Pct,
      venueBttsPct: data.awayForm?.venueBttsPct,
      matches: data.awayForm?.matches,
      record: data.awayForm?.record,
      matchCount: data.awayForm?.matchCount
    },

    h2h: data.h2h ? {
      totalMatches: data.h2h.totalMatches || 0,
      homeWins: data.h2h.homeWins || 0,
      awayWins: data.h2h.awayWins || 0,
      draws: data.h2h.draws || 0,
      avgGoals: data.h2h.avgGoals,
      over25Percentage: data.h2h.over25Percentage,
      bttsPercentage: data.h2h.bttsPercentage,
      recentMatches: data.h2h.recentMatches
    } : undefined,

    odds: data.odds ? {
      matchWinner: data.odds.matchWinner,
      overUnder: data.odds.overUnder,
      btts: data.odds.btts
    } : undefined,

    oddsHistory: data.oddsHistory,

    detailedStats: data.detailedStats
  };
}

// ============================================================================
// GET HANDLER - Health Check
// ============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'Quad-Brain AI Ensemble',
    version: '2.0',
    models: ['Claude (Tactical)', 'GPT-4 (Statistical)', 'Gemini (Pattern)', 'Perplexity (Contextual)'],
    features: [
      'Debate Protocol for conflict resolution',
      'Dynamic weighting based on data quality',
      'Performance tracking & calibration',
      'Real-time news integration'
    ],
    timestamp: new Date().toISOString()
  });
}

