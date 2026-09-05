import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { nextDayWithPredictions } from '@/lib/site/predictions';
import { applyFilters, STATUS_FILTERS, type StatusFilter, type Sort } from '@/lib/site/filters';
import { listDay } from '@/lib/site/fixtures';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { todayYmd, addDays, YMD_RE, zonedStartOfDay } from '@/lib/site/time';
import { Page, PageTitle, EmptyState } from '@/components/site/ui';
import PredictionTable from '@/components/site/PredictionTable';

export const revalidate = 900;

type Search = { date?: string; league?: string; scope?: string; q?: string; status?: string; ready?: string; sort?: string };

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
  const q = (searchParams.q || '').slice(0, 60);
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(searchParams.status || '') ? (searchParams.status as StatusFilter) : 'all';
  const ready = searchParams.ready === '1';
  const sort: Sort = searchParams.sort === 'confidence' ? 'confidence' : 'time';
  const filtersActive = !!q || status !== 'all' || ready || sort !== 'time' || !!league;

  const day = await listDay(date);
  const all = day.rows;
  const scoped = scope === 'all' ? all : all.filter((r) => r.covered);
  const rows = applyFilters(scoped, { q, status, ready, league: league?.slug ?? null, sort });
  const uncoveredCount = all.filter((r) => !r.covered).length;
  const pendingCount = rows.filter((r) => !r.hasModel).length;

  const dayLabel = (ymd: string) =>
    ymd === today ? tc('today') : ymd === addDays(today, 1) ? tc('tomorrow') : ymd === addDays(today, -1) ? tc('yesterday')
    : f.dateTime(zonedStartOfDay(ymd), { weekday: 'short', day: 'numeric', month: 'short' });

  const current = { date, league: league?.slug, scope, q, status, ready: ready ? '1' : undefined, sort };
  const href = (over: Partial<Record<keyof Search, string | undefined>>) => {
    const qs = new URLSearchParams();
    const m = { ...current, ...over };
    if (m.date && m.date !== today) qs.set('date', m.date);
    if (m.league) qs.set('league', m.league);
    if (m.scope === 'all') qs.set('scope', 'all');
    if (m.q) qs.set('q', m.q);
    if (m.status && m.status !== 'all') qs.set('status', m.status);
    if (m.ready === '1') qs.set('ready', '1');
    if (m.sort && m.sort !== 'time') qs.set('sort', m.sort);
    const s = qs.toString();
    return `/predictions${s ? `?${s}` : ''}`;
  };

  const days = [-1, 0, 1, 2, 3, 4, 5].map((n) => addDays(today, n));
  if (!days.includes(date)) { days.push(date); days.sort(); }

  const nextDay = scoped.length === 0 ? await nextDayWithPredictions(date, 1) : null;
  const pill = 'tab-pill inline-flex h-7 items-center rounded-[2px] border border-transparent px-2 text-s-muted hover:text-s-ink';

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
            <Link href={href({ league: undefined })} aria-current={!league ? 'true' : undefined} className={pill}>{tc('all')}</Link>
          </li>
          {SITE_LEAGUES.map((l) => (
            <li key={l.slug}>
              <Link href={href({ league: l.slug })} aria-current={league?.slug === l.slug ? 'true' : undefined} className={pill}>{l.name}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Search · status · rated-only · sort — plain GET form, state lives in the URL. */}
      <form action={`/${locale}/predictions`} method="get" role="search" className="flex flex-wrap items-end gap-x-4 gap-y-2 border-y border-s-line py-3 text-sm">
        {date !== today && <input type="hidden" name="date" value={date} />}
        {league && <input type="hidden" name="league" value={league.slug} />}
        {scope === 'all' && <input type="hidden" name="scope" value="all" />}
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-s-muted">{t('searchLabel')}</span>
          <input type="search" name="q" defaultValue={q} placeholder={t('searchPlaceholder')} maxLength={60} autoComplete="off"
            className="h-9 w-48 rounded-[2px] border border-s-line bg-s-surface px-2 text-s-ink placeholder:text-s-muted focus:border-s-muted" />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs uppercase tracking-wider text-s-muted">{tc('status')}</legend>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <label key={s} className={`inline-flex h-9 cursor-pointer items-center rounded-[2px] border px-2 has-[:checked]:border-s-brand has-[:checked]:bg-s-brand has-[:checked]:text-s-brand-ink ${s === status ? 'border-s-brand' : 'border-s-line'}`}>
                <input type="radio" name="status" value={s} defaultChecked={s === status} className="sr-only" />
                {t(s === 'all' ? 'statusAll' : s === 'upcoming' ? 'statusUpcoming' : s === 'live' ? 'statusLive' : 'statusFinished')}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="inline-flex h-9 items-center gap-2">
          <input type="checkbox" name="ready" value="1" defaultChecked={ready} className="h-4 w-4 accent-[rgb(var(--s-brand))]" />
          {t('readyOnly')}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-s-muted">{tc('sort')}</span>
          <select name="sort" defaultValue={sort} className="h-9 rounded-[2px] border border-s-line bg-s-surface px-2 text-s-ink">
            <option value="time">{t('sortTime')}</option>
            <option value="confidence">{t('sortConfidence')}</option>
          </select>
        </label>
        <button type="submit" className="inline-flex h-9 items-center rounded-[2px] bg-s-brand px-3 font-medium text-s-brand-ink hover:opacity-90">{tc('search')}</button>
        {filtersActive && (
          <Link href={href({ q: undefined, status: undefined, ready: undefined, sort: undefined, league: undefined })} className="inline-flex h-9 items-center underline underline-offset-4">{t('clearFilters')}</Link>
        )}
      </form>

      <div className="my-3 flex flex-wrap items-center justify-between gap-2 text-sm text-s-muted">
        <span>
          <span className="font-medium text-s-ink">{dayLabel(date)}</span> · {tc('matches', { count: rows.length })}
          {day.feed === 'ok' && <> · <span className="text-xs">{t('feedStale', { time: f.dateTime(new Date(day.fetchedAt), { hour: '2-digit', minute: '2-digit' }) })}</span></>}
        </span>
        {uncoveredCount > 0 && (
          <Link href={href({ scope: scope === 'all' ? 'covered' : 'all' })} className="underline underline-offset-4">
            {scope === 'all' ? t('hideUncovered') : t('showUncovered', { count: uncoveredCount })}
          </Link>
        )}
      </div>

      {day.feed === 'error' && (
        <p role="status" className="mb-3 rounded-[2px] border border-s-loss/40 bg-s-loss/10 px-3 py-2 text-sm">{t('feedError')}</p>
      )}

      {rows.length === 0 ? (
        scoped.length > 0 ? (
          <EmptyState
            title={t('emptyFiltered')}
            lead={t('emptyFilteredLead')}
            action={<Link href={href({ q: undefined, status: undefined, ready: undefined, sort: undefined, league: undefined })} className="inline-flex h-9 items-center rounded-[2px] border border-s-line px-3 text-sm font-medium hover:border-s-muted">{t('clearFilters')}</Link>}
          />
        ) : (
          <EmptyState
            title={t('emptyTitle')}
            lead={nextDay ? t('emptyNext', { date: dayLabel(nextDay) }) : t('emptyLead')}
            action={nextDay ? (
              <Link href={href({ date: nextDay })} className="inline-flex h-9 items-center rounded-[2px] bg-s-brand px-3 text-sm font-medium text-s-brand-ink">
                {t('goToNext')}
              </Link>
            ) : undefined}
          />
        )
      ) : (
        <>
          <PredictionTable rows={rows} showOutcome={date < today} />
          <p className="mt-6 text-xs text-s-muted">
            {pendingCount > 0 && <>{t('pendingNote', { count: pendingCount })} </>}
            {t('statusHint')} {t('footnote')}
          </p>
        </>
      )}
    </Page>
  );
}
