import type { MarketStanding } from '@/lib/site/match-standing';

// "Bu maç karnemizde nerede": pazar başına bir ölçek. İşaret = o kovadaki geçmiş
// isabetimiz; 50 ve 65 çizgileri eşik. Renk yalnız hükümden gelir (güçlü/orta/zayıf).
// Sunucu bileşeni; metinler sayfadan çevrilmiş gelir.

export interface StandingLabels {
  market: Record<'1x2' | 'ou25' | 'btts', string>;
  selection: (s: MarketStanding) => string;
  verdict: Record<MarketStanding['verdict'], string>;
  evidence: (e: MarketStanding['primary']) => string;
  scopeLeague: (won: number, n: number) => string;
  scopeAll: (won: number, n: number) => string;
  thin: string;
  model: string;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;
const tone: Record<MarketStanding['verdict'], string> = {
  strong: 'bg-s-win text-white', mid: 'bg-s-raised text-s-ink', weak: 'bg-s-loss text-white', thin: 'border border-s-line text-s-muted',
};
const mark: Record<MarketStanding['verdict'], string> = { strong: 'bg-s-win', mid: 'bg-s-ink', weak: 'bg-s-loss', thin: 'bg-s-muted' };

export default function MatchStanding({ rows, labels }: { rows: MarketStanding[]; labels: StandingLabels }) {
  // v3 (2026-09-27): her pazar kendi kartında; işaret etiketi ölçeğin ÜSTÜNDE ayrı satırda,
  // eksen etiketleri ALTINDA ayrı satırda — hiçbir yazı bir başkasının üstüne binmez.
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((s) => {
        const acc = s.acc;
        const pos = acc == null ? null : Math.min(97, Math.max(3, acc * 100));
        return (
          <div key={s.market} className="flex flex-col gap-2 rounded-xl border border-s-line bg-s-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[15px] font-bold leading-tight">{labels.market[s.market]}</span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone[s.verdict]}`}>{labels.verdict[s.verdict]}</span>
            </div>
            <p className="text-[13px] text-s-muted">{labels.selection(s)} · {labels.model} <span className="num font-semibold text-s-ink">{pct(s.modelP)}</span></p>

            {/* işaret etiketi satırı */}
            <div className="relative h-4 text-[12px]">
              {pos != null && <span className="num absolute -translate-x-1/2 font-bold leading-none" style={{ left: `${pos}%` }}>{pct(acc!)}</span>}
            </div>
            {/* ölçek */}
            <div className="relative h-3">
              <div className="absolute inset-x-0 top-1 h-1.5 rounded-full bg-s-raised" />
              {acc != null && <div className="absolute left-0 top-1 h-1.5 rounded-full opacity-30" style={{ width: `${acc * 100}%`, background: 'currentColor' }} />}
              <div className="absolute -top-0.5 h-4 w-px bg-s-n400" style={{ left: '50%' }} />
              <div className="absolute -top-0.5 h-4 w-px bg-s-n400" style={{ left: '65%' }} />
              {pos != null && <div className={`absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-sm ${mark[s.verdict]}`} style={{ left: `${pos}%` }} />}
            </div>
            {/* eksen satırı */}
            <div className="num relative h-3 text-[10px] leading-none text-s-muted">
              <span className="absolute left-0">0%</span>
              <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>50</span>
              <span className="absolute -translate-x-1/2" style={{ left: '65%' }}>65</span>
              <span className="absolute right-0">100%</span>
            </div>

            <p className="mt-1 text-[12px] leading-snug text-s-muted">
              {labels.evidence(s.primary)}
              {' · '}
              {acc == null ? labels.thin : s.scope === 'league' ? labels.scopeLeague(s.won, s.n) : labels.scopeAll(s.won, s.n)}
            </p>
            {s.secondary && s.secondary.all.n >= 10 && (
              <p className="text-[12px] leading-snug text-s-muted">
                {labels.evidence(s.secondary)}
                {' · '}
                {s.secondary.league && s.secondary.league.n >= 10 ? labels.scopeLeague(s.secondary.league.won, s.secondary.league.n) : labels.scopeAll(s.secondary.all.won, s.secondary.all.n)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
