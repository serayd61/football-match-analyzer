import { SITE_URL } from '@/lib/seo';
import { routing } from '@/i18n/routing';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { CONTENT_IMAGES, type ContentImageId } from '@/lib/site/content-images';

// Sitemap XML builder (SEO denetimi 2026-10-10), served by app/sitemap.xml/route.ts.
// Next 14.2's `sitemap.ts` convention cannot emit the Google image extension,
// and the three real product screenshots on the home and methodology pages
// should be discoverable through the sitemap, not only through <img> crawling.
// Same URL set and hreflang alternates as the old convention file; `lastmod`
// is the only date field Google reads (changefreq / priority are kept for Bing).
//
// Freemium SEO (2026-09-24): only URLs an anonymous visitor can open are
// listed. Everything members-only (/predictions, /predictions/[id], the legacy
// /analysis pages) 307s to /login for Googlebot and was filling Search Console
// with "discovered, not indexed" and "page with redirect" entries.
//
// Public match pages (2026-10-10): /matches and /matches/{slug} are listed
// with the engine row's updated_at as lastmod. Data pages (home, leagues,
// performance) take the latest engine write instead of "today": a lastmod
// that changes on every request tells Google nothing.

/** `lastmod`: Date ya da ISO string — unstable_cache Date'i JSON'a çevirip string döndürür (build 2026-10-16: toISOString hatası). */
export interface Entry { path: string; lastmod?: Date | string | null; changefreq: string; priority: number; images?: ContentImageId[] }
const isoOf = (d: Date | string): string | null => { const t = new Date(d); return Number.isNaN(t.getTime()) ? null : t.toISOString(); };

/** Real revision dates of the long-form docs (bump when the text changes). */
export const DOCS_UPDATED: Record<'methodology' | 'about' | 'privacy' | 'terms' | 'glossary', Date> = {
  methodology: new Date('2026-10-10T12:00:00Z'),
  glossary: new Date('2026-10-17T12:00:00Z'),
  about: new Date('2026-09-04T12:00:00Z'),
  privacy: new Date('2026-10-18T12:00:00Z'),
  terms: new Date('2026-09-04T12:00:00Z'),
};

export interface SitemapInput {
  /** latest engine write in covered leagues; null → no lastmod on data pages */
  dataUpdated: Date | null;
  /** public match pages (locale-free paths) with their own lastmod; `settled` → results section (2026-11-01) */
  matches: Array<{ path: string; lastmod: Date | null; settled?: boolean }>;
  /** team pages (SEO Faz 1b), locale-free paths; with lastmod = last played kick-off (2026-11-01) */
  teams?: Array<string | { path: string; lastmod: Date | string | null }>;
}

// Tarama bütçesi (SC 2026-11-01: 1.693 "keşfedildi – dizine eklenmedi", 5.344 URL tek
// dosyada, takım sayfaları saatlik lastmod ile "sürekli değişiyor" görünüyordu).
// Sitemap türlere bölünür: /sitemap.xml bir indeks, bölümler /sitemaps/{section}.xml.
// SC'de her bölümün indeks durumu ayrı okunur; bitmiş maçlar "results" bölümünde
// aylık changefreq ile durur, yaklaşan maçlar "matches" bölümünde günlük.
export const SITEMAP_SECTIONS = ['pages', 'leagues', 'teams', 'matches', 'results'] as const;
export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];
export const sectionPath = (s: SitemapSection) => `/sitemaps/${s}.xml`;
export function isSitemapSection(v: string): v is SitemapSection { return (SITEMAP_SECTIONS as readonly string[]).includes(v); }

/** Static public paths (one entry each; tests count them). */
export const STATIC_PATHS = ['', '/matches', '/matches/today', '/matches/tomorrow', '/matches/yesterday', '/teams', '/pricing', '/performance', '/leagues', '/methodology', '/glossary', '/data', '/about', '/app', '/contact', '/privacy', '/terms'] as const;

