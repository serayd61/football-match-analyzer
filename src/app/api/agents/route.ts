// src/app/api/agents/route.ts
// Professional Agent Analysis API - v6
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG:
// v6 - Strategy Agent integration with multi-model and sentiment data
// v5 - Added record and matchCount fields (fixes N/A issue)
// v5 - Better data mapping for UI display
// ═══════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { runMultiModelAnalysis } from '@/lib/heurist/multiModel';
import { runStrategyAgent } from '@/lib/heurist/agents/strategy';  // ← YENİ!
import { savePrediction } from '@/lib/predictions';
import { fetchCompleteMatchData } from '@/lib/heurist/sportmonks-data';

// ==================== DATA QUALITY THRESHOLD ====================
const MIN_DATA_QUALITY = 30;

// ==================== PROFESSIONAL OVER/UNDER CALCULATION ====================

function calculateProfessionalOverUnder(
  homeStats: any,
  awayStats: any,
  h2h: any
): { prediction: string; confidence: number; breakdown: any } {
  
  const WEIGHTS = {
    homeVenue: 0.30,
    awayVenue: 0.30,
    h2h: 0.25,
    general: 0.15,
  };

  const homeVenueOver = homeStats?.venueOver25Pct ?? parseInt(homeStats?.over25Percentage || '50');
  const awayVenueOver = awayStats?.venueOver25Pct ?? parseInt(awayStats?.over25Percentage || '50');
  const h2hOver = parseInt(h2h?.over25Percentage || '50');
  const generalOver = (parseInt(homeStats?.over25Percentage || '50') + parseInt(awayStats?.over25Percentage || '50')) / 2;

  const weightedOver = 
    (homeVenueOver * WEIGHTS.homeVenue) +
    (awayVenueOver * WEIGHTS.awayVenue) +
    (h2hOver * WEIGHTS.h2h) +
    (generalOver * WEIGHTS.general);

  const homeExpectedScored = parseFloat(homeStats?.venueAvgScored || homeStats?.avgGoalsScored || '1.2');
  const homeExpectedConceded = parseFloat(homeStats?.venueAvgConceded || homeStats?.avgGoalsConceded || '1.0');
  const awayExpectedScored = parseFloat(awayStats?.venueAvgScored || awayStats?.avgGoalsScored || '1.0');
  const awayExpectedConceded = parseFloat(awayStats?.venueAvgConceded || awayStats?.avgGoalsConceded || '1.2');

  const homeExpected = (homeExpectedScored + awayExpectedConceded) / 2;
  const awayExpected = (awayExpectedScored + homeExpectedConceded) / 2;
  const expectedTotal = homeExpected + awayExpected;

  const prediction = weightedOver >= 50 ? 'Over' : 'Under';
  const confidence = Math.min(85, Math.max(50, Math.abs(weightedOver - 50) + 55));

  return {
    prediction,
    confidence: Math.round(confidence),
    breakdown: {
      homeVenueOver,
      awayVenueOver,
      h2hOver,
      generalOver: Math.round(generalOver),
      weightedOver: Math.round(weightedOver),
      expectedTotal: expectedTotal.toFixed(2),
      homeExpected: homeExpected.toFixed(2),
      awayExpected: awayExpected.toFixed(2),
      weights: WEIGHTS,
    }
  };
}

