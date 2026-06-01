import type { MetadataRoute } from 'next';
import { SITE_URL, matchSlug, getAllAnalysisRefs } from '@/lib/seo';

// Refresh the sitemap hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/analysis`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/ai-performance`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.5 },
  ];

  let matchRoutes: MetadataRoute.Sitemap = [];
  try {
    const refs = await getAllAnalysisRefs();
    matchRoutes = refs
      .filter((r) => r.fixture_id && r.home_team && r.away_team)
      .map((r) => ({
        url: `${SITE_URL}/analysis/${matchSlug(r.home_team, r.away_team, r.fixture_id)}`,
        lastModified: r.updated_at ? new Date(r.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
  } catch {
    // If the DB is unreachable at build/revalidate time, still ship static routes.
    matchRoutes = [];
  }

  return [...staticRoutes, ...matchRoutes];
}
