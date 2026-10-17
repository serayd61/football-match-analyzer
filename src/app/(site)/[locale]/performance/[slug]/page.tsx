import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { SITE_URL } from '@/lib/seo';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { leagueCountryName } from '@/lib/site/countries';
import { getPerformance } from '@/lib/site/performance';
import { listPublicResultsForLeague } from '@/lib/site/match-public-data';
import { matchPath } from '@/lib/site/match-public';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { StatRow, StatCell } from '@/components/site/StatCell';
import LocalTime from '@/components/site/LocalTime';
import JsonLd from '@/components/site/JsonLd';
import { breadcrumbJsonLd, datasetJsonLd, faqPageJsonLd } from '@/lib/site/jsonld';
import { REGISTER_HREF, SIGNIN_HREF } from '@/components/site/Paywall';

// ============================================================================
// Per-league track record (SEO Faz 1b, 2026-10-17): /[locale]/performance/{league}.
// "Bundesliga Prognose Trefferquote", "prediction accuracy premier league" —
// the /performance page answers only with a query string the crawler ignores.
// Public figures only: settled count, hit rate, Brier, return, months, markets
// and the latest settled matches with their public verdicts. The members' pick
// table stays on /performance?league=. No session read → ISR (1 h).
// ============================================================================
export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SITE_LEAGUES.map((l) => ({ locale, slug: l.slug })));
}

export async function generateMetadata({ params }: { params: { locale: string; slug: string } }): Promise<Metadata> {
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'perfLeague' });
  return {
    title: t('metaTitle', { league: league.name }),
    description: t('metaDescription', { league: league.name, country: leagueCountryName(league, params.locale) }),
    alternates: alternatesFor(params.locale as Locale, `/performance/${league.slug}`),
  };
}

const score = (r: { homeScore: number | null; awayScore: number | null }) => (r.homeScore != null && r.awayScore != null ? `${r.homeScore}–${r.awayScore}` : '–');