// ==================== MAIN API ENDPOINT ====================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const access = await checkUserAccess(session.user.email, ip);

    if (!access.canUseAgents) {
      return NextResponse.json({ 
        error: 'Pro subscription required for AI Agents',
        requiresPro: true 
      }, { status: 403 });
    }

    // Parse request
    const body = await request.json();
    const { 
      fixtureId, 
      homeTeam, 
      awayTeam, 
      homeTeamId, 
      awayTeamId, 
      league = '', 
      language = 'en', 
      useMultiModel = true 
    } = body;

    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
    }

    console.log('');
    console.log('🤖 ═══════════════════════════════════════════════════════════════');
    console.log('🤖 PROFESSIONAL AGENT ANALYSIS v6 (with Strategy Agent)');
    console.log('🤖 ═══════════════════════════════════════════════════════════════');
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🆔 IDs: Home=${homeTeamId}, Away=${awayTeamId}, Fixture=${fixtureId}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 1: Fetch Complete Match Data
    // ═══════════════════════════════════════════════════════════════════════════
    
    const dataFetchStart = Date.now();
    
    const completeMatchData = await fetchCompleteMatchData(
      fixtureId,
      homeTeamId,
      awayTeamId,
      homeTeam,
      awayTeam,
      league
    );
    
    const dataFetchTime = Date.now() - dataFetchStart;
    console.log(`⏱️ Data fetch completed in ${dataFetchTime}ms`);

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 2: Data Quality Check
    // ═══════════════════════════════════════════════════════════════════════════
    
    const dataQuality = completeMatchData.dataQuality;
    
    if (dataQuality && dataQuality.score < MIN_DATA_QUALITY) {
      console.log(`⚠️ Data quality too low: ${dataQuality.score}/100`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 3: Professional Over/Under Calculation
    // ═══════════════════════════════════════════════════════════════════════════
    
    const overUnderCalc = calculateProfessionalOverUnder(
      completeMatchData.homeForm,
      completeMatchData.awayForm,
      completeMatchData.h2h
    );
    
    console.log('');
    console.log('🎯 PROFESSIONAL OVER/UNDER CALCULATION');
    console.log(`   🎯 WEIGHTED OVER 2.5: ${overUnderCalc.breakdown.weightedOver}%`);
    console.log(`   🎯 PREDICTION: ${overUnderCalc.prediction} (${overUnderCalc.confidence}% güven)`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 4: Prepare Match Data for Agents
    // ═══════════════════════════════════════════════════════════════════════════
    
    const matchData: any = {
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league,
      date: new Date().toISOString(),
      odds: completeMatchData.odds,
      homeForm: {
        form: completeMatchData.homeForm.form,
        points: completeMatchData.homeForm.points,
        avgGoals: completeMatchData.homeForm.avgGoalsScored,
        avgConceded: completeMatchData.homeForm.avgGoalsConceded,
        over25Percentage: completeMatchData.homeForm.over25Percentage,
        bttsPercentage: completeMatchData.homeForm.bttsPercentage,
        cleanSheetPercentage: completeMatchData.homeForm.cleanSheetPercentage,
        failedToScorePercentage: completeMatchData.homeForm.failedToScorePercentage,
        matches: completeMatchData.homeForm.matchDetails,
        record: completeMatchData.homeForm.record,
        matchCount: completeMatchData.homeForm.matchCount,
        venueForm: completeMatchData.homeForm.venueForm,
        venuePoints: completeMatchData.homeForm.venuePoints,
        venueAvgScored: completeMatchData.homeForm.venueAvgScored,
        venueAvgConceded: completeMatchData.homeForm.venueAvgConceded,
        venueOver25Pct: completeMatchData.homeForm.venueOver25Pct,
        venueBttsPct: completeMatchData.homeForm.venueBttsPct,
        venueMatchCount: completeMatchData.homeForm.venueMatchCount,
        venueRecord: completeMatchData.homeForm.venueRecord,
      },
      awayForm: {
        form: completeMatchData.awayForm.form,
        points: completeMatchData.awayForm.points,
        avgGoals: completeMatchData.awayForm.avgGoalsScored,
        avgConceded: completeMatchData.awayForm.avgGoalsConceded,
        over25Percentage: completeMatchData.awayForm.over25Percentage,
        bttsPercentage: completeMatchData.awayForm.bttsPercentage,
        cleanSheetPercentage: completeMatchData.awayForm.cleanSheetPercentage,
        failedToScorePercentage: completeMatchData.awayForm.failedToScorePercentage,
        matches: completeMatchData.awayForm.matchDetails,
        record: completeMatchData.awayForm.record,
        matchCount: completeMatchData.awayForm.matchCount,
        venueForm: completeMatchData.awayForm.venueForm,
        venuePoints: completeMatchData.awayForm.venuePoints,
        venueAvgScored: completeMatchData.awayForm.venueAvgScored,
        venueAvgConceded: completeMatchData.awayForm.venueAvgConceded,
        venueOver25Pct: completeMatchData.awayForm.venueOver25Pct,
        venueBttsPct: completeMatchData.awayForm.venueBttsPct,
        venueMatchCount: completeMatchData.awayForm.venueMatchCount,
        venueRecord: completeMatchData.awayForm.venueRecord,
      },
      h2h: {
        totalMatches: completeMatchData.h2h.totalMatches,
        homeWins: completeMatchData.h2h.homeWins,
        awayWins: completeMatchData.h2h.awayWins,
        draws: completeMatchData.h2h.draws,
        avgGoals: completeMatchData.h2h.avgTotalGoals,
        over25Percentage: completeMatchData.h2h.over25Percentage,
        bttsPercentage: completeMatchData.h2h.bttsPercentage,
        matchDetails: completeMatchData.h2h.matchDetails,
      },
      detailedStats: {
        home: completeMatchData.homeForm,
        away: completeMatchData.awayForm,
        h2h: completeMatchData.h2h,
      },
      professionalCalc: {
        overUnder: overUnderCalc,
      },
      oddsHistory: completeMatchData.oddsHistory,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 5: Run Multi-Model Analysis (if enabled)
    // ═══════════════════════════════════════════════════════════════════════════
    
    let multiModelResult = null;
    
    if (useMultiModel) {
      try {
        console.log('🤖 Running Multi-Model Analysis...');
        const mmStart = Date.now();
        multiModelResult = await runMultiModelAnalysis(matchData);
        console.log(`   ✅ Multi-Model completed in ${Date.now() - mmStart}ms`);
      } catch (mmError) {
        console.error('⚠️ Multi-Model Analysis failed:', mmError);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 6: Run Standard Agent Analysis (Orchestrator)
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('🤖 Running Agent Analysis (Orchestrator)...');
    const agentStart = Date.now();
    
    const result = await runFullAnalysis(
      { matchData }, 
      language as 'tr' | 'en' | 'de'
    );
    
    console.log(`   ✅ Agent Analysis completed in ${Date.now() - agentStart}ms`);

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 7: Run Strategy Agent (NEW!) - Tüm verileri sentezle
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('🧠 Running Strategy Agent v2.0...');
    const strategyStart = Date.now();
    
    let strategyResult = null;
    try {
      strategyResult = await runStrategyAgent(
        matchData,
        {
          deepAnalysis: result.reports?.deepAnalysis,
          stats: result.reports?.stats,
          odds: result.reports?.odds,
          sentiment: result.reports?.sentiment,
        },
        multiModelResult,
        { overUnder: overUnderCalc }, // professionalCalc
        language as 'tr' | 'en' | 'de'
      );
      console.log(`   ✅ Strategy Agent completed in ${Date.now() - strategyStart}ms`);
      console.log(`   🎯 Best Bet: ${strategyResult?.recommendedBets?.[0]?.type} - ${strategyResult?.recommendedBets?.[0]?.selection}`);
      console.log(`   ⚠️ Risk: ${strategyResult?.riskAssessment?.level} (${strategyResult?.riskAssessment?.score}/100)`);
    } catch (strategyError) {
      console.error('⚠️ Strategy Agent failed:', strategyError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 8: Merge Strategy Results into Reports
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Strategy Agent sonuçlarını reports'a ekle
    if (strategyResult && result.reports) {
      result.reports.strategy = {
        ...result.reports.strategy,
        // Strategy Agent v2 verileri
        masterAnalysis: strategyResult.masterAnalysis,
        consensus: strategyResult.consensus,
        riskAssessment: strategyResult.riskAssessment,
        recommendedBets: strategyResult.recommendedBets,
        avoidBets: strategyResult.avoidBets,
        stakeSuggestion: strategyResult.stakeSuggestion,
        specialAlerts: strategyResult.specialAlerts,
        agentSummary: strategyResult.agentSummary,
        _consensus: strategyResult._consensus,
        _bestBet: strategyResult._bestBet,
        _totalAgreement: strategyResult._totalAgreement,
        _avgConfidence: strategyResult._avgConfidence,
      };
      
      // weightedConsensus'u da güncelle
      if (strategyResult.consensus) {
        result.reports.weightedConsensus = {
          ...result.reports.weightedConsensus,
          matchResult: {
            prediction: strategyResult.consensus.matchResult?.prediction || result.reports.weightedConsensus?.matchResult?.prediction,
            confidence: strategyResult.consensus.matchResult?.confidence || result.reports.weightedConsensus?.matchResult?.confidence,
            agreement: strategyResult.consensus.matchResult?.agree || result.reports.weightedConsensus?.matchResult?.agreement,
            votes: strategyResult.consensus.matchResult?.votes,
          },
          overUnder: {
            prediction: strategyResult.consensus.overUnder?.prediction || result.reports.weightedConsensus?.overUnder?.prediction,
            confidence: strategyResult.consensus.overUnder?.confidence || result.reports.weightedConsensus?.overUnder?.confidence,
            agreement: strategyResult.consensus.overUnder?.agree || result.reports.weightedConsensus?.overUnder?.agreement,
            votes: strategyResult.consensus.overUnder?.votes,
          },
          btts: {
            prediction: strategyResult.consensus.btts?.prediction || result.reports.weightedConsensus?.btts?.prediction,
            confidence: strategyResult.consensus.btts?.confidence || result.reports.weightedConsensus?.btts?.confidence,
            agreement: strategyResult.consensus.btts?.agree || result.reports.weightedConsensus?.btts?.agreement,
            votes: strategyResult.consensus.btts?.votes,
          },
          bestBet: strategyResult._bestBet ? {
            type: strategyResult._bestBet.type,
            selection: strategyResult._bestBet.selection,
            confidence: strategyResult._bestBet.confidence,
            agreement: `${strategyResult._bestBet.agree}/${strategyResult._bestBet.total}`,
          } : result.reports.weightedConsensus?.bestBet,
          finalPrediction: {
            ...result.reports.weightedConsensus?.finalPrediction,
            recommendation: strategyResult.agentSummary || result.reports.weightedConsensus?.finalPrediction?.recommendation,
          },
          isConsensus: (strategyResult._totalAgreement || 0) >= 6,
        };
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 9: Save Prediction for Backtesting
    // ═══════════════════════════════════════════════════════════════════════════
    
    try {
      await savePrediction({
        fixtureId: matchData.fixtureId,
        matchDate: matchData.date,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        reports: {
          deepAnalysis: result.reports?.deepAnalysis,
          stats: result.reports?.stats,
          odds: result.reports?.odds,
          strategy: result.reports?.strategy,
          weightedConsensus: result.reports?.weightedConsensus,
        },
        multiModel: multiModelResult ? {
          predictions: multiModelResult.predictions,
          consensus: multiModelResult.consensus,
          modelAgreement: multiModelResult.modelAgreement,
        } : undefined,
      });
      console.log('📊 Prediction saved to database for backtesting');
    } catch (saveError) {
      console.error('⚠️ Prediction save failed (non-blocking):', saveError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 10: Build Response
    // ═══════════════════════════════════════════════════════════════════════════
    
    const totalTime = Date.now() - startTime;
    
    console.log('');
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('✅ ANALYSIS COMPLETE');
    console.log(`✅ Total time: ${totalTime}ms`);
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('');

    return NextResponse.json({
      success: result.success,
      reports: result.reports,
      
      timing: {
        total: totalTime,
        dataFetch: dataFetchTime,
        agents: result.timing?.agents || 0,
        strategy: strategyResult ? Date.now() - strategyStart : 0,
      },
      
      errors: result.errors,
      
      // Multi-Model results
      multiModel: multiModelResult ? {
        enabled: true,
        predictions: multiModelResult.predictions,
        consensus: multiModelResult.consensus,
        unanimousDecisions: multiModelResult.unanimousDecisions,
        conflictingDecisions: multiModelResult.conflictingDecisions,
        bestBet: multiModelResult.bestBet,
        modelAgreement: multiModelResult.modelAgreement,
      } : { enabled: false },
      
      // Strategy Agent Summary (NEW!)
      strategyAgent: strategyResult ? {
        enabled: true,
        masterAnalysis: strategyResult.masterAnalysis,
        riskAssessment: strategyResult.riskAssessment,
        recommendedBets: strategyResult.recommendedBets,
        stakeSuggestion: strategyResult.stakeSuggestion,
        specialAlerts: strategyResult.specialAlerts,
        agentSummary: strategyResult.agentSummary,
      } : { enabled: false },
      
      // Data quality info
      dataQuality: {
        score: dataQuality?.score || 0,
        homeFormQuality: dataQuality?.homeFormQuality || 0,
        awayFormQuality: dataQuality?.awayFormQuality || 0,
        h2hQuality: dataQuality?.h2hQuality || 0,
        oddsQuality: dataQuality?.oddsQuality || 0,
        warnings: dataQuality?.warnings || [],
      },
      
      // What data was used
      dataUsed: {
        hasOdds: !!(completeMatchData.odds?.matchWinner?.home > 1),
        hasHomeForm: !!(completeMatchData.homeForm?.form && completeMatchData.homeForm.form !== 'NNNNN'),
        hasAwayForm: !!(completeMatchData.awayForm?.form && completeMatchData.awayForm.form !== 'NNNNN'),
        hasHomeVenueData: !!(completeMatchData.homeForm?.venueMatchCount && completeMatchData.homeForm.venueMatchCount > 0),
        hasAwayVenueData: !!(completeMatchData.awayForm?.venueMatchCount && completeMatchData.awayForm.venueMatchCount > 0),
        hasH2H: !!(completeMatchData.h2h?.totalMatches && completeMatchData.h2h.totalMatches > 0),
        homeFormMatches: completeMatchData.homeForm?.matchCount || 0,
        awayFormMatches: completeMatchData.awayForm?.matchCount || 0,
        homeVenueMatches: completeMatchData.homeForm?.venueMatchCount || 0,
        awayVenueMatches: completeMatchData.awayForm?.venueMatchCount || 0,
        h2hMatchCount: completeMatchData.h2h?.totalMatches || 0,
        homeRecord: completeMatchData.homeForm?.record || 'N/A',
        awayRecord: completeMatchData.awayForm?.record || 'N/A',
        homeVenueRecord: completeMatchData.homeForm?.venueRecord || 'N/A',
        awayVenueRecord: completeMatchData.awayForm?.venueRecord || 'N/A',
      },
      
      // Professional calculation results
      professionalCalc: {
        overUnder: overUnderCalc,
      },
      
      // Raw stats for debugging/transparency
      rawStats: {
        home: {
          form: completeMatchData.homeForm.form,
          venueForm: completeMatchData.homeForm.venueForm,
          avgScored: completeMatchData.homeForm.avgGoalsScored,
          venueAvgScored: completeMatchData.homeForm.venueAvgScored,
          avgConceded: completeMatchData.homeForm.avgGoalsConceded,
          venueAvgConceded: completeMatchData.homeForm.venueAvgConceded,
          over25: completeMatchData.homeForm.over25Percentage,
          venueOver25: completeMatchData.homeForm.venueOver25Pct,
          btts: completeMatchData.homeForm.bttsPercentage,
          venueBtts: completeMatchData.homeForm.venueBttsPct,
          matchCount: completeMatchData.homeForm.matchCount,
          venueMatchCount: completeMatchData.homeForm.venueMatchCount,
          record: completeMatchData.homeForm.record,
          venueRecord: completeMatchData.homeForm.venueRecord,
          points: completeMatchData.homeForm.points,
          venuePoints: completeMatchData.homeForm.venuePoints,
        },
        away: {
          form: completeMatchData.awayForm.form,
          venueForm: completeMatchData.awayForm.venueForm,
          avgScored: completeMatchData.awayForm.avgGoalsScored,
          venueAvgScored: completeMatchData.awayForm.venueAvgScored,
          avgConceded: completeMatchData.awayForm.avgGoalsConceded,
          venueAvgConceded: completeMatchData.awayForm.venueAvgConceded,
          over25: completeMatchData.awayForm.over25Percentage,
          venueOver25: completeMatchData.awayForm.venueOver25Pct,
          btts: completeMatchData.awayForm.bttsPercentage,
          venueBtts: completeMatchData.awayForm.venueBttsPct,
          matchCount: completeMatchData.awayForm.matchCount,
          venueMatchCount: completeMatchData.awayForm.venueMatchCount,
          record: completeMatchData.awayForm.record,
          venueRecord: completeMatchData.awayForm.venueRecord,
          points: completeMatchData.awayForm.points,
          venuePoints: completeMatchData.awayForm.venuePoints,
        },
        h2h: {
          totalMatches: completeMatchData.h2h.totalMatches,
          homeWins: completeMatchData.h2h.homeWins,
          awayWins: completeMatchData.h2h.awayWins,
          draws: completeMatchData.h2h.draws,
          over25: completeMatchData.h2h.over25Percentage,
          btts: completeMatchData.h2h.bttsPercentage,
          avgGoals: completeMatchData.h2h.avgTotalGoals,
        },
        odds: completeMatchData.odds,
      },
    });
    
  } catch (error: any) {
    console.error('❌ Agent API Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Analysis failed',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

// ==================== GET ENDPOINT (Health Check) ====================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: 'v6',
    features: [
      'Professional data fetching with includes',
      'Venue-specific statistics',
      'Data quality scoring',
      'Multi-model analysis',
      'Professional Over/Under calculation',
      'Record & matchCount fields for UI',
      'Strategy Agent v2.0 integration',  // ← YENİ
    ],
    timestamp: new Date().toISOString(),
  });
}
