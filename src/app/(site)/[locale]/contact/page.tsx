import type { Metadata } from 'next';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { Page, PageTitle } from '@/components/site/ui';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd } from '@/lib/site/jsonld';

// Contact (SEO Faz 0, 2026-10-17): the footer used to link the legacy, English-only,
// client-rendered /contact page from every locale. This is the localized, static
// replacement (e-mail + Telegram); the legacy URL 301s here (lib/site/legacy-paths.ts).
export const revalidate = 86400;

const SUPPORT_EMAIL = 'support@footballanalyzer.com';
const TELEGRAM_URL = 'https://t.me/fanalytics_pro';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('metaTitle'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/contact') };
}

export default async function ContactPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('contact');
  const tn = await getTranslations('nav');
  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(locale as Locale, [{ name: tn('home'), path: '/' }, { name: t('title'), path: '/contact' }])} />
      <div className="max-w-3xl">
        <PageTitle title={t('title')} lead={t('lead')} />
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="card !gap-2">
            <dt className="kicker">{t('emailLabel')}</dt>
            <dd><a href={`mailto:${SUPPORT_EMAIL}`} className="text-[17px] font-semibold underline underline-offset-4 hover:text-s-accent-600">{SUPPORT_EMAIL}</a></dd>
            <dd className="text-[14px] text-s-muted">{t('emailNote')}</dd>
          </div>
          <div className="card !gap-2">
            <dt className="kicker">{t('telegramLabel')}</dt>
            <dd><a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-[17px] font-semibold underline underline-offset-4 hover:text-s-accent-600">@fanalytics_pro</a></dd>
            <dd className="text-[14px] text-s-muted">{t('telegramNote')}</dd>
          </div>
        </dl>
        <p className="mt-8 text-[15px] text-s-muted">
          {t('moreLead')}{' '}
          <Link href="/methodology" className="underline underline-offset-4 hover:text-s-ink">{tn('methodology')}</Link>
          {' · '}
          <Link href="/pricing" className="underline underline-offset-4 hover:text-s-ink">{tn('pricing')}</Link>
          {' · '}
          <Link href="/account" rel="nofollow" className="underline underline-offset-4 hover:text-s-ink">{tn('account')}</Link>
        </p>
      </div>
    </Page>
  );
}