export default async function LeaguePerformancePage({ params }: { params: { locale: string; slug: string } }) {
  unstable_setRequestLocale(params.locale);
  const league = leagueBySlug(params.slug);
  if (!league) notFound();
  const t = await getTranslations('perfLeague');
  const tp = await getTranslations('performance');
  const t2 = await getTranslations('v2.performance');
  const tpw = await getTranslations('paywall');
  const tn = await getTranslations('nav');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const [r, recent] = await Promise.all([getPerformance(league.slug), listPublicResultsForLeague(league.slug, 60, 20).catch(() => [])]);
  const o = r.overall;
  const pct = (x: number | null, d = 1) => (x == null ? '–' : f.number(x, d === 0 ? 'percent0' : 'percent1'));
  const mk = Object.fromEntries(r.markets.map((m) => [m.market, m])) as Record<string, { n: number; won: number; acc: number | null; brier: number | null }>;
  const ou = mk.ou25, btts = mk.btts;
  const months = r.months.slice(-6);
  const monthLabel = (ym: string) => f.dateTime(new Date(`${ym}-15T12:00:00Z`), 'month');
  const url = `${SITE_URL}/${params.locale}/performance/${league.slug}`;
  const from = r.from ? f.dateTime(new Date(r.from), { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const sentences: string[] = [];
  if (o.n) {
    sentences.push(t('sSummary', { league: league.name, from: from ?? '–', won: o.won, n: o.n, acc: pct(o.acc), brier: o.brier == null ? '–' : o.brier.toFixed(3) }));
    if (ou?.n >= 10 && btts?.n >= 10) sentences.push(t('sMarkets', { ou: pct(ou.acc), ouN: ou.n, btts: pct(btts.acc), bttsN: btts.n }));
    if (r.roi) sentences.push(t('sRoi', { roi: `${r.roi.roi >= 0 ? '+' : ''}${pct(r.roi.roi)}`, bets: r.roi.bets }));
    if (months.length >= 2) sentences.push(t('sMonths', { list: months.map((m) => `${monthLabel(m.month)} ${pct(m.acc, 0)} (${m.n})`).join(' · ') }));
  }
  const faqs = o.n ? [
    { q: t('faqAccQ', { league: league.name }), a: t('sSummary', { league: league.name, from: from ?? '–', won: o.won, n: o.n, acc: pct(o.acc), brier: o.brier == null ? '–' : o.brier.toFixed(3) }) },
    { q: t('faqBrierQ'), a: t('faqBrierA') },
    { q: t('faqHowQ', { league: league.name }), a: t('faqHowA', { league: league.name }) },
  ] : [];

  return (
    <Page>
      <JsonLd data={breadcrumbJsonLd(params.locale as Locale, [{ name: tn('home'), path: '/' }, { name: t2('title'), path: '/performance' }, { name: league.name, path: `/performance/${league.slug}` }])} />
      {o.n > 0 && <JsonLd data={{ ...datasetJsonLd(params.locale as Locale, { name: t('metaTitle', { league: league.name }), description: t('metaDescription', { league: league.name, country: leagueCountryName(league, params.locale) }), settled: o.n, dateModified: r.to ? new Date(r.to) : null }), '@id': `${url}#dataset`, url }} />}
      {faqs.length > 0 && <JsonLd data={faqPageJsonLd(faqs)} />}
      <PageTitle
        eyebrow={t('eyebrow')}
        title={t('h1', { league: league.name })}
        lead={t('lead', { league: league.name })}
        aside={<Link href="/performance" className="text-xs underline underline-offset-4">{t('allLeagues')}</Link>}
      />
      {!o.n ? (
        <EmptyState title={tp('emptyTitle')} lead={tp('emptyLead')} />
      ) : (
        <>
          <div className="max-w-3xl space-y-2 pb-6 text-[15px] leading-relaxed">
            {sentences.map((s, i) => <p key={i}>{s}</p>)}
            <p className="text-xs text-s-muted">{t2('window', { from: r.from ? f.dateTime(new Date(r.from), 'dayShort') : '–', to: r.to ? f.dateTime(new Date(r.to), 'dayShort') : '–' })} · <Link href="/methodology" className="underline underline-offset-4">{t('methodLink')}</Link> · <Link href="/glossary#brier" className="underline underline-offset-4">{t('glossaryLink')}</Link></p>
          </div>
          <StatRow cols={4}>
            <StatCell first size="lg" label={t2('settled')} value={f.number(o.n)} note={tp('settledNote')} />
            <StatCell size="lg" label={t2('hitRate')} value={pct(o.acc)} note={tp('hitRateNote', { won: o.won, n: o.n })} />
            <StatCell size="lg" label={tp('brier')} value={o.brier == null ? '–' : o.brier.toFixed(3)} note={tp('brierNote')} />
            <StatCell size="lg" label={`${t2('roi')} · ${tp('roiClosing')}`} value={r.roi ? `${r.roi.roi >= 0 ? '+' : ''}${pct(r.roi.roi)}` : '–'} note={r.roi ? tp('roiNote', { bets: r.roi.bets }) : tp('roiNone')} />
          </StatRow>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <section aria-labelledby="markets-h">
              <SectionTitle id="markets-h" title={tp('secMarkets')} />
              <table className="mt-3 w-full text-sm">
                <thead><tr className="border-b border-s-line text-left text-xs font-medium uppercase tracking-wider text-s-muted"><th className="py-1.5">{tp('market')}</th><th className="py-1.5 text-right">{t2('hitRate')}</th><th className="py-1.5 text-right">{tp('record')}</th><th className="py-1.5 text-right">{tp('brier')}</th></tr></thead>
                <tbody>
                  {(['1x2', 'ou25', 'btts'] as const).map((k) => { const b = mk[k]; if (!b) return null; return (
                    <tr key={k} className="border-b border-s-line"><td className="py-1.5">{k === '1x2' ? tc('market1x2') : k === 'ou25' ? tc('ou25') : tc('btts')}</td><td className="num py-1.5 text-right">{pct(b.acc)}</td><td className="num py-1.5 text-right text-s-muted">{b.won}–{b.n - b.won}</td><td className="num py-1.5 text-right">{b.brier == null ? '–' : b.brier.toFixed(3)}</td></tr>
                  ); })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-s-muted">{tp('marketsNote')}</p>
            </section>
            <section aria-labelledby="months-h">
              <SectionTitle id="months-h" title={tp('secMonthly')} />
              <table className="mt-3 w-full text-sm">
                <thead><tr className="border-b border-s-line text-left text-xs font-medium uppercase tracking-wider text-s-muted"><th className="py-1.5">{tp('month')}</th><th className="py-1.5 text-right">{tp('nShort')}</th><th className="py-1.5 text-right">{t2('hitRate')}</th><th className="py-1.5 text-right">{tp('record')}</th></tr></thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month} className="border-b border-s-line"><td className="py-1.5">{monthLabel(m.month)}</td><td className="num py-1.5 text-right">{m.n}</td><td className="num py-1.5 text-right">{pct(m.acc)}</td><td className="num py-1.5 text-right text-s-muted">{m.won}–{m.n - m.won}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-s-muted">{tp('monthlyNote')}</p>
            </section>
          </div>

          {recent.length > 0 && (
            <section className="mt-10" aria-labelledby="recent-h">
              <SectionTitle id="recent-h" title={t('recentH', { league: league.name })} sub={t('recentSub')} meta={<Link href={`/leagues/${league.slug}/results`} className="underline underline-offset-4">{t('archive')}</Link>} />
              <div className="tbl-scroll mt-4">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-s-line text-left text-xs font-medium uppercase tracking-wider text-s-muted"><th className="py-1.5">{t2('colDate')}</th><th className="py-1.5">{t2('colMatch')}</th><th className="py-1.5 text-right">{t2('colScore')}</th><th className="hidden py-1.5 sm:table-cell">{t2('colPick')}</th><th className="py-1.5 text-right">{t2('colResult')}</th></tr></thead>
                  <tbody>
                    {recent.map((m) => { const v = m.verdict; const pickName = v ? (v.pick === '1' ? m.homeName : v.pick === '2' ? m.awayName : tc('draw')) : null; return (
                      <tr key={m.fixtureId} className="border-b border-s-line">
                        <td className="py-1.5 text-xs text-s-muted"><LocalTime iso={m.kickoff} format="dayShort" /></td>
                        <td className="py-1.5"><Link href={matchPath(m)} className="hover:underline underline-offset-4">{m.homeName} – {m.awayName}</Link></td>
                        <td className="num py-1.5 text-right font-semibold">{score(m)}</td>
                        <td className="hidden py-1.5 text-s-muted sm:table-cell">{v ? `${pickName} · ${f.number(v.p, 'percent0')}` : '–'}</td>
                        <td className="py-1.5 text-right">{v ? <span className={`tag ${v.outcome === 'won' ? 'tag-win' : 'tag-loss'}`}>{v.outcome === 'won' ? tc('won') : tc('lost')}</span> : <span className="text-s-muted">–</span>}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <aside className="rule-b-1 mt-8 grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-labelledby="members-h">
            <div>
              <h2 id="members-h" className="text-[20px] font-extrabold">{t('membersH')}</h2>
              <p className="mt-1 max-w-lg text-[14px] text-s-muted">{t('membersLead', { league: league.name })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={REGISTER_HREF} rel="nofollow" className="btn btn-primary" data-cta="perf-league-trial">{tpw('lockedCta')}</Link>
              <Link href={SIGNIN_HREF} rel="nofollow" className="text-sm font-semibold hover:text-s-accent-600">{tpw('lockedSignIn')}</Link>
            </div>
          </aside>

          {faqs.length > 0 && (
            <section className="mt-8 max-w-3xl" aria-labelledby="faq-h">
              <h2 id="faq-h" className="text-[20px]">{t('faqH')}</h2>
              <dl className="mt-3 space-y-3 text-[15px] leading-relaxed">
                {faqs.map((q, i) => <div key={i}><dt className="font-semibold">{q.q}</dt><dd className="text-s-muted">{q.a}</dd></div>)}
              </dl>
            </section>
          )}
        </>
      )}
      <section className="mt-10 border-t border-s-line pt-6">
        <SectionTitle title={t('otherLeagues')} />
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {SITE_LEAGUES.filter((l) => l.slug !== league.slug).map((l) => <li key={l.slug}><Link href={`/performance/${l.slug}`} className="chip">{l.name}</Link></li>)}
        </ul>
      </section>
      <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-s-line py-5 text-sm">
        <Link href={`/leagues/${league.slug}`} className="underline underline-offset-4">{t('leaguePage', { league: league.name })}</Link>
        <Link href={`/leagues/${league.slug}/results`} className="underline underline-offset-4">{t('archive')}</Link>
        <Link href="/performance" className="underline underline-offset-4">{t('allLeagues')}</Link>
        <Link href="/methodology" className="underline underline-offset-4">{t('methodLink')}</Link>
      </nav>
    </Page>
  );
}
