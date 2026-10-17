import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd } from '@/lib/site/jsonld';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { leagueCountryName } from '@/lib/site/countries';
import { listPublicResultsForLeague } from '@/lib/site/match-public-data';
import { Page, PageTitle, SectionTitle } from '@/components/site/ui';
import PublicMatchList from '@/components/site/PublicMatchList';

// Results archive per league (SEO Faz 1a, 2026-10-17): every settled match of the
// last 120 days with its final score, newest first, each row linking to the public
// match page (/matches/{slug}), where the model's settled verdict is shown. No
// session read, no model figure → ISR. Before this, settled match pages dropped
// out of the sitemap after 14 days and nothing on the site linked to them.
export const revalidate = 900;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SITE_LEAGUES.map((l) => ({ locale, slug: l.slug })));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'league.results' });
  return {
    title: t('metaTitle', { league: league.name }),
    description: t('metaDescription', { league: league.name, country: leagueCountryName(league, params.locale) }),
    alternates: alternatesFor(params.locale as Locale, `/leagues/${league.slug}/results`),
  };
}

export default async function LeagueResultsPage({ params }: { params: { locale: string; slug: string } }) {
  unstable_setRequestLocale(params.locale);
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations('league.results');
  const tn = await getTranslations('nav');
  const f = await getFormatter();
  const rows = await listPublicResultsForLeague(league.slug).catch(() => []);
  const updated = rows.reduce<string | null>((m, r) => (r.updatedAt && (!m || r.updatedAt > m) ? r.updatedAt : m), null);
  const verdicts = rows.filter((r) => r.verdict);
  const won = verdicts.filter((r) => r.verdict!.outcome === 'won').length;

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(params.locale as Locale, [{ name: tn('home'), path: '/' }, { name: tn('leagues'), path: '/leagues' }, { name: league.name, path: `/leagues/${league.slug}` }, { name: t('title'), path: `/leagues/${league.slug}/results` }])} />
      <PageTitle
        eyebrow={leagueCountryName(league, params.locale)}
        title={t('h1', { league: league.name })}
        lead={t('lead', { league: league.name })}
        aside={<Link href={`/leagues/${league.slug}`} className="text-xs underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>}
      />
      <div className="max-w-3xl space-y-2 pb-6 text-[15px] leading-relaxed">
        {verdicts.length > 0 && <p>{t('recordLine', { league: league.name, n: verdicts.length, won, acc: f.number(won / verdicts.length, 'percent0') })} <Link href={`/performance/${league.slug}`} className="underline underline-offset-4">{t('recordLink')}</Link></p>}
        {updated && <p className="text-xs text-s-muted">{t('updated', { time: f.dateTime(new Date(updated), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) })}</p>}
      </div>
      {rows.length ? (
        <PublicMatchList rows={rows} groupBy="day" showLeague={false} />
      ) : (
        <p className="text-sm text-s-muted">{t('empty')}</p>
      )}
      <section className="mt-12 border-t border-s-line pt-6">
        <SectionTitle title={t('otherLeagues')} />
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {SITE_LEAGUES.filter((l) => l.slug !== league.slug).map((l) => (
            <li key={l.slug}><Link href={`/leagues/${l.slug}/results`} className="chip">{l.name}</Link></li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
