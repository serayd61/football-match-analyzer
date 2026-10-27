// ============================================================================
// PAZAR BAZLI STRATEJİ — 1X2 ve KG için motor + piyasa kuralı (saf, testli)
// ----------------------------------------------------------------------------
// Neden (2026-10-27, kapsanan ligler 1 Eyl–26 Eki, 588 maç, aynı maçlarda):
//   1X2: motor favori p≥60 → %72 (iddia %70); piyasa ≥60 → %68; harman ≥60 → %70.
//        Motor ile piyasa FARKLI favori gösterdiğinde motor %25, piyasa %39 (n=64) →
//        ayrışmada çekimser kal. LLM oyu %48 (yazı turanın altı) → sıfır ağırlık.
//   KG:  her maça "Var" tabanı %60; motor yön %55 (tabanın altı); KG Yok motor ≤40
//        %42 (iddia %65). KG Var piyasa ≥60 → %69, harman ≥60 → %68, motor ≥60 → %63.
//        → öncü kaynak piyasa, motor onay filtresi; KG Yok hiç önerilmez; LLM %44 → sıfır.
// Üst/Alt bu modülün dışında (mevcut konsensüs; geçen hafta 8/10).
// Çekimser (abstain): tahmin yine yazılır (DB kısıtı, karne) ama güven tavanı 49 ve
// "en sağlam bahis" bu pazarı seçemez.
// ============================================================================
export interface Probs1x2 { home: number; draw: number; away: number }
export interface StrategyInput {
  /** ham Dixon-Coles (piyasa harmanı ÖNCESİ) */
  dc?: Probs1x2 | null;
  /** marjsız piyasa 1X2 */
  market?: Probs1x2 | null;
  dcBttsYes?: number | null;
  marketBttsYes?: number | null;
}
export interface StrategyPick { prediction: string; confidence: number; abstain: boolean; reasoning: string; source: 'dc+market' | 'dc' | 'market' }

export const STRATEGY = { minP1x2: 0.60, minMarketBtts: 0.60, minDcBtts: 0.55, marketWeight: 0.7, abstainCap: 49 } as const;

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const okP = (p?: Probs1x2 | null): p is Probs1x2 => !!p && fin(p.home) && fin(p.draw) && fin(p.away) && p.home + p.draw + p.away > 0.9 && p.home + p.draw + p.away < 1.1;
const fav = (p: Probs1x2): keyof Probs1x2 => (p.home >= p.draw && p.home >= p.away ? 'home' : p.away >= p.draw ? 'away' : 'draw');
const label: Record<keyof Probs1x2, string> = { home: '1', draw: 'X', away: '2' };
const pct = (x: number) => Math.round(100 * x);

/** 1X2: motor ve piyasa aynı favoriyi göstermeli, harman p ≥ 0,60. Ayrışma → çekimser. */
export function strategy1x2(dc?: Probs1x2 | null, market?: Probs1x2 | null): StrategyPick | null {
  const d = okP(dc) ? dc : null, m = okP(market) ? market : null;
  if (!d && !m) return null;
  if (d && m) {
    const fd = fav(d), fm = fav(m);
    const w = STRATEGY.marketWeight;
    const bl: Probs1x2 = { home: (1 - w) * d.home + w * m.home, draw: (1 - w) * d.draw + w * m.draw, away: (1 - w) * d.away + w * m.away };
    const fb = fav(bl), p = bl[fb];
    if (fd !== fm) return { prediction: label[fb], confidence: Math.min(STRATEGY.abstainCap, pct(p)), abstain: true, source: 'dc+market', reasoning: `Çekimser: motor ${label[fd]} (%${pct(d[fd])}) ile piyasa ${label[fm]} (%${pct(m[fm])}) ayrışıyor; ayrışmada motor %25, piyasa %39 tutuyor.` };
    const abstain = p < STRATEGY.minP1x2;
    return { prediction: label[fb], confidence: abstain ? Math.min(STRATEGY.abstainCap, pct(p)) : pct(p), abstain, source: 'dc+market', reasoning: abstain ? `Çekimser: motor ve piyasa ${label[fb]} diyor ama harman %${pct(p)} < %${pct(STRATEGY.minP1x2)}.` : `Motor (%${pct(d[fb])}) ve piyasa (%${pct(m[fb])}) aynı favori; harman %${pct(p)}.` };
  }
  const src = d ?? m!, f = fav(src), p = src[f], abstain = p < STRATEGY.minP1x2;
  return { prediction: label[f], confidence: abstain ? Math.min(STRATEGY.abstainCap, pct(p)) : pct(p), abstain, source: d ? 'dc' : 'market', reasoning: `${d ? 'Yalnız motor' : 'Yalnız piyasa'} (%${pct(p)})${abstain ? ' — eşik altı, çekimser' : ''}.` };
}

/** KG: piyasa Var ≥ 0,60 ve motor Var ≥ 0,55 → "Var". Aksi çekimser; "Yok" hiç önerilmez. */
export function strategyBtts(dcYes?: number | null, marketYes?: number | null): StrategyPick | null {
  const d = fin(dcYes) ? dcYes : null, m = fin(marketYes) ? marketYes : null;
  if (d == null && m == null) return null;
  const w = STRATEGY.marketWeight;
  const yes = d != null && m != null ? (1 - w) * d + w * m : (m ?? d)!;
  const prediction = yes >= 0.5 ? 'Yes' : 'No';
  const passes = m != null && m >= STRATEGY.minMarketBtts && (d == null || d >= STRATEGY.minDcBtts);
  const source: StrategyPick['source'] = d != null && m != null ? 'dc+market' : d != null ? 'dc' : 'market';
  if (passes) return { prediction: 'Yes', confidence: pct(yes), abstain: false, source, reasoning: `KG Var: piyasa %${pct(m!)}${d != null ? `, motor %${pct(d)}` : ''}; harman %${pct(yes)}.` };
  const why = m == null ? 'piyasa oranı yok' : m < STRATEGY.minMarketBtts ? `piyasa Var %${pct(m)} < %${pct(STRATEGY.minMarketBtts)}` : `motor Var %${pct(d!)} < %${pct(STRATEGY.minDcBtts)}`;
  return { prediction, confidence: Math.min(STRATEGY.abstainCap, pct(Math.max(yes, 1 - yes))), abstain: true, source, reasoning: `Çekimser: ${why}. KG Yok önerilmez (motor ≤40 → %42 tuttu).` };
}

/** Marjsız iki yönlü olasılık (ör. KG Var) — oranlar geçersizse null. */
export function devigYes(yes?: number | null, no?: number | null): number | null {
  if (!fin(yes) || !fin(no) || yes <= 1 || no <= 1) return null;
  const a = 1 / yes, b = 1 / no; return a / (a + b);
}
export function devig1x2(o?: { home: number; draw: number; away: number } | null): Probs1x2 | null {
  if (!o || !fin(o.home) || !fin(o.draw) || !fin(o.away) || o.home <= 1 || o.draw <= 1 || o.away <= 1) return null;
  const h = 1 / o.home, d = 1 / o.draw, a = 1 / o.away, s = h + d + a; return { home: h / s, draw: d / s, away: a / s };
}
