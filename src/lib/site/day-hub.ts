import { YMD_RE, addDays, todayYmd } from './time';

// ============================================================================
// Day hubs (SEO Faz 1b, 2026-10-17): /matches/today, /matches/tomorrow,
// /matches/yesterday and /matches/{yyyy-mm-dd}. "Vorhersage heute" /
// "bugünkü maçlar" / "prediction for today" are the evergreen day queries
// every competitor ranks for; the weekly /matches hub answers none of them
// with a URL of its own. Pure helpers (unit-tested); data in match-public-data.ts.
//
// Rules
//   - the three named hubs are canonical and listed in the sitemap;
//   - a dated slug that equals today/tomorrow/yesterday redirects (307) to the
//     named hub so the two never compete;
//   - other dated slugs are canonical themselves, reachable through the
//     previous/next-day links, limited to the results window (PAST_DAYS back)
//     and the fixture window (FUTURE_DAYS ahead) — outside that: 404.
// ============================================================================

export type DayHubKind = 'today' | 'tomorrow' | 'yesterday' | 'date';
export interface DayHub { kind: DayHubKind; ymd: string }

export const NAMED: Record<Exclude<DayHubKind, 'date'>, number> = { yesterday: -1, today: 0, tomorrow: 1 };
export const PAST_DAYS = 120;
export const FUTURE_DAYS = 21;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400e3);

/** Parse a /matches/{slug} segment as a day hub; null when it is a match slug or an unknown/out-of-window day. */
export function parseDayHub(slug: string, today = todayYmd()): DayHub | null {
  if (slug in NAMED) {
    const kind = slug as Exclude<DayHubKind, 'date'>;
    return { kind, ymd: addDays(today, NAMED[kind]) };
  }
  if (!YMD_RE.test(slug)) return null;
  const [y, m, d] = slug.split('-').map(Number);
  // reject impossible calendar dates (2026-02-30 → March 2 after Date.UTC normalisation)
  if (new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) !== slug) return null;
  const off = daysBetween(today, slug);
  if (off < -PAST_DAYS || off > FUTURE_DAYS) return null;
  return { kind: 'date', ymd: slug };
}

/** The named hub a dated slug should redirect to, or null when it is a plain date. */
export function namedHubFor(ymd: string, today = todayYmd()): Exclude<DayHubKind, 'date'> | null {
  const off = daysBetween(today, ymd);
  return off === 0 ? 'today' : off === 1 ? 'tomorrow' : off === -1 ? 'yesterday' : null;
}

/** Locale-free path of a hub (named when the day is today/tomorrow/yesterday). */
export function dayHubPath(ymd: string, today = todayYmd()): string {
  const named = namedHubFor(ymd, today);
  return `/matches/${named ?? ymd}`;
}

/** Previous/next day paths, clipped to the window; null at the edges. */
export function dayHubNeighbours(ymd: string, today = todayYmd()): { prev: string | null; next: string | null } {
  const off = daysBetween(today, ymd);
  return {
    prev: off - 1 >= -PAST_DAYS ? dayHubPath(addDays(ymd, -1), today) : null,
    next: off + 1 <= FUTURE_DAYS ? dayHubPath(addDays(ymd, 1), today) : null,
  };
}
