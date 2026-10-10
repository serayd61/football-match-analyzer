import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { COLS, parseRows, mapRow, loadContext, getPrediction } from './predictions';
import { idsForLeague } from './results';
import { resolveOfficialVersion, officialFilter } from './official';
import { publicMatchView, type PublicMatch } from './match-public';

// Server-side reads for the public match pages and the sitemap. Every row
// goes through publicMatchView() so no model figure leaves this module.

/** Public view of one covered fixture; null when unknown, hidden or outside model coverage. */
export async function getPublicMatch(fixtureId: number): Promise<PublicMatch | null> {
  const p = await getPrediction(fixtureId);
  if (!p || !p.covered) return null;
  return publicMatchView(p);
}

/** Covered fixtures kicking off from two hours ago up to `days` ahead, kick-off order. */
export const listPublicUpcoming = unstable_cache(
  async (days = 7, limit = 400): Promise<PublicMatch[]> => {
    const ids = await idsForLeague(null);
    const official = await resolveOfficialVersion();
    const now = Date.now();
    const { data, error } = await officialFilter(db().from('engine_predictions').select(COLS), official)
      .in('league_id', ids)
      .eq('settled', false)
      .gte('kickoff', new Date(now - 2 * 3600e3).toISOString())
      .lt('kickoff', new Date(now + days * 86400e3).toISOString())
      .order('kickoff', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    return parseRows(data, official).map((r) => publicMatchView(mapRow(r, ctx))).filter((m) => m.league);
  },
  ['site-public-upcoming-v1'],
  { revalidate: REVALIDATE.fixtures },
);

/** Settled covered fixtures with a final score from the last `days` days, newest first. */
export const listPublicRecent = unstable_cache(
  async (days = 7, limit = 200): Promise<PublicMatch[]> => {
    const ids = await idsForLeague(null);
    const official = await resolveOfficialVersion();
    const { data, error } = await officialFilter(db().from('engine_predictions').select(COLS), official)
      .in('league_id', ids)
      .eq('settled', true)
      .not('home_score', 'is', null)
      .gte('kickoff', new Date(Date.now() - days * 86400e3).toISOString())
      .order('kickoff', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    return parseRows(data, official).map((r) => publicMatchView(mapRow(r, ctx))).filter((m) => m.league);
  },
  ['site-public-recent-v1'],
  { revalidate: REVALIDATE.results },
);

export interface SitemapMatch { path: string; lastmod: Date | null }

/**
 * Public match URLs for the sitemap: covered fixtures from `pastDays` back to
 * `futureDays` ahead. `lastmod` is the engine row's updated_at (a real write),
 * never "now".
 */
export const listSitemapMatches = unstable_cache(
  async (pastDays = 14, futureDays = 21): Promise<SitemapMatch[]> => {
    const ids = await idsForLeague(null);
    const official = await resolveOfficialVersion();
    const { data, error } = await officialFilter(db().from('engine_predictions').select(COLS), official)
      .in('league_id', ids)
      .gte('kickoff', new Date(Date.now() - pastDays * 86400e3).toISOString())
      .lt('kickoff', new Date(Date.now() + futureDays * 86400e3).toISOString())
      .order('kickoff', { ascending: true })
      .limit(3000);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    const seen = new Set<number>();
    const out: SitemapMatch[] = [];
    for (const r of parseRows(data, official)) {
      const m = publicMatchView(mapRow(r, ctx));
      if (!m.league || seen.has(m.fixtureId)) continue;
      seen.add(m.fixtureId);
      const d = m.updatedAt ? new Date(m.updatedAt) : null;
      out.push({ path: `/matches/${m.slug}`, lastmod: d && !Number.isNaN(d.getTime()) ? d : null });
    }
    return out;
  },
  ['site-sitemap-matches-v1'],
  { revalidate: REVALIDATE.performance },
);

/** Most recent engine write in covered leagues — the honest lastmod for data pages (home, leagues, performance). */
export const latestDataUpdate = unstable_cache(
  async (): Promise<Date | null> => {
    const ids = await idsForLeague(null);
    const { data } = await db().from('engine_predictions').select('updated_at').in('league_id', ids).not('updated_at', 'is', null).order('updated_at', { ascending: false }).limit(1);
    const iso = (data?.[0] as { updated_at?: string } | undefined)?.updated_at;
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  },
  ['site-latest-data-update-v1'],
  { revalidate: REVALIDATE.performance },
);
