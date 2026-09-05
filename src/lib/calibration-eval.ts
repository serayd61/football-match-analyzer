// ============================================================================
// KALİBRASYON DEĞERLENDİRME — saf yardımcılar (cron + performans sayfası + test)
// ----------------------------------------------------------------------------
// Denetim 2026-09-05:
//   • Eski fit-calibration `Number(null)` → 0 dönüşümüyle eksik p_over25'i
//     "%100 Alt" örneğine çeviriyordu. Buradaki `finiteOrNull` null/undefined/
//     boş dizeyi DÖNÜŞTÜRMEDEN reddeder.
//   • `brier_after` aynı noktalar üzerinde ölçülüyordu (eğitim ölçümü). Burada
//     kronolojik ayrım (train → holdout) ve aylık walk-forward değerlendirme
//     vardır: eğri yalnız ÖNCEKİ sonuçları görür.
// ============================================================================

import { fitIsotonic, brier, applyCurve, type Knot } from './calibration';

export interface Pt { x: number; y: number }
export interface TPt extends Pt { t: number }

/** Strict numeric parse: null / undefined / '' / NaN / Infinity → null (never 0). */
export function finiteOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  if (typeof v === 'boolean') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface GoalRow { home_score: unknown; away_score: unknown; p_over25: unknown; p_btts_yes: unknown; kickoff?: string | null }
export interface GoalPoints { ou25: TPt[]; btts: TPt[]; skipped: { noScore: number; noOu: number; noBtts: number; outOfRange: number } }

const inUnit = (v: number | null): v is number => v != null && v >= 0 && v <= 1;

/** Goal-market calibration points; each market keeps its own valid sample count. */
export function goalPoints(rows: GoalRow[]): GoalPoints {
  const out: GoalPoints = { ou25: [], btts: [], skipped: { noScore: 0, noOu: 0, noBtts: 0, outOfRange: 0 } };
  for (const r of rows) {
    const hs = finiteOrNull(r.home_score), as = finiteOrNull(r.away_score);
    if (hs == null || as == null) { out.skipped.noScore++; continue; }
    const t = r.kickoff ? Date.parse(r.kickoff) : 0;
    const pOver = finiteOrNull(r.p_over25);
    if (pOver == null) out.skipped.noOu++;
    else if (!inUnit(pOver)) out.skipped.outOfRange++;
    else {
      const pickOver = pOver >= 0.5;
      out.ou25.push({ x: pickOver ? pOver : 1 - pOver, y: pickOver === (hs + as >= 3) ? 1 : 0, t });
    }
    const pBtts = finiteOrNull(r.p_btts_yes);
    if (pBtts == null) out.skipped.noBtts++;
    else if (!inUnit(pBtts)) out.skipped.outOfRange++;
    else {
      const pickYes = pBtts >= 0.5;
      out.btts.push({ x: pickYes ? pBtts : 1 - pBtts, y: pickYes === (hs > 0 && as > 0) ? 1 : 0, t });
    }
  }
  return out;
}

/** Chronological split: first (1-frac) → train, last frac → holdout. Input must be time-ordered. */
export function temporalSplit<T>(sorted: T[], holdoutFrac = 0.2, minTrain = 300): { train: T[]; holdout: T[] } {
  const cut = Math.floor(sorted.length * (1 - holdoutFrac));
  if (cut < minTrain) return { train: sorted, holdout: [] };
  return { train: sorted.slice(0, cut), holdout: sorted.slice(cut) };
}

export interface HoldoutStats { n: number; before: number; after: number; improvement: number }

/** Fit on train, score on holdout — an out-of-sample estimate of the curve's effect. */
export function holdoutBrier(train: Pt[], holdout: Pt[]): HoldoutStats | null {
  if (!holdout.length) return null;
  const knots = fitIsotonic(train);
  if (knots.length < 2) return null;
  const before = brier(holdout);
  const after = brier(holdout.map((p) => ({ x: applyCurve(p.x, knots) ?? p.x, y: p.y })));
  return { n: holdout.length, before, after, improvement: Math.round((before - after) * 10000) / 10000 };
}

export interface CalBin { lo: number; hi: number; n: number; predicted: number; observed: number }
interface BinAcc { lo: number; hi: number; n: number; sumP: number; won: number }

export function makeBins(): BinAcc[] {
  const bins: BinAcc[] = [];
  for (let i = 0; i < 7; i++) bins.push({ lo: 0.3 + i * 0.1, hi: 0.4 + i * 0.1, n: 0, sumP: 0, won: 0 });
  return bins;
}

export function addToBin(bins: BinAcc[], p: number, won: boolean): void {
  const bin = bins.find((b) => p >= b.lo && p < b.hi) || (p >= 1 ? bins[bins.length - 1] : null);
  if (bin) { bin.n++; bin.sumP += p; if (won) bin.won++; }
}

export function finishBins(bins: BinAcc[]): CalBin[] {
  return bins.filter((b) => b.n > 0).map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, predicted: b.sumP / b.n, observed: b.won / b.n }));
}

export interface WalkForward {
  bins: CalBin[];
  /** rows scored with a curve fitted only on earlier months */
  scored: number;
  /** rows in the warm-up period (no prior curve with enough samples) */
  warmup: number;
  firstScoredMonth: string | null;
  brierRaw: number | null;
  brierCalibrated: number | null;
}

const monthOf = (t: number) => new Date(t).toISOString().slice(0, 7);

/**
 * Month-by-month walk-forward: for each calendar month, fit the isotonic curve
 * on all points from earlier months (if ≥ minTrain) and score that month with
 * it. No point ever sees a curve trained on itself or on later data.
 */
export function walkForwardBins(points: TPt[], minTrain = 300): WalkForward {
  const sorted = [...points].filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  const byMonth = new Map<string, TPt[]>();
  for (const p of sorted) { const m = monthOf(p.t); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m)!.push(p); }
  const bins = makeBins();
  const prior: TPt[] = [];
  let scored = 0, warmup = 0, firstScoredMonth: string | null = null;
  let sqRaw = 0, sqCal = 0;
  for (const [month, pts] of byMonth) {
    if (prior.length >= minTrain) {
      const knots: Knot[] = fitIsotonic(prior);
      for (const p of pts) {
        const c = knots.length >= 2 ? applyCurve(p.x, knots) ?? p.x : p.x;
        addToBin(bins, c, p.y === 1);
        sqRaw += (p.x - p.y) ** 2; sqCal += (c - p.y) ** 2;
      }
      scored += pts.length;
      firstScoredMonth ??= month;
    } else {
      warmup += pts.length;
    }
    prior.push(...pts);
  }
  return {
    bins: finishBins(bins), scored, warmup, firstScoredMonth,
    brierRaw: scored ? Math.round((sqRaw / scored) * 10000) / 10000 : null,
    brierCalibrated: scored ? Math.round((sqCal / scored) * 10000) / 10000 : null,
  };
}
