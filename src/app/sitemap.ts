import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { routing } from '@/i18n/routing';
import { SITE_LEAGUES } from '@/lib/site/leagues';

// Freemium SEO (2026-09-24): the sitemap lists only URLs an anonymous visitor
// can actually open. Everything members-only — /predictions, /predictions/[id],
// the legacy /analysis, /analysis/[slug], /ai-performance, /leaderboard — 307s
// to /login for Googlebot and was filling Search Console with ~2,000
// "discovered, not indexed" and "page with redirect" entries.

// Refresh the sitemap hourly.
export const revalidate = 3600;

// One entry per localized URL, each carrying hreflang alternates for the
// other locales (plus x-default → English).
function localized(path: string, extra: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `${SITE_URL}/${l}${path}`;
  languages['x-default'] = `${SITE_URL}/${routing.defaultLocale}${path}`;
  return routing.locales.map((l) => ({ url: `${SITE_URL}/${l}${path}`, alternates: { languages }, ...extra }));
}

// SEO denetimi 2026-10-10: Google uses <lastmod> (and ignores changefreq /
// priority). Data pages change daily, so they carry today's date; the long-form
// docs carry their real revision date.
const DOCS_UPDATED = new Date('2026-09-04T12:00:00Z');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const site: MetadataRoute.Sitemap = [
    ...localized('', { changeFrequency: 'hourly', priority: 1, lastModified: today }),
    ...localized('/pricing', { changeFrequency: 'monthly', priority: 0.6 }),
    ...localized('/performance', { changeFrequency: 'daily', priority: 0.8, lastModified: today }),
    ...localized('/leagues', { changeFrequency: 'weekly', priority: 0.6, lastModified: today }),
    ...localized('/methodology', { changeFrequency: 'monthly', priority: 0.6, lastModified: DOCS_UPDATED }),
    ...localized('/about', { changeFrequency: 'monthly', priority: 0.4, lastModified: DOCS_UPDATED }),
    ...localized('/privacy', { changeFrequency: 'yearly', priority: 0.2 }),
    ...localized('/terms', { changeFrequency: 'yearly', priority: 0.2 }),
    ...SITE_LEAGUES.flatMap((l) => localized(`/leagues/${l.slug}`, { changeFrequency: 'daily', priority: 0.7, lastModified: today })),
  ];

  return site;
}
