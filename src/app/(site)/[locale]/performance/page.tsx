import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { getPerformance } from '@/lib/site/performance';
import { Page, PageTitle, SectionTitle, EmptyState } from '@/components/site/ui';
import { CalibrationChart, MonthlyChart } from '@/components/site/PerformanceCharts';

export const revalidate = 3600;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'performance' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/performance') };
}

const pct = (x: number | null, digits = 1) => (x == null ? '–' : `${(x * 100).toFixed(digits)}%`);
const fx = (x: number | null, d = 3) => (x == null ? '–' : x.toFixed(d));

export default async function PerformancePage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('performance');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const r = await getPerformance(null);

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
        <Stat label={t('roi')} value={r.roi ? `${r.roi.roi >= 0 ? '+' : ''}${pct(r.roi.roi)}` : '–'} note={r.roi ? t('roiNote', { bets: r.roi.bets }) : t('roiNone')} tone={r.roi ? (r.roi.roi >= 0 ? 'win' : 'loss') : undefined} />
      </dl>

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
          <p className="mt-2 text-xs text-s-muted">{t('calibrationNote')}</p>
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
            <SectionTitle title={t('secRoi')} meta={r.roi ? t('roiWindow', { from: r.roi.from ? f.dateTime(new Date(r.roi.from), 'dayShort') : '–', to: r.roi.to ? f.dateTime(new Date(r.roi.to), 'dayShort') : '–' }) : undefined} />
            {r.roi ? (
              <>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  <dt className="text-s-muted">{t('bets')}</dt><dd className="num">{r.roi.bets} · {r.roi.won}–{r.roi.bets - r.roi.won}</dd>
                  <dt className="text-s-muted">{t('staked')}</dt><dd className="num">{f.number(r.roi.staked, 'fixed2')}</dd>
                  <dt className="text-s-muted">{t('returned')}</dt><dd className="num">{f.number(r.roi.returned, 'fixed2')}</dd>
                  <dt className="text-s-muted">{t('profit')}</dt><dd className={`num font-medium ${r.roi.profit >= 0 ? 'text-s-win' : 'text-s-loss'}`}>{r.roi.profit >= 0 ? '+' : ''}{f.number(r.roi.profit, 'fixed2')} ({r.roi.roi >= 0 ? '+' : ''}{pct(r.roi.roi)})</dd>
                  <dt className="text-s-muted">{t('marketFav')}</dt><dd className="num">{pct(r.roi.marketAcc)} · {t('brier')} {fx(r.roi.marketBrier)}</dd>
                </dl>
                <p className="mt-2 text-xs text-s-muted">{t('roiExplain')}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-s-muted">{t('roiNone')}</p>
            )}
          </div>
        </section>
      </div>

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
