// Brand: 28×28 accent square with "FA" 12px in the page colour, then
// "FOOTBALLANALYTICS.PRO" 800 — ".PRO" in accent. Reads at header size and
// scales down for the footer (`compact`).
export default function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none" aria-label="footballanalytics.pro">
      <span className={`grid shrink-0 place-items-center bg-s-accent font-head font-extrabold text-s-brand-ink ${compact ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[12px]'}`} aria-hidden>FA</span>
      <span className={`font-head font-extrabold uppercase leading-none tracking-[0.01em] ${compact ? 'text-[12px]' : 'text-[14px] sm:text-[15px]'}`}>
        FootballAnalytics<span className="text-s-accent">.pro</span>
      </span>
    </span>
  );
}
