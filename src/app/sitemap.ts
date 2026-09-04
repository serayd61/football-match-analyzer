import type { MetadataRoute } from 'next';
import { SITE_URL, matchSlug, getAllAnalysisRefs } from '@/lib/seo';
import { routing } from '@/i18n/routing';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { listSitemapFixtures } from '@/lib/site/results';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site: MetadataRoute.Sitemap = [
    ...localized('', { changeFrequency: 'hourly', priority: 1 }),
    ...localized('/predictions', { changeFrequency: 'hourly', priority: 0.9 }),
    ...localized('/results', { changeFrequency: 'hourly', priority: 0.8 }),
    ...localized('/performance', { changeFrequency: 'daily', priority: 0.8 }),
    ...localized('/leagues', { changeFrequency: 'weekly', priority: 0.6 }),
    ...localized('/methodology', { changeFrequency: 'monthly', priority: 0.6 }),
    ...localized('/about', { changeFrequency: 'monthly', priority: 0.4 }),
    ...localized('/privacy', { changeFrequency: 'yearly', priority: 0.2 }),
    ...localized('/terms', { changeFrequency: 'yearly', priority: 0.2 }),
    ...SITE_LEAGUES.flatMap((l) => localized(`/leagues/${l.slug}`, { changeFrequency: 'daily', priority: 0.7 })),
  ];

  let matches: MetadataRoute.Sitemap = [];
  try {
    const fixtures = await listSitemapFixtures(30);
    matches = fixtures.flatMap((f) =>
      localized(`/predictions/${f.fixtureId}`, { changeFrequency: 'daily', priority: 0.6, lastModified: f.updatedAt ? new Date(f.updatedAt) : undefined }),
    );
  } catch {
    matches = [];
  }

  // Legacy app surface (unchanged).
  const legacy: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/analysis`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/ai-performance`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.5 },
  ];
  let analysis: MetadataRoute.Sitemap = [];
  try {
    const refs = await getAllAnalysisRefs();
    analysis = refs
      .filter((r) => r.fixture_id && r.home_team && r.away_team)
      .map((r) => ({
        url: `${SITE_URL}/analysis/${matchSlug(r.home_team, r.away_team, r.fixture_id)}`,
        lastModified: r.updated_at ? new Date(r.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
  } catch {
    analysis = [];
  }

  return [...site, ...matches, ...legacy, ...analysis];
}
