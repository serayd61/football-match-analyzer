// src/app/api/test-data-comparison/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId') || '85'; // Default: PSG
  const teamName = searchParams.get('teamName') || 'Test Team';

  const results: any = {
    teamId,
    teamName,
    method1_fixtures_between: null,
    method2_teams_latest: null,
    comparison: {}
  };

  // METHOD 1: Stats API yaklaşımı (fixtures/between)
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const url1 = `https://api.sportmonks.com/v3/football/fixtures/between/${startDate}/${endDate}/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores;league&per_page=10`;
    
    console.log('Method 1 URL:', url1);
    const res1 = await fetch(url1);
    const data1 = await res1.json();
    
    if (data1.error) {
      results.method1_fixtures_between = { error: data1.error, message: data1.message };
    } else {
      const matches1 = (data1.data || [])
        .filter((m: any) => m.scores?.length > 0)
        .sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime())
        .slice(0, 5);

      results.method1_fixtures_between = {
        endpoint: `fixtures/between/${startDate}/${endDate}/${teamId}`,
        rawCount: data1.data?.length || 0,
        filteredCount: matches1.length,
        matches: matches1.map((m: any) => {
          const home = m.participants?.find((p: any) => p.meta?.location === 'home');
          const away = m.participants?.find((p: any) => p.meta?.location === 'away');
          let homeScore = 0, awayScore = 0;
          m.scores?.forEach((s: any) => {
            if (s.description === 'CURRENT') {
              if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
              if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
            }
          });
          return {
            date: m.starting_at?.split('T')[0],
            home: home?.name,
            away: away?.name,
            score: `${homeScore}-${awayScore}`,
            league: m.league?.name
          };
        })
      };
    }
  } catch (e: any) {
    results.method1_fixtures_between = { error: e.message };
  }

  // METHOD 2: AI Analysis yaklaşımı (teams/{id}?include=latest)
  try {
    const url2 = `https://api.sportmonks.com/v3/football/teams/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=latest.scores;latest.participants`;
    
    console.log('Method 2 URL:', url2);
    const res2 = await fetch(url2);
    const data2 = await res2.json();
    
    if (data2.error) {
      results.method2_teams_latest = { error: data2.error, message: data2.message };
    } else {
      const matches2 = (data2.data?.latest || []).slice(0, 5);

      results.method2_teams_latest = {
        endpoint: `teams/${teamId}?include=latest`,
        teamName: data2.data?.name,
        rawCount: data2.data?.latest?.length || 0,
        filteredCount: matches2.length,
        matches: matches2.map((m: any) => {
          const home = m.participants?.find((p: any) => p.meta?.location === 'home');
          const away = m.participants?.find((p: any) => p.meta?.location === 'away');
          let homeScore = 0, awayScore = 0;
          m.scores?.forEach((s: any) => {
            if (s.description === 'CURRENT') {
              if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
              if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
            }
          });
          return {
            date: m.starting_at?.split('T')[0],
            home: home?.name,
            away: away?.name,
            score: `${homeScore}-${awayScore}`,
            league: m.league?.name
          };
        })
      };
    }
  } catch (e: any) {
    results.method2_teams_latest = { error: e.message };
  }

  // KARŞILAŞTIRMA
  const m1Count = results.method1_fixtures_between?.filteredCount || 0;
  const m2Count = results.method2_teams_latest?.filteredCount || 0;
  
  results.comparison = {
    method1_count: m1Count,
    method2_count: m2Count,
    winner: m1Count > m2Count ? 'Method 1 (fixtures/between)' : m2Count > m1Count ? 'Method 2 (teams/latest)' : 'Equal',
    recommendation: m1Count === 0 && m2Count === 0 
      ? '⚠️ Her iki method da veri döndürmedi - API planını kontrol et!'
      : m1Count >= m2Count 
        ? '✅ Method 1 (fixtures/between) kullan' 
        : '✅ Method 2 (teams/latest) kullan'
  };

  return NextResponse.json(results, { status: 200 });
}
