import { buildSitemapXml } from '@/lib/site/sitemap';

// /sitemap.xml as a hand-built XML route (SEO denetimi 2026-10-10) — replaces the
// `app/sitemap.ts` convention so the Google image extension can be emitted.
// See lib/site/sitemap.ts for the URL set. Refreshed hourly.

export const revalidate = 3600;

export function GET() {
  return new Response(buildSitemapXml(), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
}
