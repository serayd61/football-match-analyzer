import { Link } from '@/i18n/navigation';
import LocalTime from './LocalTime';
import type { SitePrediction } from '@/lib/site/predictions';

// Last-N results from a team's perspective: W / D / L chips, newest first.
export type FormItem = { fixtureId: number; res: 'W' | 'D' | 'L'; score: string; opponent: string; home: boolean; kickoff: string };

export function toFormItems(teamId: number, rows: SitePrediction[]): FormItem[] {
  return rows
    .filter((r) => r.homeScore != null && r.awayScore != null)
    .map((r) => {
      const isHome = r.homeId === teamId;
      const gf = isHome ? r.homeScore! : r.awayScore!;
      const ga = isHome ? r.awayScore! : r.homeScore!;
      const res: 'W' | 'D' | 'L' = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
      return { fixtureId: r.fixtureId, res, score: `${r.homeScore}–${r.awayScore}`, opponent: isHome ? r.awayName : r.homeName, home: isHome, kickoff: r.kickoff };
    });
}

const CHIP: Record<'W' | 'D' | 'L', string> = {
  W: 'bg-s-win text-white',
  D: 'bg-s-void text-white',
  L: 'bg-s-loss text-white',
};

export default function FormStrip({ items, labels }: { items: FormItem[]; labels: { W: string; D: string; L: string; vs: string; home: string; away: string } }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <li key={it.fixtureId}>
          <Link
            href={`/predictions/${it.fixtureId}`}
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-bold ${CHIP[it.res]}`}
            title={`${it.home ? labels.home : labels.away} ${labels.vs} ${it.opponent} · ${it.score}`}
          >
            {labels[it.res]}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Son N maç, satır satır (5 Eki, kullanıcı): şerit rakibi/skoru yalnız hover'da
// gösteriyordu, mobilde hiç görünmüyordu. Tarih · iç/dış · rakip · skor · G/B/M.
export function FormList({ items, labels }: { items: FormItem[]; labels: { W: string; D: string; L: string; homeShort: string; awayShort: string } }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-s-line border-b border-s-line">
      {items.map((it) => (
        <li key={it.fixtureId}>
          <Link href={`/predictions/${it.fixtureId}`} className="flex items-center gap-2 py-1.5 hover:bg-s-raised/60">
            <span className="w-14 shrink-0 text-xs text-s-muted"><LocalTime iso={it.kickoff} format="dayShort" /></span>
            <span className="w-5 shrink-0 text-center text-[10px] font-semibold uppercase text-s-muted">{it.home ? labels.homeShort : labels.awayShort}</span>
            <span className="min-w-0 flex-1 truncate">{it.opponent}</span>
            <span className="num shrink-0 font-semibold">{it.score}</span>
            <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${CHIP[it.res]}`}>{labels[it.res]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
