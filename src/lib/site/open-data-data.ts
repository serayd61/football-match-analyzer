import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { COLS, parseRows, mapRow, loadContext } from './predictions';
import { idsForLeague } from './results';
import { resolveOfficialVersion, officialFilter } from './official';
import { toOpenDataRow, OPEN_DATA_SINCE, type OpenDataRow } from './open-data';

const PAGE = 1000;
const MAX_ROWS = 20000;

/**
 * Every settled covered match with a final score since the dataset epoch, in
 * kick-off order, as open-data rows (SEO Faz 2.1). Official model version only,
 * paginated like the track record so the file never silently truncates at a
 * PostgREST page. Cached for an hour; the route handlers slice it per league.
 */
export const listOpenDataRows = unstable_cache(
  async (): Promise<OpenDataRow[]> => {
    const ids = await idsForLeague(null);
    if (!ids.length) return [];
    const official = await resolveOfficialVersion();
    const ctx = await loadContext();
    const out: OpenDataRow[] = [];
    const seen = new Set<number>();
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await officialFilter(db().from('engine_predictions').select(COLS), official)
        .in('league_id', ids)
        .eq('settled', true)
        .not('home_score', 'is', null)
        .gte('kickoff', `${OPEN_DATA_SINCE}T00:00:00Z`)
        .order('kickoff', { ascending: true })
        .order('fixture_id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const list = (data || []) as unknown[];
      for (const r of parseRows(data, official)) {
        const row = toOpenDataRow(mapRow(r, ctx));
        if (!row || seen.has(row.fixture_id)) continue;
        seen.add(row.fixture_id);
        out.push(row);
      }
      if (list.length < PAGE) break;
    }
    return out;
  },
  ['site-open-data-rows-v1'],
  { revalidate: REVALIDATE.performance },
);
