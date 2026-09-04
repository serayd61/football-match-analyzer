import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { listPredictionsForDay, nextDayWithPredictions } from '@/lib/site/predictions';
import { listResults } from '@/lib/site/results';
import { getPerformance } from '@/lib/site/performance';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { todayYmd, addDays, zonedStartOfDay } from '@/lib/site/time';
import { Page, SectionTitle } from '@/components/site/ui';
import PredictionTable from '@/components/site/PredictionTable';
import ResultsTable from '@/components/site/ResultsTable';

export const revalidate = 900;

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'home' });
  const tm = await getTranslations({ locale, namespace: 'meta' });
  // A layout's title.template only applies to child segments, so the index
  // page at the same level spells its own absolute title.
  return {
    title: { absolute: `${t('metaTitle', { count: SITE_LEAGUES.length })} · ${tm('siteName')}` },
    description: t('metaDescription', { count: SITE_LEAGUES.length }),
    alternates: alternatesFor(locale as Locale, ''),
  };
}

const pct = (x: number | null, d = 1) => (x == null ? '–' : `${(x * 100).toFixed(d)}%`);

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('home');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  const today = todayYmd();
  const [todayRows, perf, latest] = await Promise.all([
    listPredictionsForDay(today),
    getPerformance(null),
    listResults({ league: null, from: null, to: null, page: 1, pageSize: 6 }),
  ]);
  let day = today;
  let upcoming = todayRows.filter((r) => r.covered && !r.settled);
  if (!upcoming.length) {
    const next = await nextDayWithPredictions(today, 1);
    if (next) { day = next; upcoming = (await listPredictionsForDay(next)).filter((r) => r.covered); }
  }
  upcoming = upcoming.slice(0, 10);

  const dayLabel = day === today ? tc('today') : day === addDays(today, 1) ? tc('tomorrow') : f.dateTime(zonedStartOfDay(day), 'dayLong');
  const lastMonth = perf.months[perf.months.length - 1] ?? null;
  const btn = 'inline-flex h-10 items-center rounded-[2px] px-4 text-sm font-medium';

  return (
    <Page>
      {/* ── Masthead: claim on the left, the record on the right ─────── */}
      <div className="grid gap-8 border-b border-s-line py-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:py-12">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-s-muted">{t('eyebrow')}</p>
          <h1 className="mt-2 max-w-2xl text-4xl leading-[1.02] sm:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-s-muted">{t('lead', { count: SITE_LEAGUES.length })}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/predictions" className={`${btn} bg-s-brand text-s-brand-ink hover:opacity-90`}>{t('ctaPredictions')}</Link>
            <Link href="/methodology" className={`${btn} border border-s-line hover:border-s-muted`}>{t('ctaMethod')}</Link>
          </div>
        </div>

        <div className="border-t border-s-line pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">{t('recordTitle')}</h2>
            <Link href="/performance" className="text-xs underline underline-offset-4">{t('recordLink')}</Link>
          </div>
          {perf.overall.n ? (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
                <Stat label={t('statSettled')} value={f.number(perf.overall.n)} />
                <Stat label={t('statHit')} value={pct(perf.overall.acc)} note={t('statHitNote', { won: perf.overall.won, n: perf.overall.n })} />
                <Stat label={t('statBrier')} value={perf.overall.brier == null ? '–' : perf.overall.brier.toFixed(3)} note={t('statBrierNote')} />
                <Stat label={t('statRoi')} value={perf.roi ? `${perf.roi.roi >= 0 ? '+' : ''}${pct(perf.roi.roi)}` : '–'} note={perf.roi ? t('statRoiNote', { bets: perf.roi.bets }) : t('statRoiNone')} tone={perf.roi ? (perf.roi.roi >= 0 ? 'win' : 'loss') : undefined} />
              </dl>
              <p className="mt-4 text-xs text-s-muted">
                {t('recordWindow', { from: perf.from ? f.dateTime(new Date(perf.from), 'dayShort') : '–', to: perf.to ? f.dateTime(new Date(perf.to), 'dayShort') : '–' })}
                {lastMonth && <> · {t('recordLastMonth', { month: f.dateTime(new Date(`${lastMonth.month}-15T12:00:00Z`), 'month'), acc: pct(lastMonth.acc), n: lastMonth.n })}</>}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-s-muted">{t('recordEmpty')}</p>
          )}
        </div>
      </div>

      {/* ── Upcoming ────────────────────────────────────────────────── */}
      <section className="mt-10">
        <SectionTitle title={t('upcomingTitle', { day: dayLabel })} meta={<Link href={day === today ? '/predictions' : `/predictions?date=${day}`} className="underline underline-offset-4">{t('upcomingAll')}</Link>} />
        {upcoming.length ? (
          <div className="mt-2"><PredictionTable rows={upcoming} /></div>
        ) : (
          <p className="mt-3 text-sm text-s-muted">{t('upcomingEmpty')}</p>
        )}
      </section>

      {/* ── Latest results ──────────────────────────────────────────── */}
      <section className="mt-12">
        <SectionTitle title={t('latestTitle')} meta={<Link href="/results" className="underline underline-offset-4">{t('latestAll')}</Link>} />
        {latest.rows.length ? (
          <div className="mt-2"><ResultsTable rows={latest.rows} /></div>
        ) : (
          <p className="mt-3 text-sm text-s-muted">{t('latestEmpty')}</p>
        )}
      </section>

      {/* ── How it works + coverage ─────────────────────────────────── */}
      <div className="mt-14 grid gap-10 border-t border-s-line pt-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="text-xl">{t('howTitle')}</h2>
          <ol className="mt-4 grid gap-6 sm:grid-cols-3">
            {(['1', '2', '3'] as const).map((n) => (
              <li key={n} className="border-t-2 border-s-ink pt-3">
                <span className="num font-head text-2xl">{n}</span>
                <h3 className="mt-1 font-body text-sm font-semibold">{t(`how${n}Title`)}</h3>
                <p className="mt-1 text-sm text-s-muted">{t(`how${n}Text`)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm">
            <Link href="/methodology" className="underline underline-offset-4">{t('howLink')}</Link>
          </p>
        </section>

        <section>
          <h2 className="text-xl">{t('coverageTitle', { count: SITE_LEAGUES.length })}</h2>
          <ul className="mt-4 columns-2 text-sm leading-7">
            {SITE_LEAGUES.map((l) => (
              <li key={l.slug}>
                <Link href={`/leagues/${l.slug}`} className="hover:underline underline-offset-4">{l.name}</Link>
                <span className="text-s-muted"> · {l.country}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-s-muted">{t('coverageNote')}</p>
        </section>
      </div>

      <p className="mt-12 border-t border-s-line pt-4 text-xs text-s-muted">{t('disclaimer')}</p>
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
