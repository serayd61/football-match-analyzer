import React from 'react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { getPerformance } from '@/lib/site/performance';
import { getWeeklyProgress } from '@/lib/site/weekly-progress';
import { listResults } from '@/lib/site/results';
import { leagueBySlug, SITE_LEAGUES } from '@/lib/site/leagues';
import { Page, SectionTitle, EmptyState } from '@/components/site/ui';
import { CalibrationChart } from '@/components/site/PerformanceCharts';
import { StatRow, StatCell } from '@/components/site/StatCell';
import ResultsTable from '@/components/site/ResultsTable';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { LockedBlock, TrialNotice } from '@/components/site/Paywall';

// Performance (Modernist redesign 2026-09-11) — replaces /results. Track
// record first: four stat cells, the monthly hit-rate bars and the latest
// settled picks (members; visitors see the count). The full report —
// calibration, leagues, markets, ROI, weekly review — follows below.
// The session read makes the page dynamic; the report itself stays cached.
export const dynamic = 'force-dynamic';

type Search = { page?: string; league?: string };
const PAGE_SIZE = 25;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'v2.performance' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/performance') };
}

const pct = (x: number | null, digits = 1) => (x == null ? '–' : `${(x * 100).toFixed(digits)}%`);
const fx = (x: number | null, d = 3) => (x == null ? '–' : x.toFixed(d));

