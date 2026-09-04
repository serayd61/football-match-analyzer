import { Link } from '@/i18n/navigation';
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
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-[2px] px-1.5 text-xs font-semibold ${CHIP[it.res]}`}
            title={`${it.home ? labels.home : labels.away} ${labels.vs} ${it.opponent} · ${it.score}`}
          >
            {labels[it.res]}
          </Link>
        </li>
      ))}
    </ul>
  );
}
