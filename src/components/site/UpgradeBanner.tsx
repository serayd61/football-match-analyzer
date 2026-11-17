'use client';

// Pro şeridi — her sayfada (2026-11-14; önceki hali TrialEndedBanner, 2026-11-02).
//
// Başlığın altında tek satırlık şerit: Pro olmayan ÜYEYE (deneme süresinde ya da
// süresi dolmuş) yıllık planın aylığa göre ne kadar ucuz olduğunu söyler ve
// /pricing'e götürür. Kendi "house ad"ımız: reklam SDK'sı yok, Play reklam
// beyanı değişmez (marketing/play-in-app-ads-assessment.md §6).
//
// Önceki sürümden farklar (kullanıcı kararı, 2026-11-14):
//  - yalnız süresi dolana değil, denemedeki üyeye de gösterilir;
//  - paywall olan sayfalar hariç tutulmaz — hariç yalnız /pricing (planların
//    kendisi) ve /login;
//  - Play uygulamasında da gösterilir: v1.3.0+ (Play Billing köprüsü) /pricing'e
//    gider ve orada Play üzerinden satılır; köprüsüz eski sürümde satın alma
//    yolu olmadığı için şerit "uygulamayı güncelle" der ve Play mağazasına gider
//    (Play ödeme politikası: uygulama içinden başka ödeme yöntemine yönlendirme yok);
//  - kapatma 30 gün değil, yalnız o oturum (sessionStorage): sonraki ziyarette geri gelir.
//
// Rakam: web'de yıllık/aylık oranı plans.ts'ten (yearlySavingPct) hesaplanıp
// sunucudan gelir. Uygulamada fiyatı Play yerelleştirir; 14 Kas 2026'da Console'da
// bakılan ülkelerde yıllık plan 12 aylık ödemeden %58–62 ucuzdu, bu yüzden metin
// kesin yüzde yerine "%50'den fazla" der.
//
// Durum /api/site/access'ten, oturum başına 10 dk önbellekle (sessionStorage),
// yalnız oturum açık kullanıcı için. Metinler sunucudan prop olarak gelir
// (paywall istemci ad alanında değil).
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { track } from '@/lib/analytics';
import { PLAY_STORE_URL } from '@/lib/site/app-links';
import { useAppMode, type AppMode } from '@/lib/site/app-mode';
import Regional from '@/components/site/Regional';

const CLOSED = 'fa_upgrade_banner_closed';
export const ACCESS_CACHE_KEY = 'fa_site_access';
const CACHE_MS = 10 * 60_000;
const EXCLUDED = ['/pricing', '/login'];

export type AccessState = 'anon' | 'trial' | 'pro' | 'expired';
export type UpgradeBannerKind = 'offer' | 'update';

/**
 * Saf karar (test edilir). `offer` = planlara git, `update` = uygulamayı güncelle.
 * `yearlyOnWeb=false` (yıllık Stripe fiyatı yok): web'de yalnız süresi dolana,
 * eski aylık başlıkla gösterilir — denemedeki üyeye söylenecek bir indirim yoktur.
 */
export function upgradeBannerKind(state: AccessState | null, pathname: string, mode: AppMode | null, closed: boolean, yearlyOnWeb = true): UpgradeBannerKind | null {
  if (state !== 'trial' && state !== 'expired') return null;
  if (!mode || closed) return null;
  const path = pathname.replace(/^\/(en|de|it|tr)(?=\/|$)/, '') || '/';
  if (EXCLUDED.some((p) => path === p || path.startsWith(p + '/'))) return null;
  if (mode === 'app-legacy') return 'update';
  if (mode === 'web' && !yearlyOnWeb && state === 'trial') return null;
  return 'offer';
}

/** Satın alma sonrası çağrılır: şerit 10 dakika boyunca eski "expired" durumunu göstermesin. */
export function clearAccessCache(): void {
  try { sessionStorage.removeItem(ACCESS_CACHE_KEY); } catch { /* storage may be blocked */ }
}

