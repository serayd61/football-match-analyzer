// src/app/api/agents/route.ts
// Professional Agent Analysis API - v8
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG:
// v8 - Fixed ALL object rendering issues (stakeSuggestion, masterAnalysis, consensus, etc.)
// v7 - Fixed riskAssessment object→string conversion
// v6 - Strategy Agent integration with multi-model and sentiment data
// ═══════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';
import { runMultiModelAnalysis } from '@/lib/heurist/multiModel';
import { runStrategyAgent } from '@/lib/heurist/agents/strategy';
import { savePrediction } from '@/lib/predictions';
import { savePrediction as saveAdminPrediction } from '@/lib/admin/service';
import { 
  savePredictionSession, 
  saveProfessionalMarketPrediction,
  type ModelPrediction,
  type ProfessionalMarketPrediction 
} from '@/lib/admin/enhanced-service';
import { fetchCompleteMatchData } from '@/lib/heurist/sportmonks-data';
import { getCachedAnalysis, setCachedAnalysis, clearCacheForMatch } from '@/lib/analysisCache';
import { generateProfessionalAnalysis, type MatchStats, type ProfessionalAnalysis } from '@/lib/betting/professional-markets';

// ==================== DATA QUALITY THRESHOLD ====================
const MIN_DATA_QUALITY = 30;

// ==================== HELPER: Normalize ALL objects for React ====================

function normalizeRiskAssessment(riskAssessment: any): string {
  if (!riskAssessment) return 'Medium';
  if (typeof riskAssessment === 'string') return riskAssessment;
  if (typeof riskAssessment === 'object' && riskAssessment.level) return riskAssessment.level;
  return 'Medium';
}

function getRiskScore(riskAssessment: any): number | null {
  if (!riskAssessment) return null;
  if (typeof riskAssessment === 'object' && riskAssessment.score !== undefined) return riskAssessment.score;
  return null;
}

function getRiskFactors(riskAssessment: any): string[] {
  if (!riskAssessment) return [];
  if (typeof riskAssessment === 'object' && Array.isArray(riskAssessment.factors)) return riskAssessment.factors;
  return [];
}

// ✅ NEW: Normalize stakeSuggestion
function normalizeStakeSuggestion(stake: any): string {
  if (!stake) return 'Medium';
  if (typeof stake === 'string') return stake;
  if (typeof stake === 'object' && stake.level) return stake.level;
  return 'Medium';
}

function getStakePercentage(stake: any): string | null {
  if (!stake) return null;
  if (typeof stake === 'object' && stake.percentage) return stake.percentage;
  return null;
}

function getStakeReasoning(stake: any): string | null {
  if (!stake) return null;
  if (typeof stake === 'object' && stake.reasoning) return stake.reasoning;
  return null;
}

// ✅ NEW: Normalize masterAnalysis
function normalizeMasterAnalysis(analysis: any): string {
  if (!analysis) return '';
  if (typeof analysis === 'string') return analysis;
  if (typeof analysis === 'object' && analysis.summary) return analysis.summary;
  return '';
}

function getMasterKeyFactors(analysis: any): string[] {
  if (!analysis) return [];
  if (typeof analysis === 'object' && Array.isArray(analysis.keyFactors)) return analysis.keyFactors;
  return [];
}

// ✅ NEW: Normalize consensus predictions (convert "6/8" to number)
function normalizeConsensusItem(item: any): { prediction: string; confidence: number; agree: number; total: number; reasoning?: string } | null {
  if (!item) return null;
  
  let agree = 0;
  let total = 4;
  
  if (typeof item.agree === 'string' && item.agree.includes('/')) {
    const parts = item.agree.split('/');
    agree = parseInt(parts[0]) || 0;
    total = parseInt(parts[1]) || 4;
  } else if (typeof item.agree === 'number') {
    agree = item.agree;
  }
  
  return {
    prediction: item.prediction || '',
    confidence: item.confidence || 0,
    agree,
    total,
    reasoning: item.reasoning || undefined
  };
}

// ✅ NEW: Normalize bestBet
function normalizeBestBet(bet: any): { type: string; selection: string; confidence: number; agree: number; total: number; reasoning?: string } | null {
  if (!bet) return null;
  
  let agree = 0;
  let total = 4;
  
  if (typeof bet.agree === 'string' && bet.agree.includes('/')) {
    const parts = bet.agree.split('/');
    agree = parseInt(parts[0]) || 0;
    total = parseInt(parts[1]) || 4;
  } else if (typeof bet.agree === 'number') {
    agree = bet.agree;
  }
  
  return {
    type: bet.type || '',
    selection: bet.selection || '',
    confidence: bet.confidence || 0,
    agree,
    total,
    reasoning: bet.reasoning || undefined
  };
}

// ✅ NEW: Normalize Kelly Criterion stake suggestion
function normalizeKellyStake(stake: any): { level: string; percentage: string; kellyFraction: number; reasoning: string } | null {
  if (!stake) return null;
  if (typeof stake === 'string') {
    return { level: stake, percentage: '1-2%', kellyFraction: 0.25, reasoning: 'Default stake' };
  }
  if (typeof stake === 'object') {
    return {
      level: stake.level || 'Medium',
      percentage: stake.percentage || '1-2%',
      kellyFraction: stake.kellyFraction || 0.25,
      reasoning: stake.reasoning || ''
    };
  }
  return null;
}

