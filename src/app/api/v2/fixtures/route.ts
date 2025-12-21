// ============================================================================
// API V2: FIXTURES - Edge Cached Maç Listesi
// Ultra-hızlı maç listesi (<100ms)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Edge runtime for speed

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

// ============================================================================
// SPORTMONKS FETCH
// ============================================================================

async function fetchFixturesFromAPI(date: string): Promise<any[]> {
  try {
    const url = new URL(`${SPORTMONKS_API}/fixtures/date/${date}`);
    url.searchParams.append('api_token', SPORTMONKS_KEY);
    url.searchParams.append('include', 'participants;league;scores');
    url.searchParams.append('per_page', '100');
    
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // 5 dakika cache
    });
    
    if (!res.ok) {
      console.error(`SportMonks API error: ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.error('SportMonks fetch error:', error);
    return [];
  }
}

// ============================================================================
// TRANSFORM FIXTURES
// ============================================================================

function transformFixtures(fixtures: any[]): any[] {
  return fixtures
    .filter(f => f.participants && f.participants.length >= 2)
    .map(f => {
      const home = f.participants.find((p: any) => p.meta?.location === 'home');
      const away = f.participants.find((p: any) => p.meta?.location === 'away');
      
      return {
        id: f.id,
        homeTeam: home?.name || 'Unknown',
        awayTeam: away?.name || 'Unknown',
        homeTeamId: home?.id,
        awayTeamId: away?.id,
        homeTeamLogo: home?.image_path,
        awayTeamLogo: away?.image_path,
        league: f.league?.name || 'Unknown League',
        leagueId: f.league?.id,
        leagueLogo: f.league?.image_path,
        date: f.starting_at,
        status: f.state?.short || 'NS',
        homeScore: f.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals,
        awayScore: f.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Cache key
    const cacheKey = CACHE_KEYS.FIXTURES_DATE(date);
    
    // Get from cache or fetch
    const fixtures = await getOrSet(
      cacheKey,
      async () => {
        const rawFixtures = await fetchFixturesFromAPI(date);
        return transformFixtures(rawFixtures);
      },
      CACHE_TTL.FIXTURES
    );
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      date,
      count: fixtures.length,
      fixtures,
      cached: processingTime < 50, // Cache hit if < 50ms
      processingTime
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Processing-Time': `${processingTime}ms`
      }
    });
    
  } catch (error) {
    console.error('Fixtures API error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

