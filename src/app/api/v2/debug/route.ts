// ============================================================================
// DEBUG API - Sportmonks veri kontrolü
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFullFixtureData } from '@/lib/sportmonks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fixtureId = searchParams.get('fixture_id') || '19432011';
  
  const results: any = {
    timestamp: new Date().toISOString(),
    fixtureId,
    apiKeyPresent: !!SPORTMONKS_KEY,
    tests: {}
  };
  
  try {
    // Test 1: Fixture temel bilgileri
    console.log('🔍 Test 1: Fixture base data...');
    const fixtureUrl = new URL(`${SPORTMONKS_API}/fixtures/${fixtureId}`);
    fixtureUrl.searchParams.append('api_token', SPORTMONKS_KEY);
    fixtureUrl.searchParams.append('include', 'participants;league;scores');
    
    const fixtureRes = await fetch(fixtureUrl.toString());
    const fixtureData = await fixtureRes.json();
    
    results.tests.fixture = {
      status: fixtureRes.status,
      success: fixtureRes.ok,
      hasData: !!fixtureData?.data,
      teams: fixtureData?.data?.participants?.map((p: any) => ({
        id: p.id,
        name: p.name,
        location: p.meta?.location
      })) || [],
      error: fixtureData?.error || fixtureData?.message || null
    };
    
    if (!fixtureData?.data) {
      results.tests.fixture.rawResponse = fixtureData;
    }
    
    // Takım ID'lerini al
    const homeTeam = fixtureData?.data?.participants?.find((p: any) => p.meta?.location === 'home');
    const awayTeam = fixtureData?.data?.participants?.find((p: any) => p.meta?.location === 'away');
    const homeTeamId = homeTeam?.id;
    const awayTeamId = awayTeam?.id;
    
    results.homeTeamId = homeTeamId;
    results.awayTeamId = awayTeamId;
    
    if (homeTeamId) {
      // Test 2: Takım detayları
      console.log('🔍 Test 2: Team details...');
      const teamUrl = new URL(`${SPORTMONKS_API}/teams/${homeTeamId}`);
      teamUrl.searchParams.append('api_token', SPORTMONKS_KEY);
      teamUrl.searchParams.append('include', 'statistics;latest;coaches');
      
      const teamRes = await fetch(teamUrl.toString());
      const teamData = await teamRes.json();
      
      results.tests.team = {
        status: teamRes.status,
        success: teamRes.ok,
        hasData: !!teamData?.data,
        teamName: teamData?.data?.name,
        hasStatistics: !!teamData?.data?.statistics?.length,
        hasLatest: !!teamData?.data?.latest?.length,
        latestCount: teamData?.data?.latest?.length || 0,
        hasCoaches: !!teamData?.data?.coaches?.length,
        error: teamData?.error || teamData?.message || null
      };
      
      // Test 3: H2H
      if (awayTeamId) {
        console.log('🔍 Test 3: Head to head...');
        const h2hUrl = new URL(`${SPORTMONKS_API}/fixtures/head-to-head/${homeTeamId}/${awayTeamId}`);
        h2hUrl.searchParams.append('api_token', SPORTMONKS_KEY);
        h2hUrl.searchParams.append('include', 'participants;scores');
        h2hUrl.searchParams.append('per_page', '10');
        
        const h2hRes = await fetch(h2hUrl.toString());
        const h2hData = await h2hRes.json();
        
        results.tests.h2h = {
          status: h2hRes.status,
          success: h2hRes.ok,
          hasData: !!h2hData?.data?.length,
          matchCount: h2hData?.data?.length || 0,
          error: h2hData?.error || h2hData?.message || null
        };
      }
    }
    
    // Test 4: getFullFixtureData function
    console.log('🔍 Test 4: getFullFixtureData function...');
    try {
      const fullData = await getFullFixtureData(parseInt(fixtureId));
      results.tests.fullFixtureData = {
        success: !!fullData,
        hasData: !!fullData,
        homeTeam: fullData?.homeTeam?.name || null,
        awayTeam: fullData?.awayTeam?.name || null,
        homeForm: fullData?.homeTeam?.form || null,
        awayForm: fullData?.awayTeam?.form || null,
        h2hMatches: fullData?.h2h?.totalMatches || 0,
        dataQualityScore: fullData?.dataQuality?.score || 0,
        error: null
      };
    } catch (e: any) {
      results.tests.fullFixtureData = {
        success: false,
        hasData: false,
        error: e.message || String(e)
      };
    }
    
    // Özet
    results.summary = {
      allTestsPassed: Object.values(results.tests).every((t: any) => t.success),
      dataAvailable: results.tests.fixture?.hasData && 
                     results.tests.team?.hasData && 
                     (results.tests.h2h?.hasData || results.tests.h2h?.matchCount >= 0),
      fullDataWorks: results.tests.fullFixtureData?.success || false
    };
    
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    
  } catch (error: any) {
    results.error = error.message || String(error);
    return NextResponse.json(results, { status: 500 });
  }
}

