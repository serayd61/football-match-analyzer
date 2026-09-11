// ConfidenceRing — the one circle in the system. `conic-gradient(accent conf%,
// neutral-300 0)` with an inner disc (~78% of the diameter) carrying the
// number. Sizes from the handoff: 68px (card, 18px text), 104–110px
// (hero / detail, 26–30px text). Server-safe.
export default function ConfidenceRing({
  conf, size = 68, label, inner = 'bg', className = '',
}: {
  /** calibrated confidence 0–1, or null when the model has none */
  conf: number | null | undefined;
  size?: number;
  /** small muted caption under the number ("confidence") */
  label?: string;
  /** inner disc colour: page bg or card surface */
  inner?: 'bg' | 'surface';
  className?: string;
}) {
  const pct = conf == null ? null : Math.round(conf * 100);
  const innerSize = Math.round(size * 0.78);
  const font = size >= 100 ? Math.round(size * 0.27) : Math.round(size * 0.265);
  return (
    <div
      className={`ring grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size, background: `conic-gradient(rgb(var(--s-accent)) ${pct ?? 0}%, rgb(var(--s-n300)) 0)` }}
      role="img"
      aria-label={pct == null ? '–' : `${pct}%${label ? ` ${label}` : ''}`}
    >
      <div
        className={`grid place-items-center text-center ${inner === 'bg' ? 'bg-s-bg' : 'bg-s-surface'}`}
        style={{ width: innerSize, height: innerSize }}
      >
        <div>
          <div className="num font-head font-extrabold leading-none" style={{ fontSize: font }}>{pct == null ? '–' : `${pct}%`}</div>
          {label && <div className="mt-0.5 text-[10px] leading-none text-s-muted">{label}</div>}
        </div>
      </div>
    </div>
  );
}
