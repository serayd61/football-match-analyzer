// Brand v3: a small rounded pitch mark (two halves + centre spot) in brand
// green, then "footballanalytics" in lowercase 700 with ".pro" muted.
export default function Wordmark({ compact = false }: { compact?: boolean }) {
  const s = compact ? 20 : 26;
  return (
    <span className="inline-flex items-center gap-2.5 select-none" aria-label="footballanalytics.pro">
      <svg width={s} height={s} viewBox="0 0 26 26" aria-hidden className="shrink-0">
        <rect x="1" y="1" width="24" height="24" rx="7" fill="rgb(var(--s-brand))" />
        <path d="M13 4v18" stroke="rgb(var(--s-brand-ink))" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
        <circle cx="13" cy="13" r="3.4" fill="none" stroke="rgb(var(--s-brand-ink))" strokeWidth="1.6" opacity=".9" />
        <path d="M4 8.5h3.5v9H4M22 8.5h-3.5v9H22" fill="none" stroke="rgb(var(--s-brand-ink))" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
      </svg>
      <span className={`font-head font-bold leading-none tracking-[-0.02em] ${compact ? 'text-[14px]' : 'text-[17px]'}`}>
        footballanalytics<span className="font-semibold text-s-muted">.pro</span>
      </span>
    </span>
  );
}
