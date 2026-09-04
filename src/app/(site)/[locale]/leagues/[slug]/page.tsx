import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { getPerformance } from '@/lib/site/performance';
import { listResults, listUpcomingForLeague } from '@/lib/site/results';
import { getStandings } from '@/lib/site/standings';
import StandingsTable from '@/components/site/StandingsTable';
import { Page, PageTitle, SectionTitle } from '@/components/site/ui';
import PredictionTable from '@/components/site/PredictionTable';
import ResultsTable from '@/components/site/ResultsTable';

export const revalidate = 900;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SITE_LEAGUES.map((l) => ({ locale, slug: l.slug })));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'league' });
  return {
    title: t('metaTitle', { league: league.name }),
    description: t('metaDescription', { league: league.name, country: league.country }),
    alternates: alternatesFor(params.locale as Locale, `/leagues/${league.slug}`),
  };
}

export default async function LeaguePage({ params }: { params: { locale: string; slug: string } }) {
  unstable_setRequestLocale(params.locale);
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations('league');
  const tp = await getTranslations('performance');
  const f = await getFormatter();

  const [perf, upcoming, recent, table] = await Promise.all([
    getPerformance(league.slug),
    listUpcomingForLeague(league.slug, 30),
    listResults({ league, from: null, to: null, page: 1, pageSize: 20 }),
    getStandings(league.slug),
  ]);
  const ts = await getTranslations('standings');
  const o = perf.overall;
  const pct = (x: number | null) => (x == null ? '–' : f.number(x, 'percent1'));

  return (
    <Page>
      <PageTitle
        eyebrow={league.country}
        title={league.name}
        lead={t('lead', { league: league.name })}
        aside={<Link href="/leagues" className="text-xs underline underline-offset-4">{t('allLeagues')}</Link>}
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-s-line py-5 sm:grid-cols-4">
        <Stat label={tp('settled')} value={f.number(o.n)} />
        <Stat label={tp('hitRate')} value={pct(o.acc)} note={o.n ? tp('hitRateNote', { won: o.won, n: o.n }) : undefined} />
        <Stat label={tp('brier')} value={o.brier == null ? '–' : o.brier.toFixed(3)} note={tp('brierNote')} />
        <Stat label={tp('roi')} value={perf.roi ? `${perf.roi.roi >= 0 ? '+' : ''}${pct(perf.roi.roi)}` : '–'} note={perf.roi ? tp('roiNote', { bets: perf.roi.bets }) : tp('roiNone')} tone={perf.roi ? (perf.roi.roi >= 0 ? 'win' : 'loss') : undefined} />
      </dl>
      {perf.months.length > 1 && (
        <p className="mt-2 text-xs text-s-muted">
          {t('monthly')}{' '}
          {perf.months.map((m) => `${f.dateTime(new Date(`${m.month}-15T12:00:00Z`), 'month')} ${pct(m.acc)} (${m.n})`).join(' · ')}
        </p>
      )}

      <section className="mt-10">
        <SectionTitle title={t('upcoming')} meta={<Link href={`/predictions?league=${league.slug}`} className="underline underline-offset-4">{t('upcomingAll')}</Link>} />
        {upcoming.length ? <div className="mt-2"><PredictionTable rows={upcoming} /></div> : <p className="mt-3 text-sm text-s-muted">{t('upcomingEmpty')}</p>}
      </section>

      {table.length > 0 && (
        <section className="mt-12">
          <SectionTitle title={ts('title')} meta={ts('meta')} />
          <div className="mt-2"><StandingsTable rows={table} /></div>
        </section>
      )}

      <section className="mt-12">
        <SectionTitle title={t('recent')} meta={<Link href={`/results?league=${league.slug}&period=all`} className="underline underline-offset-4">{t('recentAll')}</Link>} />
        {recent.rows.length ? <div className="mt-2"><ResultsTable rows={recent.rows} /></div> : <p className="mt-3 text-sm text-s-muted">{t('recentEmpty')}</p>}
      </section>

      <p className="mt-12 border-t border-s-line pt-4 text-xs text-s-muted">{t('note', { league: league.name })}</p>
    </Page>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'win' | 'loss' }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-s-muted">{label}</dt>
      <dd className={`num mt-0.5 font-head text-3xl leading-none ${tone === 'win' ? 'text-s-win' : tone === 'loss' ? 'text-s-loss' : ''}`}>{value}</dd>
      {note && <dd className="mt-1 text-xs text-s-muted">{note}</dd>}
    </div>
  );
}
