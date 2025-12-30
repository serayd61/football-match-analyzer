// ============================================================================
// DEBUG API - Sportmonks veri kontrolü
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFullFixtureData } from '@/lib/sportmonks/index';

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
      // Test 2: Takım detayları (korner dahil)
      console.log('🔍 Test 2: Team details with corners...');
      const teamUrl = new URL(`${SPORTMONKS_API}/teams/${homeTeamId}`);
      teamUrl.searchParams.append('api_token', SPORTMONKS_KEY);
      teamUrl.searchParams.append('include', 'statistics.details;latest.statistics;latest.scores');
      
      const teamRes = await fetch(teamUrl.toString());
      const teamData = await teamRes.json();
      
      // Check for corner stats in statistics
      const stats = teamData?.data?.statistics || [];
      const cornerStats = stats.filter((s: any) => 
        s.type_id === 34 || s.type_id === 45 || s.type_id === 46 ||
        s.details?.some((d: any) => d.type_id === 34 || d.type_id === 45 || d.type_id === 46)
      );
      
      // Check for corners in latest matches
      const latestMatches = teamData?.data?.latest || [];
      const matchesWithCorners = latestMatches.filter((m: any) => 
        m.statistics?.some((s: any) => s.type_id === 34)
      );
      
      // Find actual corner values
      let cornerSamples: any[] = [];
      latestMatches.slice(0, 3).forEach((m: any, idx: number) => {
        if (m.statistics) {
          const homeCorners = m.statistics.find((s: any) => s.type_id === 34 && s.location === 'home');
          const awayCorners = m.statistics.find((s: any) => s.type_id === 34 && s.location === 'away');
          cornerSamples.push({
            matchIndex: idx,
            homeCorners: homeCorners?.data?.value,
            awayCorners: awayCorners?.data?.value,
            hasStats: !!m.statistics?.length,
            statsCount: m.statistics?.length || 0,
            statTypes: m.statistics?.map((s: any) => s.type_id)?.slice(0, 10) || []
          });
        } else {
          cornerSamples.push({ matchIndex: idx, hasStats: false });
        }
      });
      
      results.tests.team = {
        status: teamRes.status,
        success: teamRes.ok,
        hasData: !!teamData?.data,
        teamName: teamData?.data?.name,
        hasStatistics: !!stats.length,
        statsCount: stats.length,
        cornerStatsFound: cornerStats.length,
        hasLatest: !!latestMatches.length,
        latestCount: latestMatches.length,
        matchesWithCorners: matchesWithCorners.length,
        cornerSamples,
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

