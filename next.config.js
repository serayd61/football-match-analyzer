const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withSerwist = require('@serwist/next').default({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Görseller (mobil LCP ölçümü 2026-11-08): takım logoları `unoptimized` ile
  // ham iniyordu — FotMob 192×192 PNG gönderiyor, sayfa 20×20 gösteriyor;
  // bir maç sayfasında 6+ logo = ~90 KiB gereksiz. Artık Vercel optimizasyonu
  // küçük WebP üretiyor.
  images: {
    // `hostname: '**'` AÇIK BİR GÖRSEL VEKİLİYDİ: herkes /_next/image?url=…
    // ile rastgele görseli bizim hesabımızdan dönüştürebilirdi (optimizasyon
    // açıldığı için artık kotayı da yakardı). Tek gerçek kaynak FotMob.
    remotePatterns: [{ protocol: 'https', hostname: 'images.fotmob.com' }],
    formats: ['image/webp'],
    // Logolar en fazla 28 CSS px, DPR 3'te 84 — varsayılan en küçük boyut
    // 16'dan sonra 32'ye atlıyordu; bu liste 20/28'in 2× ve 3×'ini kapsıyor.
    imageSizes: [16, 20, 28, 32, 40, 48, 56, 64, 84, 96, 128, 256],
    // Logo bir sezon boyunca değişmez; uzun TTL dönüşüm sayısını (ve faturayı)
    // düşürür.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

module.exports = withNextIntl(withSerwist(nextConfig));