export default async function PerformancePage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('performance');
  const t2 = await getTranslations('v2.performance');
  const tc = await getTranslations('common');
  const tm = await getTranslations('match');
  const f = await getFormatter();
  const access = await getSiteAccess();
  const unlocked = canSeeMatches(access);
  const page = Math.max(1, Math.min(500, Number.parseInt(searchParams.page || '1', 10) || 1));
  const league = searchParams.league ? leagueBySlug(searchParams.league) : null;

  const [r, w, res, recent] = await Promise.all([
    getPerformance(null),
    getWeeklyProgress(12),
    listResults({ league, from: null, to: null, page, pageSize: PAGE_SIZE }),
    // Longest losing run over the last 400 settled 1X2 picks (newest first → reversed).
    listResults({ league: null, from: null, to: null, page: 1, pageSize: 400 }),
  ]);
  let losingRun = 0, run = 0;
  for (const row of [...recent.rows].reverse()) {
    if (row.outcome === 'lost') { run += 1; losingRun = Math.max(losingRun, run); } else if (row.outcome === 'won') run = 0;
  }

  const monthLabel = (ym: string) => f.dateTime(new Date(`${ym}-15T12:00:00Z`), 'month');
  const monthShort = (ym: string) => f.dateTime(new Date(`${ym}-15T12:00:00Z`), { month: 'short' });
  const marketName = { '1x2': tc('market1x2'), ou25: tc('ou25'), btts: tc('btts') } as const;
  const th = 'py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted';
  const months = r.months.slice(-6);
  const pages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));
  const href = (over: Partial<Search>) => {
    const qs = new URLSearchParams();
    const m = { page: String(page), league: league?.slug, ...over };
    if (m.league) qs.set('league', m.league);
    if (m.page && m.page !== '1') qs.set('page', m.page);
    const q = qs.toString();
    return `/performance${q ? `?${q}` : ''}#results`;
  };

  if (!r.overall.n) {
    return (
      <Page>
        <div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t2('title')}</h1><p className="mt-2 text-[14px] text-s-muted">{t2('lead')}</p></div>
        <EmptyState title={t('emptyTitle')} lead={t('emptyLead')} />
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-8">
        <div>
          <h1 className="text-[32px] sm:text-[40px]">{t2('title')}</h1>
          <p className="mt-2 max-w-2xl text-[14px] text-s-muted">{t2('lead')}</p>
        </div>
        <p className="text-[12px] text-s-muted">{t2('window', { from: r.from ? f.dateTime(new Date(r.from), 'dayShort') : '–', to: r.to ? f.dateTime(new Date(r.to), 'dayShort') : '–' })}</p>
      </div>

      {/* ── 4 stat cells ────────────────────────────────────────────── */}
      <StatRow cols={4}>
        <StatCell first size="lg" label={t2('hitRate')} value={pct(r.overall.acc)} note={t('hitRateNote', { won: r.overall.won, n: r.overall.n })} />
        <StatCell size="lg" label={`${t2('roi')} · ${t('roiClosing')}`} value={r.roi ? `${r.roi.roi >= 0 ? '+' : ''}${pct(r.roi.roi)}` : '–'} note={r.roi ? t('roiNote', { bets: r.roi.bets }) : t('roiNone')} />
        <StatCell size="lg" label={t2('settled')} value={f.number(r.overall.n)} note={t('settledNote')} />
        <StatCell size="lg" label={t2('losingRun')} value={losingRun || '–'} tone="accent" />
      </StatRow>

      {/* ── Monthly bars + latest results ───────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
        <section>
          <h2 className="text-[24px]">{t2('monthlyTitle')}</h2>
          <div className="rule-b mt-4 grid h-[180px] items-end gap-2" style={{ gridTemplateColumns: `repeat(${months.length || 1}, minmax(0, 1fr))` }} role="img" aria-label={t('secMonthly')}>
            {months.map((m) => (
              <div key={m.month} className="flex h-full flex-col justify-end gap-1">
                <span className="num text-[12px] font-semibold leading-none">{m.acc == null ? '–' : Math.round(m.acc * 100)}</span>
                <span className={`w-full ${m.n < 30 ? 'bg-s-n400' : 'bg-s-ink'}`} style={{ height: `${Math.round((m.acc ?? 0) * 100)}%` }} title={`${monthLabel(m.month)} · ${pct(m.acc)} · ${t('nShort')} ${m.n}`} />
              </div>
            ))}
          </div>
          <div className="mt-1 grid gap-2 text-[11px] text-s-muted" style={{ gridTemplateColumns: `repeat(${months.length || 1}, minmax(0, 1fr))` }}>
            {months.map((m) => <span key={m.month} className="truncate">{monthShort(m.month)}</span>)}
          </div>
          <p className="mt-3 text-[12px] text-s-muted">{t('monthlyNote')}</p>
        </section>

        <section id="results">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-[24px]">{t2('resultsTitle')}</h2>
            <nav className="flex flex-wrap gap-1" aria-label={tc('league')}>
              <Link href={href({ league: undefined, page: '1' })} className={`btn btn-sm ${!league ? 'btn-primary' : 'btn-secondary'}`}>{tc('all')}</Link>
              {SITE_LEAGUES.map((l) => <Link key={l.slug} href={href({ league: l.slug, page: '1' })} className={`btn btn-sm ${league?.slug === l.slug ? 'btn-primary' : 'btn-secondary'}`}>{l.name}</Link>)}
            </nav>
          </div>
          <div className="mt-4"><TrialNotice access={access} /></div>
          {!unlocked ? (
            <LockedBlock count={res.total} />
          ) : res.rows.length ? (
            <>
              <ResultsTable rows={res.rows} />
              <div className="mt-3 flex items-center justify-between text-[13px]">
                <span className="text-s-muted">{res.total} · {page}/{pages}</span>
                <span className="flex gap-4">
                  {page > 1 && <Link href={href({ page: String(page - 1) })} className="font-semibold hover:text-s-accent-600">←</Link>}
                  {page < pages && <Link href={href({ page: String(page + 1) })} className="font-semibold hover:text-s-accent-600">→</Link>}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-s-muted">{t('emptyLead')}</p>
          )}
        </section>
      </div>

      {/* ── Full report ─────────────────────────────────────────────── */}
      <section className="rule-t mt-10 pt-8">
        <h2 className="text-[30px]">{t2('detailsTitle')}</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-s-muted">{t2('detailsLead')}</p>
      </section>
      <p className="mt-3 text-xs text-s-muted">
        {t('qualityNote', { decided: f.number(r.quality.decided), versions: r.quality.modelVersions.join(', ') || '–', recomputed: r.quality.recomputedCorrect })}
        {r.quality.truncated && <> {t('truncated')}</>}
        {' '}{t('brierScale')}
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        {/* Monthly trend */}
        <section>
          <SectionTitle title={t('secMonthly')} meta={t('monthlyMeta')} />
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-s-line text-left"><th className={th}>{t('month')}</th><th className={`${th} text-right`}>{t('nShort')}</th><th className={`${th} text-right`}>{t('record')}</th><th className={`${th} text-right`}>{t('hitRate')}</th><th className={`${th} text-right`}>{t('brier')}</th></tr></thead>
            <tbody>
              {[...r.months].reverse().map((m) => (
                <tr key={m.month} className="border-b border-s-line">
                  <td className="py-1.5">{monthLabel(m.month)}</td>
                  <td className="num py-1.5 text-right">{m.n}</td>
                  <td className="num py-1.5 text-right">{m.won}–{m.n - m.won}</td>
                  <td className={`num py-1.5 text-right ${m.acc != null && m.acc < 0.45 ? 'text-s-loss' : ''}`}>{pct(m.acc)}</td>
                  <td className="num py-1.5 text-right text-s-muted">{fx(m.brier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-s-muted">{t('monthlyNote')}</p>
        </section>

        {/* Calibration */}
        <section>
          <SectionTitle title={t('secCalibration')} meta={t('calibrationMeta')} />
          <div className="mt-4">
            <CalibrationChart bins={r.calibration} labels={{ predicted: t('predicted'), observed: t('observed'), ideal: t('ideal'), n: t('nShort') }} />
          </div>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="border-b border-s-line text-left"><th className={th}>{t('bin')}</th><th className={`${th} text-right`}>{t('nShort')}</th><th className={`${th} text-right`}>{t('predicted')}</th><th className={`${th} text-right`}>{t('observed')}</th><th className={`${th} text-right`}>{t('gap')}</th></tr></thead>
            <tbody>
              {r.calibration.map((b) => (
                <tr key={b.lo} className="border-b border-s-line">
                  <td className="num py-1.5">{Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}%</td>
                  <td className="num py-1.5 text-right">{b.n}</td>
                  <td className="num py-1.5 text-right">{pct(b.predicted)}</td>
                  <td className="num py-1.5 text-right">{pct(b.observed)}</td>
                  <td className={`num py-1.5 text-right ${Math.abs(b.observed - b.predicted) > 0.1 ? 'text-s-loss' : 'text-s-muted'}`}>{b.observed - b.predicted >= 0 ? '+' : '−'}{Math.abs(Math.round((b.observed - b.predicted) * 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-s-muted">
            <span className="font-medium text-s-ink">{t('calRetro')}.</span> {t('calibrationNote')}
            {r.calibrationCurve && <> {tm('curveMeta', { segment: r.calibrationCurve.segment, n: f.number(r.calibrationCurve.nSamples ?? 0), date: r.calibrationCurve.fittedAt ? f.dateTime(new Date(r.calibrationCurve.fittedAt), 'dayShort') : '–' })}</>}
          </p>

          <h3 className="mt-6 font-body text-xs font-medium uppercase tracking-wider text-s-muted">{t('calWalk')}</h3>
          {r.calibrationWalkForward.bins.length ? (
            <>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="border-b border-s-line text-left"><th className={th}>{t('bin')}</th><th className={`${th} text-right`}>{t('nShort')}</th><th className={`${th} text-right`}>{t('predicted')}</th><th className={`${th} text-right`}>{t('observed')}</th><th className={`${th} text-right`}>{t('gap')}</th></tr></thead>
                <tbody>
                  {r.calibrationWalkForward.bins.map((b) => (
                    <tr key={b.lo} className="border-b border-s-line">
                      <td className="num py-1.5">{Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}%</td>
                      <td className="num py-1.5 text-right">{b.n}</td>
                      <td className="num py-1.5 text-right">{pct(b.predicted)}</td>
                      <td className="num py-1.5 text-right">{pct(b.observed)}</td>
                      <td className={`num py-1.5 text-right ${Math.abs(b.observed - b.predicted) > 0.1 ? 'text-s-loss' : 'text-s-muted'}`}>{b.observed - b.predicted >= 0 ? '+' : '−'}{Math.abs(Math.round((b.observed - b.predicted) * 100))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-s-muted">
                {t('walkNote', { warmup: f.number(r.calibrationWalkForward.warmup), month: r.calibrationWalkForward.firstScoredMonth ? monthLabel(r.calibrationWalkForward.firstScoredMonth) : '–' })}
                {' '}{t('walkBrier', { raw: fx(r.calibrationWalkForward.brierRaw, 4), cal: fx(r.calibrationWalkForward.brierCalibrated, 4) })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-s-muted">{t('walkEmpty')}</p>
          )}
        </section>

        {/* By league */}
        <section>
          <SectionTitle title={t('secLeagues')} />
          <table className="mt-2 w-full text-sm">
            <thead><tr className="border-b border-s-line text-left"><th className={th}>{tc('league')}</th><th className={`${th} text-right`}>{t('nShort')}</th><th className={`${th} text-right`}>{t('record')}</th><th className={`${th} text-right`}>{t('hitRate')}</th><th className={`${th} text-right`}>{t('brier')}</th></tr></thead>
            <tbody>
              {r.leagues.map((l) => (
                <tr key={l.league.slug} className="border-b border-s-line">
                  <td className="py-1.5"><Link href={`/leagues/${l.league.slug}`} className="hover:underline underline-offset-4">{l.league.name}</Link></td>
                  <td className="num py-1.5 text-right">{l.n}</td>
                  <td className="num py-1.5 text-right">{l.won}–{l.n - l.won}</td>
                  <td className={`num py-1.5 text-right ${l.acc != null && l.acc < 0.45 ? 'text-s-loss' : ''}`}>{pct(l.acc)}</td>
                  <td className="num py-1.5 text-right text-s-muted">{fx(l.brier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-s-muted">{t('leaguesNote')}</p>
        </section>

        {/* By market + ROI */}
        <section className="space-y-8">
          <div>
            <SectionTitle title={t('secMarkets')} />
            <table className="mt-2 w-full text-sm">
              <thead><tr className="border-b border-s-line text-left"><th className={th}>{t('market')}</th><th className={`${th} text-right`}>{t('nShort')}</th><th className={`${th} text-right`}>{t('record')}</th><th className={`${th} text-right`}>{t('hitRate')}</th><th className={`${th} text-right`}>{t('brier')}</th></tr></thead>
              <tbody>
                {r.markets.map((m) => (
                  <tr key={m.market} className="border-b border-s-line">
                    <td className="py-1.5">{marketName[m.market]}</td>
                    <td className="num py-1.5 text-right">{m.n}</td>
                    <td className="num py-1.5 text-right">{m.won}–{m.n - m.won}</td>
                    <td className="num py-1.5 text-right">{pct(m.acc)}</td>
                    <td className="num py-1.5 text-right text-s-muted">{fx(m.brier)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-s-muted">{t('marketsNote')}</p>
          </div>

          <div>
            <SectionTitle title={t('secRoi')} />
            {[r.roi, r.roiOpening].filter((x): x is NonNullable<typeof x> => !!x).map((roi) => (
              <div key={roi.phase} className="mt-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-medium">{roi.phase === 'closing' ? t('roiClosing') : t('roiOpening')}</span>
                  <span className="text-xs text-s-muted">{t('roiWindow', { from: roi.from ? f.dateTime(new Date(roi.from), 'dayShort') : '–', to: roi.to ? f.dateTime(new Date(roi.to), 'dayShort') : '–' })}</span>
                </div>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  <dt className="text-s-muted">{t('bets')}</dt><dd className="num">{roi.bets} · {roi.won}–{roi.bets - roi.won}</dd>
                  <dt className="text-s-muted">{t('coverage')}</dt><dd className="num">{pct(roi.coverage, 0)} · {t('coverageNote', { bets: roi.bets, decided: r.quality.decided, missing: roi.missing })}</dd>
                  <dt className="text-s-muted">{t('staked')}</dt><dd className="num">{f.number(roi.staked, 'fixed2')}</dd>
                  <dt className="text-s-muted">{t('returned')}</dt><dd className="num">{f.number(roi.returned, 'fixed2')}</dd>
                  <dt className="text-s-muted">{t('profit')}</dt><dd className={`num font-medium ${roi.profit >= 0 ? 'text-s-win' : 'text-s-loss'}`}>{roi.profit >= 0 ? '+' : ''}{f.number(roi.profit, 'fixed2')} ({roi.roi >= 0 ? '+' : ''}{pct(roi.roi)})</dd>
                  <dt className="text-s-muted">{t('marketFav')}</dt><dd className="num">{pct(roi.marketAcc)} · {t('brier')} {fx(roi.marketBrier)}</dd>
                  <dt className="text-s-muted">{t('providers')}</dt><dd>{roi.providers.join(', ') || '–'}</dd>
                </dl>
              </div>
            ))}
            {!r.roi && !r.roiOpening && <p className="mt-2 text-sm text-s-muted">{t('roiNone')}</p>}
            <p className="mt-2 text-xs text-s-muted">{t('roiExplain')} {t('roiPhaseNote')}</p>
          </div>
        </section>
      </div>

      {/* Weekly progress — read from engine_weekly_metrics (Monday review), never recomputed here */}
      <section className="mt-12">
        <SectionTitle title={t('secWeekly')} meta={t('weeklyMeta')} />
        {w.weeks.length ? (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-s-line text-left">
                    <th className={th}>{t('week')}</th>
                    {(['1x2', 'ou25', 'btts'] as const).map((m) => (
                      <th key={m} className={`${th} text-right`} colSpan={3}>{marketName[m]}</th>
                    ))}
                  </tr>
                  <tr className="border-b border-s-line text-left">
                    <th className={th}></th>
                    {(['1x2', 'ou25', 'btts'] as const).map((m) => (
                      <React.Fragment key={m}>
                        <th className={`${th} text-right`}>{t('nShort')}</th>
                        <th className={`${th} text-right`}>{t('hitRate')}</th>
                        <th className={`${th} text-right`}>{t('logLoss')}</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {w.weeks.map((wk) => (
                    <tr key={wk} className="border-b border-s-line">
                      <td className="num py-1.5">{wk}</td>
                      {(['1x2', 'ou25', 'btts'] as const).map((m) => {
                        const row = w.rows.find((x) => x.week === wk && x.market === m);
                        return (
                          <React.Fragment key={m}>
                            <td className="num py-1.5 text-right">{row ? row.n : '–'}</td>
                            <td className={`num py-1.5 text-right ${row && row.n < 30 ? 'text-s-muted' : ''}`}>{row ? pct(row.accuracy) : '–'}</td>
                            <td className="num py-1.5 text-right text-s-muted">{row ? fx(row.logLoss) : '–'}</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-s-line font-medium">
                    <td className="py-1.5">{t('rolling', { weeks: w.weeks.length })}</td>
                    {(['1x2', 'ou25', 'btts'] as const).map((m) => {
                      const ro = w.rolling[m];
                      return (
                        <React.Fragment key={m}>
                          <td className="num py-1.5 text-right">{ro ? f.number(ro.n) : '–'}</td>
                          <td className="num py-1.5 text-right">{ro ? pct(ro.accuracy) : '–'}</td>
                          <td className="num py-1.5 text-right">{ro ? fx(ro.logLoss) : '–'}</td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-s-muted">
              {t('weeklyNote')}
              {w.benchmark && <> {t('weeklyBenchmark', { n: f.number(w.benchmark.n), model: pct(w.benchmark.model), market: pct(w.benchmark.market), roi: w.benchmark.roi == null ? '–' : `${w.benchmark.roi >= 0 ? '+' : ''}${pct(w.benchmark.roi)}` })}</>}
              {w.calibration && <> {t('weeklyCal', { raw: fx(w.calibration.raw, 4), cal: fx(w.calibration.cal, 4) })}</>}
            </p>
            {w.latest && w.latest.alerts.length > 0 && (
              <div className="mt-3 text-xs">
                <span className="font-medium text-s-ink">{t('weeklyAlerts')} ({w.latest.week}):</span>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-s-muted">
                  {w.latest.alerts.map((a) => <li key={a.code}>{a.message}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-s-muted">{t('weeklyEmpty')}</p>
        )}
      </section>

      <p className="rule-t mt-12 pt-4 text-xs text-s-muted">
        {t('footer', { at: f.dateTime(new Date(r.computedAt), 'kickoff') })} <Link href="/methodology" className="underline underline-offset-4">{t('footerLink')}</Link>
      </p>
    </Page>
  );
}
