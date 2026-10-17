import { getTranslations } from 'next-intl/server';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/site/og';
import { routing } from '@/i18n/routing';

// og:image of the track-record page (SEO Faz 0, 2026-10-17): was the generic locale card.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Prediction accuracy and public track record — Football Analytics';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'v2.performance' });
  const tm = await getTranslations({ locale, namespace: 'meta' });
  return ogCard({ eyebrow: tm('siteName'), title: t('metaTitle'), subtitle: t('lead') });
}