async function readAccessState(): Promise<AccessState | null> {
  try {
    // Stripe dönüşü (/dashboard?payment=success): önbellekteki durum artık yanlış.
    if (/[?&]payment=success\b/.test(window.location.search)) clearAccessCache();
    const raw = sessionStorage.getItem(ACCESS_CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { state: AccessState; at: number };
      if (Date.now() - c.at < CACHE_MS) return c.state;
    }
  } catch { /* storage may be blocked */ }
  try {
    const r = await fetch('/api/site/access', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { state: AccessState };
    try { sessionStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify({ state: j.state, at: Date.now() })); } catch { /* ignore */ }
    return j.state;
  } catch {
    return null;
  }
}

export type UpgradeBannerLabels = {
  /** denemedeki üye */ kickerTrial: string;
  /** süresi dolmuş üye */ kickerExpired: string;
  /** web, yıllık plan açık: "Save 59% …" */ titleYearly: string;
  /** web, yıllık plan kapalı: eski aylık başlık */ titleMonthly: string;
  /** Play uygulaması: kesin yüzde yok */ titleApp: string;
  /** bölgesel fiyat alan ziyaretçi (fa_ppp): aynı başlıklar bölgesel rakamlarla */
  titleYearlyRegional: string; titleMonthlyRegional: string; kickerRegional: string;
  lead: string; cta: string;
  kickerUpdate: string; titleUpdate: string; ctaUpdate: string;
  close: string;
};

export default function UpgradeBanner({ labels: l, pricingHref, yearlyOnWeb }: { labels: UpgradeBannerLabels; pricingHref: string; yearlyOnWeb: boolean }) {
  const { status } = useSession();
  const pathname = usePathname();
  const mode = useAppMode();
  const [state, setState] = useState<AccessState | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') { setState(null); return; }
    let alive = true;
    try { setClosed(sessionStorage.getItem(CLOSED) === '1'); } catch { /* ignore */ }
    readAccessState().then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  // pathname: satın alma sonrası başka sayfaya geçince durum yeniden okunur (önbellek 10 dk)
  }, [status, pathname]);

  const kind = status === 'authenticated' ? upgradeBannerKind(state, pathname, mode, closed, yearlyOnWeb) : null;
  if (!kind) return null;
  const close = () => { try { sessionStorage.setItem(CLOSED, '1'); } catch { /* ignore */ } setClosed(true); };

  const update = kind === 'update';
  const web = !update && mode === 'web';
  const location = update ? 'upgrade_banner_update' : mode === 'web' ? 'upgrade_banner' : 'upgrade_banner_app';
  const kicker = update ? l.kickerUpdate : state === 'expired' ? l.kickerExpired : l.kickerTrial;
  const title = update ? l.titleUpdate : mode === 'web' ? (yearlyOnWeb ? l.titleYearly : l.titleMonthly) : l.titleApp;

  return (
    <div role="region" aria-label={title} className="border-b border-s-line bg-s-brand text-s-brand-ink" data-testid="upgrade-banner" data-kind={kind}>
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1 leading-tight">
          {/* Web'de bölgesel ziyaretçi kendi rakamını görür (2026-11-17); uygulamada fiyatı Play yerelleştirir. */}
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{web ? <Regional std={kicker} reg={l.kickerRegional} /> : kicker}</p>
          <p className="text-[14px] font-semibold">
            {web ? <Regional plan={yearlyOnWeb ? 'yearly' : 'monthly'} std={title} reg={yearlyOnWeb ? l.titleYearlyRegional : l.titleMonthlyRegional} /> : title}
          </p>
          {!update && <p className="hidden text-[12.5px] opacity-80 sm:block">{l.lead}</p>}
        </div>
        <a
          href={update ? PLAY_STORE_URL : pricingHref}
          onClick={() => track.ctaClick(location, update ? 'app_update' : 'pricing')}
          data-cta={location}
          className="shrink-0 rounded-full bg-s-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-s-ink hover:opacity-90"
        >
          {update ? l.ctaUpdate : l.cta}
        </a>
        <button type="button" onClick={close} aria-label={l.close} className="shrink-0 p-1 opacity-80 hover:opacity-100">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </div>
  );
}
