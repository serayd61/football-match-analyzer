import { routing, type Locale } from '@/i18n/routing';

// SEO Faz 0 (2026-10-17): the unlocalized legacy app pages that Google still
// holds in its index (225 `/analysis/{home}-vs-{away}-{id}` pages took 44% of
// all impressions in the last 3 months) used to 307 anonymous visitors to
// /login. They now 301 to the localized public page that replaced them, so the
// equity moves instead of evaporating. Pure function: unit-tested, used by the
// edge middleware (no DB access there).
//
//   /analysis/{slug}      → /{l}/matches/{slug}      (same slug format; /matches 404s if the league is not covered)
//   /analysis, /live, …   → /{l}/matches
//   /match/{id}           → /{l}/predictions/{id}    (members' page; anonymous get a 200 login wall, noindex)
//   /leaderboard, /ai-performance, /track-record, /stats, /league-stats → /{l}/performance
//   /contact              → /{l}/contact
//
// Account pages (/favorites, /profile, /settings) and the odds tools stay
// members-only (see middleware); they are not in Google's index.
const MATCH_SLUG = /^\/analysis\/([a-z0-9-]+-\d+)\/?$/;
const MATCH_ID = /^\/match\/(\d+)\/?$/;

const EXACT: Record<string, string> = {
  '/analysis': '/matches',
  '/live': '/matches',
  '/tahminler': '/matches',
  '/leaderboard': '/performance',
  '/ai-performance': '/performance',
  '/track-record': '/performance',
  '/stats': '/performance',
  '/league-stats': '/performance',
  '/contact': '/contact',
};

/** Locale for a legacy redirect: the next-intl cookie if valid, else the default. */
export function legacyLocale(cookie: string | undefined | null): Locale {
  return cookie && (routing.locales as readonly string[]).includes(cookie) ? (cookie as Locale) : routing.defaultLocale;
}

/** Localized destination for a legacy path, or null when the path is not a known legacy public page. */
export function legacyRedirectTarget(path: string, locale: Locale): string | null {
  const m = path.match(MATCH_SLUG);
  if (m) return `/${locale}/matches/${m[1]}`;
  const id = path.match(MATCH_ID);
  if (id) return `/${locale}/predictions/${id[1]}`;
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const to = EXACT[clean];
  return to ? `/${locale}${to}` : null;
}
