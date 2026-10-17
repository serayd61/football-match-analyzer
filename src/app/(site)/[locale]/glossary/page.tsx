import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { SITE_URL } from '@/lib/seo';
import DocPage, { docMetadata, type DocSection } from '@/components/site/DocPage';
import JsonLd from '@/components/site/JsonLd';
import { definedTermSetJsonLd } from '@/lib/site/jsonld';

// Glossary (SEO Faz 1b, 2026-10-17): xG, xPTS, ELO, Dixon-Coles, Poisson, Brier,
// calibration, the three markets and "how a football prediction algorithm
// works" — one anchor per term, DefinedTermSet JSON-LD, four languages. The
// explainer queries ("was ist xG", "gol beklentisi nedir") are the easiest
// entry points of the analytics vocabulary, and every table links here.
export const revalidate = 86400;

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  return docMetadata(locale, 'glossary');
}

export default async function Page({ params: { locale } }: { params: { locale: string } }) {
  const t = await getTranslations({ locale, namespace: 'docs.glossary' });
  const tn = await getTranslations({ locale, namespace: 'nav' });
  const sections = t.raw('sections') as DocSection[];
  const url = `${SITE_URL}/${locale}/glossary`;
  const terms = sections.filter((s) => s.id).map((s) => ({ id: s.id!, term: s.h, description: s.p[0] }));
  return (
    <DocPage locale={locale} doc="glossary" updated="2026-10-17" extra={<JsonLd data={definedTermSetJsonLd(locale as Locale, { url, name: t('title'), terms })} />}>
      <nav className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line pt-5 text-sm" aria-label={t('moreNav')}>
        <Link href="/methodology" className="underline underline-offset-4">{tn('methodology')}</Link>
        <Link href="/performance" className="underline underline-offset-4">{tn('performance')}</Link>
        <Link href="/matches/today" className="underline underline-offset-4">{t('linkToday')}</Link>
        <Link href="/leagues" className="underline underline-offset-4">{tn('leagues')}</Link>
      </nav>
    </DocPage>
  );
}
