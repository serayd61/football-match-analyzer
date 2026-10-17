import type { Metadata } from 'next';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { leagueCountryName } from '@/lib/site/countries';
import { listTeams } from '@/lib/site/team-data';
import { teamPath } from '@/lib/site/teams';
import { Page, PageTitle, SectionTitle } from '@/components/site/ui';
import { Crest } from '@/components/site/PredictionTable';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd } from '@/lib/site/jsonld';

// Club index (SEO Faz 1b): every club of the covered leagues, grouped by league,
// linking to /teams/{slug}. Crawl hub for the team pages; no session → ISR.
export const revalidate = 3600;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'teams' });
  return { title: t('metaTitle'), description: t('metaDescription', { leagues: SITE_LEAGUES.length }), alternates: alternatesFor(locale as Locale, '/teams') };
}

export default async function TeamsPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('teams');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const teams = await listTeams().catch(() => []);
  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(locale as Locale, [{ name: tn('home'), path: '/' }, { name: t('title'), path: '/teams' }])} />
      <PageTitle title={t('title')} lead={t('lead', { count: teams.length, leagues: SITE_LEAGUES.length })} aside={<Link href="/leagues" className="text-xs underline underline-offset-4">{tn('leagues')}</Link>} />
      {SITE_LEAGUES.map((l) => {
        const list = teams.filter((x) => x.league.slug === l.slug);
        if (!list.length) return null;
        return (
          <section key={l.slug} className="mt-8" aria-labelledby={`league-${l.slug}`}>
            <SectionTitle id={`league-${l.slug}`} title={l.name} sub={leagueCountryName(l, locale)} meta={<Link href={`/leagues/${l.slug}`} className="underline underline-offset-4">{t('leaguePage')}</Link>} />
            <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-[14.5px] sm:grid-cols-2 lg:grid-cols-3">
              {list.map((x) => (
                <li key={x.id}><Link href={teamPath(x)} className="inline-flex items-center gap-2 hover:underline underline-offset-4"><Crest src={x.crest} alt={tc('crestAlt', { team: x.name })} />{x.name}</Link></li>
              ))}
            </ul>
          </section>
        );
      })}
    </Page>
  );
}
