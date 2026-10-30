import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Check } from 'lucide-react';
import { Page, PageTitle, SectionTitle } from '@/components/site/ui';
import JsonLd from '@/components/site/JsonLd';
import PlayBadge from '@/components/site/PlayBadge';
import { alternatesFor } from '@/lib/site/seo';
import type { Locale } from '@/i18n/routing';
import { SITE_URL } from '@/lib/seo';
import { ORG_REF } from '@/lib/site/jsonld';
import { PLAY_STORE_URL, PLAY_PACKAGE } from '@/lib/site/app-links';
import { isTwa } from '@/lib/site/twa';

// Android app page (2026-10-28, production launch): what the Play app is, the
// Play CTA + QR code, screenshots, requirements, SoftwareApplication JSON-LD.
// Inside the Play app itself the page is pointless → redirect home.
export const revalidate = 86400;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'playApp' });
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: alternatesFor(locale as Locale, '/app') };
}

export default async function AppPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  if (isTwa()) redirect(`/${locale}`);
  const t = await getTranslations('playApp');
  const shots = [
    { src: `/images/app/play-${locale === 'tr' ? 'tr' : 'en'}-home.jpg`, alt: t('shot1') },
    { src: `/images/app/play-${locale === 'tr' ? 'tr' : 'en'}-record.jpg`, alt: t('shot2') },
  ];
  const features = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] as const;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'Football Analytics Pro',
    operatingSystem: 'Android 7.0+',
    applicationCategory: 'SportsApplication',
    installUrl: PLAY_STORE_URL,
    identifier: PLAY_PACKAGE,
    url: `${SITE_URL}/${locale}/app`,
    image: `${SITE_URL}/images/app/app-icon-192.png`,
    screenshot: shots.map((s) => `${SITE_URL}${s.src}`),
    description: t('metaDescription'),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: ORG_REF,
    publisher: ORG_REF,
  };

  return (
    <Page>
      <JsonLd data={jsonLd} />
      <PageTitle eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} />

      <div className="mt-2 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-4">
            <Image src="/images/app/app-icon-192.png" alt="" width={72} height={72} className="rounded-[18px] border border-s-line" priority />
            <PlayBadge label={t('cta')} location="app-page" size="lg" />
          </div>

          <section aria-labelledby="feat-title">
            <SectionTitle id="feat-title" title={t('featuresTitle')} />
            <ul className="mt-4 grid gap-3 text-[15px] sm:grid-cols-2">
              {features.map((k) => (
                <li key={k} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-s-win" aria-hidden />{t(k)}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="shots-title">
            <SectionTitle id="shots-title" title={t('shotsTitle')} />
            <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-[560px]">
              {shots.map((s) => (
                <figure key={s.src} className="flex flex-col gap-2">
                  <Image src={s.src} alt={s.alt} width={540} height={960} className="w-full rounded-[2px] border border-s-line" sizes="(max-width: 640px) 45vw, 270px" />
                  <figcaption className="text-[13px] text-s-muted">{s.alt}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section aria-labelledby="req-title">
            <SectionTitle id="req-title" title={t('reqTitle')} />
            <p className="mt-3 max-w-[70ch] text-[15px] text-s-muted">{t('req')}</p>
          </section>
        </div>

        <aside className="card card-flat items-center text-center lg:sticky lg:top-24">
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={t('qrLabel')} className="block bg-white p-2">
            <Image src="/images/app/google-play-qr.svg" alt={t('qrLabel')} width={212} height={212} unoptimized />
          </a>
          <p className="text-[14px] font-semibold">{t('qrLabel')}</p>
          <p className="text-[13px] text-s-muted">{t('qrHint')}</p>
        </aside>
      </div>
    </Page>
  );
}
