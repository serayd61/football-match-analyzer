// ============================================================================
// KESİN SKOR (saf, testli) — motor λ'larından skor olasılıkları (2026-10-14)
// ----------------------------------------------------------------------------
// Motor yalnız 1X2 / Ü-A 2,5 / KG yayımlar; skor matrisi λ_ev, λ_dep ve Dixon-Coles
// düzeltmesinden (engine/model.py predict ile aynı formül, rho = -0.10, 0..10 gol)
// burada türetilir. "Skor tahmini" = en olası skor, olasılığı EXACT_SCORE_MIN
// (%15) ve üzerindeyse. 180 günlük denetim (10.052 bitmiş maç): ≥%15'lik en olası
// skor 1.910 maçta çıktı, 283'ü tuttu (%14,8; iddia ort. %20,6) — büyük çoğunluğu
// 0-0 ve 1-0. Yani bir skor tahmini kabaca 7'de 1 tutar; sayfa bunu saklamaz,
// geçmiş karnesiyle birlikte gösterir.
// ============================================================================

export const EXACT_SCORE_MIN = 0.15;
/** Dixon-Coles düşük skor düzeltmesi — resmi sürüm dc-1.0 (engine_model_versions.params.rho). */
export const DC_RHO = -0.10;
const MAX_GOALS = 10;
const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800];

export interface ScoreProb { home: number; away: number; p: number }

const pois = (k: number, lam: number) => (lam <= 0 ? (k === 0 ? 1 : 0) : Math.exp(-lam) * Math.pow(lam, k) / FACT[k]);

/** Skor matrisi, olasılığa göre azalan (normalize edilmiş; DC düzeltmeli). */
export function scoreMatrix(lambdaHome: number, lambdaAway: number, rho = DC_RHO): ScoreProb[] {
  const lh = Math.min(Math.max(lambdaHome, 0.05), 6), la = Math.min(Math.max(lambdaAway, 0.05), 6);
  const ph: number[] = [], pa: number[] = [];
  for (let i = 0; i <= MAX_GOALS; i++) { ph.push(pois(i, lh)); pa.push(pois(i, la)); }
  const out: ScoreProb[] = [];
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      let p = ph[i] * pa[j];
      if (i === 0 && j === 0) p *= 1 - lh * la * rho;
      else if (i === 1 && j === 0) p *= 1 + la * rho;
      else if (i === 0 && j === 1) p *= 1 + lh * rho;
      else if (i === 1 && j === 1) p *= 1 - rho;
      if (p < 0) p = 0;
      total += p;
      out.push({ home: i, away: j, p });
    }
  }
  if (total > 0) for (const s of out) s.p /= total;
  return out.sort((a, b) => b.p - a.p || a.home + a.away - (b.home + b.away));
}

/** En olası skor; eşik altındaysa null. λ yoksa null. */
export function exactScorePick(lambdaHome: number | null | undefined, lambdaAway: number | null | undefined, min = EXACT_SCORE_MIN): ScoreProb | null {
  if (lambdaHome == null || lambdaAway == null || !Number.isFinite(lambdaHome) || !Number.isFinite(lambdaAway)) return null;
  const top = scoreMatrix(lambdaHome, lambdaAway)[0];
  return top && top.p >= min - 1e-12 ? top : null;
}

export type ScoreBucket = '15-18' | '18-20' | '20+';
export const SCORE_BUCKETS: ScoreBucket[] = ['15-18', '18-20', '20+'];

export function scoreBucket(p: number): ScoreBucket {
  return p >= 0.20 ? '20+' : p >= 0.18 ? '18-20' : '15-18';
}

export const scoreLabel = (s: { home: number; away: number }) => `${s.home}-${s.away}`;

export function settleScore(pick: { home: number; away: number }, homeScore: number | null, awayScore: number | null): boolean | null {
  if (homeScore == null || awayScore == null) return null;
  return pick.home === homeScore && pick.away === awayScore;
}

export interface Tally { n: number; won: number; claimed: number }
export const emptyTally = (): Tally => ({ n: 0, won: 0, claimed: 0 });
export function addTally(t: Tally, won: boolean, p: number): Tally { t.n++; if (won) t.won++; t.claimed += p; return t; }
export const hitRate = (t: Tally) => (t.n ? t.won / t.n : null);
export const claimedRate = (t: Tally) => (t.n ? t.claimed / t.n : null);
