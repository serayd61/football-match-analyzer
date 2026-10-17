import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_URL } from '@/lib/seo';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { leagueCountryName } from '@/lib/site/countries';
import { listSettledLeagueRows } from '@/lib/site/league-tables-data';
import { goalsTable, leagueGoalSummary } from '@/lib/site/league-tables';
import { getPerformance } from '@/lib/site/performance';
import { listTeams } from '@/lib/site/team-data';
import { teamCrest, teamPath } from '@/lib/site/teams';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { Crest } from '@/components/site/PredictionTable';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd, datasetJsonLd, faqPageJsonLd } from '@/lib/site/jsonld';
import { REGISTER_HREF, SIGNIN_HREF } from '@/components/site/Paywall';

// Goal statistics per league (SEO Faz 1c, 2026-10-17): over 2.5, both teams to
// score, clean sheets and goals per match, club by club, from this season's
// settled matches — "Beide Teams treffen Statistik", "2.5 üst istatistikleri",
// "over 2.5 stats". Probabilities for upcoming matches stay members-only; the
// model's settled record on the goal markets is quoted from the league report.
export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SITE_LEAGUES.map((l) => ({ locale, slug: l.slug })));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'goalsStats' });
  return {
    title: t('metaTitle', { league: league.name }),
    description: t('metaDescription', { league: league.name, country: leagueCountryName(league, params.locale) }),
    alternates: alternatesFor(params.locale as Locale, `/leagues/${league.slug}/goals`),
  };
}

