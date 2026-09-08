import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import AuthProvider from '@/components/AuthProvider';
import { LanguageProvider } from '@/components/LanguageProvider';
import FloatingBackButton from '@/components/FloatingBackButton';
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import GoogleAdsTag from '@/components/GoogleAdsTag';
import Navigation from '@/components/Navigation';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import QueryProvider from '@/components/QueryProvider';
import { SITE_URL } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Football Analytics Pro',
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512x512.png`,
  description: 'Statistical football match probabilities with a public, settled track record.',
};

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Football Analytics Pro',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/analysis?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Football Analytics Pro - Football predictions with a public track record',
    template: '%s | Football Analytics Pro',
  },
  description: 'Match probabilities for ten leagues: 1X2, over/under 2.5 and both teams to score. Every prediction is settled after the final whistle and stays on the record.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FA Pro',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Football Analytics Pro',
    title: 'Football Analytics Pro',
    description: 'Match probabilities for ten leagues, settled after every game. Hit rate, calibration and return against closing odds are public.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football Analytics Pro',
    description: 'Football match probabilities with a public, settled track record.',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${inter.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <QueryProvider>
          <AuthProvider>
            <LanguageProvider>
              <Navigation />
              {children}
              <FloatingBackButton />
              <PWAInstallPrompt />
              <ServiceWorkerRegister />
            </LanguageProvider>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
        {process.env.NEXT_PUBLIC_GOOGLE_ADS_ID && (
          <GoogleAdsTag adsId={process.env.NEXT_PUBLIC_GOOGLE_ADS_ID} />
        )}
      </body>
    </html>
  );
}
