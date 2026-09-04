'use client';

// ============================================================================
// Google Ads — gtag yükleyici (dönüşüm takibi)
// ============================================================================
// Sadece NEXT_PUBLIC_GOOGLE_ADS_ID (AW-XXXXXXXXX) tanımlıysa render edilir.
// gtag.js'i yükler + `config` çağırır. GA4 (@next/third-parties) ile birlikte
// çalışır: ikisi de aynı window.dataLayer / window.gtag'i paylaşır.
// Dönüşüm olayları src/lib/analytics.ts > trackAdsConversion() ile atılır.

import Script from 'next/script';

export default function GoogleAdsTag({ adsId }: { adsId: string }) {
  if (!adsId) return null;
  return (
    <>
      <Script
        id="google-ads-gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`}
      />
      <Script id="google-ads-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${adsId}');
        `}
      </Script>
    </>
  );
}
