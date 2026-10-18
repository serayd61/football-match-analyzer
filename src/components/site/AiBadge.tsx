import { Sparkles } from 'lucide-react';

// Liste rozeti (18 Eki): bu maç için otomatik AI görüşü hazır. Nötr "AI" işareti —
// Claude/Anthropic logosu marka izni ister; metinde "Claude" geçmesi serbest.
export default function AiBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-s-accent/40 bg-s-accent/10 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-s-accent-700" title={label} aria-label={label}>
      <Sparkles className="h-3 w-3" aria-hidden />
      AI
    </span>
  );
}
