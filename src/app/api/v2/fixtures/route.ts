// ============================================================================
// API V2: FIXTURES - Edge Cached Maç Listesi
// Ultra-hızlı maç listesi (<100ms)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';
import { withApiMiddleware, successResponse, Errors, RATE_LIMIT_PRESETS } from '@/lib/middleware/error-handler';
import { getEnabledLeagueIds } from '@/lib/data-providers/api-football-provider';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const FOOTBALL_API_HOST = 'api-football-v1.p.rapidapi.com';
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';

// ============================================================================
// API-FOOTBALL FETCH (tek çağrı: o güne ait tüm maçlar, lokal filtre)
// ============================================================================

async function fetchFixturesFromAPI(date: string): Promise<any[]> {
  if (!FOOTBALL_API_KEY) {
    console.error('FOOTBALL_API_KEY missing');
    return [];
  }
  try {
    const res = await fetch(
      `https://${FOOTBALL_API_HOST}/v3/fixtures?date=${date}&timezone=UTC`,
      {
        headers: { 'X-RapidAPI-Key': FOOTBALL_API_KEY, 'X-RapidAPI-Host': FOOTBALL_API_HOST },
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) {
      console.error(`API-Football error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const fixtures = Array.isArray(data?.response) ? data.response : [];
    const allowed = new Set(getEnabledLeagueIds());
    const filtered = fixtures.filter((f: any) => allowed.has(f.league?.id));
    console.log(`📊 Fetched ${filtered.length}/${fixtures.length} fixtures for ${date}`);
    return filtered;
  } catch (error) {
    console.error('API-Football fetch error:', error);
    return [];
  }
}

// ============================================================================
// TRANSFORM FIXTURES (çıktı şekli korunur)
// ============================================================================

function transformFixtures(fixtures: any[]): any[] {
  return fixtures
    .filter(f => f.teams?.home && f.teams?.away)
    .map(f => ({
      id: f.fixture?.id,
      homeTeam: f.teams.home?.name || 'Unknown',
      awayTeam: f.teams.away?.name || 'Unknown',
      homeTeamId: f.teams.home?.id,
      awayTeamId: f.teams.away?.id,
      homeTeamLogo: f.teams.home?.logo,
      awayTeamLogo: f.teams.away?.logo,
      league: f.league?.name || 'Unknown League',
      leagueId: f.league?.id,
      leagueLogo: f.league?.logo,
      leagueCountry: f.league?.country || '',
      date: f.fixture?.date,
      status: f.fixture?.status?.short || 'NS',
      homeScore: f.goals?.home ?? undefined,
      awayScore: f.goals?.away ?? undefined,
    }))
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

async function getFixturesHandler(request: NextRequest) {
  const startTime = Date.now();
  
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const leagueId = searchParams.get('league_id');
  
  // Tarih validasyonu
  if (date && isNaN(Date.parse(date))) {
    throw Errors.validation('Invalid date format. Use YYYY-MM-DD format.');
  }
    
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
    
  return successResponse(
    {
      date,
      count: fixtures.length,
      totalCount: allFixtures.length,
      fixtures,
      leagues,
    },
    undefined,
    {
      cached: processingTime < 50,
      processingTime,
    }
  );
}

// Middleware ile sarılmış handler (Rate Limit + Error Handler)
export const GET = withApiMiddleware(
  getFixturesHandler,
  RATE_LIMIT_PRESETS.PUBLIC // Public endpoint - IP bazlı rate limit
);

