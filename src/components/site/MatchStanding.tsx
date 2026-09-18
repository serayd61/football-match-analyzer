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
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {rows.map((s) => {
        const acc = s.acc;
        return (
          <div key={s.market} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{labels.market[s.market]}</span>
              <span className={`rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone[s.verdict]}`}>{labels.verdict[s.verdict]}</span>
            </div>
            <p className="text-sm text-s-muted">{labels.selection(s)} · {labels.model} <span className="num text-s-ink">{pct(s.modelP)}</span></p>
            <div className="relative mt-1 h-7">
              <div className="absolute inset-x-0 top-3 h-1.5 bg-s-raised" />
              <div className="absolute top-1 h-5 w-px bg-s-line" style={{ left: '50%' }} />
              <div className="absolute top-1 h-5 w-px bg-s-line" style={{ left: '65%' }} />
              {acc != null && (
                <>
                  <div className="absolute inset-y-0 left-0 top-3 h-1.5 opacity-30" style={{ width: `${acc * 100}%`, background: 'currentColor' }} />
                  <div className={`absolute top-0 h-7 w-1.5 rounded-[1px] ${mark[s.verdict]}`} style={{ left: `calc(${acc * 100}% - 3px)` }} />
                  <span className="num absolute -top-5 text-xs font-semibold" style={{ left: `calc(${acc * 100}% - 14px)` }}>{pct(acc)}</span>
                </>
              )}
              <span className="num absolute -bottom-4 left-0 text-[10px] text-s-muted">0%</span>
              <span className="num absolute -bottom-4 text-[10px] text-s-muted" style={{ left: 'calc(50% - 10px)' }}>50%</span>
              <span className="num absolute -bottom-4 text-[10px] text-s-muted" style={{ left: 'calc(65% - 10px)' }}>65%</span>
              <span className="num absolute -bottom-4 right-0 text-[10px] text-s-muted">100%</span>
            </div>
            <p className="mt-4 text-xs text-s-muted">
              {labels.evidence(s.primary)}
              {' · '}
              {acc == null ? labels.thin : s.scope === 'league' ? labels.scopeLeague(s.won, s.n) : labels.scopeAll(s.won, s.n)}
            </p>
            {s.secondary && s.secondary.all.n >= 10 && (
              <p className="text-xs text-s-muted">
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
