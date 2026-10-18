// ============================================================================
// API V2: FIXTURES - Edge Cached Maç Listesi
// Ultra-hızlı maç listesi (<100ms)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOrSet, getRedisClient, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';
import { withApiMiddleware, successResponse, Errors, RATE_LIMIT_PRESETS } from '@/lib/middleware/error-handler';
import { getMatchesByDateStrict, FeedUnavailableError, FFMatch } from '@/lib/data-sources/free-football';
import { excludedLeagueIds, hiddenLeagueIds } from '@/lib/coverage/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================================
// FETCH (Free API Live Football Data)
// ============================================================================

// Kaynak hatası (502/429/ağ) → FeedUnavailableError yukarı çıkar; boş gün ([]) ile karışmaz.
async function fetchFixturesFromAPI(date: string): Promise<FFMatch[]> {
  const matches = await getMatchesByDateStrict(date);
  console.log(`📊 Fetched ${matches.length} fixtures for ${date}`);
  return matches;
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
    // ?scope=model: kapsam sicilinde 'excluded' ligler elenir (motor senkronu bunu kullanır;
    // Gana/Galler ligine tahmin üretilmez, akış kotası ve void yükü düşer)
    const scopeModel = searchParams.get('scope') === 'model';
  
  // Tarih validasyonu
  if (date && isNaN(Date.parse(date))) {
    throw Errors.validation('Invalid date format. Use YYYY-MM-DD format.');
  }
    
    // Cache key
    const cacheKey = CACHE_KEYS.FIXTURES_DATE(date);
    
    // Get from cache or fetch. 2026-10-18: sağlayıcı 502 verince boş liste 5 dk önbelleğe
    // yazılıyor, site "bugün maç yok" gösteriyordu (17 Eki sabahı da aynı). Kaynak hatasında
    // ÖNBELLEĞE YAZMA: varsa bayat kopya (önbelleksiz uzun tutulan son iyi liste), yoksa
    // boş + meta.feedUnavailable — istemci "veri kaynağı geçici olarak ulaşılamıyor" der.
    let feedUnavailable = false;
    let allFixturesRaw: ReturnType<typeof transformFixtures>;
    try {
      allFixturesRaw = await getOrSet(
        cacheKey,
        async () => {
          const rawFixtures = await fetchFixturesFromAPI(date);
          const out = transformFixtures(rawFixtures);
          // son iyi kopya: 24 saat (yalnız dolu listeler)
          if (out.length) { try { await getRedisClient().set(`${cacheKey}:last-good`, out, { ex: 24 * 3600 }); } catch { /* opsiyonel */ } }
          return out;
        },
        CACHE_TTL.FIXTURES
      );
    } catch (e) {
      if (!(e instanceof FeedUnavailableError)) throw e;
      feedUnavailable = true;
      let lastGood: ReturnType<typeof transformFixtures> | null = null;
      try { lastGood = await getRedisClient().get<ReturnType<typeof transformFixtures>>(`${cacheKey}:last-good`); } catch { /* opsiyonel */ }
      allFixturesRaw = lastGood ?? [];
      console.error(`[fixtures] feed unavailable for ${date}; serving ${lastGood ? 'last-good copy' : 'empty'} (not cached)`);
    }
    
    // Sicilde 'hidden' (sinyalsiz lig veya 17 Eki eleme kuralı: uzak ülke / alt kademe /
    // kadın-genç) hiçbir yüzeyde listelenmez; 'excluded' yalnızca scope=model'de düşer.
    const hidden = await hiddenLeagueIds().catch(() => new Set<number>());
    const excluded = scopeModel ? await excludedLeagueIds() : null;
    const allFixtures = allFixturesRaw.filter((f) => !hidden.has(Number(f.leagueId)) && !(excluded && excluded.has(Number(f.leagueId))));

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
      ...(feedUnavailable ? { feedUnavailable: true } : {}),
    }
  );
}

// Middleware ile sarılmış handler (Rate Limit + Error Handler)
export const GET = withApiMiddleware(
  getFixturesHandler,
  RATE_LIMIT_PRESETS.PUBLIC // Public endpoint - IP bazlı rate limit
);

