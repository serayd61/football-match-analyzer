// ============================================================================
// GOL PAZARI PİYASA ÇIPASI (saf) — Üst 2,5 / KG Var olasılığını bahisçi oranıyla
// harmanlar: p = (1−w)·model + w·piyasa (marjsız). 1X2'deki blend.ts ile aynı fikir.
// ----------------------------------------------------------------------------
// Neden (2026-09-20 backtest): KG n=326 log-loss saf DC 0,673 → w=0,7 0,658 →
// saf piyasa 0,655; Üst football-data 3 lig×2 sezon: piyasa her ligde daha
// kalibre (E0 0,755→0,688), DC-tek Üst isabeti PL'de %50. w=0,7 kazancın
// çoğunu alırken model katkısını korur. Oran yoksa saf model aynen kalır.
// Devig: multiplicative (backtest ile birebir). Seçim yönü harmanlanmış
// olasılıktan türer; `pRaw` her zaman modelin ham değeri (karne kovaları için).
// ============================================================================
import { devigMultiplicative } from '@/lib/odds/devig';

export const GOAL_BLEND_WEIGHT = 0.7;

export interface GoalBook {
  over25: number | null;
  under25: number | null;
  bttsYes: number | null;
  bttsNo: number | null;
  phase: string | null;
}

export interface GoalCall<P extends string> {
  pick: P;
  /** gösterilen olasılık: harman varsa harman, yoksa kalibrasyon eğrisi */
  p: number | null;
  /** modelin ham olasılığı (seçilen taraf) */
  pRaw: number;
  /** marjsız piyasa olasılığı (seçilen taraf), oran yoksa null */
  pMarket: number | null;
  /** p piyasa ile harmanlandı mı */
  blended: boolean;
}

const valid = (o: number | null | undefined): o is number => o != null && Number.isFinite(o) && o > 1;

/** İki taraflı orandan ilk tarafın marjsız olasılığı; oran eksikse null. */
export function marketYes(a: number | null | undefined, b: number | null | undefined): number | null {
  if (!valid(a) || !valid(b)) return null;
  const [pa] = devigMultiplicative([a, b]);
  return Number.isFinite(pa) ? pa : null;
}

export function blendYes(pModelYes: number, pMarketYes: number | null, w = GOAL_BLEND_WEIGHT): number {
  if (pMarketYes == null) return pModelYes;
  const k = Math.max(0, Math.min(1, w));
  return (1 - k) * pModelYes + k * pMarketYes;
}

/** "Var/Üst" tarafının kullanılacak olasılığı: harman varsa harman, yoksa model. */
export function yesSideP<P extends string>(c: GoalCall<P> | null, yes: P): number | null {
  if (!c) return null;
  const v = c.blended && c.p != null ? c.p : c.pRaw;
  return c.pick === yes ? v : 1 - v;
}

/**
 * Tek pazarı harmanlar. `pDisplay` = oran yoksa gösterilecek değer (kalibrasyon eğrisi).
 * Yön harmanlanmış olasılıktan: %55 model + %42 piyasa → w=0,7 ile %46 → seçim ters döner.
 */
export function blendCall<P extends string>(
  pModelYes: number | null | undefined,
  yesOdds: number | null | undefined,
  noOdds: number | null | undefined,
  yes: P,
  no: P,
  pDisplay: (raw: number) => number | null,
  w = GOAL_BLEND_WEIGHT,
): GoalCall<P> | null {
  const v = Number(pModelYes);
  if (!Number.isFinite(v) || v < 0 || v > 1) return null;
  const m = marketYes(yesOdds, noOdds);
  if (m == null) {
    const pick = v >= 0.5 ? yes : no; const raw = v >= 0.5 ? v : 1 - v;
    return { pick, p: pDisplay(raw), pRaw: raw, pMarket: null, blended: false };
  }
  const b = blendYes(v, m, w);
  const pick = b >= 0.5 ? yes : no;
  const side = (x: number) => (pick === yes ? x : 1 - x);
  return { pick, p: side(b), pRaw: side(v), pMarket: side(m), blended: true };
}
