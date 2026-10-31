'use client';

// Android "smart banner" (2026-10-31): maç sayfalarının üstünde ince bir şerit →
// Google Play. Neden: SC son 7 gün 45 mobil / 5 masaüstü tıklama; iniş sayfası
// maç sayfası; Play bağlantısı yalnız ana sayfada ve /app'teydi.
// Kurallar: yalnız Android tarayıcıda (iOS/masaüstünde Play linki işe yaramaz),
// Play uygulamasının içinde değil (fa_twa çerezi / UA token; lib/site/twa.ts),
// kapatınca 14 gün gizli (localStorage). Tespit istemcide: sunucu tarafı
// cookies() okuması ISR sayfalarını dinamiğe çevirirdi. Metinler sunucudan
// (playApp istemci ad alanında değil). cta_click → location 'app_banner'.
import { useEffect, useState } from 'react';
import { track } from '@/lib/analytics';
import { PLAY_STORE_SITE_URL } from '@/lib/site/app-links';

// lib/site/twa.ts next/headers içerir → istemciden import edilmez; değerler oradakiyle aynı.
const TWA_COOKIE = 'fa_twa';
const TWA_UA_TOKEN = 'FootballAnalyticsPro/';
const KEY = 'fa_app_banner_dismissed';
const HIDE_DAYS = 14;

/** Saf karar (test edilir): Android + uygulama dışı + son 14 günde kapatılmamış. */
export function shouldShowAppBanner(ua: string, cookie: string, dismissedAt: string | null, now = Date.now()): boolean {
  if (!/android/i.test(ua)) return false;
  if (ua.includes(TWA_UA_TOKEN)) return false;
  if (new RegExp(`(?:^|;\\s*)${TWA_COOKIE}=`).test(cookie)) return false;
  const t = dismissedAt ? Number(dismissedAt) : NaN;
  if (Number.isFinite(t) && now - t < HIDE_DAYS * 86_400_000) return false;
  return true;
}

export default function AppBanner({ title, lead, cta, close, location = 'app_banner' }: { title: string; lead: string; cta: string; close: string; location?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let dismissed: string | null = null;
    try { dismissed = localStorage.getItem(KEY); } catch {}
    setShow(shouldShowAppBanner(navigator.userAgent, document.cookie, dismissed));
  }, []);
  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} setShow(false); };
  return (
    <div role="region" aria-label={title} className="mb-1 flex items-center gap-3 border-b border-s-line bg-s-surface py-2 md:hidden">
      <button type="button" onClick={dismiss} aria-label={close} className="shrink-0 p-1 text-s-muted hover:text-s-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/app/app-icon-192.png" alt="" width={36} height={36} className="shrink-0 rounded-[9px] border border-s-line" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <p className="truncate text-[11.5px] text-s-muted">{lead}</p>
      </div>
      <a
        href={PLAY_STORE_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track.ctaClick(location, 'google_play')}
        data-cta={`${location}-google-play`}
        className="shrink-0 rounded-full bg-s-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-s-brand-ink"
      >
        {cta}
      </a>
    </div>
  );
}
