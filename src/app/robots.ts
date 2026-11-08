import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // `allow` kuralları `disallow`'dan önce gelir (daha uzun eşleşme kazanır):
        // 2026-11-08: her maç sayfasının openGraph.images'ı /api/og/match/{id}'ye
        // bakıyor ama `Disallow: /api/` Googlebot'un görseli çekmesini engelliyordu
        // (sosyal kart + Discover/zengin sonuç görseli boş kalıyor).
        allow: ['/', '/api/og/'],
        // 2026-11-01: /login noindex'ti ama her maç sayfası kendine özel ?callbackUrl=… ile
        // iki benzersiz login URL'si üretiyordu (SC: 1.641 noindex + 102 kanoniksiz kopya taranıyor).
        // Taramayı kesmek için robots'ta kapalı; nav/CTA linkleri zaten rel="nofollow".
        // `/*/m/`: anonim ISR ayrımının üye rotası (2026-11-08). Ziyaretçi bu
        // URL'yi hiç görmez (middleware rewrite'ı, adres çubuğu temiz kalır);
        // URL tahminiyle açılsa bile kopya URL olarak taranmasın. Sayfa ayrıca
        // noindex ve canonical'ı temiz adrese bakıyor.
        disallow: ['/api/', '/admin', '/dashboard', '/settings', '/profile', '/favorites', '/offline', '/login', '/*/login', '/*/dashboard', '/*/account', '/*/m/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
