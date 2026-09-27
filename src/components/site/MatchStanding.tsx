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
  /** "geçmişte tuttu" başlığı (v3) */
  hit: string;
  /** "n maç" kısa örneklem etiketi (v3) */
  sample: (n: number) => string;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;
const tone: Record<MarketStanding['verdict'], string> = {
  strong: 'bg-s-win text-white', mid: 'bg-s-raised text-s-ink', weak: 'bg-s-loss text-white', thin: 'border border-s-line text-s-muted',
};
const mark: Record<MarketStanding['verdict'], string> = { strong: 'bg-s-win', mid: 'bg-s-ink', weak: 'bg-s-loss', thin: 'bg-s-muted' };

const numTone: Record<MarketStanding['verdict'], string> = { strong: 'text-s-win', mid: 'text-s-ink', weak: 'text-s-loss', thin: 'text-s-muted' };

export default function MatchStanding({ rows, labels }: { rows: MarketStanding[]; labels: StandingLabels }) {
  // v3.1 (2026-09-27): iki büyük sayı yan yana — "Model" vs "Geçmişte tuttu" — altında sade ölçek.
  // Ölçek üzerinde yüzen yazı yok; işaret yalnız konum gösterir, sayı üstteki blokta.
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((s) => {
        const acc = s.acc;
        const pos = acc == null ? null : Math.min(98, Math.max(2, acc * 100));
        return (
          <div key={s.market} className="flex flex-col gap-3 rounded-xl border border-s-line bg-s-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[15px] font-bold leading-tight">{labels.market[s.market]}</div>
                <div className="mt-0.5 truncate text-[13px] text-s-muted">{labels.selection(s)}</div>
              </div>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tone[s.verdict]}`}>{labels.verdict[s.verdict]}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-s-raised/60 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{labels.model}</div>
                <div className="num text-[24px] font-bold leading-none">{pct(s.modelP)}</div>
              </div>
              <div className="rounded-lg bg-s-raised/60 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-s-muted">{labels.hit}</div>
                <div className={`num text-[24px] font-bold leading-none ${numTone[s.verdict]}`}>{acc == null ? '–' : pct(acc)}</div>
                {acc != null && <div className="num mt-0.5 text-[11px] text-s-muted">{labels.sample(s.n)}</div>}
              </div>
            </div>

            {/* ölçek: 0–100, 50 ve 65 eşik çizgileri, işaret = geçmiş isabet */}
            <div>
              <div className="relative h-4">
                <div className="absolute inset-x-0 top-[6px] h-1 rounded-full bg-s-n300" />
                {acc != null && <div className={`absolute left-0 top-[6px] h-1 rounded-full ${mark[s.verdict]} opacity-40`} style={{ width: `${acc * 100}%` }} />}
                <div className="absolute top-0 h-4 w-px bg-s-n400" style={{ left: '50%' }} />
                <div className="absolute top-0 h-4 w-px bg-s-n400" style={{ left: '65%' }} />
                {pos != null && <div className={`absolute top-0 h-4 w-[3px] -translate-x-1/2 rounded-sm ${mark[s.verdict]}`} style={{ left: `${pos}%` }} />}
              </div>
              <div className="num relative mt-1 h-3 text-[10px] leading-none text-s-muted">
                <span className="absolute left-0">0</span>
                <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>50</span>
                <span className="absolute -translate-x-1/2" style={{ left: '65%' }}>65</span>
                <span className="absolute right-0">100%</span>
              </div>
            </div>

            <p className="text-[12px] leading-snug text-s-muted">
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
