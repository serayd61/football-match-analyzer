// ============================================================================
// ELO BLEND — Club Elo'yu bağımsız bir 1X2 tahminine çevirir ve Dixon-Coles
// çıktısıyla harmanlar. ELO'nun kattığı sinyal: kupa/Avrupa formu + uzun hafıza
// + piyasa-benzeri kalibrasyon (gol/xG penceresinin göremediği).
//
//   p = (1 - λ) · p_DC  +  λ · p_ELO        (yalnız 1X2; Ü/A ve KG DC'den korunur)
//
// ELO→1X2: eğitimde fit edilmiş  gol_farkı ≈ a·(elo_h − elo_a) + b  eşlemesi
// (b = ev avantajı, gol) → supremacy → (λ_h, λ_a) → Poisson + Dixon-Coles(rho).
// Backtest (engine/backtest_elo.py) 5/5 top-ligde log-loss + Brier iyileştirdi.
//
// ELO verisi/takım yoksa DC değişmeden döner (graceful fallback).
// ============================================================================

import type { MarketProbabilities } from '@/lib/statistical/dixon-coles';

const RHO = -0.1;
const MAX_GOALS = 10;

/** Lig-başı ELO→gol eşleme + harman ağırlığı (team_elo.elo JSONB'den). */
export interface EloParams {
  a: number;      // gol / ELO-puanı
  b: number;      // ev avantajı (gol)
  total: number;  // lig ortalama toplam gol
  lambda: number; // harman ağırlığı 0..1
}

function poisson(k: number, lam: number): number {
  if (lam <= 0) return k === 0 ? 1 : 0;
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lam) * Math.pow(lam, k)) / fact;
}

function normalize3(a: number, b: number, c: number): [number, number, number] {
  const s = a + b + c;
  return s > 0 ? [a / s, b / s, c / s] : [a, b, c];
}

/**
 * ELO farkından (elo_home − elo_away) 1X2 olasılığı. backtest_elo.elo_probs birebir.
 */
export function eloProbs(eloDiff: number, p: EloParams): { home: number; draw: number; away: number } {
  const supRaw = p.a * eloDiff + p.b;
  const sup = Math.max(-2.5, Math.min(2.5, supRaw));
  const lamH = Math.max(0.05, Math.min(6.0, (p.total + sup) / 2));
  const lamA = Math.max(0.05, Math.min(6.0, (p.total - sup) / 2));

  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, i) => poisson(i, lamH));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, j) => poisson(j, lamA));

  let H = 0, D = 0, A = 0, tot = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      let pr = ph[i] * pa[j];
      if (i === 0 && j === 0) pr *= 1 - lamH * lamA * RHO;
      else if (i === 1 && j === 0) pr *= 1 + lamA * RHO;
      else if (i === 0 && j === 1) pr *= 1 + lamH * RHO;
      else if (i === 1 && j === 1) pr *= 1 - RHO;
      if (pr < 0) pr = 0;
      tot += pr;
      if (i > j) H += pr;
      else if (i === j) D += pr;
      else A += pr;
    }
  }
  return tot > 0 ? { home: H / tot, draw: D / tot, away: A / tot } : { home: H, draw: D, away: A };
}

/**
 * DC olasılıklarını ELO ile harmanlar. Yalnız 1X2 (matchResult) değişir; Ü/A, KG,
 * beklenen gol, skor matrisi DC'den korunur (ELO bunları bilgilendirmez).
 * eloHome/eloAway sayısal ELO; herhangi biri yoksa DC aynen döner.
 */
export function blendWithElo(
  dc: MarketProbabilities,
  eloHome: number | null | undefined,
  eloAway: number | null | undefined,
  params: EloParams | null | undefined
): MarketProbabilities {
  if (eloHome == null || eloAway == null || !params) return dc;
  const lam = Math.max(0, Math.min(1, params.lambda));
  if (lam === 0) return dc;

  const pe = eloProbs(eloHome - eloAway, params);
  const [h, d, a] = normalize3(
    (1 - lam) * dc.matchResult.home + lam * pe.home,
    (1 - lam) * dc.matchResult.draw + lam * pe.draw,
    (1 - lam) * dc.matchResult.away + lam * pe.away
  );
  return { ...dc, matchResult: { home: h, draw: d, away: a } };
}
