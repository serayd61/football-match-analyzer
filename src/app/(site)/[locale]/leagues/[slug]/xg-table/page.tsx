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
import { xgTable } from '@/lib/site/league-tables';
import { listTeams } from '@/lib/site/team-data';
import { teamCrest, teamPath } from '@/lib/site/teams';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { Crest } from '@/components/site/PredictionTable';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd, datasetJsonLd, faqPageJsonLd } from '@/lib/site/jsonld';

// xG / xPTS table per league (SEO Faz 1c, 2026-10-17): "xG Tabelle Bundesliga",
// "xg serie a", "gol beklentisi tablosu". Model expected goals and expected
// points of the settled season, club by club, next to goals and points. The
// page says plainly that these are pre-match model figures, not shot xG.
// Settled data only, no session → ISR (1 h).
export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SITE_LEAGUES.map((l) => ({ locale, slug: l.slug })));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'xgTable' });
  return {
    title: t('metaTitle', { league: league.name }),
    description: t('metaDescription', { league: league.name, country: leagueCountryName(league, params.locale) }),
    alternates: alternatesFor(params.locale as Locale, `/leagues/${league.slug}/xg-table`),
  };
}

export default async function XgTablePage({ params }: { params: { locale: string; slug: string } }) {
  unstable_setRequestLocale(params.locale);
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations('xgTable');
  const tl = await getTranslations('league');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const [rows, teams] = await Promise.all([listSettledLeagueRows(league.slug).catch(() => []), listTeams().catch(() => [])]);
  const table = xgTable(rows);
  const slugOf = new Map(teams.map((x) => [x.id, x.slug]));
  const d1 = (x: number) => f.number(x, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const signed = (x: number) => `${x > 0 ? '+' : ''}${d1(x)}`;
  const lastKick = rows.reduce<string | null>((m, r) => (!m || r.kickoff > m ? r.kickoff : m), null);
  const url = `${SITE_URL}/${params.locale}/leagues/${league.slug}/xg-table`;
  const top = table[0];
  const lucky = [...table].sort((a, b) => b.luck - a.luck)[0];
  const unlucky = [...table].sort((a, b) => a.luck - b.luck)[0];
  const sentences: string[] = [];
  if (top) sentences.push(t('sTop', { team: top.name, xgd: signed(top.xgd), n: top.n, league: league.name }));
  if (lucky && unlucky && lucky.id !== unlucky.id) sentences.push(t('sLuck', { team: lucky.name, luck: signed(lucky.luck), unlucky: unlucky.name, uluck: signed(unlucky.luck) }));
  const faqs = [
    { q: t('faqWhatQ'), a: t('whatIsP1') },
    { q: t('faqXptsQ'), a: t('whatIsP3') },
    { q: t('faqSourceQ'), a: t('whatIsP2') },
  ];
  const th = 'py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted';

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(params.locale as Locale, [{ name: tn('home'), path: '/' }, { name: tn('leagues'), path: '/leagues' }, { name: league.name, path: `/leagues/${league.slug}` }, { name: t('title'), path: `/leagues/${league.slug}/xg-table` }])} />
      {table.length > 0 && <JsonLd data={{ ...datasetJsonLd(params.locale as Locale, { name: t('metaTitle', { league: league.name }), description: t('metaDescription', { league: league.name, country: leagueCountryName(league, params.locale) }), settled: rows.length, dateModified: lastKick ? new Date(lastKick) : null }), '@id': `${url}#dataset`, url }} />}
      <JsonLd data={faqPageJsonLd(faqs)} />
      <PageTitle eyebrow={t('eyebrow')} title={t('h1', { league: league.name })} lead={t('lead', { league: league.name })} aside={<Link href={`/leagues/${league.slug}`} className="text-xs underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>} />
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
                <th className={`${th} hidden text-right sm:table-cell`}>{t('colGoals')}</th>
                <th className={`${th} text-right`}>{t('colXgf')}</th>
                <th className={`${th} text-right`}>{t('colXga')}</th>
                <th className={`${th} text-right`}>{t('colXgd')}</th>
                <th className={`${th} hidden text-right sm:table-cell`}>{t('colPts')}</th>
                <th className={`${th} text-right`}>{t('colXpts')}</th>
                <th className={`${th} text-right`}>{t('colLuck')}</th>
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
                    <td className="num hidden py-1.5 text-right sm:table-cell">{r.gf}–{r.ga}</td>
                    <td className="num py-1.5 text-right">{d1(r.xgf)}</td>
                    <td className="num py-1.5 text-right">{d1(r.xga)}</td>
                    <td className={`num py-1.5 text-right font-semibold ${r.xgd > 0 ? 'text-s-win' : r.xgd < 0 ? 'text-s-loss' : ''}`}>{signed(r.xgd)}</td>
                    <td className="num hidden py-1.5 text-right sm:table-cell">{r.pts}</td>
                    <td className="num py-1.5 text-right">{d1(r.xpts)}</td>
                    <td className={`num py-1.5 text-right ${r.luck > 1 ? 'text-s-win' : r.luck < -1 ? 'text-s-loss' : 'text-s-muted'}`}>{signed(r.luck)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10 max-w-3xl" aria-labelledby="what-h">
        <h2 id="what-h" className="text-[22px]">{t('whatIsH')}</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
          <p>{t('whatIsP1')}</p>
          <p>{t('whatIsP2')}</p>
          <p>{t('whatIsP3')}</p>
          <p className="text-s-muted"><Link href="/glossary#xg-table" className="underline underline-offset-4">{t('glossaryLink')}</Link> · <Link href="/methodology" className="underline underline-offset-4">{t('methodLink')}</Link></p>
        </div>
      </section>

      <section className="mt-10 border-t border-s-line pt-6">
        <SectionTitle title={t('otherLeagues')} />
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {SITE_LEAGUES.filter((l) => l.slug !== league.slug).map((l) => <li key={l.slug}><Link href={`/leagues/${l.slug}/xg-table`} className="chip">{l.name}</Link></li>)}
        </ul>
      </section>
      <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line py-5 text-sm">
        <Link href={`/leagues/${league.slug}`} className="underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>
        <Link href={`/leagues/${league.slug}/goals`} className="underline underline-offset-4">{tl('goalsStats')}</Link>
        <Link href={`/leagues/${league.slug}/results`} className="underline underline-offset-4">{tl('resultsArchive')}</Link>
        <Link href={`/performance/${league.slug}`} className="underline underline-offset-4">{tl('recordPage', { league: league.name })}</Link>
      </nav>
    </Page>
  );
}
