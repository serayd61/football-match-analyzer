// ============================================================================
// QUAD-BRAIN API ENDPOINT
// 4 AI Model Consensus Architecture for Football Predictions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runQuadBrainAnalysis, EnhancedMatchData, QuadBrainAPIResponse } from '@/lib/quad-brain';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/analysisCache';
import { fetchCompleteMatchData, fetchMatchDataByFixtureId } from '@/lib/heurist/sportmonks-data';
import { savePrediction } from '@/lib/admin/service';
import { savePredictionSession, type ModelPrediction } from '@/lib/admin/enhanced-service';

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

    // ═══════════════════════════════════════════════════════════════════════
    // 📊 ADMIN PANEL - TAHMİN KAYDET
    // ═══════════════════════════════════════════════════════════════════════
    if (result.success && result.consensus) {
      try {
        await savePrediction({
          fixtureId: fixtureId || 0,
          homeTeam,
          awayTeam,
          league: league || 'Unknown',
          matchDate: matchData.matchDate || new Date().toISOString(),
          analysisType: 'quad-brain',
          predictions: {
            claude: result.individualPredictions?.claude ? {
              matchResult: result.individualPredictions.claude.predictions?.matchResult?.prediction || '',
              matchResultConfidence: result.individualPredictions.claude.predictions?.matchResult?.confidence || 0,
              over25: result.individualPredictions.claude.predictions?.overUnder25?.prediction || '',
              over25Confidence: result.individualPredictions.claude.predictions?.overUnder25?.confidence || 0,
              btts: result.individualPredictions.claude.predictions?.btts?.prediction || '',
              bttsConfidence: result.individualPredictions.claude.predictions?.btts?.confidence || 0,
            } : undefined,
            gpt4: result.individualPredictions?.gpt4 ? {
              matchResult: result.individualPredictions.gpt4.predictions?.matchResult?.prediction || '',
              matchResultConfidence: result.individualPredictions.gpt4.predictions?.matchResult?.confidence || 0,
              over25: result.individualPredictions.gpt4.predictions?.overUnder25?.prediction || '',
              over25Confidence: result.individualPredictions.gpt4.predictions?.overUnder25?.confidence || 0,
              btts: result.individualPredictions.gpt4.predictions?.btts?.prediction || '',
              bttsConfidence: result.individualPredictions.gpt4.predictions?.btts?.confidence || 0,
            } : undefined,
            gemini: result.individualPredictions?.gemini ? {
              matchResult: result.individualPredictions.gemini.predictions?.matchResult?.prediction || '',
              matchResultConfidence: result.individualPredictions.gemini.predictions?.matchResult?.confidence || 0,
              over25: result.individualPredictions.gemini.predictions?.overUnder25?.prediction || '',
              over25Confidence: result.individualPredictions.gemini.predictions?.overUnder25?.confidence || 0,
              btts: result.individualPredictions.gemini.predictions?.btts?.prediction || '',
              bttsConfidence: result.individualPredictions.gemini.predictions?.btts?.confidence || 0,
            } : undefined,
            perplexity: result.individualPredictions?.perplexity ? {
              matchResult: result.individualPredictions.perplexity.predictions?.matchResult?.prediction || '',
              matchResultConfidence: result.individualPredictions.perplexity.predictions?.matchResult?.confidence || 0,
              over25: result.individualPredictions.perplexity.predictions?.overUnder25?.prediction || '',
              over25Confidence: result.individualPredictions.perplexity.predictions?.overUnder25?.confidence || 0,
              btts: result.individualPredictions.perplexity.predictions?.btts?.prediction || '',
              bttsConfidence: result.individualPredictions.perplexity.predictions?.btts?.confidence || 0,
            } : undefined,
          },
          consensus: {
            matchResult: {
              prediction: result.consensus.matchResult?.prediction || '',
              confidence: result.consensus.matchResult?.confidence || 0,
              agreement: result.consensus.matchResult?.agreement?.weightedAgreement || 0,
            },
            over25: {
              prediction: result.consensus.overUnder25?.prediction || '',
              confidence: result.consensus.overUnder25?.confidence || 0,
              agreement: result.consensus.overUnder25?.agreement?.weightedAgreement || 0,
            },
            btts: {
              prediction: result.consensus.btts?.prediction || '',
              confidence: result.consensus.btts?.confidence || 0,
              agreement: result.consensus.btts?.agreement?.weightedAgreement || 0,
            },
          },
          bestBets: result.bestBets?.map((bet, idx) => ({
            rank: bet.rank || idx + 1,
            market: bet.market || '',
            selection: bet.selection || '',
            confidence: bet.confidence || 0,
            reasoning: bet.reasoning || '',
          })) || [],
          riskLevel: result.riskAssessment?.overall || 'medium',
          riskFactors: result.riskAssessment?.factors || [],
          dataQualityScore: result.dataQuality?.overall || 70,
        });
        console.log('📊 Quad-Brain prediction saved to Admin Panel');
      } catch (saveError) {
        console.error('⚠️ Admin Panel save failed (non-blocking):', saveError);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 📊 ENHANCED ADMIN - YENİ TAHMİN TAKİP SİSTEMİ
      // ═══════════════════════════════════════════════════════════════════════
      try {
        const modelPredictions: ModelPrediction[] = [];
        
        // Add Claude predictions
        if (result.individualPredictions?.claude) {
          const cp = result.individualPredictions.claude.predictions;
          modelPredictions.push({
            session_id: '',
            model_name: 'claude',
            model_type: 'llm',
            btts_prediction: cp?.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
            btts_confidence: cp?.btts?.confidence || 0,
            over_under_prediction: cp?.overUnder25?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
            over_under_confidence: cp?.overUnder25?.confidence || 0,
            match_result_prediction: cp?.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                     cp?.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
            match_result_confidence: cp?.matchResult?.confidence || 0,
          });
        }
        
        // Add GPT-4 predictions
        if (result.individualPredictions?.gpt4) {
          const gp = result.individualPredictions.gpt4.predictions;
          modelPredictions.push({
            session_id: '',
            model_name: 'gpt4',
            model_type: 'llm',
            btts_prediction: gp?.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
            btts_confidence: gp?.btts?.confidence || 0,
            over_under_prediction: gp?.overUnder25?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
            over_under_confidence: gp?.overUnder25?.confidence || 0,
            match_result_prediction: gp?.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                     gp?.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
            match_result_confidence: gp?.matchResult?.confidence || 0,
          });
        }
        
        // Add Gemini predictions
        if (result.individualPredictions?.gemini) {
          const gep = result.individualPredictions.gemini.predictions;
          modelPredictions.push({
            session_id: '',
            model_name: 'gemini',
            model_type: 'llm',
            btts_prediction: gep?.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
            btts_confidence: gep?.btts?.confidence || 0,
            over_under_prediction: gep?.overUnder25?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
            over_under_confidence: gep?.overUnder25?.confidence || 0,
            match_result_prediction: gep?.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                     gep?.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
            match_result_confidence: gep?.matchResult?.confidence || 0,
          });
        }
        
        // Add Perplexity predictions
        if (result.individualPredictions?.perplexity) {
          const pp = result.individualPredictions.perplexity.predictions;
          modelPredictions.push({
            session_id: '',
            model_name: 'perplexity',
            model_type: 'llm',
            btts_prediction: pp?.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
            btts_confidence: pp?.btts?.confidence || 0,
            over_under_prediction: pp?.overUnder25?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
            over_under_confidence: pp?.overUnder25?.confidence || 0,
            match_result_prediction: pp?.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                     pp?.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
            match_result_confidence: pp?.matchResult?.confidence || 0,
          });
        }

        await savePredictionSession({
          fixture_id: fixtureId || 0,
          home_team: homeTeam,
          away_team: awayTeam,
          league: league || 'Unknown',
          match_date: matchData.matchDate || new Date().toISOString(),
          prediction_source: 'quad_brain',
          session_type: 'manual',
          consensus_btts: result.consensus.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
          consensus_btts_confidence: result.consensus.btts?.confidence || 0,
          consensus_over_under: result.consensus.overUnder25?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
          consensus_over_under_confidence: result.consensus.overUnder25?.confidence || 0,
          consensus_match_result: result.consensus.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                  result.consensus.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
          consensus_match_result_confidence: result.consensus.matchResult?.confidence || 0,
          best_bet_1_market: result.bestBets?.[0]?.market || null,
          best_bet_1_selection: result.bestBets?.[0]?.selection || null,
          best_bet_1_confidence: result.bestBets?.[0]?.confidence || null,
          best_bet_2_market: result.bestBets?.[1]?.market || null,
          best_bet_2_selection: result.bestBets?.[1]?.selection || null,
          best_bet_2_confidence: result.bestBets?.[1]?.confidence || null,
          best_bet_3_market: result.bestBets?.[2]?.market || null,
          best_bet_3_selection: result.bestBets?.[2]?.selection || null,
          best_bet_3_confidence: result.bestBets?.[2]?.confidence || null,
          risk_level: result.riskAssessment?.overall === 'high' ? 'high' : 
                      result.riskAssessment?.overall === 'low' ? 'low' : 'medium',
        }, modelPredictions);
        
        console.log('📊 Enhanced Quad-Brain tracking saved!');
      } catch (enhancedSaveError) {
        console.error('⚠️ Enhanced tracking save failed (non-blocking):', enhancedSaveError);
      }
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

