import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { nextDayWithPredictions } from '@/lib/site/predictions';
import { listDay } from '@/lib/site/fixtures';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { todayYmd, addDays, YMD_RE, zonedStartOfDay } from '@/lib/site/time';
import { Page, EmptyState } from '@/components/site/ui';
import PredictionCard from '@/components/site/PredictionCard';
import { RiskNote } from '@/components/site/Risk';
import { requireSiteAccess } from '@/lib/site/access';
import { Paywall, TrialNotice } from '@/components/site/Paywall';

// Members-only (2026-09-08): session read → dynamic; shared data stays cached in the lib layer.
export const dynamic = 'force-dynamic';

// Predictions (Modernist redesign 2026-09-11). Header row with the day and
// the model's update time, league filter buttons (state in the URL), a
// toggleable "How to read confidence" note, then a 3-column grid of cards.
// The date strip and the covered/all switch survive as small links.

type Search = { date?: string; league?: string; scope?: string; note?: string };

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'predictions' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/predictions') };
}

export default async function PredictionsPage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  const access = await requireSiteAccess(locale, '/predictions');
  const t = await getTranslations('v2.predictions');
  const tp = await getTranslations('predictions');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  if (access.state === 'expired') {
    return (
      <Page>
        <div className="rule-b pb-4 pt-8"><h1 className="text-[40px]">{t('title')}</h1></div>
        <Paywall />
      </Page>
    );
  }

  const today = todayYmd();
  const date = searchParams.date && YMD_RE.test(searchParams.date) ? searchParams.date : today;
  const league = searchParams.league ? leagueBySlug(searchParams.league) : null;
  const scope = searchParams.scope === 'all' ? 'all' : 'covered';
  const showNote = searchParams.note !== '0';

  const day = await listDay(date);
  const all = day.rows;
  const scoped = scope === 'all' ? all : all.filter((r) => r.covered);
  const rows = league ? scoped.filter((r) => r.league?.slug === league.slug) : scoped;
  const uncoveredCount = all.filter((r) => !r.covered).length;

  const dayLabel = (ymd: string) =>
    ymd === today ? tc('today') : ymd === addDays(today, 1) ? tc('tomorrow') : ymd === addDays(today, -1) ? tc('yesterday')
    : f.dateTime(zonedStartOfDay(ymd), { weekday: 'short', day: 'numeric', month: 'short' });

  const href = (over: Partial<Search>) => {
    const qs = new URLSearchParams();
    const m = { date, league: league?.slug, scope, note: showNote ? undefined : '0', ...over };
    if (m.date && m.date !== today) qs.set('date', m.date);
    if (m.league) qs.set('league', m.league);
    if (m.scope === 'all') qs.set('scope', 'all');
    if (m.note === '0') qs.set('note', '0');
    const s = qs.toString();
    return `/predictions${s ? `?${s}` : ''}`;
  };

  const nextDay = scoped.length === 0 ? await nextDayWithPredictions(date, 1) : null;
  const leaguesToday = SITE_LEAGUES.filter((l) => scoped.some((r) => r.league?.slug === l.slug));
  const updated = day.feed === 'ok' ? f.dateTime(new Date(day.fetchedAt), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : null;
  const fullDay = f.dateTime(zonedStartOfDay(date), { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Page>
      {/* Header row */}
      <div className="rule-b flex flex-wrap items-end justify-between gap-4 pb-4 pt-8">
        <div>
          <h1 className="text-[32px] sm:text-[40px]">{date === today ? t('title') : t('titleDay', { day: dayLabel(date) })}</h1>
          <p className="mt-2 text-[14px] text-s-muted">
            {updated ? t('meta', { day: fullDay, matches: rows.length, time: updated }) : t('metaNoFeed', { day: fullDay, matches: rows.length })}
          </p>
        </div>
        <nav aria-label={tc('league')} className="flex flex-wrap gap-1">
          <Link href={href({ league: undefined })} className={`btn btn-sm ${!league ? 'btn-primary' : 'btn-secondary'}`} aria-current={!league ? 'true' : undefined}>{t('all')}</Link>
          {(leaguesToday.length ? leaguesToday : SITE_LEAGUES).map((l) => (
            <Link key={l.slug} href={href({ league: l.slug })} className={`btn btn-sm ${league?.slug === l.slug ? 'btn-primary' : 'btn-secondary'}`} aria-current={league?.slug === l.slug ? 'true' : undefined}>{l.name}</Link>
          ))}
        </nav>
      </div>

      {/* Day strip + scope */}
      <div className="rule-b-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 text-[13px]">
        <span className="flex gap-4">
          <Link href={href({ date: addDays(date, -1) })} className="font-semibold hover:text-s-accent-600">{t('dayPrev')}</Link>
          <Link href={href({ date: addDays(date, 1) })} className="font-semibold hover:text-s-accent-600">{t('dayNext')}</Link>
        </span>
        <span className="flex gap-4 text-s-muted">
          {uncoveredCount > 0 && (
            <Link href={href({ scope: scope === 'all' ? 'covered' : 'all' })} className="hover:text-s-ink">
              {scope === 'all' ? t('hideUncovered') : t('showUncovered', { count: uncoveredCount })}
            </Link>
          )}
          <Link href={href({ note: showNote ? '0' : undefined })} className="hover:text-s-ink">{showNote ? t('hide') : t('show')}</Link>
        </span>
      </div>

      {showNote && (
        <RiskNote className="mt-4 max-w-[760px]">
          <strong>{t('howTitle')}</strong> {t('howText')}
        </RiskNote>
      )}

      <div className="mt-4"><TrialNotice access={access} /></div>

      {day.feed === 'error' && (
        <p role="status" className="risk-note mb-3">{tp('feedError')}</p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          lead={nextDay ? t('emptyNext', { date: dayLabel(nextDay) }) : tp('emptyLead')}
          action={nextDay ? <Link href={href({ date: nextDay })} className="btn btn-primary">{t('goToNext', { date: dayLabel(nextDay) })}</Link> : (league ? <Link href={href({ league: undefined })} className="btn btn-secondary">{t('all')}</Link> : undefined)}
        />
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => <PredictionCard key={p.fixtureId} p={p} />)}
          </div>
          <p className="mt-6 text-[12px] text-s-muted">{t('footnote')}</p>
        </>
      )}
    </Page>
  );
}
