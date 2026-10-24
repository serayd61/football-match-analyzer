import { Sparkles, Gavel } from 'lucide-react';

// Liste rozeti (18 Eki): bu maç için otomatik AI görüşü hazır. Nötr "AI" işareti —
// Claude/Anthropic logosu marka izni ister; metinde "Claude" geçmesi serbest.
// 24 Eki: `verdict` → ajanların ortak kararı da var (survival verdict eşiği geçti);
// rozet dolu zemin + tokmak simgesi + kısa etiketle ayrışır. Karar yoksa eski görünüm.
export default function AiBadge({ label, verdict = false, verdictLabel }: { label: string; verdict?: boolean; verdictLabel?: string }) {
  if (verdict) {
    const l = verdictLabel || label;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-s-accent/60 bg-s-accent/20 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-s-accent-700" title={l} aria-label={l} data-testid="ai-badge-verdict">
        <Sparkles className="h-3 w-3" aria-hidden />
        AI
        <span className="mx-0.5 opacity-60" aria-hidden>·</span>
        <Gavel className="h-3 w-3" aria-hidden />
        {verdictLabel ? <span className="normal-case">{verdictLabel}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-s-accent/40 bg-s-accent/10 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-s-accent-700" title={label} aria-label={label} data-testid="ai-badge">
      <Sparkles className="h-3 w-3" aria-hidden />
      AI
    </span>
  );
}
