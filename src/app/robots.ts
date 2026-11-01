import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // 2026-11-01: /login noindex'ti ama her maç sayfası kendine özel ?callbackUrl=… ile
        // iki benzersiz login URL'si üretiyordu (SC: 1.641 noindex + 102 kanoniksiz kopya taranıyor).
        // Taramayı kesmek için robots'ta kapalı; nav/CTA linkleri zaten rel="nofollow".
        disallow: ['/api/', '/admin', '/dashboard', '/settings', '/profile', '/favorites', '/offline', '/login', '/*/login', '/*/dashboard', '/*/account'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
