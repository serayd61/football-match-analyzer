// ============================================================================
// API V2: FIXTURES - Edge Cached Maç Listesi
// Ultra-hızlı maç listesi (<100ms)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';
import { withApiMiddleware, successResponse, Errors, RATE_LIMIT_PRESETS } from '@/lib/middleware/error-handler';
import { getMatchesByDate, FFMatch } from '@/lib/data-sources/free-football';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================================
// FETCH (Free API Live Football Data)
// ============================================================================

async function fetchFixturesFromAPI(date: string): Promise<FFMatch[]> {
  try {
    const matches = await getMatchesByDate(date);
    console.log(`📊 Fetched ${matches.length} fixtures for ${date}`);
    return matches;
  } catch (error) {
    console.error('Free-football fetch error:', error);
    return [];
  }
}

// ============================================================================
// TRANSFORM FIXTURES (çıktı şekli korunur)
// ============================================================================

function ffStatusShort(m: FFMatch): string {
  if (m.cancelled) return 'CANC';
  if (m.finished) return 'FT';
  if (m.started) return 'LIVE';
  return 'NS';
}

function transformFixtures(fixtures: FFMatch[]): any[] {
  return fixtures
    .map(f => ({
      id: f.id,
      homeTeam: f.homeName || 'Unknown',
      awayTeam: f.awayName || 'Unknown',
      homeTeamId: f.homeId,
      awayTeamId: f.awayId,
      homeTeamLogo: f.homeLogo,
      awayTeamLogo: f.awayLogo,
      league: f.leagueName || 'Unknown League',
      leagueId: f.leagueId,
      leagueLogo: f.leagueLogo,
      leagueCountry: f.leagueCountry || '',
      date: f.utcTime,
      status: ffStatusShort(f),
      homeScore: f.homeScore ?? undefined,
      awayScore: f.awayScore ?? undefined,
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

