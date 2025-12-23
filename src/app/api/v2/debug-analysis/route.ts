// ============================================================================
// DEBUG ANALYSIS API - Tam analiz sürecini göster
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFullFixtureData } from '@/lib/sportmonks/index';
import { calculateStatisticalPrediction, buildFullDataPrompt } from '@/lib/smart-prompt/index';
import { runSmartAnalysis } from '@/lib/smart-analyzer/index';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fixtureId = searchParams.get('fixture_id');
  
  if (!fixtureId) {
    return NextResponse.json({ error: 'fixture_id required' }, { status: 400 });
  }
  
  const debug: any = {
    timestamp: new Date().toISOString(),
    fixtureId: parseInt(fixtureId),
    steps: {}
  };
  
  try {
    // STEP 1: Sportmonks'tan veri çekme
    console.log('📊 Step 1: Fetching data from Sportmonks...');
    const fullData = await getFullFixtureData(parseInt(fixtureId));
    
    debug.steps.sportmonks = {
      success: !!fullData,
      hasData: !!fullData,
      dataQuality: fullData?.dataQuality || null,
      homeTeam: {
        id: fullData?.homeTeam?.id,
        name: fullData?.homeTeam?.name,
        form: fullData?.homeTeam?.form,
        formPoints: fullData?.homeTeam?.formPoints,
        avgGoalsScored: fullData?.homeTeam?.avgGoalsScored,
        avgGoalsConceded: fullData?.homeTeam?.avgGoalsConceded,
        bttsPercentage: fullData?.homeTeam?.bttsPercentage,
        over25Percentage: fullData?.homeTeam?.over25Percentage,
        homeWins: fullData?.homeTeam?.homeWins,
        homeDraws: fullData?.homeTeam?.homeDraws,
        homeLosses: fullData?.homeTeam?.homeLosses,
        avgCornersFor: fullData?.homeTeam?.avgCornersFor,
        avgCornersAgainst: fullData?.homeTeam?.avgCornersAgainst,
        recentMatches: fullData?.homeTeam?.recentMatches?.length || 0
      },
      awayTeam: {
        id: fullData?.awayTeam?.id,
        name: fullData?.awayTeam?.name,
        form: fullData?.awayTeam?.form,
        formPoints: fullData?.awayTeam?.formPoints,
        avgGoalsScored: fullData?.awayTeam?.avgGoalsScored,
        avgGoalsConceded: fullData?.awayTeam?.avgGoalsConceded,
        bttsPercentage: fullData?.awayTeam?.bttsPercentage,
        over25Percentage: fullData?.awayTeam?.over25Percentage,
        awayWins: fullData?.awayTeam?.awayWins,
        awayDraws: fullData?.awayTeam?.awayDraws,
        awayLosses: fullData?.awayTeam?.awayLosses,
        avgCornersFor: fullData?.awayTeam?.avgCornersFor,
        avgCornersAgainst: fullData?.awayTeam?.avgCornersAgainst,
        recentMatches: fullData?.awayTeam?.recentMatches?.length || 0
      },
      h2h: {
        totalMatches: fullData?.h2h?.totalMatches || 0,
        team1Wins: fullData?.h2h?.team1Wins || 0,
        team2Wins: fullData?.h2h?.team2Wins || 0,
        draws: fullData?.h2h?.draws || 0,
        avgGoals: fullData?.h2h?.avgGoals || 0,
        bttsPercentage: fullData?.h2h?.bttsPercentage || 0,
        avgCorners: fullData?.h2h?.avgCorners || 0,
        recentMatches: fullData?.h2h?.recentMatches?.length || 0
      }
    };
    
    if (!fullData) {
      debug.error = 'Failed to fetch data from Sportmonks';
      return NextResponse.json(debug, { status: 200 });
    }
    
    // STEP 2: İstatistiksel tahmin hesaplama
    console.log('📊 Step 2: Calculating statistical prediction...');
    const matchData = {
      fixtureId: parseInt(fixtureId),
      homeTeamId: fullData.homeTeam.id,
      awayTeamId: fullData.awayTeam.id,
      homeTeamName: fullData.homeTeam.name,
      awayTeamName: fullData.awayTeam.name,
      league: fullData.league?.name || '',
      matchDate: fullData.fixture?.startingAt || ''
    };
    
    // Context oluştur
    const context = {
      homeTeam: {
        teamId: fullData.homeTeam.id,
        teamName: fullData.homeTeam.name,
        recentForm: fullData.homeTeam.form || '',
        formPoints: fullData.homeTeam.formPoints || 0,
        goalsScored: 0,
        goalsConceded: 0,
        avgGoalsScored: fullData.homeTeam.avgGoalsScored || 1.2,
        avgGoalsConceded: fullData.homeTeam.avgGoalsConceded || 1.0,
        homeWins: fullData.homeTeam.homeWins || 0,
        homeDraws: fullData.homeTeam.homeDraws || 0,
        homeLosses: fullData.homeTeam.homeLosses || 0,
        awayWins: 0,
        awayDraws: 0,
        awayLosses: 0,
        bttsPercentage: fullData.homeTeam.bttsPercentage || 50,
        over25Percentage: fullData.homeTeam.over25Percentage || 50,
        avgCornersFor: fullData.homeTeam.avgCornersFor || 0,
        avgCornersAgainst: fullData.homeTeam.avgCornersAgainst || 0
      },
      awayTeam: {
        teamId: fullData.awayTeam.id,
        teamName: fullData.awayTeam.name,
        recentForm: fullData.awayTeam.form || '',
        formPoints: fullData.awayTeam.formPoints || 0,
        goalsScored: 0,
        goalsConceded: 0,
        avgGoalsScored: fullData.awayTeam.avgGoalsScored || 1.1,
        avgGoalsConceded: fullData.awayTeam.avgGoalsConceded || 1.1,
        homeWins: 0,
        homeDraws: 0,
        homeLosses: 0,
        awayWins: fullData.awayTeam.awayWins || 0,
        awayDraws: fullData.awayTeam.awayDraws || 0,
        awayLosses: fullData.awayTeam.awayLosses || 0,
        bttsPercentage: fullData.awayTeam.bttsPercentage || 50,
        over25Percentage: fullData.awayTeam.over25Percentage || 50,
        avgCornersFor: fullData.awayTeam.avgCornersFor || 0,
        avgCornersAgainst: fullData.awayTeam.avgCornersAgainst || 0
      },
      h2h: {
        totalMatches: fullData.h2h.totalMatches || 0,
        team1Wins: fullData.h2h.team1Wins || 0,
        team2Wins: fullData.h2h.team2Wins || 0,
        draws: fullData.h2h.draws || 0,
        avgGoals: fullData.h2h.avgGoals || 2.5,
        bttsPercentage: fullData.h2h.bttsPercentage || 50,
        avgCorners: fullData.h2h.avgCorners || 0
      }
    };
    
    const statsPrediction = calculateStatisticalPrediction(context);
    
    debug.steps.statistical = {
      context,
      prediction: statsPrediction,
      calculations: {
        btts: {
          homeRate: context.homeTeam.bttsPercentage,
          awayRate: context.awayTeam.bttsPercentage,
          h2hRate: context.h2h.bttsPercentage,
          weightedScore: (context.homeTeam.bttsPercentage * 0.3) + 
                        (context.awayTeam.bttsPercentage * 0.3) + 
                        (context.h2h.bttsPercentage * 0.4),
          prediction: statsPrediction.btts.prediction,
          confidence: statsPrediction.btts.confidence
        },
        overUnder: {
          homeAvgScored: context.homeTeam.avgGoalsScored,
          homeAvgConceded: context.homeTeam.avgGoalsConceded,
          awayAvgScored: context.awayTeam.avgGoalsScored,
          awayAvgConceded: context.awayTeam.avgGoalsConceded,
          expectedGoals: ((context.homeTeam.avgGoalsScored + context.awayTeam.avgGoalsConceded) + 
                         (context.awayTeam.avgGoalsScored + context.homeTeam.avgGoalsConceded)) / 2,
          h2hAvgGoals: context.h2h.avgGoals,
          totalExpectedGoals: ((((context.homeTeam.avgGoalsScored + context.awayTeam.avgGoalsConceded) + 
                                (context.awayTeam.avgGoalsScored + context.homeTeam.avgGoalsConceded)) / 2) * 0.6) + 
                              (context.h2h.avgGoals * 0.4),
          prediction: statsPrediction.overUnder.prediction,
          confidence: statsPrediction.overUnder.confidence
        },
        matchResult: {
          homeFormPoints: context.homeTeam.formPoints,
          awayFormPoints: context.awayTeam.formPoints,
          homeWinRate: context.homeTeam.homeWins / Math.max(1, context.homeTeam.homeWins + context.homeTeam.homeDraws + context.homeTeam.homeLosses),
          awayWinRate: context.awayTeam.awayWins / Math.max(1, context.awayTeam.awayWins + context.awayTeam.awayDraws + context.awayTeam.awayLosses),
          h2hTeam1Wins: context.h2h.team1Wins,
          h2hTeam2Wins: context.h2h.team2Wins,
          prediction: statsPrediction.matchResult.prediction,
          confidence: statsPrediction.matchResult.confidence
        }
      }
    };
    
    // STEP 3: AI prompt'u göster
    console.log('📊 Step 3: Building AI prompt...');
    const aiPrompt = buildFullDataPrompt(matchData, fullData);
    
    debug.steps.aiPrompt = {
      length: aiPrompt.length,
      preview: aiPrompt.substring(0, 1000) + '...',
      fullPrompt: aiPrompt
    };
    
    // STEP 4: Tam analiz çalıştır (AI responses dahil)
    console.log('📊 Step 4: Running full analysis...');
    const analysisResult = await runSmartAnalysis({
      fixtureId: parseInt(fixtureId),
      homeTeamId: matchData.homeTeamId,
      awayTeamId: matchData.awayTeamId,
      homeTeam: matchData.homeTeamName,
      awayTeam: matchData.awayTeamName,
      league: matchData.league,
      matchDate: matchData.matchDate
    });
    
    debug.steps.finalAnalysis = {
      success: !!analysisResult,
      btts: analysisResult?.btts,
      overUnder: analysisResult?.overUnder,
      matchResult: analysisResult?.matchResult,
      corners: analysisResult?.corners,
      bestBet: analysisResult?.bestBet,
      agreement: analysisResult?.agreement,
      riskLevel: analysisResult?.riskLevel,
      overallConfidence: analysisResult?.overallConfidence,
      dataQuality: analysisResult?.dataQuality,
      modelsUsed: analysisResult?.modelsUsed
    };
    
    // STEP 5: Karşılaştırma
    debug.comparison = {
      statistical: {
        btts: statsPrediction.btts.prediction,
        bttsConf: statsPrediction.btts.confidence,
        overUnder: statsPrediction.overUnder.prediction,
        overUnderConf: statsPrediction.overUnder.confidence,
        matchResult: statsPrediction.matchResult.prediction,
        matchResultConf: statsPrediction.matchResult.confidence
      },
      final: {
        btts: analysisResult?.btts?.prediction,
        bttsConf: analysisResult?.btts?.confidence,
        overUnder: analysisResult?.overUnder?.prediction,
        overUnderConf: analysisResult?.overUnder?.confidence,
        matchResult: analysisResult?.matchResult?.prediction,
        matchResultConf: analysisResult?.matchResult?.confidence
      },
      changes: {
        btts: statsPrediction.btts.prediction !== analysisResult?.btts?.prediction ? 'CHANGED' : 'SAME',
        overUnder: statsPrediction.overUnder.prediction !== analysisResult?.overUnder?.prediction ? 'CHANGED' : 'SAME',
        matchResult: statsPrediction.matchResult.prediction !== analysisResult?.matchResult?.prediction ? 'CHANGED' : 'SAME'
      }
    };
    
    return NextResponse.json(debug, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    
  } catch (error: any) {
    debug.error = error.message || String(error);
    debug.stack = error.stack;
    return NextResponse.json(debug, { status: 500 });
  }
}

