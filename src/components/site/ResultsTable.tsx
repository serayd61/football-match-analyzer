import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SitePrediction } from '@/lib/site/predictions';
import { goalOutcomes } from '@/lib/site/results';
import { ymdOf, zonedStartOfDay } from '@/lib/site/time';
import LocalTime from './LocalTime';
import OutcomeBadge from './OutcomeBadge';
import { Crest, pickLabel } from './PredictionTable';

const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);

function Mark({ o }: { o: 'won' | 'lost' | null }) {
  if (!o) return <span className="text-s-muted">–</span>;
  return <span className={o === 'won' ? 'text-s-win' : 'text-s-loss'} aria-hidden>{o === 'won' ? '✓' : '✗'}</span>;
}

// Settled matches grouped by Zurich calendar day, newest first.
export default async function ResultsTable({ rows }: { rows: SitePrediction[] }) {
  const t = await getTranslations('results');
  const tc = await getTranslations('common');
  const f = await getFormatter();

  const groups = new Map<string, SitePrediction[]>();
  for (const r of rows) {
    const d = ymdOf(r.kickoff);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(r);
  }

  const cols = 'md:grid-cols-[3.5rem_7rem_minmax(14rem,1.4fr)_3rem_minmax(8rem,1fr)_5rem_4rem_4rem]';

  return (
    <div>
      <div className={`hidden ${cols} border-b border-s-line pb-1.5 text-[11px] uppercase tracking-wider text-s-muted md:grid`}>
        <span>{tc('kickoff')}</span>
        <span>{tc('league')}</span>
        <span>{t('colMatch')}</span>
        <span className="text-right">{t('colScore')}</span>
        <span className="pl-4">{t('colPick')}</span>
        <span>{tc('market1x2')}</span>
        <span className="text-center">{tc('ou25Short')}</span>
        <span className="text-center">{tc('bttsShort')}</span>
      </div>
      {[...groups.entries()].map(([day, list]) => (
        <section key={day} aria-label={day}>
          <h2 className="mt-5 border-b border-s-line pb-1 font-body text-xs font-semibold uppercase tracking-wider text-s-muted first:mt-2">
            {f.dateTime(zonedStartOfDay(day), 'dayLong')}
          </h2>
          <ul className="divide-y divide-s-line">
            {list.map((r) => {
              const g = goalOutcomes(r);
              const pickName = pickLabel(r, tc);
              return (
                <li key={r.fixtureId}>
                  <Link href={`/predictions/${r.fixtureId}`} className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-2 gap-y-1 py-2 text-sm hover:bg-s-raised/60 ${cols} md:gap-x-3`}>
                    <LocalTime iso={r.kickoff} format="time" className="text-s-muted" />
                    <span className="truncate text-xs text-s-muted md:text-sm md:text-s-ink">
                      {r.leagueName}
                    </span>
                    <span className="row-start-2 col-span-2 flex min-w-0 flex-col gap-0.5 md:row-auto md:col-auto">
                      <span className={`flex items-center gap-2 truncate ${r.pick === '1' ? 'font-semibold' : ''}`}><Crest src={r.homeCrest} alt="" />{r.homeName}</span>
                      <span className={`flex items-center gap-2 truncate ${r.pick === '2' ? 'font-semibold' : ''}`}><Crest src={r.awayCrest} alt="" />{r.awayName}</span>
                    </span>
                    <span className="num row-start-2 flex flex-col text-right font-semibold md:row-auto">
                      <span>{r.homeScore}</span><span>{r.awayScore}</span>
                    </span>
                    <span className="col-span-3 flex items-center gap-2 md:col-auto md:pl-4">
                      <span className="truncate">{pickName}</span>
                      <span className="num text-s-muted">{pct(r.confidence)}</span>
                    </span>
                    <span className="col-span-3 flex items-center gap-3 md:col-auto md:block">
                      <OutcomeBadge outcome={r.outcome} />
                      <span className="text-xs text-s-muted md:hidden">
                        {tc('ou25Short')} {r.overUnder ? (r.overUnder.pick === 'over' ? tc('over') : tc('under')) : '–'} <Mark o={g.ou} />
                        {' · '}
                        {tc('bttsShort')} {r.btts ? (r.btts.pick === 'yes' ? tc('yes') : tc('no')) : '–'} <Mark o={g.btts} />
                      </span>
                    </span>
                    <span className="hidden text-center text-xs md:block">
                      {r.overUnder ? (r.overUnder.pick === 'over' ? tc('over') : tc('under')) : '–'} <Mark o={g.ou} />
                    </span>
                    <span className="hidden text-center text-xs md:block">
                      {r.btts ? (r.btts.pick === 'yes' ? tc('yes') : tc('no')) : '–'} <Mark o={g.btts} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
