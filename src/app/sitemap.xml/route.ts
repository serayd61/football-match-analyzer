import { buildSitemapXml } from '@/lib/site/sitemap';
import { listSitemapMatches, latestDataUpdate } from '@/lib/site/match-public-data';
import { listTeams } from '@/lib/site/team-data';
import { teamPath } from '@/lib/site/teams';

// /sitemap.xml as a hand-built XML route (SEO denetimi 2026-10-10) — replaces the
// `app/sitemap.ts` convention so the Google image extension can be emitted.
// See lib/site/sitemap.ts for the URL set. Refreshed hourly. The public match
// pages and the real "last data write" come from the database; if that read
// fails the static part of the sitemap is still served (without lastmod).

export const revalidate = 3600;

export async function GET() {
  const [matches, dataUpdated, teams] = await Promise.all([
    listSitemapMatches().catch((e) => { console.error('[sitemap] matches', e); return []; }),
    latestDataUpdate().catch(() => null),
    // SEO Faz 1b: team pages
    listTeams().then((ts) => ts.map(teamPath)).catch((e) => { console.error('[sitemap] teams', e); return [] as string[]; }),
  ]);
  return new Response(buildSitemapXml({ dataUpdated, matches, teams }), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
}
