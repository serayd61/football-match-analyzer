import type { Metadata } from 'next';
import MatchPage, { matchMetadata } from '@/components/site/pages/MatchPage';
import { ANON_ACCESS } from '@/lib/site/access-state';

// ============================================================================
// Herkese açık maç sayfası — ANONİM ISR sürümü (Core Web Vitals, 2026-11-08)
//
// Sayfa 2026-11-08'e kadar `force-dynamic`'ti, çünkü gövdesi `getSiteAccess()`
// (next-auth → cookies) ve `isTwa()` (cookies) okuyordu. Next 14'te bir
// `cookies()` çağrısı rotayı önbelleksiz yapar, yani Vercel her istekte HTML'i
// yeniden üretiyordu: `cache-control: private, no-store`, `x-vercel-cache: MISS`,
// kaynakta TTFB ~1,0 sn. Tıkların geldiği ülkelere (Nijerya, Gana, Kenya, TR,
// IT) RTT 150–250 ms eklenince mobil LCP eşiği (2,5 sn) kaynakta yanıyordu —
// Search Console mobil CWV: 0 iyi URL, 112 URL "LCP > 2,5 sn".
//
// Trafiğin tamamına yakını anonim (292 kayıt, aktif Pro 0), yani her ziyaret
// kimsenin görmediği bir üyelik kontrolünün bedelini ödüyordu. Artık:
//   · anonim istek  → bu rota, ISR + CDN (aşağıdaki revalidate)
//   · oturum çerezi → middleware `/{locale}/m/matches/{slug}`'e rewrite eder
//                     (URL değişmez), orada bugünkü dinamik davranış birebir
// Tek render bileşeni: components/site/pages/MatchPage.tsx.
//
// URL'ler, canonical, hreflang, sitemap ve JSON-LD değişmedi; görünen tek fark
// hız. `lastmod` dürüstlüğü de etkilenmez: sitemap motorun `updated_at`'ını
// okur, HTML önbelleğinden bağımsız.
// ============================================================================

// 5 dakika: maç öncesi durum. Canlı skor bu sayfada zaten gösterilmiyor
// (yalnız "yaklaşan" / "sonuçlandı"), veri katmanı da unstable_cache ile
// 300–3600 sn önbellekli — ISR onun üstüne biner.
export const revalidate = 300;

// Ölçülmüş (2026-11-08, yerel üretim derlemesi): Next 14'te dinamik segmentli
// bir rota `generateStaticParams` TANIMLAMAZSA `revalidate` yok sayılır ve yanıt
// `private, no-store` ile çıkar — CDN'e hiç girmez. Tanımlayan rotalar
// (/leagues/{slug}, /performance/{slug}) `s-maxage=300` alıyordu, tanımlamayanlar
// (/teams/{slug}, /matches/{slug}, gün merkezleri) almıyordu; korelasyon tam.
// Boş liste dönmek yeterli: build'de hiçbir maç sayfası üretilmez (build süresi
// artmaz, 4 dil × ~1.000 maç), ilk istek MISS olur ve ISR önbelleğine yazılır.
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

type Params = { locale: string; slug: string };

export function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return matchMetadata(params.locale, params.slug);
}

export default function Page({ params }: { params: Params }) {
  // Anonim ağaç: oturum okunmaz, Play (TWA) ziyaretçisi üye rotasına yazılır.
  return <MatchPage locale={params.locale} slug={params.slug} access={ANON_ACCESS} twa={false} />;
}
