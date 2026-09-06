// ============================================================================
// KAPI — iki sürümün eşleştirilmiş karşılaştırması (gate.py'nin TS karşılığı)
// ----------------------------------------------------------------------------
// Aynı maçta iki sürümün log-loss'u varsa fark d = ll_b − ll_a (negatif = b daha
// iyi). İki araç:
//   pairedBootstrap(d[])      — tek haftanın satırları için eşleştirilmiş bootstrap
//                               %95 aralığı (gate.py ile aynı yöntem, seed'li).
//   pairedFromSums(n, Σd, Σd²) — haftalık toplamlardan yuvarlanan pencere için
//                               normal yaklaşımlı %95 aralığı (bootstrap için
//                               satır gerekmez; tablolar Σ saklar).
// Karar kuralı (experiment-protocol §3): Δ < 0 ve aralık 0'ı dışlıyor ve n
// yeterli. Yön tutarlılığı (lig başına) burada değil raporda değerlendirilir.
// ============================================================================

export interface PairedStats {
  n: number;
  mean: number;
  lo: number;
  hi: number;
  /** aralık 0'ı dışlıyor ve ortalama negatif → b daha iyi */
  bBetter: boolean;
  /** aralık 0'ı dışlıyor ve ortalama pozitif → b daha kötü */
  bWorse: boolean;
}

/** Deterministik PRNG (mulberry32) — testte tekrarlanabilir bootstrap. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

export function pairedBootstrap(d: number[], boot = 2000, seed = 7): PairedStats | null {
  const n = d.length;
  if (n < 2) return null;
  const mean = d.reduce((s, x) => s + x, 0) / n;
  const rand = rng(seed);
  const samples = new Array<number>(boot);
  for (let b = 0; b < boot; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[Math.floor(rand() * n)];
    samples[b] = s / n;
  }
  samples.sort((x, y) => x - y);
  const lo = samples[Math.floor(0.025 * boot)];
  const hi = samples[Math.max(0, Math.floor(0.975 * boot) - 1)];
  return { n, mean: r4(mean), lo: r4(lo), hi: r4(hi), bBetter: hi < 0, bWorse: lo > 0 };
}

/** Yuvarlanan toplamlardan: ortalama ± 1.96·se, se = sqrt(var/n), var = (Σd² − n·mean²)/(n−1). */
export function pairedFromSums(n: number, sumD: number, sumD2: number): PairedStats | null {
  if (n < 2) return null;
  const mean = sumD / n;
  const varc = Math.max(0, (sumD2 - n * mean * mean) / (n - 1));
  const se = Math.sqrt(varc / n);
  const lo = mean - 1.96 * se, hi = mean + 1.96 * se;
  return { n, mean: r4(mean), lo: r4(lo), hi: r4(hi), bBetter: hi < 0, bWorse: lo > 0 };
}

export interface PromotionGate {
  minWeeks: number;
  minPaired: number;
  /** Δ log-loss (b − a) en az bu kadar negatif olmalı (mutlak) */
  minImprovement: number;
}

/** Terfi kapısı varsayılanları (plan §3b). */
export const PROMOTION_GATE: PromotionGate = { minWeeks: 4, minPaired: 600, minImprovement: 0.003 };

export interface GateInput {
  weeks: number;
  primary: PairedStats | null;                 // 1x2 log-loss
  secondary: Array<PairedStats | null>;         // ou25, btts log-loss — kötüleşmemeli
}

export interface GateVerdict { pass: boolean; reasons: string[] }

export function promotionVerdict(input: GateInput, gate: PromotionGate = PROMOTION_GATE): GateVerdict {
  const reasons: string[] = [];
  const p = input.primary;
  if (input.weeks < gate.minWeeks) reasons.push(`weeks ${input.weeks} < ${gate.minWeeks}`);
  if (!p) reasons.push('no paired 1x2 rows');
  else {
    if (p.n < gate.minPaired) reasons.push(`paired n ${p.n} < ${gate.minPaired}`);
    if (!(p.mean <= -gate.minImprovement)) reasons.push(`Δlog-loss ${p.mean} not ≤ −${gate.minImprovement}`);
    if (!(p.hi < 0)) reasons.push(`95% CI [${p.lo}, ${p.hi}] includes 0`);
  }
  for (const s of input.secondary) if (s && s.bWorse) reasons.push('a secondary market got significantly worse');
  return { pass: reasons.length === 0, reasons };
}
