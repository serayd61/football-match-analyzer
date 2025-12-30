// ============================================================================
// API V2: FIXTURES - Edge Cached Maç Listesi
// Ultra-hızlı maç listesi (<100ms)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

// ============================================================================
// SPORTMONKS FETCH
// ============================================================================

async function fetchFixturesFromAPI(date: string): Promise<any[]> {
  try {
    // Tüm sayfaları çek
    let allFixtures: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 5) { // Max 5 sayfa (500 maç)
      const url = new URL(`${SPORTMONKS_API}/fixtures/date/${date}`);
      url.searchParams.append('api_token', SPORTMONKS_KEY);
      url.searchParams.append('include', 'participants;league;scores');
      url.searchParams.append('per_page', '100');
      url.searchParams.append('page', String(page));
      
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 }
      });
      
      if (!res.ok) {
        console.error(`SportMonks API error: ${res.status}`);
        break;
      }
      
      const data = await res.json();
      const fixtures = data.data || [];
      
      if (fixtures.length === 0) {
        hasMore = false;
      } else {
        allFixtures = [...allFixtures, ...fixtures];
        page++;
        
        // Pagination bilgisi varsa kontrol et
        if (data.pagination && page > data.pagination.last_page) {
          hasMore = false;
        }
      }
    }
    
    console.log(`📊 Fetched ${allFixtures.length} fixtures for ${date}`);
    return allFixtures;
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
        leagueCountry: f.league?.country?.name || '',
        date: f.starting_at,
        status: f.state?.short || 'NS',
        homeScore: f.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals,
        awayScore: f.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Ligleri çıkar
function extractLeagues(fixtures: any[]): { id: number; name: string; logo?: string; count: number }[] {
  const leagueMap = new Map<number, { name: string; logo?: string; count: number }>();
  
  for (const f of fixtures) {
    if (f.leagueId) {
      const existing = leagueMap.get(f.leagueId);
      if (existing) {
        existing.count++;
      } else {
        leagueMap.set(f.leagueId, { name: f.league, logo: f.leagueLogo, count: 1 });
      }
    }
  }
  
  return Array.from(leagueMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const leagueId = searchParams.get('league_id');
    
    // Cache key
    const cacheKey = CACHE_KEYS.FIXTURES_DATE(date);
    
    // Get from cache or fetch
    const allFixtures = await getOrSet(
      cacheKey,
      async () => {
        const rawFixtures = await fetchFixturesFromAPI(date);
        return transformFixtures(rawFixtures);
      },
      CACHE_TTL.FIXTURES
    );
    
    // Ligleri çıkar
    const leagues = extractLeagues(allFixtures);
    
    // Lig filtresi uygula
    const fixtures = leagueId 
      ? allFixtures.filter(f => f.leagueId === parseInt(leagueId))
      : allFixtures;
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      date,
      count: fixtures.length,
      totalCount: allFixtures.length,
      fixtures,
      leagues,
      cached: processingTime < 50,
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

