import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Barlow_Condensed } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTimeZone, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/react';
import '@/app/globals.css';
import AuthProvider from '@/components/AuthProvider';
import GoogleAdsTag from '@/components/GoogleAdsTag';
import { routing, type Locale } from '@/i18n/routing';
import { alternatesFor, SITE_URL } from '@/lib/site/seo';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';

// Root layout of the public site (route group `(site)`). It is deliberately
// separate from the legacy app root: no LanguageProvider mount gate, no
// neon navigation, no service-worker prompt — and a real <html lang>.
//
// Body: IBM Plex Sans — true tabular figures, wide Latin coverage (DE/IT/TR),
// stays legible at 13px in dense tables. Headings and team names: Barlow
// Condensed — compact in narrow columns, carries a sports-page voice without
// shouting. Loaded once here, exposed as CSS variables for `.site`.
const plex = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-site-body',
  display: 'swap',
});
const barlow = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-site-head',
  display: 'swap',
});

// Runs before paint inside the wrapper: applies the saved theme.
const bootScript = `(function(){try{var s=document.currentScript,w=s&&s.parentElement;if(!w)return;var t=localStorage.getItem('site-theme');if(t==='light'||t==='dark'){w.setAttribute('data-theme',t)}}catch(e){}})();`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0d181b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: t('siteName'), template: `%s · ${t('siteName')}` },
    description: t('description'),
    alternates: alternatesFor(locale as Locale, '/'),
    openGraph: { siteName: t('siteName'), type: 'website', locale },
    icons: {
      icon: [{ url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      apple: [{ url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as Locale)) notFound();
  unstable_setRequestLocale(locale);
  const messages = await getMessages();
  const timeZone = await getTimeZone();
  const t = await getTranslations('nav');

  return (
    <html lang={locale}>
      <body className={`${plex.variable} ${barlow.variable}`}>
        <div className="site flex min-h-screen flex-col">
          <script dangerouslySetInnerHTML={{ __html: bootScript }} />
          <AuthProvider>
            <NextIntlClientProvider messages={messages} timeZone={timeZone}>
              <a href="#main" className="skip-link">{t('skipToContent')}</a>
              <SiteHeader />
              <main id="main" className="flex-1">{children}</main>
              <SiteFooter />
            </NextIntlClientProvider>
          </AuthProvider>
        </div>
        <Analytics />
        {process.env.NEXT_PUBLIC_GOOGLE_ADS_ID && <GoogleAdsTag adsId={process.env.NEXT_PUBLIC_GOOGLE_ADS_ID} />}
      </body>
    </html>
  );
}
