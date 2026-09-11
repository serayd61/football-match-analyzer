// Three-way probability bar (home / draw / away). Pure, server-safe.
// Modernist: flex row, 2px gaps, heights 10 / 14 / 18px. Segments: Home = ink,
// Draw = neutral-400, Away = accent. Below, an 11–12px row: "1 · 48%" left,
// "X · 27%" muted centre, "2 · 25%" accent-700 right. The full breakdown is
// in the accessible label. `compact` (10px, no caption) is for dense tables.
export default function ProbBar({
  home, draw, away, labels, highlight, size = 'md', compact = false, caption = true,
}: {
  home: number; draw: number; away: number;
  labels: { home: string; draw: string; away: string };
  /** the model's pick — printed bold in the caption */
  highlight?: '1' | 'X' | '2' | null;
  size?: 'sm' | 'md' | 'lg';
  /** legacy alias for size='sm' without caption */
  compact?: boolean;
  caption?: boolean;
}) {
  const pct = (x: number) => Math.round(x * 100);
  const h = compact || size === 'sm' ? 'h-[10px]' : size === 'lg' ? 'h-[18px]' : 'h-[14px]';
  const showCaption = caption && !compact;
  const segs = [
    { key: '1', v: home, cls: 'bg-s-ink', label: labels.home, text: '' },
    { key: 'X', v: draw, cls: 'bg-s-n400', label: labels.draw, text: 'text-s-muted' },
    { key: '2', v: away, cls: 'bg-s-accent', label: labels.away, text: 'text-s-accent-700' },
  ] as const;
  const aria = segs.map((s) => `${s.label} ${pct(s.v)}%`).join(', ');
  return (
    <div className="w-full">
      <div className={`flex w-full gap-[2px] ${h}`} role="img" aria-label={aria}>
        {segs.map((s) => (
          <div key={s.key} className={`${s.cls}`} style={{ width: `${Math.max(0, s.v * 100)}%` }} />
        ))}
      </div>
      {showCaption && (
        <div className={`num mt-1.5 flex justify-between leading-none ${size === 'lg' ? 'text-[12px]' : 'text-[11px]'}`} aria-hidden>
          {segs.map((s) => (
            <span key={s.key} className={`${s.text} ${highlight === s.key ? 'font-bold' : ''}`}>{s.key} · {pct(s.v)}%</span>
          ))}
        </div>
      )}
    </div>
  );
}
