import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction, MatchStatus } from '@/lib/site/predictions';
import ProbBar from './ProbBar';
import LocalTime from './LocalTime';
import { standingsIndex, type StandingRow } from '@/lib/site/standings';
import OutcomeBadge from './OutcomeBadge';

// Dense list of predictions grouped by league. One responsive grid per row:
// below `lg` the row stacks (time · teams · bar · pick · markets), from `lg`
// (1024px) it is a table-like layout with a header row.
//
// Denetim 2026-09-05 (P2): the old `md` grid needed ~840px of columns at a
// 768px breakpoint and hid Over/Under and BTTS on small screens. The wide
// grid now opens at `lg`, and the goal markets stay visible inline on the
// stacked layout. Match state (live / finished / postponed) is shown as a
// chip separate from the model's pick.

export function Crest({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="inline-block h-5 w-5 rounded-sm bg-s-raised" aria-hidden />;
  return <Image src={src} alt={alt} width={20} height={20} className="h-5 w-5 object-contain" unoptimized />;
}

export function pickLabel(p: SitePrediction, t: (k: string) => string): string {
  if (p.pick === '1') return p.homeName;
  if (p.pick === '2') return p.awayName;
  return t('draw');
}

const STATUS_KEY: Record<MatchStatus, string> = {
  scheduled: 'statusScheduled', live: 'statusLive', finished: 'statusFinished',
  postponed: 'statusPostponed', cancelled: 'statusCancelled', unknown: 'statusUnknown',
};

export function StatusChip({ status, label }: { status: MatchStatus; label: string }) {
  const tone = status === 'live' ? 'border-s-accent text-s-accent' : status === 'cancelled' || status === 'postponed' ? 'border-s-loss/40 text-s-loss' : 'border-s-line text-s-muted';
  return <span className={`inline-flex h-5 items-center rounded-[2px] border px-1.5 text-[11px] font-medium uppercase tracking-wider ${tone}`}>{label}</span>;
}

export default async function PredictionTable({ rows, showOutcome = false }: { rows: SitePrediction[]; showOutcome?: boolean }) {
  const t = await getTranslations('common');
  const tp = await getTranslations('predictions');
  const pct = (x: number | null | undefined) => (x == null ? t('noData') : `${Math.round(x * 100)}%`);

  // Group by league, preserving kickoff order.
  const groups = new Map<string, { name: string; slug: string | null; rows: SitePrediction[] }>();
  for (const r of rows) {
    const key = r.league?.slug || `x:${r.leagueName}`;
    if (!groups.has(key)) groups.set(key, { name: r.leagueName, slug: r.league?.slug || null, rows: [] });
    groups.get(key)!.rows.push(r);
  }

  // League positions for covered groups (one cached table per league).
  const tables = new Map<string, Map<number, StandingRow>>();
  await Promise.all([...groups.values()].filter((g) => g.slug).map(async (g) => { tables.set(g.slug!, await standingsIndex(g.slug!)); }));
  const pos = (slug: string | null, teamId: number | null) => (slug && teamId ? tables.get(slug)?.get(teamId)?.pos : undefined);
  const Pos = ({ n }: { n?: number }) => (n ? <span className="num ml-1 text-xs text-s-muted" title={tp('positionTitle', { pos: n })}>{n}.</span> : null);

  // Column widths sum to 42.5rem (+ 5 gaps) so the table fits a 1024px container without overflow.
  const gridCols = showOutcome
    ? 'lg:grid-cols-[4rem_minmax(12rem,1.4fr)_minmax(9rem,1fr)_7.5rem_5rem_5rem_5.5rem]'
    : 'lg:grid-cols-[4rem_minmax(12rem,1.4fr)_minmax(9rem,1fr)_7.5rem_5rem_5rem]';

  // Live or finished rows carry the feed's score; the outcome badge is only for settled results.
  // `in` guard: rows served from a pre-deploy data cache may predate the `status` field.
  const showState = (p: SitePrediction) => !showOutcome && p.status in STATUS_KEY && p.status !== 'scheduled' && p.status !== 'unknown';
  const showScore = (p: SitePrediction) => p.homeScore != null && p.awayScore != null && (showOutcome || p.status === 'live' || p.status === 'finished');

  const Teams = ({ p, slug }: { p: SitePrediction; slug: string | null }) => (
    <span className="flex min-w-0 flex-col gap-0.5 text-[15px] leading-tight">
      <span className="flex items-center gap-2">
        <Crest src={p.homeCrest} alt="" />
        <span className={`truncate ${p.pick === '1' ? 'font-semibold' : ''}`}>{p.homeName}</span><Pos n={pos(slug, p.homeId)} />
        {showScore(p) && <span className="num ml-auto font-semibold">{p.homeScore}</span>}
      </span>
      <span className="flex items-center gap-2">
        <Crest src={p.awayCrest} alt="" />
        <span className={`truncate ${p.pick === '2' ? 'font-semibold' : ''}`}>{p.awayName}</span><Pos n={pos(slug, p.awayId)} />
        {showScore(p) && <span className="num ml-auto font-semibold">{p.awayScore}</span>}
      </span>
    </span>
  );

  const Time = ({ p }: { p: SitePrediction }) => (
    <span className="flex flex-col gap-1 text-sm text-s-muted">
      <LocalTime iso={p.kickoff} format="time" />
      {showState(p) && <StatusChip status={p.status} label={t(STATUS_KEY[p.status])} />}
    </span>
  );

  return (
    <div className="space-y-8">
      {Array.from(groups.values()).map((g) => (
        <section key={g.slug || g.name} aria-label={g.name}>
          <div className="flex items-baseline justify-between border-b-2 border-s-ink pb-1.5">
            <h2 className="text-lg">
              {g.slug ? <Link href={`/leagues/${g.slug}`} className="hover:underline underline-offset-4">{g.name}</Link> : g.name}
            </h2>
            <span className="text-xs text-s-muted">{t('matches', { count: g.rows.length })}</span>
          </div>

          <div className={`hidden lg:grid ${gridCols} gap-x-3 px-1 py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted`}>
            <span>{t('kickoff')}</span>
            <span>{tp('colMatch')}</span>
            <span>1 · X · 2</span>
            <span>{tp('colPick')}</span>
            <span className="text-right">{t('ou25Short')}</span>
            <span className="text-right">{t('bttsShort')}</span>
            {showOutcome && <span className="text-right">{tp('colResult')}</span>}
          </div>

          <ul className="divide-y divide-s-line border-b border-s-line">
            {g.rows.map((p) => !p.hasModel ? (
              <li key={p.fixtureId}>
                <div className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-1 py-2.5 ${gridCols}`}>
                  <Time p={p} />
                  <Teams p={p} slug={g.slug} />
                  <span className={`col-span-2 text-sm text-s-muted ${showOutcome ? 'lg:col-span-5' : 'lg:col-span-4'}`}>
                    {tp('pendingModel')}
                  </span>
                </div>
              </li>
            ) : (
              <li key={p.fixtureId}>
                <Link
                  href={`/predictions/${p.fixtureId}`}
                  className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-1 py-2.5 hover:bg-s-raised/60 ${gridCols}`}
                >
                  <Time p={p} />
                  <Teams p={p} slug={g.slug} />

                  <span className="col-span-2 lg:col-span-1">
                    <ProbBar home={p.pHome} draw={p.pDraw} away={p.pAway} highlight={p.pick} labels={{ home: t('home'), draw: t('draw'), away: t('away') }} />
                  </span>

                  <span className="col-span-2 flex items-baseline justify-between gap-2 text-sm lg:col-span-1 lg:block">
                    <span className="truncate">
                      <span className="mr-1 inline-block w-4 text-center font-semibold text-s-muted">{p.pick ?? '–'}</span>
                      <span className="lg:hidden">{pickLabel(p, t)}</span>
                    </span>
                    <span className="num font-semibold">{pct(p.confidence)}</span>
                  </span>

                  {/* Goal markets: inline on the stacked layout, own columns from lg. */}
                  <span className="num col-span-2 text-xs text-s-muted lg:hidden">
                    {tp('mobileMarkets', {
                      ou: p.overUnder ? `${p.overUnder.pick === 'over' ? t('over') : t('under')} ${pct(p.overUnder.p)}` : t('noData'),
                      btts: p.btts ? `${p.btts.pick === 'yes' ? t('yes') : t('no')} ${pct(p.btts.p)}` : t('noData'),
                    })}
                  </span>
                  <span className="num hidden text-right text-sm lg:block">
                    {p.overUnder ? <>{p.overUnder.pick === 'over' ? t('over') : t('under')} <span className="text-s-muted">{pct(p.overUnder.p)}</span></> : t('noData')}
                  </span>
                  <span className="num hidden text-right text-sm lg:block">
                    {p.btts ? <>{p.btts.pick === 'yes' ? t('yes') : t('no')} <span className="text-s-muted">{pct(p.btts.p)}</span></> : t('noData')}
                  </span>

                  {showOutcome && (
                    <span className="col-span-2 lg:col-span-1 lg:text-right">
                      <OutcomeBadge outcome={p.outcome} />
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
