import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { SITE_LEAGUES, resolveLeague, type SiteLeague } from './leagues';
import { getCatalogMap } from '@/lib/league-catalog';
import { COLS, parseRows, mapRow, loadContext, type SitePrediction } from './predictions';
import { zonedStartOfDay, addDays } from './time';

// ---------------------------------------------------------------------------
// Covered league ids. Feed league ids are seasonal (Championship 2025/26 is
// 938218, not 48), so the catalog is the only reliable way to turn a slug
// into the id set a server-side filter can use.
// ---------------------------------------------------------------------------
export const coveredLeagueIds = unstable_cache(
  async (): Promise<Record<string, number[]>> => {
    const catalog = await getCatalogMap().catch(() => new Map());
    const out: Record<string, number[]> = {};
    for (const l of SITE_LEAGUES) out[l.slug] = [...l.ids];
    for (const [id, e] of catalog as Map<number, { name: string; ccode: string }>) {
      const l = resolveLeague(e.name, null, e.ccode);
      if (l && !out[l.slug].includes(id)) out[l.slug].push(id);
    }
    return out;
  },
  ['site-covered-ids'],
  { revalidate: REVALIDATE.performance },
);

export async function idsForLeague(league: SiteLeague | null): Promise<number[]> {
  const map = await coveredLeagueIds();
  return league ? map[league.slug] : Object.values(map).flat();
}

export interface ResultsQuery {
  league?: SiteLeague | null;
  /** inclusive Zurich calendar day */
  from?: string | null;
  /** exclusive Zurich calendar day */
  to?: string | null;
  page: number;
  pageSize: number;
}

export interface ResultsPage {
  rows: SitePrediction[];
  /** settled with a final score */
  total: number;
  won: number;
  lost: number;
  /** marked settled by the engine but never resolved to a score (postponed, abandoned, feed gap) */
  unresolved: number;
}

/** Settled matches in covered leagues, newest first, with page totals. */
export const listResults = unstable_cache(
  async (q: ResultsQuery): Promise<ResultsPage> => {
    const ids = await idsForLeague(q.league ?? null);
    const base = () => {
      let s = db().from('engine_predictions').select(COLS, { count: 'exact' }).eq('settled', true).in('league_id', ids);
      if (q.from) s = s.gte('kickoff', zonedStartOfDay(q.from).toISOString());
      if (q.to) s = s.lt('kickoff', zonedStartOfDay(q.to).toISOString());
      return s;
    };
    const fromIdx = (q.page - 1) * q.pageSize;
    const scored = () => base().not('home_score', 'is', null);
    const [list, won, lost, unresolved] = await Promise.all([
      scored().order('kickoff', { ascending: false }).range(fromIdx, fromIdx + q.pageSize - 1),
      scored().eq('correct', true).limit(0),
      scored().eq('correct', false).limit(0),
      base().is('home_score', null).limit(0),
    ]);
    if (list.error) throw new Error(list.error.message);
    const ctx = await loadContext();
    return {
      rows: parseRows(list.data).map((r) => mapRow(r, ctx)),
      total: list.count ?? 0,
      won: won.count ?? 0,
      lost: lost.count ?? 0,
      unresolved: unresolved.count ?? 0,
    };
  },
  ['site-results'],
  { revalidate: REVALIDATE.results },
);

/** Zurich day window helpers for period presets. */
export function periodWindow(period: '7d' | '30d' | '90d' | 'all', today: string): { from: string | null; to: string | null } {
  if (period === 'all') return { from: null, to: null };
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return { from: addDays(today, -days), to: addDays(today, 1) };
}

/** Goal-market outcomes are settled from the final score. */
export function goalOutcomes(p: SitePrediction): { ou: 'won' | 'lost' | null; btts: 'won' | 'lost' | null } {
  if (p.homeScore == null || p.awayScore == null) return { ou: null, btts: null };
  const total = p.homeScore + p.awayScore;
  const both = p.homeScore > 0 && p.awayScore > 0;
  return {
    ou: p.overUnder ? ((p.overUnder.pick === 'over' ? total > 2.5 : total < 2.5) ? 'won' : 'lost') : null,
    btts: p.btts ? ((p.btts.pick === 'yes') === both ? 'won' : 'lost') : null,
  };
}

/** Upcoming (unsettled, kick-off from now) covered predictions for one league. */
export const listUpcomingForLeague = unstable_cache(
  async (slug: string, limit = 30): Promise<SitePrediction[]> => {
    const map = await coveredLeagueIds();
    const ids = map[slug] || [];
    if (!ids.length) return [];
    const { data, error } = await db()
      .from('engine_predictions')
      .select(COLS)
      .in('league_id', ids)
      .eq('settled', false)
      .gte('kickoff', new Date(Date.now() - 2 * 3600e3).toISOString())
      .order('kickoff', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    return parseRows(data).map((r) => mapRow(r, ctx));
  },
  ['site-upcoming-league'],
  { revalidate: REVALIDATE.fixtures },
);

/** Fixture ids for the sitemap: covered matches from the last `days` days plus everything upcoming. */
export const listSitemapFixtures = unstable_cache(
  async (days = 30): Promise<Array<{ fixtureId: number; updatedAt: string | null }>> => {
    const ids = await idsForLeague(null);
    const { data } = await db()
      .from('engine_predictions')
      .select('fixture_id, updated_at')
      .in('league_id', ids)
      .gte('kickoff', new Date(Date.now() - days * 86400e3).toISOString())
      .order('kickoff', { ascending: false })
      .limit(2000);
    return ((data || []) as Array<{ fixture_id: number; updated_at: string | null }>).map((r) => ({ fixtureId: Number(r.fixture_id), updatedAt: r.updated_at }));
  },
  ['site-sitemap-fixtures'],
  { revalidate: REVALIDATE.performance },
);
