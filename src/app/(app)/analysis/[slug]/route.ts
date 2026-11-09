import { NextResponse, type NextRequest } from 'next/server';
import { getPublicMatch } from '@/lib/site/match-public-data';
import { fixtureIdFromSlug } from '@/lib/site/match-public';
import { legacyLocale } from '@/lib/site/legacy-paths';

// Eski /analysis/{home}-vs-{away}-{id} sayfaları (SEO Faz 0, 2026-10-17'den beri
// middleware 301 ile /{l}/matches/{slug}'a gönderiyordu). Kapsam dışı ligdeki
// maçlarda hedef 404 → Search Console'da "Bulunamadı (404)" altında 60 URL
// 301→404 zinciri olarak duruyordu; Googlebot her turda iki istek harcıyor,
// URL'ler aylarca indekste kalıyordu (2026-11-09).
//
// Burada veritabanına bakılır (middleware edge'de bakamaz): maç herkese açık
// sayfada varsa tek hop 301 (kanonik slug'a), yoksa 410 Gone — Google 410'u
// 404'ten hızlı düşürür ve ikinci isteği hiç yapmaz. Matcher'dan
// '/analysis/:path*' çıkarıldı; '/analysis' (dizin) hâlâ middleware'de.
// Eski page.tsx ölü koddu (middleware önce yakalıyordu); rota ile aynı
// segmentte duramayacağı için silindi.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const id = fixtureIdFromSlug(params.slug);
  const m = id ? await getPublicMatch(id).catch(() => null) : null;
  if (m) {
    const locale = legacyLocale(req.cookies.get('NEXT_LOCALE')?.value);
    return NextResponse.redirect(new URL(`/${locale}/matches/${m.slug}${req.nextUrl.search}`, req.url), 301);
  }
  return new Response('Gone: this match page is no longer available.', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=86400' },
  });
}
