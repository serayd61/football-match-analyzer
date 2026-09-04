import type { Metadata } from 'next';
import { IBM_Plex_Sans, Barlow_Condensed } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';
import { alternatesFor, SITE_URL } from '@/lib/site/seo';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';

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

// Runs before paint inside the wrapper: applies the saved theme and syncs
// <html lang>. The root layout is shared with legacy pages, so lang is set here.
const bootScript = `(function(){try{var s=document.currentScript,w=s&&s.parentElement;if(!w)return;var t=localStorage.getItem('site-theme');if(t==='light'||t==='dark'){w.setAttribute('data-theme',t)}var l=w.getAttribute('lang');if(l){document.documentElement.lang=l}}catch(e){}})();`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    // `absolute` so the root layout's "| Football Analytics Pro" template is not applied.
    title: { absolute: t('siteName'), template: `%s · ${t('siteName')}` },
    description: t('description'),
    alternates: alternatesFor(locale as Locale, '/'),
    openGraph: { siteName: t('siteName'), type: 'website', locale },
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
  const t = await getTranslations('nav');

  return (
    <div className={`site ${plex.variable} ${barlow.variable} flex min-h-screen flex-col`} lang={locale}>
      <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      <NextIntlClientProvider messages={messages}>
        <a href="#main" className="skip-link">{t('skipToContent')}</a>
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
      </NextIntlClientProvider>
    </div>
  );
}