// ✅ NEW: Normalize new market predictions (Asian Handicap, Correct Score, etc.)
function normalizeNewMarkets(markets: any): any {
  if (!markets) return null;
  
  return {
    asianHandicap: markets.asianHandicap ? {
      prediction: markets.asianHandicap.prediction || '',
      confidence: markets.asianHandicap.confidence || 0,
      value: markets.asianHandicap.value || false,
      reasoning: markets.asianHandicap.reasoning || ''
    } : null,
    correctScore: markets.correctScore ? {
      prediction: markets.correctScore.prediction || '',
      confidence: markets.correctScore.confidence || 0,
      alternatives: markets.correctScore.alternatives || [],
      reasoning: markets.correctScore.reasoning || ''
    } : null,
    htFt: markets.htFt ? {
      prediction: markets.htFt.prediction || '',
      confidence: markets.htFt.confidence || 0,
      value: markets.htFt.value || false,
      reasoning: markets.htFt.reasoning || ''
    } : null,
    corners: markets.corners ? {
      prediction: markets.corners.prediction || '',
      confidence: markets.corners.confidence || 0,
      expectedTotal: markets.corners.expectedTotal || 0,
      reasoning: markets.corners.reasoning || ''
    } : null,
    cards: markets.cards ? {
      prediction: markets.cards.prediction || '',
      confidence: markets.cards.confidence || 0,
      expectedTotal: markets.cards.expectedTotal || 0,
      reasoning: markets.cards.reasoning || ''
    } : null
  };
}

// ✅ NEW: Normalize advanced risk assessment
function normalizeAdvancedRisk(risk: any): { level: string; score: number; factors: string[]; criticalAlerts: string[] } {
  if (!risk) return { level: 'Medium', score: 50, factors: [], criticalAlerts: [] };
  if (typeof risk === 'string') {
    return { level: risk, score: risk === 'Low' ? 30 : risk === 'High' ? 70 : 50, factors: [], criticalAlerts: [] };
  }
  return {
    level: risk.level || 'Medium',
    score: risk.score || 50,
    factors: risk.factors || [],
    criticalAlerts: risk.criticalAlerts || []
  };
}

// ✅ NEW: Normalize xG data
function normalizeXgData(xg: any): { homeXg: number; awayXg: number; expectedTotal: number; trend: string } | null {
  if (!xg) return null;
  return {
    homeXg: xg.homeXg || 0,
    awayXg: xg.awayXg || 0,
    expectedTotal: xg.expectedTotal || 0,
    trend: xg.trend || 'stable'
  };
}

