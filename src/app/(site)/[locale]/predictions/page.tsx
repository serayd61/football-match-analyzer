import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { nextDayWithPredictions } from '@/lib/site/predictions';
import { listDayRows } from '@/lib/site/fixtures';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { todayYmd, addDays, YMD_RE, zonedStartOfDay } from '@/lib/site/time';
import { Page, PageTitle, EmptyState } from '@/components/site/ui';
import PredictionTable from '@/components/site/PredictionTable';

export const revalidate = 900;

type Search = { date?: string; league?: string; scope?: string };

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'predictions' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/predictions') };
}

export default async function PredictionsPage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('predictions');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  const today = todayYmd();
  const date = searchParams.date && YMD_RE.test(searchParams.date) ? searchParams.date : today;
  const league = searchParams.league ? leagueBySlug(searchParams.league) : null;
  const scope = searchParams.scope === 'all' ? 'all' : 'covered';

  const all = await listDayRows(date);
  let rows = scope === 'all' ? all : all.filter((r) => r.covered);
  if (league) rows = rows.filter((r) => r.league?.slug === league.slug);
  const uncoveredCount = all.filter((r) => !r.covered).length;
  const pendingCount = rows.filter((r) => !r.hasModel).length;

  const dayLabel = (ymd: string) =>
    ymd === today ? tc('today') : ymd === addDays(today, 1) ? tc('tomorrow') : ymd === addDays(today, -1) ? tc('yesterday')
    : f.dateTime(zonedStartOfDay(ymd), { weekday: 'short', day: 'numeric', month: 'short' });

  const href = (over: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged = { date, league: league?.slug, scope, ...over };
    if (merged.date && merged.date !== today) q.set('date', merged.date);
    if (merged.league) q.set('league', merged.league);
    if (merged.scope === 'all') q.set('scope', 'all');
    const s = q.toString();
    return `/predictions${s ? `?${s}` : ''}`;
  };

  const days = [-1, 0, 1, 2, 3, 4, 5].map((n) => addDays(today, n));
  if (!days.includes(date)) { days.push(date); days.sort(); }

  const nextDay = rows.length === 0 ? await nextDayWithPredictions(date, 1) : null;

  return (
    <Page>
      <PageTitle
        title={t('title')}
        lead={t('lead')}
        aside={
          <p className="text-xs text-s-muted">
            {t('coverage', { count: SITE_LEAGUES.length })}{' '}
            <Link href="/methodology" className="underline underline-offset-4">{t('coverageLink')}</Link>
          </p>
        }
      />

      {/* Date strip */}
      <nav aria-label={tc('date')} className="tbl-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1 border-b border-s-line pb-2">
          {days.map((d) => (
            <li key={d}>
              <Link
                href={href({ date: d })}
                aria-current={d === date ? 'true' : undefined}
                className="tab-pill inline-flex h-8 items-center whitespace-nowrap rounded-[2px] border border-s-line px-3 text-sm hover:border-s-muted"
              >
                {dayLabel(d)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* League filter */}
      <nav aria-label={tc('league')} className="tbl-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
        <ul className="flex flex-wrap gap-1 py-3 text-sm">
          <li>
            <Link href={href({ league: undefined })} aria-current={!league ? 'true' : undefined} className="tab-pill inline-flex h-7 items-center rounded-[2px] border border-transparent px-2 text-s-muted hover:text-s-ink">
              {tc('all')}
            </Link>
          </li>
          {SITE_LEAGUES.map((l) => (
            <li key={l.slug}>
              <Link href={href({ league: l.slug })} aria-current={league?.slug === l.slug ? 'true' : undefined} className="tab-pill inline-flex h-7 items-center rounded-[2px] border border-transparent px-2 text-s-muted hover:text-s-ink">
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-s-muted">
        <span>
          <span className="font-medium text-s-ink">{dayLabel(date)}</span> · {tc('matches', { count: rows.length })}
        </span>
        {uncoveredCount > 0 && (
          <Link href={href({ scope: scope === 'all' ? 'covered' : 'all' })} className="underline underline-offset-4">
            {scope === 'all' ? t('hideUncovered') : t('showUncovered', { count: uncoveredCount })}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          lead={nextDay ? t('emptyNext', { date: dayLabel(nextDay) }) : t('emptyLead')}
          action={nextDay ? (
            <Link href={href({ date: nextDay })} className="inline-flex h-9 items-center rounded-[2px] bg-s-brand px-3 text-sm font-medium text-s-brand-ink">
              {t('goToNext')}
            </Link>
          ) : undefined}
        />
      ) : (
        <>
          <PredictionTable rows={rows} showOutcome={date < today} />
          <p className="mt-6 text-xs text-s-muted">
            {pendingCount > 0 && <>{t('pendingNote', { count: pendingCount })} </>}
            {t('footnote')}
          </p>
        </>
      )}
    </Page>
  );
}
