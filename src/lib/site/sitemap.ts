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

interface Entry { path: string; lastmod?: Date; changefreq: string; priority: number; images?: ContentImageId[] }

// Real revision date of the long-form docs; data pages change daily.
const DOCS_UPDATED = new Date('2026-09-04T12:00:00Z');

function entries(today: Date): Entry[] {
  return [
    { path: '', changefreq: 'hourly', priority: 1, lastmod: today, images: ['standings', 'track-record'] },
    { path: '/pricing', changefreq: 'monthly', priority: 0.6 },
    { path: '/performance', changefreq: 'daily', priority: 0.8, lastmod: today },
    { path: '/leagues', changefreq: 'weekly', priority: 0.6, lastmod: today },
    { path: '/methodology', changefreq: 'monthly', priority: 0.6, lastmod: DOCS_UPDATED, images: ['sample-analysis', 'track-record'] },
    { path: '/about', changefreq: 'monthly', priority: 0.4, lastmod: DOCS_UPDATED },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2 },
    { path: '/terms', changefreq: 'yearly', priority: 0.2 },
    ...SITE_LEAGUES.map((l): Entry => ({ path: `/leagues/${l.slug}`, changefreq: 'daily', priority: 0.7, lastmod: today })),
  ];
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
    e.lastmod ? `    <lastmod>${e.lastmod.toISOString()}</lastmod>` : '',
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority}</priority>`,
    alternates,
    images,
    '  </url>',
  ].filter(Boolean).join('\n'));
}

export function buildSitemapXml(today = new Date()): string {
  const day = new Date(today); day.setUTCHours(0, 0, 0, 0);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries(day).flatMap(urlBlocks),
    '</urlset>',
    '',
  ].join('\n');
}