// ✅ NEW: Normalize timing patterns
function normalizeTimingPatterns(timing: any): any {
  if (!timing) return null;
  return {
    home: {
      firstHalfGoals: timing.home?.firstHalfGoals || 0,
      secondHalfGoals: timing.home?.secondHalfGoals || 0,
      last15MinGoals: timing.home?.last15MinGoals || 0,
      scoringFirst: timing.home?.scoringFirst || 0
    },
    away: {
      firstHalfGoals: timing.away?.firstHalfGoals || 0,
      secondHalfGoals: timing.away?.secondHalfGoals || 0,
      last15MinGoals: timing.away?.last15MinGoals || 0,
      scoringFirst: timing.away?.scoringFirst || 0
    }
  };
}

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
      useMultiModel = true,
      skipCache = false // 🆕 Cache'i bypass etmek için
    } = body;

    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📦 CACHE KONTROLÜ - Aynı maç + dil için 30 dk cache (skipCache=true ise bypass)
    // ═══════════════════════════════════════════════════════════════════════════
    if (!skipCache) {
      const cached = getCachedAnalysis(fixtureId, language, 'agents');
      
      if (cached) {
        console.log(`📦 CACHE HIT - Returning cached agent analysis from ${cached.cachedAt.toLocaleTimeString()}`);
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cachedAt: cached.cachedAt.toISOString(),
        });
      }
    } else {
      console.log('📦 CACHE BYPASS - skipCache=true, running fresh analysis');
    }
    console.log('📦 CACHE MISS - Running fresh agent analysis');

    console.log('');
    console.log('🤖 ═══════════════════════════════════════════════════════════════');
    console.log('🤖 PROFESSIONAL AGENT ANALYSIS v8 (ALL objects normalized)');
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
      // Yeni: Stats Agent için ek veriler
      advancedStats: {
        // xG verileri (eğer mevcutsa)
        xgData: (completeMatchData as any).xgData || null,
        // Timing patterns (ilk yarı/son 15dk golleri)
        timingPatterns: (completeMatchData as any).timingPatterns || null,
        // Clean sheet serileri
        cleanSheetStreaks: {
          home: parseInt(completeMatchData.homeForm.cleanSheetPercentage || '0'),
          away: parseInt(completeMatchData.awayForm.cleanSheetPercentage || '0'),
        },
        // Gol atma/yeme oranları
        scoringTrends: {
          homeAvgScored: parseFloat(completeMatchData.homeForm.avgGoalsScored || '1.0'),
          homeAvgConceded: parseFloat(completeMatchData.homeForm.avgGoalsConceded || '1.0'),
          awayAvgScored: parseFloat(completeMatchData.awayForm.avgGoalsScored || '1.0'),
          awayAvgConceded: parseFloat(completeMatchData.awayForm.avgGoalsConceded || '1.0'),
        },
      },
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
    // 📊 STEP 7: Run Strategy Agent - Tüm verileri sentezle
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
        { overUnder: overUnderCalc },
        language as 'tr' | 'en' | 'de'
      );
      console.log(`   ✅ Strategy Agent completed in ${Date.now() - strategyStart}ms`);
      console.log(`   🎯 Best Bet: ${strategyResult?.recommendedBets?.[0]?.type} - ${strategyResult?.recommendedBets?.[0]?.selection}`);
      console.log(`   ⚠️ Risk: ${normalizeRiskAssessment(strategyResult?.riskAssessment)}`);
    } catch (strategyError) {
      console.error('⚠️ Strategy Agent failed:', strategyError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 8: Merge Strategy Results into Reports - ALL NORMALIZED!
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (strategyResult && result.reports) {
      // Normalize consensus items
      const normalizedConsensus = strategyResult.consensus ? {
        overUnder: normalizeConsensusItem(strategyResult.consensus.overUnder),
        matchResult: normalizeConsensusItem(strategyResult.consensus.matchResult),
        btts: normalizeConsensusItem(strategyResult.consensus.btts),
      } : null;

      const normalized_consensus = strategyResult._consensus ? {
        overUnderConsensus: normalizeConsensusItem(strategyResult._consensus.overUnderConsensus),
        matchResultConsensus: normalizeConsensusItem(strategyResult._consensus.matchResultConsensus),
        bttsConsensus: normalizeConsensusItem(strategyResult._consensus.bttsConsensus),
      } : null;

      // Normalize Kelly Criterion stake
      const kellyStake = normalizeKellyStake(strategyResult.stakeSuggestion);
      
      // Normalize new markets
      const newMarkets = normalizeNewMarkets(strategyResult.newMarkets);
      
      // Normalize advanced risk
      const advancedRisk = normalizeAdvancedRisk(strategyResult.riskAssessment);
      
      result.reports.strategy = {
        ...result.reports.strategy,
        // ✅ ALL NORMALIZED - No objects that can break React!
        masterAnalysis: normalizeMasterAnalysis(strategyResult.masterAnalysis),
        masterKeyFactors: getMasterKeyFactors(strategyResult.masterAnalysis),
        
        consensus: normalizedConsensus,
        _consensus: normalized_consensus,
        
        riskAssessment: normalizeRiskAssessment(strategyResult.riskAssessment),
        riskScore: getRiskScore(strategyResult.riskAssessment),
        riskFactors: getRiskFactors(strategyResult.riskAssessment),
        
        // ✅ NEW: Advanced Risk with Kelly Criterion
        advancedRisk: advancedRisk,
        
        stakeSuggestion: normalizeStakeSuggestion(strategyResult.stakeSuggestion),
        stakePercentage: getStakePercentage(strategyResult.stakeSuggestion),
        stakeReasoning: getStakeReasoning(strategyResult.stakeSuggestion),
        
        // ✅ NEW: Kelly Criterion details
        kellyStake: kellyStake,
        
        _bestBet: normalizeBestBet(strategyResult._bestBet),
        
        // ✅ NEW: Additional market predictions
        newMarkets: newMarkets,
        
        // Arrays are OK
        recommendedBets: strategyResult.recommendedBets || [],
        avoidBets: strategyResult.avoidBets || [],
        specialAlerts: strategyResult.specialAlerts || [],
        
        // Strings are OK
        agentSummary: strategyResult.agentSummary || '',
        
        // Numbers are OK
        _totalAgreement: strategyResult._totalAgreement || 0,
        _avgConfidence: strategyResult._avgConfidence || 0,
      };
      
      // Update weightedConsensus with normalized values
      if (normalizedConsensus) {
        result.reports.weightedConsensus = {
          ...result.reports.weightedConsensus,
          matchResult: normalizedConsensus.matchResult ? {
            prediction: normalizedConsensus.matchResult.prediction,
            confidence: normalizedConsensus.matchResult.confidence,
            agreement: normalizedConsensus.matchResult.agree,
            total: normalizedConsensus.matchResult.total,
          } : result.reports.weightedConsensus?.matchResult,
          overUnder: normalizedConsensus.overUnder ? {
            prediction: normalizedConsensus.overUnder.prediction,
            confidence: normalizedConsensus.overUnder.confidence,
            agreement: normalizedConsensus.overUnder.agree,
            total: normalizedConsensus.overUnder.total,
          } : result.reports.weightedConsensus?.overUnder,
          btts: normalizedConsensus.btts ? {
            prediction: normalizedConsensus.btts.prediction,
            confidence: normalizedConsensus.btts.confidence,
            agreement: normalizedConsensus.btts.agree,
            total: normalizedConsensus.btts.total,
          } : result.reports.weightedConsensus?.btts,
          bestBet: strategyResult._bestBet ? {
            type: strategyResult._bestBet.type || '',
            selection: strategyResult._bestBet.selection || '',
            confidence: strategyResult._bestBet.confidence || 0,
            agreement: `${strategyResult._bestBet.agree || 0}/${strategyResult._bestBet.total || 4}`,
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
    // 📊 ADMIN PANEL - TAHMİN KAYDET
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const consensus = result.reports?.weightedConsensus;
      const mmPredictions = multiModelResult?.predictions as any;
      
      await saveAdminPrediction({
        fixtureId: matchData.fixtureId,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        matchDate: matchData.date,
        analysisType: 'agents',
        predictions: {
          claude: mmPredictions?.claude ? {
            matchResult: mmPredictions.claude.matchResult?.prediction || '',
            matchResultConfidence: mmPredictions.claude.matchResult?.confidence || 0,
            over25: mmPredictions.claude.overUnder?.prediction || '',
            over25Confidence: mmPredictions.claude.overUnder?.confidence || 0,
            btts: mmPredictions.claude.btts?.prediction || '',
            bttsConfidence: mmPredictions.claude.btts?.confidence || 0,
          } : undefined,
          gpt4: mmPredictions?.gpt4 ? {
            matchResult: mmPredictions.gpt4.matchResult?.prediction || '',
            matchResultConfidence: mmPredictions.gpt4.matchResult?.confidence || 0,
            over25: mmPredictions.gpt4.overUnder?.prediction || '',
            over25Confidence: mmPredictions.gpt4.overUnder?.confidence || 0,
            btts: mmPredictions.gpt4.btts?.prediction || '',
            bttsConfidence: mmPredictions.gpt4.btts?.confidence || 0,
          } : undefined,
          gemini: mmPredictions?.gemini ? {
            matchResult: mmPredictions.gemini.matchResult?.prediction || '',
            matchResultConfidence: mmPredictions.gemini.matchResult?.confidence || 0,
            over25: mmPredictions.gemini.overUnder?.prediction || '',
            over25Confidence: mmPredictions.gemini.overUnder?.confidence || 0,
            btts: mmPredictions.gemini.btts?.prediction || '',
            bttsConfidence: mmPredictions.gemini.btts?.confidence || 0,
          } : undefined,
          mistral: mmPredictions?.mistral ? {
            matchResult: mmPredictions.mistral.matchResult?.prediction || '',
            matchResultConfidence: mmPredictions.mistral.matchResult?.confidence || 0,
            over25: mmPredictions.mistral.overUnder?.prediction || '',
            over25Confidence: mmPredictions.mistral.overUnder?.confidence || 0,
            btts: mmPredictions.mistral.btts?.prediction || '',
            bttsConfidence: mmPredictions.mistral.btts?.confidence || 0,
          } : undefined,
        },
        consensus: {
          matchResult: {
            prediction: consensus?.matchResult?.prediction || '',
            confidence: consensus?.matchResult?.confidence || 0,
            agreement: consensus?.matchResult?.agreement || 0,
          },
          over25: {
            prediction: consensus?.overUnder?.prediction || '',
            confidence: consensus?.overUnder?.confidence || 0,
            agreement: consensus?.overUnder?.agreement || 0,
          },
          btts: {
            prediction: consensus?.btts?.prediction || '',
            confidence: consensus?.btts?.confidence || 0,
            agreement: consensus?.btts?.agreement || 0,
          },
        },
        bestBets: strategyResult?.recommendedBets?.map((bet: any, idx: number) => ({
          rank: idx + 1,
          market: bet.type || '',
          selection: bet.selection || '',
          confidence: bet.confidence || 0,
          reasoning: bet.reasoning || '',
        })) || [],
        riskLevel: normalizeRiskAssessment(strategyResult?.riskAssessment) === 'High' ? 'high' : 
                   normalizeRiskAssessment(strategyResult?.riskAssessment) === 'Low' ? 'low' : 'medium',
        riskFactors: getRiskFactors(strategyResult?.riskAssessment),
        dataQualityScore: dataQuality?.score || 70,
        userId: (session?.user as any)?.id,
      });
      console.log('📊 Agent prediction saved to Admin Panel');
    } catch (adminSaveError) {
      console.error('⚠️ Admin Panel save failed (non-blocking):', adminSaveError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 ENHANCED ADMIN - YENİ TAHMİN TAKİP SİSTEMİ
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const consensus = result.reports?.weightedConsensus;
      const mmPredictions = multiModelResult?.predictions as any;
      
      // Model predictions for enhanced tracking
      const modelPredictions: ModelPrediction[] = [];
      
      // Add each AI model's predictions
      if (mmPredictions?.claude) {
        modelPredictions.push({
          session_id: '', // Will be set by savePredictionSession
          model_name: 'claude',
          model_type: 'llm',
          btts_prediction: mmPredictions.claude.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
          btts_confidence: mmPredictions.claude.btts?.confidence || 0,
          over_under_prediction: mmPredictions.claude.overUnder?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
          over_under_confidence: mmPredictions.claude.overUnder?.confidence || 0,
          match_result_prediction: mmPredictions.claude.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                   mmPredictions.claude.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
          match_result_confidence: mmPredictions.claude.matchResult?.confidence || 0,
        });
      }
      
      if (mmPredictions?.gpt4) {
        modelPredictions.push({
          session_id: '',
          model_name: 'gpt4',
          model_type: 'llm',
          btts_prediction: mmPredictions.gpt4.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
          btts_confidence: mmPredictions.gpt4.btts?.confidence || 0,
          over_under_prediction: mmPredictions.gpt4.overUnder?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
          over_under_confidence: mmPredictions.gpt4.overUnder?.confidence || 0,
          match_result_prediction: mmPredictions.gpt4.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                   mmPredictions.gpt4.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
          match_result_confidence: mmPredictions.gpt4.matchResult?.confidence || 0,
        });
      }
      
      if (mmPredictions?.gemini) {
        modelPredictions.push({
          session_id: '',
          model_name: 'gemini',
          model_type: 'llm',
          btts_prediction: mmPredictions.gemini.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
          btts_confidence: mmPredictions.gemini.btts?.confidence || 0,
          over_under_prediction: mmPredictions.gemini.overUnder?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
          over_under_confidence: mmPredictions.gemini.overUnder?.confidence || 0,
          match_result_prediction: mmPredictions.gemini.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                   mmPredictions.gemini.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
          match_result_confidence: mmPredictions.gemini.matchResult?.confidence || 0,
        });
      }

      // Save to enhanced tracking system
      await savePredictionSession({
        fixture_id: matchData.fixtureId,
        home_team: matchData.homeTeam,
        away_team: matchData.awayTeam,
        league: matchData.league,
        match_date: matchData.date,
        prediction_source: 'ai_agents',
        session_type: 'manual',
        consensus_btts: consensus?.btts?.prediction?.toLowerCase() === 'yes' ? 'yes' : 'no',
        consensus_btts_confidence: consensus?.btts?.confidence || 0,
        consensus_over_under: consensus?.overUnder?.prediction?.toLowerCase()?.includes('over') ? 'over' : 'under',
        consensus_over_under_confidence: consensus?.overUnder?.confidence || 0,
        consensus_match_result: consensus?.matchResult?.prediction?.toLowerCase() === 'home' ? 'home' : 
                                consensus?.matchResult?.prediction?.toLowerCase() === 'away' ? 'away' : 'draw',
        consensus_match_result_confidence: consensus?.matchResult?.confidence || 0,
        best_bet_1_market: strategyResult?.recommendedBets?.[0]?.type || undefined,
        best_bet_1_selection: strategyResult?.recommendedBets?.[0]?.selection || undefined,
        best_bet_1_confidence: strategyResult?.recommendedBets?.[0]?.confidence || undefined,
        best_bet_2_market: strategyResult?.recommendedBets?.[1]?.type || undefined,
        best_bet_2_selection: strategyResult?.recommendedBets?.[1]?.selection || undefined,
        best_bet_2_confidence: strategyResult?.recommendedBets?.[1]?.confidence || undefined,
        best_bet_3_market: strategyResult?.recommendedBets?.[2]?.type || undefined,
        best_bet_3_selection: strategyResult?.recommendedBets?.[2]?.selection || undefined,
        best_bet_3_confidence: strategyResult?.recommendedBets?.[2]?.confidence || undefined,
        risk_level: normalizeRiskAssessment(strategyResult?.riskAssessment) === 'High' ? 'high' : 
                    normalizeRiskAssessment(strategyResult?.riskAssessment) === 'Low' ? 'low' : 'medium',
      }, modelPredictions);
      
      console.log('📊 Enhanced prediction tracking saved!');
    } catch (enhancedSaveError) {
      console.error('⚠️ Enhanced tracking save failed (non-blocking):', enhancedSaveError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 9B: Save Professional Market Predictions for Admin Panel
    // ═══════════════════════════════════════════════════════════════════════════
    // This will be done after generating professionalMarkets in Step 10

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 10: Generate Professional Markets Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    
    let professionalMarkets: ProfessionalAnalysis | null = null;
    try {
      const matchStats: MatchStats = {
        home: {
          avgGoalsFor: parseFloat(completeMatchData.homeForm.avgGoalsScored || '1.5') || 1.5,
          avgGoalsAgainst: parseFloat(completeMatchData.homeForm.avgGoalsConceded || '1.2') || 1.2,
          homeAvgGoalsFor: parseFloat(completeMatchData.homeForm.venueAvgScored || '1.5') || 1.5,
          homeAvgGoalsAgainst: parseFloat(completeMatchData.homeForm.venueAvgConceded || '1.2') || 1.2,
          over15Pct: parseFloat(completeMatchData.homeForm.over25Percentage || '60') || 60,
          over25Pct: parseFloat(completeMatchData.homeForm.over25Percentage || '50') || 50,
          over35Pct: (parseFloat(completeMatchData.homeForm.over25Percentage || '50') || 50) * 0.6,
          bttsPct: parseFloat(completeMatchData.homeForm.bttsPercentage || '50') || 50,
          cleanSheetPct: 30,
          failedToScorePct: 20,
          firstHalfGoalsPct: 45,
          secondHalfGoalsPct: 55,
          form: completeMatchData.homeForm.form || 'DDDDD',
          xG: result.reports?.stats?.xgAnalysis?.homeXG,
          xGA: result.reports?.stats?.xgAnalysis?.awayActual,
        },
        away: {
          avgGoalsFor: parseFloat(completeMatchData.awayForm.avgGoalsScored || '1.3') || 1.3,
          avgGoalsAgainst: parseFloat(completeMatchData.awayForm.avgGoalsConceded || '1.4') || 1.4,
          awayAvgGoalsFor: parseFloat(completeMatchData.awayForm.venueAvgScored || '1.3') || 1.3,
          awayAvgGoalsAgainst: parseFloat(completeMatchData.awayForm.venueAvgConceded || '1.4') || 1.4,
          over15Pct: parseFloat(completeMatchData.awayForm.over25Percentage || '60') || 60,
          over25Pct: parseFloat(completeMatchData.awayForm.over25Percentage || '50') || 50,
          over35Pct: (parseFloat(completeMatchData.awayForm.over25Percentage || '50') || 50) * 0.6,
          bttsPct: parseFloat(completeMatchData.awayForm.bttsPercentage || '50') || 50,
          cleanSheetPct: 30,
          failedToScorePct: 20,
          firstHalfGoalsPct: 45,
          secondHalfGoalsPct: 55,
          form: completeMatchData.awayForm.form || 'DDDDD',
          xG: result.reports?.stats?.xgAnalysis?.awayXG,
          xGA: result.reports?.stats?.xgAnalysis?.homeActual,
        },
        h2h: {
          totalMatches: completeMatchData.h2h.totalMatches || 0,
          homeWins: completeMatchData.h2h.homeWins || 0,
          awayWins: completeMatchData.h2h.awayWins || 0,
          draws: completeMatchData.h2h.draws || 0,
          avgGoals: parseFloat(completeMatchData.h2h.avgTotalGoals || '2.5') || 2.5,
          over25Pct: parseFloat(completeMatchData.h2h.over25Percentage || '50') || 50,
          bttsPct: parseFloat(completeMatchData.h2h.bttsPercentage || '50') || 50,
          homeTeamScoredFirst: 50,
          awayTeamScoredFirst: 50,
        },
        odds: completeMatchData.odds ? {
          home: completeMatchData.odds.matchWinner?.home || 2.5,
          draw: completeMatchData.odds.matchWinner?.draw || 3.2,
          away: completeMatchData.odds.matchWinner?.away || 2.8,
          over25: completeMatchData.odds.overUnder?.['2.5']?.over || 1.9,
          under25: completeMatchData.odds.overUnder?.['2.5']?.under || 1.9,
          over15: 1.4,
          under15: 2.8,
          bttsYes: completeMatchData.odds.btts?.yes || 1.9,
          bttsNo: completeMatchData.odds.btts?.no || 1.9,
        } : undefined,
      };

      professionalMarkets = generateProfessionalAnalysis(matchStats, language);
      console.log('📈 Professional markets analysis generated');

      // Save professional market predictions to admin panel
      try {
        const proMarketPrediction: ProfessionalMarketPrediction = {
          fixture_id: matchData.fixtureId,
          home_team: matchData.homeTeam,
          away_team: matchData.awayTeam,
          league: matchData.league,
          match_date: matchData.date,
          
          // Core Markets
          match_result_selection: professionalMarkets.matchResult?.selection,
          match_result_confidence: professionalMarkets.matchResult?.confidence,
          over_under_25_selection: professionalMarkets.overUnder25?.selection,
          over_under_25_confidence: professionalMarkets.overUnder25?.confidence,
          over_under_15_selection: professionalMarkets.overUnder15?.selection,
          over_under_15_confidence: professionalMarkets.overUnder15?.confidence,
          over_under_35_selection: professionalMarkets.overUnder35?.selection,
          over_under_35_confidence: professionalMarkets.overUnder35?.confidence,
          btts_selection: professionalMarkets.btts?.selection,
          btts_confidence: professionalMarkets.btts?.confidence,
          
          // First Half Markets
          fh_result_selection: professionalMarkets.firstHalfResult?.selection,
          fh_result_confidence: professionalMarkets.firstHalfResult?.confidence,
          fh_over_05_selection: professionalMarkets.firstHalfOver05?.selection,
          fh_over_05_confidence: professionalMarkets.firstHalfOver05?.confidence,
          fh_over_15_selection: professionalMarkets.firstHalfOver15?.selection,
          fh_over_15_confidence: professionalMarkets.firstHalfOver15?.confidence,
          fh_btts_selection: professionalMarkets.firstHalfBtts?.selection,
          fh_btts_confidence: professionalMarkets.firstHalfBtts?.confidence,
          
          // Special Markets
          htft_selection: professionalMarkets.htft?.selection,
          htft_confidence: professionalMarkets.htft?.confidence,
          asian_hc_selection: professionalMarkets.asianHandicap?.selection,
          asian_hc_confidence: professionalMarkets.asianHandicap?.confidence,
          first_goal_selection: professionalMarkets.teamToScoreFirst?.selection,
          first_goal_confidence: professionalMarkets.teamToScoreFirst?.confidence,
          
          // Team Goals
          home_over_05_selection: professionalMarkets.homeOver05?.selection,
          home_over_05_confidence: professionalMarkets.homeOver05?.confidence,
          away_over_05_selection: professionalMarkets.awayOver05?.selection,
          away_over_05_confidence: professionalMarkets.awayOver05?.confidence,
          home_over_15_selection: professionalMarkets.homeOver15?.selection,
          home_over_15_confidence: professionalMarkets.homeOver15?.confidence,
          away_over_15_selection: professionalMarkets.awayOver15?.selection,
          away_over_15_confidence: professionalMarkets.awayOver15?.confidence,
          
          // Combo Bets
          home_and_over_15_selection: professionalMarkets.homeWinAndOver15?.selection,
          home_and_over_15_confidence: professionalMarkets.homeWinAndOver15?.confidence,
          away_and_over_15_selection: professionalMarkets.awayWinAndOver15?.selection,
          away_and_over_15_confidence: professionalMarkets.awayWinAndOver15?.confidence,
          draw_and_under_25_selection: professionalMarkets.drawAndUnder25?.selection,
          draw_and_under_25_confidence: professionalMarkets.drawAndUnder25?.confidence,
          btts_and_over_25_selection: professionalMarkets.bttsAndOver25?.selection,
          btts_and_over_25_confidence: professionalMarkets.bttsAndOver25?.confidence,
          
          // Corners & Cards
          corners_selection: professionalMarkets.totalCorners?.selection,
          corners_confidence: professionalMarkets.totalCorners?.confidence,
          cards_selection: professionalMarkets.totalCards?.selection,
          cards_confidence: professionalMarkets.totalCards?.confidence,
          exact_goals_selection: professionalMarkets.exactGoals?.selection,
          exact_goals_confidence: professionalMarkets.exactGoals?.confidence,
          
          // Safe Bets (top 2 from safeBets array)
          safe_bet_1_market: professionalMarkets.safeBets?.[0]?.market,
          safe_bet_1_selection: professionalMarkets.safeBets?.[0]?.selection,
          safe_bet_1_confidence: professionalMarkets.safeBets?.[0]?.confidence,
          safe_bet_2_market: professionalMarkets.safeBets?.[1]?.market,
          safe_bet_2_selection: professionalMarkets.safeBets?.[1]?.selection,
          safe_bet_2_confidence: professionalMarkets.safeBets?.[1]?.confidence,
        };

        await saveProfessionalMarketPrediction(proMarketPrediction);
        console.log('📊 Professional market predictions saved to Admin Panel');
      } catch (proMarketSaveError) {
        console.error('⚠️ Professional market save failed (non-blocking):', proMarketSaveError);
      }
    } catch (pmError) {
      console.error('⚠️ Professional markets error:', pmError);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 STEP 11: Build Response - ALL NORMALIZED
    // ═══════════════════════════════════════════════════════════════════════════
    
    const totalTime = Date.now() - startTime;
    
    console.log('');
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('✅ ANALYSIS COMPLETE');
    console.log(`✅ Total time: ${totalTime}ms`);
    console.log('✅ ═══════════════════════════════════════════════════');
    console.log('');

    const responseData = {
      success: result.success,
      reports: {
        ...result.reports,
        // 🆕 Yeni agent'ların sonuçları (zaten reports içinde ama açıkça gösteriyoruz)
        masterStrategist: result.reports?.masterStrategist || null,
        geniusAnalyst: result.reports?.geniusAnalyst || null,
      },
      
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
      
      // Strategy Agent Summary - ALL NORMALIZED
      strategyAgent: strategyResult ? {
        enabled: true,
        masterAnalysis: normalizeMasterAnalysis(strategyResult.masterAnalysis),
        masterKeyFactors: getMasterKeyFactors(strategyResult.masterAnalysis),
        riskAssessment: normalizeRiskAssessment(strategyResult.riskAssessment),
        riskScore: getRiskScore(strategyResult.riskAssessment),
        riskFactors: getRiskFactors(strategyResult.riskAssessment),
        // ✅ NEW: Advanced Risk with Kelly
        advancedRisk: normalizeAdvancedRisk(strategyResult.riskAssessment),
        stakeSuggestion: normalizeStakeSuggestion(strategyResult.stakeSuggestion),
        stakePercentage: getStakePercentage(strategyResult.stakeSuggestion),
        // ✅ NEW: Kelly Criterion
        kellyStake: normalizeKellyStake(strategyResult.stakeSuggestion),
        recommendedBets: strategyResult.recommendedBets || [],
        // ✅ NEW: Additional markets
        newMarkets: normalizeNewMarkets(strategyResult.newMarkets),
        specialAlerts: strategyResult.specialAlerts || [],
        agentSummary: strategyResult.agentSummary || '',
      } : { enabled: false },
      
      // 🆕 Professional Betting Markets - ALL MARKETS
      professionalMarkets: professionalMarkets ? {
        enabled: true,
        // Core Markets
        matchResult: professionalMarkets.matchResult,
        overUnder25: professionalMarkets.overUnder25,
        overUnder15: professionalMarkets.overUnder15,
        overUnder35: professionalMarkets.overUnder35,
        btts: professionalMarkets.btts,
        // First Half Markets
        firstHalf: {
          result: professionalMarkets.firstHalfResult,
          over05: professionalMarkets.firstHalfOver05,
          over15: professionalMarkets.firstHalfOver15,
          btts: professionalMarkets.firstHalfBtts,
        },
        // HT/FT
        htft: professionalMarkets.htft,
        // Handicap
        asianHandicap: professionalMarkets.asianHandicap,
        europeanHandicap: professionalMarkets.europeanHandicap,
        // Team Goals
        teamGoals: {
          homeOver05: professionalMarkets.homeOver05,
          awayOver05: professionalMarkets.awayOver05,
          homeOver15: professionalMarkets.homeOver15,
          awayOver15: professionalMarkets.awayOver15,
        },
        // First Goal
        teamToScoreFirst: professionalMarkets.teamToScoreFirst,
        // Combos
        comboBets: {
          homeWinAndOver15: professionalMarkets.homeWinAndOver15,
          awayWinAndOver15: professionalMarkets.awayWinAndOver15,
          drawAndUnder25: professionalMarkets.drawAndUnder25,
          bttsAndOver25: professionalMarkets.bttsAndOver25,
        },
        // Other
        corners: professionalMarkets.totalCorners,
        cards: professionalMarkets.totalCards,
        exactGoals: professionalMarkets.exactGoals,
        // Summary
        bestBets: professionalMarkets.bestBets,
        safeBets: professionalMarkets.safeBets,
        valueBets: professionalMarkets.valueBets,
        riskyBets: professionalMarkets.riskyBets,
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
      
      // ✅ NEW: Stats Agent advanced data
      advancedStats: {
        xgData: normalizeXgData(result.reports?.stats?.xgData),
        timingPatterns: normalizeTimingPatterns(result.reports?.stats?.timingPatterns),
        cleanSheetStreaks: result.reports?.stats?.cleanSheetStreaks || null,
        scoringFirstStats: result.reports?.stats?.scoringFirstStats || null,
      },
      
      // ✅ NEW: Deep Analysis Agent data
      deepAnalysisAdvanced: result.reports?.deepAnalysis ? {
        refereeAnalysis: result.reports.deepAnalysis.refereeAnalysis || null,
        weatherImpact: result.reports.deepAnalysis.weatherImpact || null,
        pitchConditions: result.reports.deepAnalysis.pitchConditions || null,
        lineupImpact: result.reports.deepAnalysis.lineupImpact || null,
        preparationScore: result.reports.deepAnalysis.preparationScore || null,
      } : null,
      
      // 🆕 NEW: Master Strategist Agent results
      masterStrategist: result.reports?.masterStrategist ? {
        enabled: true,
        // Yeni format
        agent: result.reports.masterStrategist.agent,
        main_take: result.reports.masterStrategist.main_take,
        signals: result.reports.masterStrategist.signals,
        model_probs: result.reports.masterStrategist.model_probs,
        recommended_bets: result.reports.masterStrategist.recommended_bets,
        risks: result.reports.masterStrategist.risks,
        confidence: result.reports.masterStrategist.confidence,
        final: result.reports.masterStrategist.final,
        // Backward compatibility (optional)
        agentEvaluation: result.reports.masterStrategist.agentEvaluation,
        conflictAnalysis: (result.reports.masterStrategist as any).conflictAnalysis,
        finalConsensus: result.reports.masterStrategist.finalConsensus,
        bestBets: result.reports.masterStrategist.bestBets,
        riskAssessment: (result.reports.masterStrategist as any).riskAssessment,
        agentFeedback: (result.reports.masterStrategist as any).agentFeedback,
        masterInsights: (result.reports.masterStrategist as any).masterInsights,
        overallConfidence: result.reports.masterStrategist.overallConfidence,
        recommendation: result.reports.masterStrategist.recommendation,
      } : { enabled: false },
      
      // 🆕 NEW: Genius Analyst Agent results
      geniusAnalyst: result.reports?.geniusAnalyst ? {
        enabled: true,
        matchAnalysis: result.reports.geniusAnalyst.matchAnalysis,
        mathematicalModel: result.reports.geniusAnalyst.mathematicalModel,
        predictions: result.reports.geniusAnalyst.predictions,
        valueBets: result.reports.geniusAnalyst.valueBets,
        riskFactors: result.reports.geniusAnalyst.riskFactors,
        motivationAnalysis: result.reports.geniusAnalyst.motivationAnalysis,
        tacticalInsights: result.reports.geniusAnalyst.tacticalInsights,
        finalRecommendation: result.reports.geniusAnalyst.finalRecommendation,
        geniusInsights: result.reports.geniusAnalyst.geniusInsights,
      } : { enabled: false },
      
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
      analyzedAt: new Date().toISOString(),
    };

    // 📦 CACHE'E KAYDET
    setCachedAnalysis(fixtureId, language, 'agents', responseData);
    console.log(`📦 Agent analysis cached for ${fixtureId}:${language}`);

    return NextResponse.json(responseData);
    
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
    version: 'v8',
    features: [
      'Professional data fetching with includes',
      'Venue-specific statistics',
      'Data quality scoring',
      'Multi-model analysis',
      'Professional Over/Under calculation',
      'Record & matchCount fields for UI',
      'Strategy Agent v2.0 integration',
      'ALL objects normalized for React rendering',
    ],
    timestamp: new Date().toISOString(),
  });
}
