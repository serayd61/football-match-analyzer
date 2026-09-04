import type { Metadata } from 'next';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { listResults, periodWindow } from '@/lib/site/results';
import { SITE_LEAGUES, leagueBySlug } from '@/lib/site/leagues';
import { todayYmd } from '@/lib/site/time';
import { Page, PageTitle, EmptyState } from '@/components/site/ui';
import ResultsTable from '@/components/site/ResultsTable';

export const revalidate = 300;

const PERIODS = ['7d', '30d', '90d', 'all'] as const;
type Period = (typeof PERIODS)[number];
const PAGE_SIZE = 50;

type Search = { period?: string; league?: string; page?: string };

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'results' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/results') };
}

export default async function ResultsPage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('results');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  const period: Period = (PERIODS as readonly string[]).includes(searchParams.period || '') ? (searchParams.period as Period) : '30d';
  const league = searchParams.league ? leagueBySlug(searchParams.league) : null;
  const page = Math.max(1, Math.min(500, Number.parseInt(searchParams.page || '1', 10) || 1));
  const today = todayYmd();
  const win = periodWindow(period, today);

  const res = await listResults({ league, from: win.from, to: win.to, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));
  const decided = res.won + res.lost;
  const acc = decided ? res.won / decided : null;

  const href = (over: Partial<Search>) => {
    const q = new URLSearchParams();
    const m = { period, league: league?.slug, page: String(page), ...over };
    if (m.period && m.period !== '30d') q.set('period', m.period);
    if (m.league) q.set('league', m.league);
    if (m.page && m.page !== '1') q.set('page', m.page);
    const s = q.toString();
    return `/results${s ? `?${s}` : ''}`;
  };
  const pill = 'tab-pill inline-flex h-8 items-center whitespace-nowrap rounded-[2px] border border-s-line px-3 text-sm hover:border-s-muted';

  return (
    <Page>
      <PageTitle
        title={t('title')}
        lead={t('lead')}
        aside={
          <p className="text-xs text-s-muted">
            {t('aside')} <Link href="/performance" className="underline underline-offset-4">{t('asideLink')}</Link>
          </p>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-s-line pb-3">
        <div className="flex flex-col gap-2">
          <nav aria-label={t('period')}>
            <ul className="flex gap-1">
              {PERIODS.map((p) => (
                <li key={p}><Link href={href({ period: p, page: '1' })} aria-current={p === period ? 'true' : undefined} className={pill}>{t(`period_${p}`)}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label={tc('league')} className="tbl-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
            <ul className="flex flex-wrap gap-1 text-sm">
              <li><Link href={href({ league: undefined, page: '1' })} aria-current={!league ? 'true' : undefined} className="tab-pill inline-flex h-7 items-center rounded-[2px] border border-transparent px-2 text-s-muted hover:text-s-ink">{tc('all')}</Link></li>
              {SITE_LEAGUES.map((l) => (
                <li key={l.slug}><Link href={href({ league: l.slug, page: '1' })} aria-current={league?.slug === l.slug ? 'true' : undefined} className="tab-pill inline-flex h-7 items-center rounded-[2px] border border-transparent px-2 text-s-muted hover:text-s-ink">{l.name}</Link></li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Filter summary: counts only, no derived claims beyond the pick hit-rate */}
        <dl className="grid grid-cols-3 gap-x-6 text-sm">
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('settledCount')}</dt><dd className="num font-head text-2xl">{f.number(res.total)}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('record')}</dt><dd className="num font-head text-2xl">{res.won}–{res.lost}</dd></div>
          <div><dt className="text-xs uppercase tracking-wider text-s-muted">{t('hitRate')}</dt><dd className="num font-head text-2xl">{acc == null ? '–' : f.number(acc, 'percent1')}</dd></div>
        </dl>
      </div>

      {res.rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} lead={t('emptyLead')} action={<Link href={href({ period: 'all', league: undefined, page: '1' })} className="underline underline-offset-4">{t('emptyAction')}</Link>} />
      ) : (
        <>
          <ResultsTable rows={res.rows} />
          <nav aria-label={t('pagination')} className="mt-6 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={href({ page: String(page - 1) })} className="underline underline-offset-4">{t('newer')}</Link> : <span className="text-s-muted">{t('newer')}</span>}
            <span className="num text-s-muted">{t('pageOf', { page, pages })}</span>
            {page < pages ? <Link href={href({ page: String(page + 1) })} className="underline underline-offset-4">{t('older')}</Link> : <span className="text-s-muted">{t('older')}</span>}
          </nav>
          <p className="mt-6 text-xs text-s-muted">
            {t('footnote')}
            {res.unresolved > 0 && <> {t('unresolvedNote', { count: res.unresolved })}</>}
          </p>
        </>
      )}
    </Page>
  );
}
