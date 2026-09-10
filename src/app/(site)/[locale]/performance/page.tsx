import React from 'react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { getPerformance } from '@/lib/site/performance';
import { getWeeklyProgress } from '@/lib/site/weekly-progress';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { CalibrationChart, MonthlyChart } from '@/components/site/PerformanceCharts';

export const revalidate = 3600;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'performance' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/performance') };
}

const pct = (x: number | null, digits = 1) => (x == null ? '–' : `${(x * 100).toFixed(digits)}%`);
const fx = (x: number | null, d = 3) => (x == null ? '–' : x.toFixed(d));

/** Hit rate with the W–L record underneath; red below `loss`, green at 60%+ on a real sample. */
function MarketCell({ b, loss }: { b: { n: number; won: number; acc: number | null }; loss: number }) {
  const tone = b.acc == null || b.n < 10 ? '' : b.acc < loss ? 'text-s-loss' : b.acc >= 0.6 ? 'text-s-win' : '';
  return (
    <td className="num py-1.5 text-right">
      <span className={tone}>{pct(b.acc)}</span>
      <span className="ml-1.5 text-xs text-s-muted">{b.n ? `${b.won}–${b.n - b.won}` : ''}</span>
    </td>
  );
}

export default async function PerformancePage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('performance');
  const tc = await getTranslations('common');
  const tm = await getTranslations('match');
  const f = await getFormatter();
  const [r, w] = await Promise.all([getPerformance(null), getWeeklyProgress(12)]);

  const monthLabel = (ym: string) => f.dateTime(new Date(`${ym}-15T12:00:00Z`), 'month');
  const marketName = { '1x2': tc('market1x2'), ou25: tc('ou25'), btts: tc('btts') } as const;
  const th = 'py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted';

  if (!r.overall.n) {
    return (
      <Page>
        <PageTitle title={t('title')} lead={t('lead')} />
        <EmptyState title={t('emptyTitle')} lead={t('emptyLead')} />
      </Page>
    );
  }

  return (
    <Page>
      <PageTitle
        title={t('title')}
        lead={t('lead')}
        aside={<p className="text-xs text-s-muted">{t('window', { from: r.from ? f.dateTime(new Date(r.from), 'dayShort') : '–', to: r.to ? f.dateTime(new Date(r.to), 'dayShort') : '–' })}</p>}
      />

      {/* Headline numbers */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-s-line py-5 sm:grid-cols-4">
        <Stat label={t('settled')} value={f.number(r.overall.n)} note={t('settledNote')} />
        <Stat label={t('hitRate')} value={pct(r.overall.acc)} note={t('hitRateNote', { won: r.overall.won, n: r.overall.n })} />
        <Stat label={t('brier')} value={fx(r.overall.brier)} note={t('brierNote')} />
        <Stat label={`${t('roi')} · ${t('roiClosing')}`} value={r.roi ? `${r.roi.roi >= 0 ? '+' : ''}${pct(r.roi.roi)}` : '–'} note={r.roi ? `${t('roiNote', { bets: r.roi.bets })} · ${t('coverage')} ${pct(r.roi.coverage, 0)}` : t('roiNone')} tone={r.roi ? (r.roi.roi >= 0 ? 'win' : 'loss') : undefined} />
      </dl>
      <p className="mt-3 text-xs text-s-muted">
        {t('qualityNote', { decided: f.number(r.quality.decided), versions: r.quality.modelVersions.join(', ') || '–', recomputed: r.quality.recomputedCorrect })}
        {r.quality.truncated && <> {t('truncated')}</>}
        {' '}{t('brierScale')}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* Monthly trend */}
        <section>
          <SectionTitle title={t('secMonthly')} meta={t('monthlyMeta')} />
          <div className="mt-4">
            <MonthlyChart months={r.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} labels={{ acc: t('hitRate'), n: t('nShort') }} />
          </div>
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
          <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-s-line text-left">
                <th className={th}>{tc('league')}</th>
                <th className={`${th} text-right`}>{t('nShort')}</th>
                <th className={`${th} text-right`}>{tc('market1x2')}</th>
                <th className={`${th} text-right`}>{tc('ou25')}</th>
                <th className={`${th} text-right`}>{tc('btts')}</th>
                <th className={`${th} text-right`}>{t('brier')}</th>
              </tr>
            </thead>
            <tbody>
              {r.leagues.map((l) => (
                <tr key={l.league.slug} className="border-b border-s-line">
                  <td className="py-1.5"><Link href={`/leagues/${l.league.slug}`} className="hover:underline underline-offset-4">{l.league.name}</Link></td>
                  <td className="num py-1.5 text-right">{l.n}</td>
                  <MarketCell b={l} loss={0.45} />
                  <MarketCell b={l.ou25} loss={0.5} />
                  <MarketCell b={l.btts} loss={0.5} />
                  <td className="num py-1.5 text-right text-s-muted">{fx(l.brier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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

      <p className="mt-12 border-t border-s-line pt-4 text-xs text-s-muted">
        {t('footer', { at: f.dateTime(new Date(r.computedAt), 'kickoff') })} <Link href="/methodology" className="underline underline-offset-4">{t('footerLink')}</Link>
      </p>
    </Page>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'win' | 'loss' }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-s-muted">{label}</dt>
      <dd className={`num mt-1 font-head text-4xl leading-none ${tone === 'win' ? 'text-s-win' : tone === 'loss' ? 'text-s-loss' : ''}`}>{value}</dd>
      {note && <dd className="mt-1 text-xs text-s-muted">{note}</dd>}
    </div>
  );
}
