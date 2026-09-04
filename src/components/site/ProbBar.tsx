// Three-way probability bar (home / draw / away). Pure, server-safe.
// Colours: home = brand, draw = void grey, away = accent. Percentages are
// printed inside segments wide enough to hold them; the full breakdown is in
// the accessible label.
export default function ProbBar({
  home, draw, away, labels, highlight, compact = false,
}: {
  home: number; draw: number; away: number;
  labels: { home: string; draw: string; away: string };
  highlight?: '1' | 'X' | '2' | null;
  compact?: boolean;
}) {
  const pct = (x: number) => Math.round(x * 100);
  const segs = [
    { key: '1', v: home, cls: 'bg-s-brand text-s-brand-ink', label: labels.home },
    { key: 'X', v: draw, cls: 'bg-s-void/70 text-white', label: labels.draw },
    { key: '2', v: away, cls: 'bg-s-accent text-white', label: labels.away },
  ] as const;
  const aria = segs.map((s) => `${s.label} ${pct(s.v)}%`).join(', ');
  return (
    <div
      className={`flex w-full overflow-hidden rounded-[2px] ${compact ? 'h-2' : 'h-5'}`}
      role="img"
      aria-label={aria}
    >
      {segs.map((s) => (
        <div
          key={s.key}
          className={`relative flex items-center justify-center overflow-hidden ${s.cls} ${
            highlight && highlight !== s.key ? 'opacity-60' : ''
          }`}
          style={{ width: `${s.v * 100}%` }}
        >
          {!compact && s.v >= 0.14 && (
            <span className="num text-[11px] font-medium leading-none">{pct(s.v)}</span>
          )}
        </div>
      ))}
    </div>
  );
}
