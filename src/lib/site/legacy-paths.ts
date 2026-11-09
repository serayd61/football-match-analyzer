import { routing, type Locale } from '@/i18n/routing';

// SEO Faz 0 (2026-10-17): the unlocalized legacy app pages that Google still
// holds in its index (225 `/analysis/{home}-vs-{away}-{id}` pages took 44% of
// all impressions in the last 3 months) used to 307 anonymous visitors to
// /login. They now 301 to the localized public page that replaced them, so the
// equity moves instead of evaporating. Pure function: unit-tested, used by the
// edge middleware (no DB access there).
//
//   /analysis/{slug}      → NOT here (2026-11-09): app/(app)/analysis/[slug]/route.ts looks the match up
//                           and answers 301 (canonical public page) or 410 (no public page) — the
//                           301→404 chain was parking 60 URLs in Search Console's "Not found".
//   /analysis, /live, …   → /{l}/matches
//   /match/{id}           → /{l}/predictions/{id}    (members' page; anonymous get a 200 login wall, noindex)
//   /leaderboard, /ai-performance, /track-record, /stats, /league-stats → /{l}/performance
//   /contact              → /{l}/contact
//
// Account pages (/favorites, /profile, /settings) and the odds tools stay
// members-only (see middleware); they are not in Google's index.
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

// 2026-11-09: `/en/en/login?callbackUrl=…` (and the de/it/tr equivalents) were
// the biggest "Bulunamadı (404)" group in Search Console — 115 pages, produced
// for weeks by the double-prefix bug fixed in PR #218. The links are gone, but
// Google holds the URLs and its "Düzeltmeyi doğrula" recrawls them: a URL that
// still 404s keeps failing validation. A 301 to the single-prefix path retires
// them properly and rescues any bookmark or external link that captured one.
// Safe because no route segment is named after a locale (en|de|it|tr).
const DOUBLE_LOCALE = new RegExp(`^/(${routing.locales.join('|')})/(?:${routing.locales.join('|')})(/.*)?$`);

/** `/en/en/login` → `/en/login`; null when the path is not double-prefixed. */
export function doubleLocaleTarget(path: string): string | null {
  const m = path.match(DOUBLE_LOCALE);
  return m ? `/${m[1]}${m[2] ?? ''}` : null;
}

/** Locale for a legacy redirect: the next-intl cookie if valid, else the default. */
export function legacyLocale(cookie: string | undefined | null): Locale {
  return cookie && (routing.locales as readonly string[]).includes(cookie) ? (cookie as Locale) : routing.defaultLocale;
}

/** Localized destination for a legacy path, or null when the path is not a known legacy public page. */
export function legacyRedirectTarget(path: string, locale: Locale): string | null {
  const id = path.match(MATCH_ID);
  if (id) return `/${locale}/predictions/${id[1]}`;
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const to = EXACT[clean];
  return to ? `/${locale}${to}` : null;
}
