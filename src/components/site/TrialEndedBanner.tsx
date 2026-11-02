'use client';

// Deneme bitimi Pro hatırlatması (2026-11-02): deneme süresi dolmuş, abone olmayan
// üyeye başlığın altında tek bir kapatılabilir şerit → /pricing. Kendi "house ad"ımız:
// reklam SDK'sı yok, Play reklam beyanı değişmez (marketing/play-in-app-ads-assessment.md §6).
// Kurallar:
//  - yalnız web; Play uygulamasında (fa_twa çerezi) gösterilmez — Play ödeme politikası
//    uygulama içinde abonelik yönlendirmesini yasaklar (lib/site/twa.ts).
//  - zaten paywall/plan gösteren sayfalarda değil (pricing, account, login, dashboard,
//    predictions, picks, coupon) — aynı ekranda iki "Planları gör" olmasın.
//  - kapatınca 30 gün gizli (localStorage). Durum /api/site/access'ten, oturum başına
//    bir kez (sessionStorage), yalnız oturum açık kullanıcı için.
// Metinler sunucudan prop olarak gelir (paywall istemci ad alanında değil).
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

const TWA_COOKIE = 'fa_twa';
const KEY = 'fa_trial_banner_dismissed';
const CACHE = 'fa_site_access';
const HIDE_DAYS = 30;
const CACHE_MS = 10 * 60_000;
const EXCLUDED = ['/pricing', '/account', '/login', '/dashboard', '/predictions', '/picks', '/coupon'];

export type AccessState = 'anon' | 'trial' | 'pro' | 'expired';

/** Saf karar (test edilir): deneme bitmiş + web + paywall olmayan sayfa + son 30 günde kapatılmamış. */
export function shouldShowTrialBanner(state: AccessState | null, pathname: string, cookie: string, dismissedAt: string | null, now = Date.now()): boolean {
  if (state !== 'expired') return false;
  if (new RegExp(`(?:^|;\\s*)${TWA_COOKIE}=`).test(cookie)) return false;
  const path = pathname.replace(/^\/(en|de|it|tr)(?=\/|$)/, '') || '/';
  if (EXCLUDED.some((p) => path === p || path.startsWith(p + '/'))) return false;
  const t = dismissedAt ? Number(dismissedAt) : NaN;
  if (Number.isFinite(t) && now - t < HIDE_DAYS * 86_400_000) return false;
  return true;
}

async function readAccessState(): Promise<AccessState | null> {
  try {
    const raw = sessionStorage.getItem(CACHE);
    if (raw) {
      const c = JSON.parse(raw) as { state: AccessState; at: number };
      if (Date.now() - c.at < CACHE_MS) return c.state;
    }
  } catch { /* storage may be blocked */ }
  try {
    const r = await fetch('/api/site/access', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { state: AccessState };
    try { sessionStorage.setItem(CACHE, JSON.stringify({ state: j.state, at: Date.now() })); } catch { /* ignore */ }
    return j.state;
  } catch {
    return null;
  }
}

export default function TrialEndedBanner({ kicker, title, lead, cta, close, pricingHref, location = 'trial_ended_banner' }: { kicker: string; title: string; lead: string; cta: string; close: string; pricingHref: string; location?: string }) {
  const { status } = useSession();
  const pathname = usePathname();
  const [state, setState] = useState<AccessState | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') { setState(null); return; }
    let alive = true;
    try { setDismissed(localStorage.getItem(KEY)); } catch { /* ignore */ }
    readAccessState().then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [status]);

  const show = status === 'authenticated' && shouldShowTrialBanner(state, pathname, typeof document === 'undefined' ? '' : document.cookie, dismissed);
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setDismissed(String(Date.now())); };

  return (
    <div role="region" aria-label={title} className="border-b border-s-line bg-s-surface" data-testid="trial-ended-banner">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-s-brand">{kicker}</p>
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="hidden text-[12.5px] text-s-muted sm:block">{lead}</p>
        </div>
        <a
          href={pricingHref}
          onClick={() => track.ctaClick(location, 'pricing')}
          data-cta={location}
          className="shrink-0 rounded-full bg-s-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-s-brand-ink hover:opacity-90"
        >
          {cta}
        </a>
        <button type="button" onClick={dismiss} aria-label={close} className="shrink-0 p-1 text-s-muted hover:text-s-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </div>
  );
}
