import { getTranslations } from 'next-intl/server';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/site/og';
import { routing } from '@/i18n/routing';

// Default og:image for every public page in this locale (a nested segment can
// override it with its own opengraph-image.tsx — the league pages do).
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Football Analytics — football predictions from a statistical model with a public record';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Image({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return ogCard({ eyebrow: t('siteName'), title: t('tagline'), subtitle: t('description') });
}
