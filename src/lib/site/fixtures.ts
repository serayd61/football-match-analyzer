import 'server-only';
import { unstable_cache } from 'next/cache';
import { getOrSet, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';
import { getMatchesByDate } from '@/lib/data-sources/free-football';
import { REVALIDATE } from './db';
import { listPredictionsForDay, loadContext, type SitePrediction } from './predictions';
import { mergeFeed, type FeedRow } from './merge-feed';
export { mergeFeed, fixtureRow, type FeedRow } from './merge-feed';
export { feedStatus } from './status';
import { zonedStartOfDay, addDays, todayYmd } from './time';

// ---------------------------------------------------------------------------
// Fixture schedule for a day, merged with the model's published predictions.
// The engine publishes ratings the evening before; until then a covered
// fixture is still listed (kick-off, teams, crests) with "rating pending".
//
// Denetim 2026-09-05 (P1): the feed knows LIVE/FT/CANC but the merged row
// used to collapse everything into settled=false/outcome=pending, so a
// finished match without a model row could land in "upcoming". `status`
// (match state) and `modelStatus` are now carried separately, and the feed
// state is also merged onto rated rows. The day query reports whether the
// feed was consulted, failed, or skipped so the UI can tell "API error" from
// "genuinely empty calendar".
//
// Feed quota: the raw fixtures go through the same Redis key the legacy
// /api/v2/fixtures route uses (5 min TTL), and the merged result is cached
// for 15 min by ISR, so a busy day costs a handful of upstream calls.
// ---------------------------------------------------------------------------

export type FeedState = 'ok' | 'error' | 'skipped';

export interface DayRows { rows: SitePrediction[]; feed: FeedState; fetchedAt: string }

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

/**
 * Rows for a calendar day (Zurich): published predictions first, then any
 * feed fixture the model has not rated yet. Only today and the next two
 * days consult the feed; other days come from the database alone.
 */
export const listDay = unstable_cache(
  async (ymd: string): Promise<DayRows> => {
    const predictions = await listPredictionsForDay(ymd);
    const today = todayYmd();
    const fetchedAt = new Date().toISOString();
    if (ymd < today || ymd > addDays(today, 2)) return { rows: predictions, feed: 'skipped', fetchedAt };

    let feed: FeedRow[] = [];
    try { feed = await feedForDay(ymd); } catch (e) { console.error('[site/fixtures] feed failed', e); return { rows: predictions, feed: 'error', fetchedAt }; }

    const ctx = await loadContext();
    const window = { from: zonedStartOfDay(ymd).getTime(), to: zonedStartOfDay(addDays(ymd, 1)).getTime() };
    return { rows: mergeFeed(predictions, feed, ctx.catalog, window), feed: 'ok', fetchedAt };
  },
  ['site-day-v2'],
  { revalidate: REVALIDATE.fixtures },
);

/** Backwards-compatible: rows only. */
export async function listDayRows(ymd: string): Promise<SitePrediction[]> {
  return (await listDay(ymd)).rows;
}