export default async function GoalsStatsPage({ params }: { params: { locale: string; slug: string } }) {
  unstable_setRequestLocale(params.locale);
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations('goalsStats');
  const tl = await getTranslations('league');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const tp = await getTranslations('paywall');
  const f = await getFormatter();
  const [rows, teams, perf] = await Promise.all([listSettledLeagueRows(league.slug).catch(() => []), listTeams().catch(() => []), getPerformance(league.slug).catch(() => null)]);
  const table = goalsTable(rows);
  const summary = leagueGoalSummary(rows);
  const slugOf = new Map(teams.map((x) => [x.id, x.slug]));
  const d2 = (x: number) => f.number(x, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const pct0 = (x: number) => f.number(x, 'percent0');
  const lastKick = rows.reduce<string | null>((m, r) => (!m || r.kickoff > m ? r.kickoff : m), null);
  const url = `${SITE_URL}/${params.locale}/leagues/${league.slug}/goals`;
  const mk = perf ? Object.fromEntries(perf.markets.map((m) => [m.market, m])) : {};
  const ou = mk.ou25, bt = mk.btts;
  const topOver = table[0], lowOver = table[table.length - 1];
  const topBtts = [...table].sort((a, b) => b.btts - a.btts)[0];
  const topCs = [...table].sort((a, b) => b.cleanSheets - a.cleanSheets)[0];
  const sentences: string[] = [];
  if (summary) sentences.push(t('sLeague', { league: league.name, avg: d2(summary.avgGoals), over: pct0(summary.over25), btts: pct0(summary.btts), n: summary.n }));
  if (topOver && lowOver && topOver.id !== lowOver.id) sentences.push(t('sTopOver', { team: topOver.name, over: pct0(topOver.over25), low: lowOver.name, lowOver: pct0(lowOver.over25) }));
  if (topBtts && topCs) sentences.push(t('sTopBtts', { team: topBtts.name, btts: pct0(topBtts.btts), cs: topCs.name, csN: topCs.cleanSheets }));
  if (ou && bt && ou.n >= 10 && bt.n >= 10 && ou.acc != null && bt.acc != null) sentences.push(t('sModel', { league: league.name, ou: f.number(ou.acc, 'percent1'), bt: f.number(bt.acc, 'percent1'), n: ou.n }));
  const faqs: Array<{ q: string; a: string }> = [];
  if (summary) faqs.push({ q: t('faqAvgQ', { league: league.name }), a: t('sLeague', { league: league.name, avg: d2(summary.avgGoals), over: pct0(summary.over25), btts: pct0(summary.btts), n: summary.n }) });
  if (topOver && lowOver && topOver.id !== lowOver.id) faqs.push({ q: t('faqOverQ', { league: league.name }), a: t('sTopOver', { team: topOver.name, over: pct0(topOver.over25), low: lowOver.name, lowOver: pct0(lowOver.over25) }) });
  if (topBtts && topCs) faqs.push({ q: t('faqBttsQ', { league: league.name }), a: t('sTopBtts', { team: topBtts.name, btts: pct0(topBtts.btts), cs: topCs.name, csN: topCs.cleanSheets }) });
  const th = 'py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted';

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(params.locale as Locale, [{ name: tn('home'), path: '/' }, { name: tn('leagues'), path: '/leagues' }, { name: league.name, path: `/leagues/${league.slug}` }, { name: t('title'), path: `/leagues/${league.slug}/goals` }])} />
      {table.length > 0 && <JsonLd data={{ ...datasetJsonLd(params.locale as Locale, { name: t('metaTitle', { league: league.name }), description: t('metaDescription', { league: league.name, country: leagueCountryName(league, params.locale) }), settled: rows.length, dateModified: lastKick ? new Date(lastKick) : null }), '@id': `${url}#dataset`, url }} />}
      {faqs.length > 0 && <JsonLd data={faqPageJsonLd(faqs)} />}
      <PageTitle eyebrow={t('eyebrow')} title={t('h1', { league: league.name })} lead={t('lead')} aside={<Link href={`/leagues/${league.slug}`} className="text-xs underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>} />
      <div className="max-w-3xl space-y-2 pb-6 text-[15px] leading-relaxed">
        {sentences.map((s, i) => <p key={i}>{s}</p>)}
        <p className="text-xs text-s-muted">{t('note')} {lastKick && tl('updated', { time: f.dateTime(new Date(lastKick), { day: 'numeric', month: 'short' }) })}</p>
      </div>

      {!table.length ? (
        <EmptyState title={t('empty')} lead={t('emptyLead')} />
      ) : (
        <div className="tbl-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-s-line text-left">
                <th className={`${th} w-8 text-right`}>#</th>
                <th className={th}>{t('colTeam')}</th>
                <th className={`${th} text-right`}>{t('colPlayed')}</th>
                <th className={`${th} hidden text-right sm:table-cell`}>{t('colAvgFor')}</th>
                <th className={`${th} hidden text-right sm:table-cell`}>{t('colAvgAgainst')}</th>
                <th className={`${th} text-right`}>{t('colAvgTotal')}</th>
                <th className={`${th} text-right`}>{t('colOver')}</th>
                <th className={`${th} text-right`}>{t('colBtts')}</th>
                <th className={`${th} hidden text-right md:table-cell`}>{t('colCs')}</th>
                <th className={`${th} hidden text-right md:table-cell`}>{t('colFts')}</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => {
                const slug = slugOf.get(r.id);
                return (
                  <tr key={r.id} className="border-b border-s-line">
                    <td className="num py-1.5 text-right text-s-muted">{i + 1}</td>
                    <td className="py-1.5"><span className="flex items-center gap-2"><Crest src={teamCrest(r.id)} alt={tc('crestAlt', { team: r.name })} />{slug ? <Link href={teamPath({ slug })} className="hover:underline underline-offset-4">{r.name}</Link> : r.name}</span></td>
                    <td className="num py-1.5 text-right">{r.n}</td>
                    <td className="num hidden py-1.5 text-right sm:table-cell">{d2(r.avgFor)}</td>
                    <td className="num hidden py-1.5 text-right sm:table-cell">{d2(r.avgAgainst)}</td>
                    <td className="num py-1.5 text-right">{d2(r.avgTotal)}</td>
                    <td className="num py-1.5 text-right font-semibold">{pct0(r.over25)}</td>
                    <td className="num py-1.5 text-right">{pct0(r.btts)}</td>
                    <td className="num hidden py-1.5 text-right md:table-cell">{r.cleanSheets}</td>
                    <td className="num hidden py-1.5 text-right md:table-cell">{r.failedToScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <aside className="rule-b-1 mt-8 grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-labelledby="members-h">
        <div>
          <h2 id="members-h" className="text-[20px] font-extrabold">{tp('lockedTitle')}</h2>
          <p className="mt-1 max-w-lg text-[14px] text-s-muted">{t('membersLead', { league: league.name })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={REGISTER_HREF} rel="nofollow" className="btn btn-primary" data-cta="goals-trial">{tp('lockedCta')}</Link>
          <Link href={SIGNIN_HREF} rel="nofollow" className="text-sm font-semibold hover:text-s-accent-600">{tp('lockedSignIn')}</Link>
        </div>
      </aside>

      <section className="mt-8 max-w-3xl" aria-labelledby="how-h">
        <h2 id="how-h" className="text-[22px]">{t('howH')}</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
          <p>{t('howP1')}</p>
          <p>{t('howP2')}</p>
          <p className="text-s-muted"><Link href="/glossary#over-under" className="underline underline-offset-4">{t('glossaryLink')}</Link></p>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="mt-8 max-w-3xl" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-[20px]">{t('faqH')}</h2>
          <dl className="mt-3 space-y-3 text-[15px] leading-relaxed">
            {faqs.map((q, i) => <div key={i}><dt className="font-semibold">{q.q}</dt><dd className="text-s-muted">{q.a}</dd></div>)}
          </dl>
        </section>
      )}

      <section className="mt-10 border-t border-s-line pt-6">
        <SectionTitle title={t('otherLeagues')} />
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {SITE_LEAGUES.filter((l) => l.slug !== league.slug).map((l) => <li key={l.slug}><Link href={`/leagues/${l.slug}/goals`} className="chip">{l.name}</Link></li>)}
        </ul>
      </section>
      <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line py-5 text-sm">
        <Link href={`/leagues/${league.slug}`} className="underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>
        <Link href={`/leagues/${league.slug}/xg-table`} className="underline underline-offset-4">{tl('xgTable')}</Link>
        <Link href={`/leagues/${league.slug}/results`} className="underline underline-offset-4">{tl('resultsArchive')}</Link>
        <Link href={`/performance/${league.slug}`} className="underline underline-offset-4">{tl('recordPage', { league: league.name })}</Link>
      </nav>
    </Page>
  );
}
