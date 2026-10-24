'use client';

// ============================================================================
// GA4 — gtag yükleyici (2026-10-24, Core Web Vitals)
// ============================================================================
// @next/third-parties <GoogleAnalytics> yerine: o bileşen next/script'in
// varsayılan `afterInteractive` stratejisini kullanır ve Next, bu scriptler
// için <head>'e <link rel="preload"> basar. 192 KB'lık gtag.js yavaş mobil
// ağda CSS/yazı tipi/HTML ile bant genişliği yarışına giriyordu (Lighthouse:
// 220–400 ms ana iş parçacığı; Search Console: 1.015 URL'de LCP 3,6 sn).
// `lazyOnload` = preload yok, tarayıcı `load`dan sonra boşta yükler.
// GoogleAdsTag ile aynı window.dataLayer / window.gtag paylaşılır.

import Script from 'next/script';

export default function GoogleAnalyticsTag({ gaId }: { gaId: string }) {
  if (!gaId) return null;
  return (
    <>
      <Script id="ga4-gtag-init" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
      <Script id="ga4-gtag-src" strategy="lazyOnload" src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
    </>
  );
}
