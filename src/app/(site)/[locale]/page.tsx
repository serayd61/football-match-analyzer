import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Check, Lock } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { listPredictionsForDay, nextDayWithPredictions } from '@/lib/site/predictions';
import { listDayRows } from '@/lib/site/fixtures';
import { listResults } from '@/lib/site/results';
import { getPerformance } from '@/lib/site/performance';
import { valueRadar } from '@/lib/site/dashboard';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { todayYmd, addDays, zonedStartOfDay } from '@/lib/site/time';
import { Page, SectionTitle } from '@/components/site/ui';
import PredictionTable from '@/components/site/PredictionTable';
import ResultsTable from '@/components/site/ResultsTable';
import LocalTime from '@/components/site/LocalTime';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { LockedBlock } from '@/components/site/Paywall';

// Members-only site (2026-09-08): the landing is the only page a visitor sees.
// It shows the record and counts, never a fixture — tables render only for a
// live trial or a paid account. Reading the session makes it dynamic.
export const dynamic = 'force-dynamic';

// Landing (2026-09-07): the page has one job — turn a visitor into an
// account (7 free days), and a trial into the paid plan. Order: claim +
// record → today's predictions (locked for visitors) → value radar teaser
// (real count, selections locked) → plans → method/coverage.
// The closing-odds ROI and calibration stay public on /performance; the
// masthead shows per-market hit rates, which are what a first-time visitor
// can actually read.

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