export function entriesFor(section: SitemapSection, input: SitemapInput): Entry[] {
  const data = input.dataUpdated;
  switch (section) {
    case 'pages':
      return [
        { path: '', changefreq: 'hourly', priority: 1, lastmod: data, images: ['standings', 'track-record'] },
        { path: '/matches', changefreq: 'hourly', priority: 0.9, lastmod: data },
        // SEO Faz 1b: evergreen day hubs — the URL stays, the day rolls (lastmod = latest engine write)
        { path: '/matches/today', changefreq: 'hourly', priority: 0.8, lastmod: data },
        { path: '/matches/tomorrow', changefreq: 'hourly', priority: 0.7, lastmod: data },
        { path: '/matches/yesterday', changefreq: 'daily', priority: 0.6, lastmod: data },
        { path: '/teams', changefreq: 'weekly', priority: 0.5, lastmod: data },
        { path: '/pricing', changefreq: 'monthly', priority: 0.6 },
        { path: '/performance', changefreq: 'daily', priority: 0.8, lastmod: data },
        { path: '/leagues', changefreq: 'weekly', priority: 0.6, lastmod: data },
        { path: '/methodology', changefreq: 'monthly', priority: 0.6, lastmod: DOCS_UPDATED.methodology, images: ['sample-analysis', 'track-record'] },
        { path: '/glossary', changefreq: 'monthly', priority: 0.5, lastmod: DOCS_UPDATED.glossary },
        // SEO Faz 2.1: open-data page (files refresh hourly; lastmod = latest engine write)
        { path: '/data', changefreq: 'daily', priority: 0.6, lastmod: data },
        { path: '/about', changefreq: 'monthly', priority: 0.4, lastmod: DOCS_UPDATED.about },
        { path: '/app', changefreq: 'monthly', priority: 0.5, lastmod: '2026-10-28' },
        { path: '/contact', changefreq: 'yearly', priority: 0.3 },
        { path: '/privacy', changefreq: 'yearly', priority: 0.2 },
        { path: '/terms', changefreq: 'yearly', priority: 0.2 },
      ];
    case 'leagues':
      return [
        ...SITE_LEAGUES.map((l): Entry => ({ path: `/leagues/${l.slug}`, changefreq: 'daily', priority: 0.7, lastmod: data })),
        // SEO Faz 1a: per-league results archive (settled matches, public scores)
        ...SITE_LEAGUES.map((l): Entry => ({ path: `/leagues/${l.slug}/results`, changefreq: 'daily', priority: 0.5, lastmod: data })),
        // SEO Faz 1c: per-league xG/xPTS table and goal statistics
        ...SITE_LEAGUES.map((l): Entry => ({ path: `/leagues/${l.slug}/xg-table`, changefreq: 'daily', priority: 0.6, lastmod: data })),
        ...SITE_LEAGUES.map((l): Entry => ({ path: `/leagues/${l.slug}/goals`, changefreq: 'daily', priority: 0.6, lastmod: data })),
        // SEO Faz 1b: per-league track record (public settled record, no session)
        ...SITE_LEAGUES.map((l): Entry => ({ path: `/performance/${l.slug}`, changefreq: 'daily', priority: 0.6, lastmod: data })),
      ];
    case 'teams':
      // lastmod = the club's last played kick-off (a real content change), never the global hourly write
      return (input.teams ?? []).map((t): Entry => typeof t === 'string'
        ? { path: t, changefreq: 'weekly', priority: 0.5, lastmod: null }
        : { path: t.path, changefreq: 'weekly', priority: 0.5, lastmod: t.lastmod });
    case 'matches':
      return input.matches.filter((m) => !m.settled).map((m): Entry => ({ path: m.path, changefreq: 'daily', priority: 0.7, lastmod: m.lastmod }));
    case 'results':
      return input.matches.filter((m) => m.settled).map((m): Entry => ({ path: m.path, changefreq: 'monthly', priority: 0.5, lastmod: m.lastmod }));
  }
}

/** All sections in one list (tests, and the legacy single-file shape). */
export function entries(input: SitemapInput): Entry[] {
  return SITEMAP_SECTIONS.flatMap((s) => entriesFor(s, input));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One <url> per localized URL, each carrying hreflang links for every locale (plus x-default → English). */
function urlBlocks(e: Entry): string[] {
  const alternates = [
    ...routing.locales.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(`${SITE_URL}/${l}${e.path}`)}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${SITE_URL}/${routing.defaultLocale}${e.path}`)}"/>`,
  ].join('\n');
  const images = (e.images ?? []).map((id) => `    <image:image>\n      <image:loc>${esc(`${SITE_URL}${CONTENT_IMAGES[id].src}`)}</image:loc>\n    </image:image>`).join('\n');
  return routing.locales.map((l) => [
    '  <url>',
    `    <loc>${esc(`${SITE_URL}/${l}${e.path}`)}</loc>`,
    e.lastmod && isoOf(e.lastmod) ? `    <lastmod>${isoOf(e.lastmod)}</lastmod>` : '',
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority}</priority>`,
    alternates,
    images,
    '  </url>',
  ].filter(Boolean).join('\n'));
}

function urlset(list: Entry[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...list.flatMap(urlBlocks),
    '</urlset>',
    '',
  ].join('\n');
}

/** Legacy single-file sitemap (every section). */
export function buildSitemapXml(input: SitemapInput = { dataUpdated: null, matches: [] }): string {
  return urlset(entries(input));
}

/** One section as its own urlset — served at /sitemaps/{section}.xml. */
export function buildSectionXml(section: SitemapSection, input: SitemapInput): string {
  return urlset(entriesFor(section, input));
}

/** Newest lastmod inside a section (the index's <lastmod>), or null. */
export function sectionLastmod(section: SitemapSection, input: SitemapInput): string | null {
  let best: string | null = null;
  for (const e of entriesFor(section, input)) {
    const iso = e.lastmod ? isoOf(e.lastmod) : null;
    if (iso && (!best || iso > best)) best = iso;
  }
  return best;
}

/** /sitemap.xml — a sitemap index pointing at the per-type sections. */
export function buildSitemapIndexXml(input: SitemapInput): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_SECTIONS.flatMap((sec) => {
      const lm = sectionLastmod(sec, input);
      return ['  <sitemap>', `    <loc>${esc(`${SITE_URL}${sectionPath(sec)}`)}</loc>`, lm ? `    <lastmod>${lm}</lastmod>` : '', '  </sitemap>'].filter(Boolean);
    }),
    '</sitemapindex>',
    '',
  ].join('\n');
}
