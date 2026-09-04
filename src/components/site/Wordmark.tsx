// Text-based wordmark with a small pitch mark. The mark is a top-down pitch:
// outline, halfway line, centre circle. Reads at 20px and scales to print.
export default function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none" aria-label="Football Analytics">
      <svg width="26" height="18" viewBox="0 0 26 18" fill="none" aria-hidden className="shrink-0">
        <rect x="1" y="1" width="24" height="16" stroke="currentColor" strokeWidth="1.6" />
        <line x1="13" y1="1" x2="13" y2="17" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="13" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        <rect x="1" y="5.5" width="4" height="7" stroke="currentColor" strokeWidth="1.2" />
        <rect x="21" y="5.5" width="4" height="7" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className="font-head font-semibold text-[1.35rem] leading-none tracking-[0.01em]">
        Football<span className="text-s-accent">Analytics</span>
        {!compact && <span className="text-s-muted font-medium">.pro</span>}
      </span>
    </span>
  );
}