// Legacy (unlocalized) routes: the account and billing flows still live in
// the old app shell, so these are plain anchors, not locale-aware Links.
const REGISTER_HREF = '/login?mode=register';
const PRICING_HREF = '/pricing';

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('home');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const count = SITE_LEAGUES.length;
  const access = await getSiteAccess();
  const unlocked = canSeeMatches(access);

  const today = todayYmd();
  const [todayRows, tomorrowRows, perf, latest] = await Promise.all([
    listDayRows(today),
    listDayRows(addDays(today, 1)),
    getPerformance(null),
    listResults({ league: null, from: null, to: null, page: 1, pageSize: 6 }),
  ]);
  let day = today;
  // Only fixtures that have not kicked off (feed live/finished state and settlement are separate now).
  let upcoming = todayRows.filter((r) => r.covered && r.status === 'scheduled');
  if (!upcoming.length) {
    const next = await nextDayWithPredictions(today, 1);
    if (next) { day = next; upcoming = (await listPredictionsForDay(next)).filter((r) => r.covered && r.status === 'scheduled'); }
  }
  upcoming = upcoming.slice(0, 10);

  // Paid-plan teaser: the same radar the dashboard shows, computed on covered
  // fixtures of today and tomorrow. Only the count is public; fixtures show to
  // members, the selection and the size of the gap only on the paid plan.
  const radar = await valueRadar([...todayRows, ...tomorrowRows].filter((r) => r.covered)).catch(() => []);

  const dayLabel = day === today ? tc('today') : day === addDays(today, 1) ? tc('tomorrow') : f.dateTime(zonedStartOfDay(day), 'dayLong');
  const lastMonth = perf.months[perf.months.length - 1] ?? null;
  const market = (k: '1x2' | 'ou25' | 'btts') => perf.markets.find((m) => m.market === k) ?? null;
  const btn = 'inline-flex h-10 items-center rounded-[2px] px-4 text-sm font-medium';
  const primary = `${btn} bg-s-brand text-s-brand-ink hover:opacity-90`;
  const secondary = `${btn} border border-s-line hover:border-s-muted`;

  return (
    <Page>
      {/* ── Masthead: claim on the left, the record on the right ─────── */}
      <div className="grid gap-8 border-b border-s-line py-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:py-12">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-s-muted">{t('eyebrow')}</p>
          <h1 className="mt-2 max-w-2xl text-4xl leading-[1.02] sm:text-5xl">{t('title')}</h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-s-muted">{t('lead', { count })}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {unlocked ? (
              <Link href="/predictions" className={primary}>{t('ctaPredictions')}</Link>
            ) : (
              <>
                <a href={REGISTER_HREF} className={primary}>{t('ctaPrimary')}</a>
                <a href="/login" className={secondary}>{t('ctaSignIn')}</a>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-s-muted">{t('plansNote')}</p>
        </div>

        <div className="border-t border-s-line pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl">{t('recordTitle')}</h2>
            <Link href="/performance" className="text-xs underline underline-offset-4">{t('recordLink')}</Link>
          </div>
          {perf.overall.n ? (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
                <Stat label={t('statSettled')} value={f.number(perf.overall.n)} note={t('recordWindow', { from: perf.from ? f.dateTime(new Date(perf.from), 'dayShort') : '–', to: perf.to ? f.dateTime(new Date(perf.to), 'dayShort') : '–' })} />
                {(['1x2', 'ou25', 'btts'] as const).map((k) => {
                  const m = market(k);
                  return (
                    <Stat
                      key={k}
                      label={k === '1x2' ? t('stat1x2') : k === 'ou25' ? t('statOu') : t('statBtts')}
                      value={m && m.n ? pct(m.acc) : '–'}
                      note={m && m.n ? t('statOf', { won: f.number(m.won), n: f.number(m.n) }) : undefined}
                    />
                  );
                })}
              </dl>
              <p className="mt-4 text-xs text-s-muted">
                {lastMonth && <>{t('recordLastMonth', { month: f.dateTime(new Date(`${lastMonth.month}-15T12:00:00Z`), 'month'), acc: pct(lastMonth.acc), n: lastMonth.n })} </>}
                {t('recordFoot')}
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
        {!unlocked ? (
          <LockedBlock count={upcoming.length} />
        ) : upcoming.length ? (
          <div className="mt-2"><PredictionTable rows={upcoming} /></div>
        ) : (
          <p className="mt-3 text-sm text-s-muted">{t('upcomingEmpty')}</p>
        )}
      </section>

      {/* ── Value radar teaser (paid) ───────────────────────────────── */}
      <section className="mt-12 border border-s-line bg-s-raised/40 p-5 sm:p-6" aria-labelledby="value-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="value-title" className="text-xl">{t('valueTitle')}</h2>
          <span className="text-xs text-s-muted">{t('valueMeta')}</span>
        </div>
        {radar.length ? (
          <>
            <p className="mt-2 text-[15px]">{t('valueFound', { n: radar.length })}</p>
            {unlocked && <ul className="mt-3 divide-y divide-s-line border-y border-s-line">
              {radar.slice(0, 3).map((v) => (
                <li key={v.fixtureId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{v.row.homeName} – {v.row.awayName}</span>
                    <span className="text-xs text-s-muted">{v.row.leagueName} · <LocalTime iso={v.row.kickoff} format="time" /></span>
                  </span>
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-[2px] border border-s-line px-2 text-xs text-s-muted">
                    <Lock size={12} aria-hidden /> {t('valueHidden')}
                  </span>
                </li>
              ))}
            </ul>}
          </>
        ) : (
          <p className="mt-2 text-sm text-s-muted">{t('valueEmpty')}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={PRICING_HREF} className={primary}>{t('valueCta')}</a>
          <span className="text-xs text-s-muted">{t('valueNote')}</span>
        </div>
      </section>

      {/* ── Latest results ──────────────────────────────────────────── */}
      <section className="mt-12">
        <SectionTitle title={t('latestTitle')} meta={<Link href="/results" className="underline underline-offset-4">{t('latestAll')}</Link>} />
        {!unlocked ? (
          <LockedBlock count={0} lead={t('latestLocked')} />
        ) : latest.rows.length ? (
          <div className="mt-2"><ResultsTable rows={latest.rows} /></div>
        ) : (
          <p className="mt-3 text-sm text-s-muted">{t('latestEmpty')}</p>
        )}
      </section>

      {/* ── Plans ───────────────────────────────────────────────────── */}
      <section className="mt-14 border-t border-s-line pt-10" aria-labelledby="plans-title">
        <h2 id="plans-title" className="text-2xl">{t('plansTitle')}</h2>
        <p className="mt-2 max-w-2xl text-s-muted">{t('plansLead')}</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Plan
            name={t('freeName')} price={t('freePrice')}
            items={[t('freeItems1', { count }), t('freeItems2'), t('freeItems3')]}
            cta={<a href={REGISTER_HREF} className={secondary}>{t('freeCta')}</a>}
          />
          <Plan
            name={t('proName')} price={t('proPrice')} badge={t('proBadge')} featured
            items={[t('proItems1'), t('proItems2'), t('proItems3'), t('proItems4')]}
            cta={<a href={PRICING_HREF} className={primary}>{t('proCta')}</a>}
          />
        </div>
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
          <h2 className="text-xl">{t('coverageTitle', { count })}</h2>
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

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-s-muted">{label}</dt>
      <dd className="num mt-0.5 font-head text-3xl leading-none">{value}</dd>
      {note && <dd className="mt-1 text-xs text-s-muted">{note}</dd>}
    </div>
  );
}

function Plan({ name, price, badge, items, cta, featured = false }: { name: string; price: string; badge?: string; items: string[]; cta: React.ReactNode; featured?: boolean }) {
  return (
    <div className={`flex flex-col border-t-2 pt-4 ${featured ? 'border-s-brand' : 'border-s-ink'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-head text-2xl">{name}</h3>
        <span className="num text-sm">{price}</span>
      </div>
      {badge && <p className="mt-1 text-xs text-s-muted">{badge}</p>}
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-s-win" aria-hidden />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">{cta}</div>
    </div>
  );
}
