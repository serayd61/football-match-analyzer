import 'server-only';
import { unstable_cache } from 'next/cache';
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';
import { getMatchesByDate } from '@/lib/data-sources/free-football';
import { REVALIDATE } from './db';
import { resolveLeague } from './leagues';
import { listPredictionsForDay, loadContext, type SitePrediction } from './predictions';
import { zonedStartOfDay, addDays, todayYmd } from './time';

// ---------------------------------------------------------------------------
// Fixture schedule for a day, merged with the model's published predictions.
// The engine publishes ratings the evening before; until then a covered
// fixture is still listed (kick-off, teams, crests) with "rating pending".
//
// Feed quota: the raw fixtures go through the same Redis key the legacy
// /api/v2/fixtures route uses (5 min TTL), and the merged result is cached
// for 15 min by ISR, so a busy day costs a handful of upstream calls.
// ---------------------------------------------------------------------------

interface FeedRow {
  id: number; homeTeam: string; awayTeam: string; homeTeamId: number; awayTeamId: number;
  homeTeamLogo: string; awayTeamLogo: string; league: string; leagueId: number; leagueLogo: string;
  leagueCountry: string; date: string; status: string; homeScore?: number; awayScore?: number;
}

async function feedForDay(ymd: string): Promise<FeedRow[]> {
  return getOrSet<FeedRow[]>(
    CACHE_KEYS.FIXTURES_DATE(ymd),
    async () => {
      const list = await getMatchesByDate(ymd);
      return list
        .map((f) => ({
          id: f.id, homeTeam: f.homeName || 'Unknown', awayTeam: f.awayName || 'Unknown', homeTeamId: f.homeId, awayTeamId: f.awayId,
          homeTeamLogo: f.homeLogo, awayTeamLogo: f.awayLogo, league: f.leagueName || 'Unknown League', leagueId: f.leagueId, leagueLogo: f.leagueLogo,
          leagueCountry: f.leagueCountry || '', date: f.utcTime, status: f.cancelled ? 'CANC' : f.finished ? 'FT' : f.started ? 'LIVE' : 'NS',
          homeScore: f.homeScore ?? undefined, awayScore: f.awayScore ?? undefined,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
    CACHE_TTL.FIXTURES,
  );
}

const crest = (id: number | null) => (id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : null);

function fixtureRow(f: FeedRow, ctx: Awaited<ReturnType<typeof loadContext>>): SitePrediction {
  const cat = ctx.catalog.get(Number(f.leagueId));
  const league = resolveLeague(f.league, f.leagueId, f.leagueCountry || cat?.ccode);
  return {
    fixtureId: f.id, league, leagueName: league?.name || f.league, leagueId: f.leagueId, covered: !!league,
    homeId: f.homeTeamId, homeName: f.homeTeam, awayId: f.awayTeamId, awayName: f.awayTeam,
    homeCrest: crest(f.homeTeamId), awayCrest: crest(f.awayTeamId), kickoff: f.date,
    pHome: 0, pDraw: 0, pAway: 0, lambdaHome: null, lambdaAway: null, pick: null, confidence: null, confidenceRaw: null,
    doubleChance: null, overUnder: null, btts: null, rationale: null,
    settled: false, homeScore: f.homeScore ?? null, awayScore: f.awayScore ?? null, result: null,
    outcome: 'pending', modelVersion: null, updatedAt: null, hasModel: false,
  };
}

/**
 * Rows for a calendar day (Zurich): published predictions first, then any
 * feed fixture the model has not rated yet. Only today and the next two
 * days consult the feed; other days come from the database alone.
 */
export const listDayRows = unstable_cache(
  async (ymd: string): Promise<SitePrediction[]> => {
    const predictions = await listPredictionsForDay(ymd);
    const today = todayYmd();
    if (ymd < today || ymd > addDays(today, 2)) return predictions;

    let feed: FeedRow[] = [];
    try { feed = await feedForDay(ymd); } catch (e) { console.error('[site/fixtures] feed failed', e); return predictions; }

    const known = new Set(predictions.map((p) => p.fixtureId));
    const from = zonedStartOfDay(ymd).getTime();
    const to = zonedStartOfDay(addDays(ymd, 1)).getTime();
    const ctx = await loadContext();
    const extra = feed
      .filter((f) => !known.has(f.id) && f.status !== 'CANC')
      .filter((f) => { const t = new Date(f.date).getTime(); return t >= from && t < to; })
      .map((f) => fixtureRow(f, ctx));
    return [...predictions, ...extra].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  },
  ['site-day-rows'],
  { revalidate: REVALIDATE.fixtures },
);
