import { Sparkles, Gavel } from 'lucide-react';
import type { AiListFlag, AiPick, AiSel } from '@/lib/site/ai-list';

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

/** Satır altı AI özeti etiketleri (yerel): başlıklar + seçim adları. */
export interface AiDetailLabels { ai: string; agent: string; agents: string; sel: Record<AiSel, string> }

// Satır altı özet (24 Eki akşamı): "Filtreler" yerine liste satırında AI ve ajan detayı.
// Sol: AI'nin en iyi bahsi (bestBet) · sağ: ajanların ortak kararı + uzlaşı oranı. Her iki
// parça da yoksa hiçbir şey çizilmez. Rakamlar yüzde, yuvarlanmış; renk/ağırlık rozetle aynı.
export function AiDetail({ flag, labels }: { flag: AiListFlag; labels: AiDetailLabels }) {
  if (!flag.pick && !flag.agent) return null;
  const part = (lead: string, p: AiPick, tail?: string | null) => (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="font-semibold text-s-accent-700">{lead}</span>
      <span className="text-s-ink">{labels.sel[p.sel]}</span>
      <span className="num">%{p.conf}</span>
      {tail ? <span className="num text-s-muted">· {tail}</span> : null}
    </span>
  );
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] leading-tight text-s-muted" data-testid="ai-detail">
      {flag.pick && part(labels.ai, flag.pick)}
      {flag.agent && part(labels.agent, flag.agent, flag.agent.agents ? `${flag.agent.agents} ${labels.agents}` : null)}
    </p>
  );
}
