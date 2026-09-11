import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { listPredictionsForDay, nextDayWithPredictions, type SitePrediction } from '@/lib/site/predictions';
import { listDayRows } from '@/lib/site/fixtures';
import { listResults } from '@/lib/site/results';
import { getPerformance } from '@/lib/site/performance';
import { SITE_LEAGUES } from '@/lib/site/leagues';
import { todayYmd, addDays, zonedStartOfDay } from '@/lib/site/time';
import { riskOf, lossRate } from '@/lib/site/risk';
import { Page } from '@/components/site/ui';
import ProbBar from '@/components/site/ProbBar';
import ConfidenceRing from '@/components/site/ConfidenceRing';
import { RiskLabel, RiskNote } from '@/components/site/Risk';
import { StatRow, StatCell } from '@/components/site/StatCell';
import LocalTime from '@/components/site/LocalTime';
import { getSiteAccess, canSeeMatches } from '@/lib/site/access';
import { LockedBlock, REGISTER_HREF, SIGNIN_HREF } from '@/components/site/Paywall';

// Members-only site (2026-09-08): the landing shows the record and counts; a
// fixture renders only for a live trial or a paid account. Reading the
// session makes it dynamic.
export const dynamic = 'force-dynamic';

// Home (Modernist redesign 2026-09-11). Two-column hero: claim + record on the
// left, "Pick of the day" on the right (confidence ring, 1X2 bar, risk note).
// Then "Recent winners" cards and three "why" cells. All numbers are live:
// the record comes from the settled table, the pick is today's highest
// calibrated confidence.

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'home' });
  const tm = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { absolute: `${t('metaTitle', { count: SITE_LEAGUES.length })} · ${tm('siteName')}` },
    description: t('metaDescription', { count: SITE_LEAGUES.length }),
    alternates: alternatesFor(locale as Locale, ''),
  };
}

