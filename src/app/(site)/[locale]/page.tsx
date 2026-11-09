import type { Metadata } from 'next';
import HomePage, { homeMetadata } from '@/components/site/pages/HomePage';
import { ANON_ACCESS } from '@/lib/site/access-state';
import { routing } from '@/i18n/routing';

// ============================================================================
// Ana sayfa — ANONİM ISR sürümü (Core Web Vitals, 2026-11-10)
//
// 2026-09-08'den beri `force-dynamic`'ti: gövde `getSiteAccess()` (next-auth →
// cookies) ve `isTwa()` okuyordu, yani her ziyaret kimsenin görmediği bir
// üyelik kontrolünün bedelini ödüyordu — `private, no-store`, CDN MISS,
// kaynakta ~8 Supabase sorgusu. CrUX (28 gün, 2026-11-09): origin TTFB p75
// 2,0 sn (eşik 0,8), LCP p75 3,7 sn (eşik 2,5) → Core Web Vitals başarısız;
// ana sayfa en çok giriş yapılan URL. Maç sayfası aynı ayrımla 2026-11-08'de
// ISR'a geçmişti (matches/[slug]/page.tsx); bu dosya o kalıbın ana sayfaya
// uygulanması:
//   · anonim istek  → bu rota, ISR + CDN
//   · oturum/Play   → middleware `/{locale}/m` rotasına rewrite (URL değişmez)
// Tek render bileşeni: components/site/pages/HomePage.tsx.
// ============================================================================

// 5 dakika: "bugünün maçları" ön izlemesi ve karne sayıları; motor saatlik
// yazar, veri katmanı zaten unstable_cache ile 300–3600 sn önbellekli.
export const revalidate = 300;

// Dört dil build'de üretilir (ilk ziyaret MISS yemez). Bkz. matches/[slug]:
// generateStaticParams tanımlanmazsa Next 14 `revalidate`'i yok sayar.
export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

type Params = { locale: string };

export function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return homeMetadata(params.locale);
}

export default function Page({ params }: { params: Params }) {
  // Anonim ağaç: oturum okunmaz, Play (TWA) ziyaretçisi üye rotasına yazılır.
  return <HomePage locale={params.locale} access={ANON_ACCESS} twa={false} />;
}
