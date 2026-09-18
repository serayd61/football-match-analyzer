'use client';
// UTM yakalayıcı (2026-09-18): Vercel'in UTM kırılımı ücretli pakette; kaynak/kampanya
// ölçümünü kendi özel olayımızla yapıyoruz. İlk sayfa açılışında utm_* varsa
// `utm_landing` olayı atılır ve ilk temas localStorage'a yazılır (fa_utm); sonraki
// dönüşüm olayları (sign_up, begin_checkout, purchase) bu kaynağı otomatik taşır.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { rememberUtm, trackEvent } from '@/lib/analytics';

export default function UtmTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const source = q.get('utm_source'); if (!source) return;
      const utm = { source, medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '' };
      const key = `fa_utm_seen:${utm.source}:${utm.campaign}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      rememberUtm(utm);
      trackEvent('utm_landing', { utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign, path: pathname || window.location.pathname });
    } catch { /* analytics must never break the app */ }
  }, [pathname]);
  return null;
}
