// ============================================================================
// DEBUG AGENT ANALYSIS API - Agent'ların çektiği verileri göster
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFullFixtureData, getTeamStats, getHeadToHead, getTeamInjuries } from '@/lib/sportmonks/index';
import { runAgentAnalysis } from '@/lib/agent-analyzer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fixtureId = parseInt(searchParams.get('fixtureId') || '0');
    
    if (!fixtureId) {
      return NextResponse.json(
        { error: 'fixtureId is required' },
        { status: 400 }
      );
    }
    
    console.log(`\n🔍 ========================================`);
    console.log(`🔍 DEBUG AGENT ANALYSIS: Fixture ${fixtureId}`);
    console.log(`🔍 ========================================\n`);
    
    // Step 1: Fetch full fixture data
    console.log('📊 Step 1: Fetching full fixture data...');
    const fullData = await getFullFixtureData(fixtureId);
    
    if (!fullData) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch full fixture data'
      });
    }
    
    const homeTeamId = fullData.homeTeam.id;
    const awayTeamId = fullData.awayTeam.id;
    
    console.log(`✅ Full data loaded: ${fullData.homeTeam.name} vs ${fullData.awayTeam.name}`);
    console.log(`   Data Quality: ${fullData.dataQuality.score}/100`);
    
    // Step 2: Fetch detailed stats
    console.log('📊 Step 2: Fetching detailed team stats...');
    const [homeTeamStats, awayTeamStats, h2hData, homeInjuries, awayInjuries] = await Promise.all([
      getTeamStats(homeTeamId),
      getTeamStats(awayTeamId),
      getHeadToHead(homeTeamId, awayTeamId),
      getTeamInjuries(homeTeamId),
      getTeamInjuries(awayTeamId)
    ]);
    
    console.log(`✅ Team stats loaded`);
    console.log(`   Home Stats: ${homeTeamStats ? '✅' : '❌'}`);
    console.log(`   Away Stats: ${awayTeamStats ? '✅' : '❌'}`);
    console.log(`   H2H Data: ${h2hData ? `✅ (${h2hData.totalMatches} matches)` : '❌'}`);
    console.log(`   Home Injuries: ${homeInjuries?.length || 0}`);
    console.log(`   Away Injuries: ${awayInjuries?.length || 0}`);
    
    // Step 3: Build MatchData-like structure for display
    const matchDataPreview = {
      fixtureId: fullData.fixtureId,
      homeTeam: fullData.homeTeam.name,
      awayTeam: fullData.awayTeam.name,
      homeTeamId: fullData.homeTeam.id,
      awayTeamId: fullData.awayTeam.id,
      league: fullData.league.name,
      date: new Date().toISOString(),
      
      // Full fixture data
      fullData: {
        homeTeam: {
          id: fullData.homeTeam.id,
          name: fullData.homeTeam.name,
          form: fullData.homeTeam.form,
          formPoints: fullData.homeTeam.formPoints,
          position: fullData.homeTeam.position,
          recentMatchesCount: fullData.homeTeam.recentMatches?.length || 0,
          recentMatches: fullData.homeTeam.recentMatches?.slice(0, 5) || []
        },
        awayTeam: {
          id: fullData.awayTeam.id,
          name: fullData.awayTeam.name,
          form: fullData.awayTeam.form,
          formPoints: fullData.awayTeam.formPoints,
          position: fullData.awayTeam.position,
          recentMatchesCount: fullData.awayTeam.recentMatches?.length || 0,
          recentMatches: fullData.awayTeam.recentMatches?.slice(0, 5) || []
        },
        h2h: {
          totalMatches: fullData.h2h?.totalMatches || 0,
          team1Wins: fullData.h2h?.team1Wins || 0,
          team2Wins: fullData.h2h?.team2Wins || 0,
          draws: fullData.h2h?.draws || 0,
          avgGoals: fullData.h2h?.avgGoals || 0,
          bttsPercentage: fullData.h2h?.bttsPercentage || 0,
          over25Percentage: fullData.h2h?.over25Percentage || 0,
          recentMatches: fullData.h2h?.recentMatches?.slice(0, 5) || []
        },
        odds: fullData.odds,
        dataQuality: fullData.dataQuality
      },
      
      // Detailed stats (what agents receive)
      detailedStats: {
        home: homeTeamStats ? {
          form: homeTeamStats.recentForm,
          formPoints: homeTeamStats.formPoints,
          avgGoalsScored: homeTeamStats.avgGoalsScored,
          avgGoalsConceded: homeTeamStats.avgGoalsConceded,
          homeWins: homeTeamStats.homeWins,
          homeDraws: homeTeamStats.homeDraws,
          homeLosses: homeTeamStats.homeLosses,
          awayWins: homeTeamStats.awayWins,
          awayDraws: homeTeamStats.awayDraws,
          awayLosses: homeTeamStats.awayLosses,
          bttsPercentage: homeTeamStats.bttsPercentage,
          over25Percentage: homeTeamStats.over25Percentage,
          under25Percentage: homeTeamStats.under25Percentage,
          cleanSheets: homeTeamStats.cleanSheets,
          failedToScore: homeTeamStats.failedToScore,
          avgCornersFor: homeTeamStats.avgCornersFor,
          avgCornersAgainst: homeTeamStats.avgCornersAgainst
        } : null,
        away: awayTeamStats ? {
          form: awayTeamStats.recentForm,
          formPoints: awayTeamStats.formPoints,
          avgGoalsScored: awayTeamStats.avgGoalsScored,
          avgGoalsConceded: awayTeamStats.avgGoalsConceded,
          homeWins: awayTeamStats.homeWins,
          homeDraws: awayTeamStats.homeDraws,
          homeLosses: awayTeamStats.homeLosses,
          awayWins: awayTeamStats.awayWins,
          awayDraws: awayTeamStats.awayDraws,
          awayLosses: awayTeamStats.awayLosses,
          bttsPercentage: awayTeamStats.bttsPercentage,
          over25Percentage: awayTeamStats.over25Percentage,
          under25Percentage: awayTeamStats.under25Percentage,
          cleanSheets: awayTeamStats.cleanSheets,
          failedToScore: awayTeamStats.failedToScore,
          avgCornersFor: awayTeamStats.avgCornersFor,
          avgCornersAgainst: awayTeamStats.avgCornersAgainst
        } : null,
        h2h: h2hData ? {
          totalMatches: h2hData.totalMatches,
          team1Wins: h2hData.team1Wins,
          team2Wins: h2hData.team2Wins,
          draws: h2hData.draws,
          avgGoals: h2hData.avgGoals,
          bttsPercentage: h2hData.bttsPercentage,
          over25Percentage: h2hData.over25Percentage,
          avgCorners: h2hData.avgCorners,
          recentMatches: h2hData.recentMatches?.slice(0, 5) || []
        } : null,
        injuries: {
          home: homeInjuries || [],
          away: awayInjuries || []
        }
      }
    };
    
    return NextResponse.json({
      success: true,
      fixtureId,
      matchData: matchDataPreview,
      summary: {
        fullDataAvailable: !!fullData,
        dataQuality: fullData.dataQuality.score,
        homeTeamStatsAvailable: !!homeTeamStats,
        awayTeamStatsAvailable: !!awayTeamStats,
        h2hDataAvailable: !!h2hData,
        h2hMatchesCount: h2hData?.totalMatches || 0,
        homeInjuriesCount: homeInjuries?.length || 0,
        awayInjuriesCount: awayInjuries?.length || 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Debug agent analysis error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to debug agent analysis',
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

