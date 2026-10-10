'use client';
// Dönüşüm hunisi (SEO 2026-10-10): organik ziyaret → herkese açık maç sayfası →
// deneme üyeliği. Sitedeki her `data-cta` bağlantısına tıklama, mevcut
// trackEvent (GA4 + Vercel) üzerinden `cta_click` olarak gider; yeni servis
// ya da çerez yok, kişisel veri yok (yalnız CTA adı ve sayfa yolu).
import { useEffect } from 'react';
import { Events, trackEvent } from '@/lib/analytics';

export default function CtaTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const el = (e.target as Element | null)?.closest?.('[data-cta]') as HTMLElement | null;
        if (!el) return;
        const cta = el.dataset.cta;
        if (!cta) return;
        trackEvent(Events.CTA_CLICK, { cta, path: window.location.pathname });
      } catch { /* analytics must never break the app */ }
    };
    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
  }, []);
  return null;
}
