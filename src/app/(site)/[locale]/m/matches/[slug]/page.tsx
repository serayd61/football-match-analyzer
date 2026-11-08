import type { Metadata } from 'next';
import { headers } from 'next/headers';
import MatchPage, { matchMetadata } from '@/components/site/pages/MatchPage';
import { MEMBER_REWRITE_HEADER } from '@/lib/site/member-routes';
import { getSiteAccess } from '@/lib/site/access';
import { isTwa } from '@/lib/site/twa';

// ============================================================================
// Maç sayfası — ÜYE sürümü (anonim ISR ayrımı, 2026-11-08)
//
// Ziyaretçi bu URL'yi hiç görmez: middleware, oturum çerezi (ya da Play
// uygulamasının `fa_twa` çerezi) olan isteği `/{locale}/matches/{slug}`'ten
// buraya **rewrite** eder — adres çubuğunda temiz URL kalır. Davranış
// 2026-11-08 öncesiyle birebir aynı: deneme bildirimi, kilidi açık "tam
// tahmini aç" bağlantısı, TWA'da fiyatsız CTA.
//
// Neden `[locale]` altında: `(site)` grubunun kendi layout.tsx'i yok, tek root
// layout `(site)/[locale]/layout.tsx`. Taslaktaki `/m/{locale}/…` yerleşimi
// `<html>` atası olmadan kalır (build hatası); buradaki yerleşim layout'u,
// fontu ve provider'ları olduğu gibi miras alır.
//
// noindex YALNIZ /{locale}/m/… adresi elle yazıldığında basılır: rewrite ile
// gelindiğinde ziyaretçinin adres çubuğundaki URL temiz ve indekslenebilir
// olan, ona noindex basmak yanlış olurdu (Googlebot oturum çerezi taşımadığı
// için her zaman anonim ISR sürümünü görür, ama HTML'i doğru tutuyoruz).
// Ayırt etme: middleware rewrite'a MEMBER_REWRITE_HEADER ekler.
// Canonical her iki durumda da temiz adres (matchMetadata locale-free
// `matchPath` üzerinden kurar). Sitemap'e girmez; robots.txt'te `/*/m/` kapalı.
// ============================================================================
export const dynamic = 'force-dynamic';

type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const meta = await matchMetadata(params.locale, params.slug);
  const rewritten = headers().get(MEMBER_REWRITE_HEADER) === '1';
  return rewritten ? meta : { ...meta, robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Params }) {
  const [access, twa] = [await getSiteAccess(), isTwa()];
  return <MatchPage locale={params.locale} slug={params.slug} access={access} twa={twa} />;
}
