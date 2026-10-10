import { getTranslations } from 'next-intl/server';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/site/og';
import { leagueBySlug } from '@/lib/site/leagues';

// League page og:image: "{League} predictions and record" in the page's language.
export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'League predictions and settled record — Football Analytics';

export default async function Image({ params }: { params: { locale: string; slug: string } }) {
  const league = leagueBySlug(params.slug);
  const t = await getTranslations({ locale: params.locale, namespace: 'league' });
  const tm = await getTranslations({ locale: params.locale, namespace: 'meta' });
  if (!league) return ogCard({ eyebrow: tm('siteName'), title: tm('tagline') });
  return ogCard({ eyebrow: league.country, title: t('metaTitle', { league: league.name }), subtitle: t('metaDescription', { league: league.name, country: league.country }) });
}
