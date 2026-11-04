import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE, ODDS_TAG } from './db';
import { idsForLeague } from './results';
import { resolveOfficialVersion, officialFilter } from './official';
import { zonedStartOfDay, addDays } from './time';
import { stripDays, type DayCount } from './day-strip-rule';

// ---------------------------------------------------------------------------
// Gün başına "kapsanan ligde resmi tahmin olan maç" sayısı (overview-1.0).
// Gün şeridi ve panel genel bakışı bunu okur; liste sorgusu (listDay) satır
// çeker, bu yalnız sayar: gün başına bir `count: exact` HEAD isteği, paralel.
// 15 dk önbellek (REVALIDATE.fixtures) — ingest sonrası liste ile aynı gecikme.
// ---------------------------------------------------------------------------
export const dayAvailability = unstable_cache(
  async (today: string): Promise<DayCount[]> => {
    const [ids, official] = await Promise.all([idsForLeague(null), resolveOfficialVersion()]);
    const days = stripDays(today);
    const counts = await Promise.all(days.map(async (date) => {
      const from = zonedStartOfDay(date).toISOString();
      const to = zonedStartOfDay(addDays(date, 1)).toISOString();
      const { count, error } = await officialFilter(db().from('engine_predictions').select('fixture_id', { count: 'exact', head: true }), official)
        .in('league_id', ids)
        .gte('kickoff', from)
        .lt('kickoff', to);
      if (error) throw new Error(error.message);
      return { date, covered: count ?? 0 };
    }));
    return counts;
  },
  ['site-day-availability-v1'],
  { revalidate: REVALIDATE.fixtures, tags: [ODDS_TAG] }, // ingest sonrası gün şeridi de tazelenir (2026-11-04)
);
