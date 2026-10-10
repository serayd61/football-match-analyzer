import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { PublicMatch } from '@/lib/site/match-public';
import { matchPath } from '@/lib/site/match-public';
import { ymdOf, zonedStartOfDay } from '@/lib/site/time';
import LocalTime from './LocalTime';
import { Crest, StatusChip } from './PredictionTable';

// Herkese açık maç listesi (2026-10-10): kick-off · armalar + isimler (+ skor) ·
// durum. Olasılık, seçim ya da güven YOK — satır /matches/{slug} sayfasına gider.
// Gün başlıkları Zürih takvimine göre; saatler tarayıcı saat dilimine çevrilir.

const STATUS_KEY = {
  scheduled: 'statusScheduled', live: 'statusLive', finished: 'statusFinished',
  postponed: 'statusPostponed', cancelled: 'statusCancelled', unknown: 'statusUnknown',
} as const;

export default async function PublicMatchList({ rows, groupBy = 'day', showLeague = true }: { rows: PublicMatch[]; groupBy?: 'day' | 'league' | 'none'; showLeague?: boolean }) {
  const tc = await getTranslations('common');
  const f = await getFormatter();
  if (!rows.length) return null;

  const groups = new Map<string, { label: string; rows: PublicMatch[] }>();
  for (const r of rows) {
    const key = groupBy === 'day' ? ymdOf(r.kickoff) : groupBy === 'league' ? (r.league?.slug ?? r.leagueName) : '';
    const label = groupBy === 'day' ? f.dateTime(zonedStartOfDay(key), { weekday: 'long', day: 'numeric', month: 'long' }) : groupBy === 'league' ? r.leagueName : '';
    if (!groups.has(key)) groups.set(key, { label, rows: [] });
    groups.get(key)!.rows.push(r);
  }

  const showState = (m: PublicMatch) => m.status !== 'scheduled' && m.status !== 'unknown';
  const showScore = (m: PublicMatch) => m.homeScore != null && m.awayScore != null && (m.status === 'live' || m.status === 'finished');

  return (
    <div className="space-y-8">
      {[...groups.values()].map((g, gi) => (
        <section key={gi} aria-label={g.label || undefined}>
          {g.label && (
            <div className="flex items-baseline justify-between border-b-2 border-s-ink pb-1.5">
              <h2 className="text-lg">{g.label}</h2>
              <span className="text-xs text-s-muted">{tc('matches', { count: g.rows.length })}</span>
            </div>
          )}
          <ul className="divide-y divide-s-line border-b border-s-line">
            {g.rows.map((m) => (
              <li key={m.fixtureId}>
                <Link href={matchPath(m)} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 px-1 py-2.5 hover:bg-s-raised/60" title={`${m.homeName} – ${m.awayName}`}>
                  <span className="flex flex-col gap-1 text-sm text-s-muted">
                    <LocalTime iso={m.kickoff} format="time" />
                    {showState(m) && <StatusChip status={m.status} label={tc(STATUS_KEY[m.status])} />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 text-[15px] leading-tight">
                    <span className="flex items-center gap-2">
                      <Crest src={m.homeCrest} alt={tc('crestAlt', { team: m.homeName })} />
                      <span className="truncate font-medium">{m.homeName}</span>
                      {showScore(m) && <span className="num ml-auto font-semibold">{m.homeScore}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <Crest src={m.awayCrest} alt={tc('crestAlt', { team: m.awayName })} />
                      <span className="truncate font-medium">{m.awayName}</span>
                      {showScore(m) && <span className="num ml-auto font-semibold">{m.awayScore}</span>}
                    </span>
                    {showLeague && groupBy !== 'league' && <span className="truncate text-xs text-s-muted">{m.leagueName}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
