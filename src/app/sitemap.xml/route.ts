import { buildSitemapIndexXml } from '@/lib/site/sitemap';
import { loadSitemapInput } from '@/lib/site/sitemap-data';

// /sitemap.xml (SEO denetimi 2026-10-10; 2026-11-01 indeks oldu) — bölümler
// /sitemaps/{pages|leagues|teams|matches|results}.xml adresinde ayrı dosyalar;
// Search Console her bölümün indeks durumunu ayrı raporlar, bitmiş maçlar
// yaklaşan maçların tarama bütçesini yemez. Veri okuması düşerse statik
// bölümler yine servis edilir (lastmod'suz).

export const revalidate = 3600;

export async function GET() {
  const input = await loadSitemapInput();
  return new Response(buildSitemapIndexXml(input), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
}