const pct = (x: number | null | undefined, d = 1) => (x == null ? '–' : `${(x * 100).toFixed(d)}%`);
const fairOdds = (p: number) => (p > 0 ? (1 / p).toFixed(2) : '–');
const pickProb = (p: SitePrediction) => (p.pick === '1' ? p.pHome : p.pick === '2' ? p.pAway : p.pick === 'X' ? p.pDraw : 0);

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('v2.home');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const count = SITE_LEAGUES.length;
  const access = await getSiteAccess();
  const unlocked = canSeeMatches(access);

  const today = todayYmd();
  const [todayRows, perf, latest] = await Promise.all([
    listDayRows(today),
    getPerformance(null),
    listResults({ league: null, from: null, to: null, page: 1, pageSize: 24 }),
  ]);
  let day = today;
  let upcoming = todayRows.filter((r) => r.covered && r.status === 'scheduled');
  if (!upcoming.length) {
    const next = await nextDayWithPredictions(today, 1);
    if (next) { day = next; upcoming = (await listPredictionsForDay(next)).filter((r) => r.covered && r.status === 'scheduled'); }
  }
  const rated = upcoming.filter((r) => r.hasModel && r.pick);
  const pod = [...rated].sort((a, b) => (b.confidence ?? b.confidenceRaw ?? 0) - (a.confidence ?? a.confidenceRaw ?? 0))[0] ?? null;
  const winners = latest.rows.filter((r) => r.outcome === 'won').slice(0, 3);

  const dayLabel = day === today ? tc('today') : day === addDays(today, 1) ? tc('tomorrow') : f.dateTime(zonedStartOfDay(day), 'dayLong');
  const kicker = rated.length && day === today ? t('kickerLive', { count: rated.length }) : rated.length ? t('kickerNext', { day: dayLabel }) : t('kickerIdle');

  const conf = pod ? (pod.confidence ?? pod.confidenceRaw) : null;
  const confPct = conf == null ? null : Math.round(conf * 100);
  const pickName = (p: SitePrediction) => (p.pick === '1' ? t('pickWin', { team: p.homeName }) : p.pick === '2' ? t('pickWin', { team: p.awayName }) : t('pickDraw'));
  const labels = { home: tc('home'), draw: tc('draw'), away: tc('away') };

  return (
    <Page>
      {/* ── Hero: 1fr 1fr, 2px vertical rule between ───────────────── */}
      <div className="rule-b grid lg:grid-cols-2">
        <div className="flex flex-col gap-6 py-8 lg:rule-r lg:pr-6">
          <p className="kicker !text-s-accent">{kicker}</p>
          <h1 className="max-w-[12ch] text-[clamp(40px,5.5vw,72px)]" style={{ textWrap: 'pretty' } as React.CSSProperties}>{t('title')}</h1>
          <p className="max-w-[520px] text-[17px] text-s-muted" style={{ textWrap: 'pretty' } as React.CSSProperties}>{t('lead', { count })}</p>
          <div className="flex flex-wrap gap-2">
            {unlocked ? (
              <Link href="/predictions" className="btn btn-primary">{t('ctaPredictions')}</Link>
            ) : (
              <Link href={REGISTER_HREF} className="btn btn-primary">{t('ctaStart')}</Link>
            )}
            <Link href="/performance" className="btn btn-secondary">{t('ctaRecord')}</Link>
            {!unlocked && <Link href={SIGNIN_HREF} className="btn btn-secondary">{t('ctaSignIn')}</Link>}
          </div>
          <StatRow cols={3} className="mt-2">
            <StatCell first label={t('statHit')} value={perf.overall.n ? pct(perf.overall.acc) : '–'} />
            <StatCell label={perf.roi ? t('statRoi') : t('statRoiNone')} value={perf.roi ? `${perf.roi.roi >= 0 ? '+' : ''}${pct(perf.roi.roi)}` : '–'} />
            <StatCell label={t('statSettled')} value={perf.overall.n ? f.number(perf.overall.n) : '–'} />
          </StatRow>
        </div>

        {/* Pick of the day */}
        <div className="rule-t flex flex-col gap-4 py-8 lg:rule-t-0 lg:pl-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="kicker">{unlocked ? t('pickOfDay') : t('pickOfDayLocked')}</p>
            {pod && <span className="text-[12px] text-s-muted">{pod.leagueName} · <LocalTime iso={pod.kickoff} format="time" /></span>}
          </div>

          {!pod ? (
            <p className="text-[15px] text-s-muted">{t('noPick')}</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <h2 className={`text-[30px] leading-[1] sm:text-[36px] ${unlocked ? '' : 'blur-locked'}`} aria-hidden={!unlocked}>
                  {unlocked ? pod.homeName : '████████'}<br />
                  <span className="text-s-muted">{t('vs')}</span> {unlocked ? pod.awayName : '███████'}
                </h2>
                <ConfidenceRing conf={conf} size={104} label={t('confidence')} />
              </div>
              <ProbBar home={pod.pHome} draw={pod.pDraw} away={pod.pAway} highlight={pod.pick} labels={labels} size="md" />
              {unlocked ? (
                <>
                  <StatRow cols={3} rule={1}>
                    <div className="flex flex-col gap-1 py-2 pr-3">
                      <dt className="text-[11px] text-s-muted">{t('pick')}</dt>
                      <dd className="text-[15px] font-semibold leading-tight">{pickName(pod)}</dd>
                    </div>
                    <div className="rule-l-1 flex flex-col gap-1 px-3 py-2">
                      <dt className="text-[11px] text-s-muted">{t('fairOdds')}</dt>
                      <dd className="num text-[15px] font-semibold leading-tight">{fairOdds(pickProb(pod))}</dd>
                    </div>
                    <div className="rule-l-1 flex flex-col gap-1 px-3 py-2">
                      <dt className="text-[11px] text-s-muted">{t('risk')}</dt>
                      <dd className="text-[15px] font-semibold leading-tight"><RiskLabel risk={riskOf(conf)} className="!text-[15px]" /></dd>
                    </div>
                  </StatRow>
                  {confPct != null && <RiskNote>{t('riskNote', { conf: confPct, loss: lossRate(conf) })}</RiskNote>}
                  <Link href={`/predictions/${pod.fixtureId}`} className="text-[13px] font-semibold text-s-accent hover:text-s-accent-600">{t('ctaPredictions')}</Link>
                </>
              ) : (
                <>
                  <RiskNote>{t('riskNoteLocked')}</RiskNote>
                  <LockedBlock count={rated.length} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Recent winners ─────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="rule-b flex flex-wrap items-end justify-between gap-3 pb-3">
          <div>
            <h2 className="text-[30px]">{t('winnersTitle')}</h2>
            <p className="mt-1 text-[14px] text-s-muted">{t('winnersSub')}</p>
          </div>
          <Link href="/performance" className="text-[13px] font-semibold hover:text-s-accent-600">{t('winnersLink')}</Link>
        </div>
        {!unlocked ? (
          <LockedBlock count={latest.total} />
        ) : winners.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {winners.map((w) => (
              <Link key={w.fixtureId} href={`/predictions/${w.fixtureId}`} className="card card-top">
                <div className="flex items-center justify-between gap-2">
                  <span className="kicker">{w.leagueName}</span>
                  <span className="tag">{tc('won')}</span>
                </div>
                <h3 className="text-[20px] leading-[1.05]">{w.homeName} {w.homeScore}–{w.awayScore} {w.awayName}</h3>
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-semibold">{pickName(w)}</span>
                  <span className="num text-s-muted">{pct(w.confidence, 0)} · {t('atOdds', { odds: fairOdds(pickProb(w)) })}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-s-muted">{t('winnersEmpty')}</p>
        )}
      </section>

      {/* ── Why: 3 equal cells with 1px rules ──────────────────────── */}
      <section className="rule-t mt-8 grid sm:grid-cols-3">
        {(['1', '2', '3'] as const).map((n, i) => (
          <div key={n} className={`py-6 ${i === 0 ? 'sm:pr-6' : 'sm:rule-l-1 sm:px-6'} ${i > 0 ? 'rule-t-1 sm:border-t-0' : ''}`}>
            <h4 className="text-[20px]">{t(`why${n}Title`)}</h4>
            <p className="mt-2 text-[14px] text-s-muted">{t(`why${n}Text`)}</p>
          </div>
        ))}
      </section>
    </Page>
  );
}
