import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction, MatchStatus } from '@/lib/site/predictions';
import { standingsIndex, type StandingRow } from '@/lib/site/standings';
import LocalTime from './LocalTime';
import { Crest, StatusChip } from './PredictionTable';

// Freemium SEO (2026-09-24): the public, prediction-free fixture list shown to
// anonymous visitors on league pages. Same grouping and row layout as
// PredictionTable, but no pick, probability bar or goal markets — only
// kickoff, teams (with crest and league position) and the match state. Rows
// do not link to /predictions/[id] because that page is members-only.

const STATUS_KEY: Record<MatchStatus, string> = {
  scheduled: 'statusScheduled', live: 'statusLive', finished: 'statusFinished',
  postponed: 'statusPostponed', cancelled: 'statusCancelled', unknown: 'statusUnknown',
};

export default async function FixtureList({ rows }: { rows: SitePrediction[] }) {
  const t = await getTranslations('common');
  const tp = await getTranslations('predictions');

  const groups = new Map<string, { name: string; slug: string | null; rows: SitePrediction[] }>();
  for (const r of rows) {
    const key = r.league?.slug || `x:${r.leagueName}`;
    if (!groups.has(key)) groups.set(key, { name: r.leagueName, slug: r.league?.slug || null, rows: [] });
    groups.get(key)!.rows.push(r);
  }

  const tables = new Map<string, Map<number, StandingRow>>();
  await Promise.all([...groups.values()].filter((g) => g.slug).map(async (g) => { tables.set(g.slug!, await standingsIndex(g.slug!)); }));
  const pos = (slug: string | null, teamId: number | null) => (slug && teamId ? tables.get(slug)?.get(teamId)?.pos : undefined);
  const Pos = ({ n }: { n?: number }) => (n ? <span className="num ml-1 text-xs text-s-muted" title={tp('positionTitle', { pos: n })}>{n}.</span> : null);

  const showState = (p: SitePrediction) => p.status in STATUS_KEY && p.status !== 'scheduled' && p.status !== 'unknown';
  const showScore = (p: SitePrediction) => p.homeScore != null && p.awayScore != null && (p.status === 'live' || p.status === 'finished');

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
          <ul className="divide-y divide-s-line border-b border-s-line">
            {g.rows.map((p) => (
              <li key={p.fixtureId} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 px-1 py-2.5">
                <span className="flex flex-col gap-1 text-sm text-s-muted">
                  <LocalTime iso={p.kickoff} format="time" />
                  {showState(p) && <StatusChip status={p.status} label={t(STATUS_KEY[p.status])} />}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 text-[15px] leading-tight">
                  <span className="flex items-center gap-2">
                    <Crest src={p.homeCrest} alt="" />
                    <span className="truncate">{p.homeName}</span><Pos n={pos(g.slug, p.homeId)} />
                    {showScore(p) && <span className="num ml-auto font-semibold">{p.homeScore}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <Crest src={p.awayCrest} alt="" />
                    <span className="truncate">{p.awayName}</span><Pos n={pos(g.slug, p.awayId)} />
                    {showScore(p) && <span className="num ml-auto font-semibold">{p.awayScore}</span>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
