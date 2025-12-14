// src/app/api/agents/route.ts
// Professional Agent Analysis API - FIXED v4
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG:
// v4 - Uses fixed sportmonks-data.ts with proper includes
// v4 - Removed duplicate data fetching
// v4 - Added data quality validation before agent execution
// v4 - Better error handling and logging
// ═══════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { runMultiModelAnalysis } from '@/lib/heurist/multiModel';
import { savePrediction } from '@/lib/predictions';
import { fetchCompleteMatchData } from '@/lib/heurist/sportmonks-data';

// ==================== DATA QUALITY THRESHOLD ====================
const MIN_DATA_QUALITY = 30; // Minimum %30 data quality required

// ==================== PROFESSIONAL OVER/UNDER CALCULATION ====================

function calculateProfessionalOverUnder(
  homeStats: any,
  awayStats: any,
  h2h: any
): { prediction: string; confidence: number; breakdown: any } {
  
  // Ağırlıklar - Venue-specific verilere daha fazla ağırlık
  const WEIGHTS = {
    homeVenue: 0.30,  // Ev sahibinin EVDEKİ maçları
    awayVenue: 0.30,  // Deplasmanın DEPLASMANDAKİ maçları
    h2h: 0.25,        // Kafa kafaya
    general: 0.15,    // Genel form
  };

  // Venue-specific Over 2.5 yüzdeleri
  const homeVenueOver = homeStats?.venueOver25Pct ?? parseInt(homeStats?.over25Percentage || '50');
  const awayVenueOver = awayStats?.venueOver25Pct ?? parseInt(awayStats?.over25Percentage || '50');
  const h2hOver = parseInt(h2h?.over25Percentage || '50');
  const generalOver = (parseInt(homeStats?.over25Percentage || '50') + parseInt(awayStats?.over25Percentage || '50')) / 2;

  // Ağırlıklı hesaplama
  const weightedOver = 
    (homeVenueOver * WEIGHTS.homeVenue) +
    (awayVenueOver * WEIGHTS.awayVenue) +
    (h2hOver * WEIGHTS.h2h) +
    (generalOver * WEIGHTS.general);

  // Beklenen gol hesaplama
  const homeExpectedScored = parseFloat(homeStats?.venueAvgScored || homeStats?.avgGoalsScored || '1.2');
  const homeExpectedConceded = parseFloat(homeStats?.venueAvgConceded || homeStats?.avgGoalsConceded || '1.0');
  const awayExpectedScored = parseFloat(awayStats?.venueAvgScored || awayStats?.avgGoalsScored || '1.0');
  const awayExpectedConceded = parseFloat(awayStats?.venueAvgConceded || awayStats?.avgGoalsConceded || '1.2');

  // Beklenen toplam gol
  const homeExpected = (homeExpectedScored + awayExpectedConceded) / 2;
  const awayExpected = (awayExpectedScored + homeExpectedConceded) / 2;
  const expectedTotal = homeExpected + awayExpected;

  // Tahmin
  const prediction = weightedOver >= 50 ? 'Over' : 'Under';
  
  // Güven hesaplama - weighted over'ın 50'den uzaklığı
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
    console.log('🤖 PROFESSIONAL AGENT ANALYSIS v4');
    console.log('🤖 ═══════════════════════════════════════════════════════════════');
    console.log(`📍 Match: ${homeTeam} vs ${awayTeam}`);
    console.log(`🆔 IDs: Home=${homeTeamId}, Away=${awayTeamId}, Fixture=${fixtureId}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 1: Fetch Complete Match Data (TEK SEFERDE!)
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
      console.log(`   Warnings: ${dataQuality.warnings.join(', ')}`);
      
      // Still proceed but with warning
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
    console.log('🎯 ═══════════════════════════════════════════════════');
    console.log('🎯 PROFESSIONAL OVER/UNDER CALCULATION');
    console.log('🎯 ═══════════════════════════════════════════════════');
    console.log(`   📊 ${homeTeam} EVDEKİ Over 2.5: ${overUnderCalc.breakdown.homeVenueOver}% (ağırlık: 30%)`);
    console.log(`   📊 ${awayTeam} DEPLASMANDAKİ Over 2.5: ${overUnderCalc.breakdown.awayVenueOver}% (ağırlık: 30%)`);
    console.log(`   📊 H2H Over 2.5: ${overUnderCalc.breakdown.h2hOver}% (ağırlık: 25%)`);
    console.log(`   📊 Genel Form Over 2.5: ${overUnderCalc.breakdown.generalOver}% (ağırlık: 15%)`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   🎯 WEIGHTED OVER 2.5: ${overUnderCalc.breakdown.weightedOver}%`);
    console.log(`   🎯 PREDICTION: ${overUnderCalc.prediction} (${overUnderCalc.confidence}% güven)`);
    console.log(`   🎯 Expected Total Goals: ${overUnderCalc.breakdown.expectedTotal}`);
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
      
      // Odds
      odds: completeMatchData.odds,
      
      // Home Form (with venue-specific data)
      homeForm: {
        form: completeMatchData.homeForm.form,
        points: completeMatchData.homeForm.points,
        avgGoals: completeMatchData.homeForm.avgGoalsScored,
        avgConceded: completeMatchData.homeForm.avgGoalsConceded,
        over25Percentage: completeMatchData.homeForm.over25Percentage,
        bttsPercentage: completeMatchData.homeForm.bttsPercentage,
        cleanSheetPercentage: completeMatchData.homeForm.cleanSheetPercentage,
        matches: completeMatchData.homeForm.matchDetails,
        
        // Venue-specific (KRITIK!)
        venueForm: completeMatchData.homeForm.venueForm,
        venueAvgScored: completeMatchData.homeForm.venueAvgScored,
        venueAvgConceded: completeMatchData.homeForm.venueAvgConceded,
        venueOver25Pct: completeMatchData.homeForm.venueOver25Pct,
        venueBttsPct: completeMatchData.homeForm.venueBttsPct,
        venueMatchCount: completeMatchData.homeForm.venueMatchCount,
        venueRecord: completeMatchData.homeForm.venueRecord,
      },
      
      // Away Form (with venue-specific data)
      awayForm: {
        form: completeMatchData.awayForm.form,
        points: completeMatchData.awayForm.points,
        avgGoals: completeMatchData.awayForm.avgGoalsScored,
        avgConceded: completeMatchData.awayForm.avgGoalsConceded,
        over25Percentage: completeMatchData.awayForm.over25Percentage,
        bttsPercentage: completeMatchData.awayForm.bttsPercentage,
        cleanSheetPercentage: completeMatchData.awayForm.cleanSheetPercentage,
        matches: completeMatchData.awayForm.matchDetails,
        
        // Venue-specific (KRITIK!)
        venueForm: completeMatchData.awayForm.venueForm,
        venueAvgScored: completeMatchData.awayForm.venueAvgScored,
        venueAvgConceded: completeMatchData.awayForm.venueAvgConceded,
        venueOver25Pct: completeMatchData.awayForm.venueOver25Pct,
        venueBttsPct: completeMatchData.awayForm.venueBttsPct,
        venueMatchCount: completeMatchData.awayForm.venueMatchCount,
        venueRecord: completeMatchData.awayForm.venueRecord,
      },
      
      // H2H
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
      
      // Detailed stats for agents
      detailedStats: {
        home: completeMatchData.homeForm,
        away: completeMatchData.awayForm,
        h2h: completeMatchData.h2h,
      },
      
      // Professional calculation
      professionalCalc: {
        overUnder: overUnderCalc,
      },
      
      // Odds history
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
        // Continue without multi-model
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 6: Run Standard Agent Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('🤖 Running Agent Analysis...');
    const agentStart = Date.now();
    
    // Pass matchData directly - NO duplicate fetching!
    const result = await runFullAnalysis(
      { matchData }, 
      language as 'tr' | 'en' | 'de'
    );
    
    console.log(`   ✅ Agent Analysis completed in ${Date.now() - agentStart}ms`);

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 7: Save Prediction for Backtesting
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
    // 📊 STEP 8: Build Response
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
          over25: completeMatchData.homeForm.over25Percentage,
          venueOver25: completeMatchData.homeForm.venueOver25Pct,
          matchCount: completeMatchData.homeForm.matchCount,
          venueMatchCount: completeMatchData.homeForm.venueMatchCount,
        },
        away: {
          form: completeMatchData.awayForm.form,
          venueForm: completeMatchData.awayForm.venueForm,
          avgScored: completeMatchData.awayForm.avgGoalsScored,
          venueAvgScored: completeMatchData.awayForm.venueAvgScored,
          over25: completeMatchData.awayForm.over25Percentage,
          venueOver25: completeMatchData.awayForm.venueOver25Pct,
          matchCount: completeMatchData.awayForm.matchCount,
          venueMatchCount: completeMatchData.awayForm.venueMatchCount,
        },
        h2h: {
          totalMatches: completeMatchData.h2h.totalMatches,
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
    version: 'v4',
    features: [
      'Professional data fetching with includes',
      'Venue-specific statistics',
      'Data quality scoring',
      'Multi-model analysis',
      'Professional Over/Under calculation',
    ],
    timestamp: new Date().toISOString(),
  });
}
