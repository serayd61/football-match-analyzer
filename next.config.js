/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

// PWA konfigürasyonu - babel uyumsuzluğu nedeniyle geçici olarak devre dışı
// next-pwa paketinde babel plugin sorunu var
// TODO: @serwist/next veya next-pwa'nın güncel versiyonuna geçiş yapılacak

module.exports = nextConfig;
