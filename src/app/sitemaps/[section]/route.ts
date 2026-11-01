import { buildSectionXml, isSitemapSection } from '@/lib/site/sitemap';
import { loadSitemapInput } from '@/lib/site/sitemap-data';

// /sitemaps/{section}.xml — bölüm dosyaları (bkz. app/sitemap.xml/route.ts, 2026-11-01).
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: { section: string } }) {
  const name = params.section.replace(/\.xml$/, '');
  if (!isSitemapSection(name)) return new Response('Not found', { status: 404 });
  const input = await loadSitemapInput();
  return new Response(buildSectionXml(name, input), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
}
