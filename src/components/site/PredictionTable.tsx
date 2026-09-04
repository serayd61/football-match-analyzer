import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction } from '@/lib/site/predictions';
import ProbBar from './ProbBar';
import LocalTime from './LocalTime';
import { standingsIndex, type StandingRow } from '@/lib/site/standings';
import OutcomeBadge from './OutcomeBadge';

// Dense list of predictions grouped by league. One responsive grid per row:
// on small screens the row stacks (time · teams · bar · pick), on md+ it is a
// six-column table-like layout with a header row.

export function Crest({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="inline-block h-5 w-5 rounded-sm bg-s-raised" aria-hidden />;
  return <Image src={src} alt={alt} width={20} height={20} className="h-5 w-5 object-contain" unoptimized />;
}

export function pickLabel(p: SitePrediction, t: (k: string) => string): string {
  if (p.pick === '1') return p.homeName;
  if (p.pick === '2') return p.awayName;
  return t('draw');
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

  const gridCols = showOutcome
    ? 'md:grid-cols-[4.5rem_minmax(14rem,1.4fr)_minmax(10rem,1fr)_8.5rem_5.5rem_5.5rem_5.5rem]'
    : 'md:grid-cols-[4.5rem_minmax(14rem,1.4fr)_minmax(10rem,1fr)_8.5rem_5.5rem_5.5rem]';

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

          <div className={`hidden md:grid ${gridCols} gap-x-3 px-1 py-1.5 text-xs font-medium uppercase tracking-wider text-s-muted`}>
            <span>{t('kickoff')}</span>
            <span>{tp('colMatch')}</span>
            <span>1 · X · 2</span>
            <span>{tp('colPick')}</span>
            <span className="text-right">{t('ou25')}</span>
            <span className="text-right">{t('btts')}</span>
            {showOutcome && <span className="text-right">{tp('colResult')}</span>}
          </div>

          <ul className="divide-y divide-s-line border-b border-s-line">
            {g.rows.map((p) => !p.hasModel ? (
              <li key={p.fixtureId}>
                <div className={`grid grid-cols-[3.5rem_1fr] items-center gap-x-3 gap-y-1.5 px-1 py-2.5 ${gridCols}`}>
                  <span className="text-sm text-s-muted">
                    <LocalTime iso={p.kickoff} format="time" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 text-[15px] leading-tight">
                    <span className="flex items-center gap-2"><Crest src={p.homeCrest} alt="" /><span className="truncate">{p.homeName}</span><Pos n={pos(g.slug, p.homeId)} /></span>
                    <span className="flex items-center gap-2"><Crest src={p.awayCrest} alt="" /><span className="truncate">{p.awayName}</span><Pos n={pos(g.slug, p.awayId)} /></span>
                  </span>
                  <span className={`col-span-2 text-sm text-s-muted ${showOutcome ? 'md:col-span-5' : 'md:col-span-4'}`}>
                    {tp('pendingModel')}
                  </span>
                </div>
              </li>
            ) : (
              <li key={p.fixtureId}>
                <Link
                  href={`/predictions/${p.fixtureId}`}
                  className={`grid grid-cols-[3.5rem_1fr] items-center gap-x-3 gap-y-1.5 px-1 py-2.5 hover:bg-s-raised/60 ${gridCols}`}
                >
                  <span className="text-sm text-s-muted">
                    <LocalTime iso={p.kickoff} format="time" />
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5 text-[15px] leading-tight">
                    <span className="flex items-center gap-2">
                      <Crest src={p.homeCrest} alt="" />
                      <span className={`truncate ${p.pick === '1' ? 'font-semibold' : ''}`}>{p.homeName}</span><Pos n={pos(g.slug, p.homeId)} />
                      {showOutcome && p.homeScore != null && <span className="num ml-auto font-semibold">{p.homeScore}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <Crest src={p.awayCrest} alt="" />
                      <span className={`truncate ${p.pick === '2' ? 'font-semibold' : ''}`}>{p.awayName}</span><Pos n={pos(g.slug, p.awayId)} />
                      {showOutcome && p.awayScore != null && <span className="num ml-auto font-semibold">{p.awayScore}</span>}
                    </span>
                  </span>

                  <span className="col-span-2 md:col-span-1">
                    <ProbBar home={p.pHome} draw={p.pDraw} away={p.pAway} highlight={p.pick} labels={{ home: t('home'), draw: t('draw'), away: t('away') }} />
                  </span>

                  <span className="col-span-2 flex items-baseline justify-between gap-2 text-sm md:col-span-1 md:block">
                    <span className="truncate">
                      <span className="mr-1 inline-block w-4 text-center font-semibold text-s-muted">{p.pick ?? '–'}</span>
                      <span className="md:hidden">{pickLabel(p, t)}</span>
                    </span>
                    <span className="num font-semibold">{pct(p.confidence)}</span>
                  </span>

                  <span className="hidden num text-right text-sm md:block">
                    {p.overUnder ? <>{p.overUnder.pick === 'over' ? t('over') : t('under')} <span className="text-s-muted">{pct(p.overUnder.p)}</span></> : t('noData')}
                  </span>
                  <span className="hidden num text-right text-sm md:block">
                    {p.btts ? <>{p.btts.pick === 'yes' ? t('yes') : t('no')} <span className="text-s-muted">{pct(p.btts.p)}</span></> : t('noData')}
                  </span>

                  {showOutcome && (
                    <span className="col-span-2 md:col-span-1 md:text-right">
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
