import SlipOptionButton from './SlipOptionButton';
import type { SlipLegInput } from './AddToSlipButton';

// ============================================================================
// "Kupona ekle" pazar ızgarası (slip-1.1, 2026-10-17): maç sayfasında hero'nun hemen
// altında; 1X2, Üst/Alt 2,5, KG, Asya handikapı, beraberlikte iade tek bakışta,
// her seçim model % ve (varsa) bahisçi oranıyla. Sunucu bileşeni; metinler sayfadan.
// ============================================================================

export interface SlipOption { leg: SlipLegInput; label: string; meta: string }
export interface SlipGroup { key: string; title: string; note?: string; options: SlipOption[] }

export default function SlipMarkets({ groups, labels }: { groups: SlipGroup[]; labels: { title: string; lead: string } }) {
  const shown = groups.filter((g) => g.options.length > 0);
  if (!shown.length) return null;
  return (
    <section className="card !gap-4 !p-5 sm:!p-6" aria-labelledby="slip-markets-title" data-testid="slip-markets">
      <div>
        <p id="slip-markets-title" className="kicker">{labels.title}</p>
        <p className="mt-1 text-[13px] leading-snug text-s-muted">{labels.lead}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((g) => (
          <div key={g.key} className="min-w-0">
            <p className="mb-2 flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-wide text-s-muted">
              <span>{g.title}</span>
              {g.note && <span className="num normal-case tracking-normal">{g.note}</span>}
            </p>
            <div className={`grid gap-2 ${g.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {g.options.map((o) => <SlipOptionButton key={`${o.leg.market}:${o.leg.selection}:${o.leg.line ?? ''}`} leg={o.leg} label={o.label} meta={o.meta} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
