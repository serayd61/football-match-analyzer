import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { unstable_setRequestLocale } from 'next-intl/server';
import HomePage, { homeMetadata } from '@/components/site/pages/HomePage';
import HomeMemberHero from '@/components/site/pages/HomeMemberHero';
import AppTodayPage from '@/components/site/pages/AppTodayPage';
import { MEMBER_REWRITE_HEADER } from '@/lib/site/member-routes';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { isTwa } from '@/lib/site/twa';
import { listResults } from '@/lib/site/results';

// ============================================================================
// Ana sayfa — ÜYE sürümü (anonim ISR ayrımı, 2026-11-10; kalıp: m/matches/[slug])
//
// Ziyaretçi bu URL'yi görmez: middleware, oturum çerezi (ya da Play `fa_twa`
// çerezi) olan isteği `/{locale}`'den buraya rewrite eder. Davranış öncekiyle
// birebir: günün maçları hero'da, son 5 sonuçlanan tahmin, TWA'da fiyatsız CTA.
//
// noindex yalnız /{locale}/m adresi elle yazıldığında (rewrite başlığı yok);
// rewrite'ta adres çubuğundaki temiz URL indekslenebilir kalır.
// ============================================================================

export const dynamic = 'force-dynamic';

type Params = { locale: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const meta = await homeMetadata(params.locale);
  const rewritten = headers().get(MEMBER_REWRITE_HEADER) === '1';
  return rewritten ? meta : { ...meta, robots: { index: false, follow: false } };
}

export default async function Page({ params: { locale } }: { params: Params }) {
  unstable_setRequestLocale(locale);
  const [access, twa] = [await getSiteAccess(), isTwa()];
  // Play uygulaması tanıtım sayfasıyla değil günün maçlarıyla açılır (2026-11-15,
  // lib/site/app-today-rule.ts). Web'de bu rota öncekiyle aynı.
  const unlocked = canSeeMatches(access);
  if (twa) return <AppTodayPage locale={locale} access={access} memberHero={unlocked ? await HomeMemberHero({ locale }) : null} />;
  const [memberHero, latest] = await Promise.all([
    // fonksiyon çağrısı, JSX değil: null dönerse HomePage örnek analiz kartına düşer
    unlocked ? HomeMemberHero({ locale }) : Promise.resolve(null),
    // Seçmeden: en son sonuçlanan tahminler (kazanan da kaybeden de). Yalnız erişimi olana.
    unlocked ? listResults({ league: null, from: null, to: null, page: 1, pageSize: 12 }).catch(() => null) : Promise.resolve(null),
  ]);
  const recent = (latest?.rows ?? []).filter((r) => r.outcome === 'won' || r.outcome === 'lost').slice(0, 5);
  return <HomePage locale={locale} access={access} twa={twa} memberHero={memberHero} recent={recent} />;
}
