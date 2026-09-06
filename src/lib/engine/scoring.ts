// ============================================================================
// MOTOR PUANLAMA — saf fonksiyonlar (DB yok, ağ yok; birim testli)
// ----------------------------------------------------------------------------
// Bir tahminin GERÇEKLEŞEN sonuca göre kalitesi. Üç pazar:
//   1X2  : 3 sınıf. log-loss = −ln p(gerçek), Brier = Σ_k (p_k − 1[k=y])²  (0..2)
//   Ü/A  : ikili, p = p_over25, y = (toplam gol ≥ 3)
//   KG   : ikili, p = p_btts_yes, y = (iki takım da gol attı)
// Referans (rastgele model): 1X2 log-loss 1.0986, Brier 0.6667; ikili Brier 0.25.
//
// Seçim (pick) kuralı pazar modülünden gelir (lib/goal-markets.ts): ≥ 0.5 → over/yes.
// Eksik olasılık HİÇBİR ZAMAN 0 sayılmaz (lib/calibration-eval.finiteOrNull);
// o pazarın skoru null kalır ve toplamda paydaya girmez.
//
// Kalibrasyon kovaları: 10 eşit kova, p ∈ [0,1]. Kova başına n, Σp, Σy saklanır
// (ortalama değil) — haftalar kesin toplanabilir. ECE = Σ_b (n_b/N)·|p̄_b − ȳ_b|.
// ============================================================================

import { finiteOrNull } from '@/lib/calibration-eval';
import { deriveOverUnder, deriveBtts, isOverUnderCorrect, isBttsCorrect } from '@/lib/goal-markets';

export type Outcome = 'H' | 'D' | 'A';
export type Pick1x2 = '1' | 'X' | '2';

const EPS = 1e-6;
const clip = (p: number) => Math.min(1 - EPS, Math.max(EPS, p));
const r4 = (x: number) => Math.round(x * 10000) / 10000;

export function outcomeOf(homeGoals: number, awayGoals: number): Outcome {
  return homeGoals > awayGoals ? 'H' : homeGoals < awayGoals ? 'A' : 'D';
}

export function pickMatches(pick: Pick1x2 | string | null | undefined, y: Outcome): boolean {
  return (pick === '1' && y === 'H') || (pick === 'X' && y === 'D') || (pick === '2' && y === 'A');
}

export interface Probs1x2 { home: number; draw: number; away: number }

/** 3-sınıf log-loss ve Brier. Olasılıklar toplamı 1'e normalize edilir (ingest ±0.02 tolere eder). */
export function score1x2(p: Probs1x2, y: Outcome): { ll: number; brier: number } {
  const s = p.home + p.draw + p.away;
  const ph = s > 0 ? p.home / s : 1 / 3, pd = s > 0 ? p.draw / s : 1 / 3, pa = s > 0 ? p.away / s : 1 / 3;
  const py = y === 'H' ? ph : y === 'D' ? pd : pa;
  const yh = y === 'H' ? 1 : 0, yd = y === 'D' ? 1 : 0, ya = y === 'A' ? 1 : 0;
  return {
    ll: r4(-Math.log(clip(py))),
    brier: r4((ph - yh) ** 2 + (pd - yd) ** 2 + (pa - ya) ** 2),
  };
}

/** İkili log-loss ve Brier; p = "evet" olasılığı, y = gerçekleşti mi. */
export function scoreBinary(p: number, y: boolean): { ll: number; brier: number } {
  const q = clip(p);
  const yy = y ? 1 : 0;
  return {
    ll: r4(-(yy * Math.log(q) + (1 - yy) * Math.log(1 - q))),
    brier: r4((p - yy) ** 2),
  };
}

export interface ScorableRow {
  p_home: unknown; p_draw: unknown; p_away: unknown;
  p_over25?: unknown; p_btts_yes?: unknown;
  pick?: string | null;
}

/** engine_predictions'a yazılacak settlement + skor sütunları (Faz 1 şeması). */
export interface RowScores {
  result: Outcome;
  correct: boolean;
  ou_pick: 'over' | 'under' | null;
  ou_correct: boolean | null;
  btts_pick: 'yes' | 'no' | null;
  btts_correct: boolean | null;
  ll_1x2: number | null;
  brier_1x2: number | null;
  ll_ou25: number | null;
  brier_ou25: number | null;
  ll_btts: number | null;
  brier_btts: number | null;
}

/**
 * Tek satır için tüm pazarların settlement'ı ve skoru. Eksik/geçersiz olasılık
 * → ilgili alanlar null (asla 0). 1X2 olasılığı eksikse ll/brier null kalır
 * ama result/correct yine yazılır (correct pick'ten).
 */
export function rowScores(row: ScorableRow, homeGoals: number, awayGoals: number): RowScores {
  const y = outcomeOf(homeGoals, awayGoals);
  const ph = finiteOrNull(row.p_home), pd = finiteOrNull(row.p_draw), pa = finiteOrNull(row.p_away);
  const has1x2 = ph != null && pd != null && pa != null && ph >= 0 && pd >= 0 && pa >= 0 && ph + pd + pa > 0;
  const s1 = has1x2 ? score1x2({ home: ph!, draw: pd!, away: pa! }, y) : null;

  // deriveOverUnder/deriveBtts `Number(null)` → 0 yapar ("%100 Alt" tuzağı);
  // bu yüzden null burada süzülür ve pazar modülüne yalnız sayı gider.
  const pOver = finiteOrNull(row.p_over25);
  const ou = pOver == null ? null : deriveOverUnder(pOver);
  const sOu = ou && pOver != null ? scoreBinary(pOver, homeGoals + awayGoals >= 3) : null;

  const pBtts = finiteOrNull(row.p_btts_yes);
  const bt = pBtts == null ? null : deriveBtts(pBtts);
  const sBt = bt && pBtts != null ? scoreBinary(pBtts, homeGoals > 0 && awayGoals > 0) : null;

  return {
    result: y,
    correct: pickMatches(row.pick, y),
    ou_pick: ou?.pick ?? null,
    ou_correct: ou ? isOverUnderCorrect(ou.pick, homeGoals, awayGoals) : null,
    btts_pick: bt?.pick ?? null,
    btts_correct: bt ? isBttsCorrect(bt.pick, homeGoals, awayGoals) : null,
    ll_1x2: s1?.ll ?? null,
    brier_1x2: s1?.brier ?? null,
    ll_ou25: sOu?.ll ?? null,
    brier_ou25: sOu?.brier ?? null,
    ll_btts: sBt?.ll ?? null,
    brier_btts: sBt?.brier ?? null,
  };
}

// ----------------------------------------------------------------------------
// ISO hafta
// ----------------------------------------------------------------------------
export interface IsoWeek { isoYear: number; isoWeek: number; weekStart: Date; weekEnd: Date }

/** ISO-8601 hafta (Pazartesi başlar, UTC). weekEnd hariçtir (sonraki Pazartesi 00:00Z). */
export function isoWeekOf(d: Date): IsoWeek {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; // Pazar = 7
  const monday = new Date(t.getTime() - (day - 1) * 86400000);
  // ISO yılı: haftanın Perşembesinin yılı
  const thursday = new Date(monday.getTime() + 3 * 86400000);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const isoWeek = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86400000)) + 1;
  return { isoYear, isoWeek, weekStart: monday, weekEnd: new Date(monday.getTime() + 7 * 86400000) };
}

/** 'YYYY-Www' → hafta; geçersizse null. */
export function parseIsoWeek(s: string | null | undefined): IsoWeek | null {
  const m = /^(\d{4})-W(\d{1,2})$/i.exec((s || '').trim());
  if (!m) return null;
  const year = Number(m[1]), week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const monday = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
  const w = isoWeekOf(monday);
  return w.isoYear === year && w.isoWeek === week ? w : null;
}

export function isoWeekLabel(w: { isoYear: number; isoWeek: number }): string {
  return `${w.isoYear}-W${String(w.isoWeek).padStart(2, '0')}`;
}

/** Önceki hafta (Pazartesi çalıştırmasında "geçen hafta"). */
export function previousIsoWeek(now = new Date(), back = 1): IsoWeek {
  const cur = isoWeekOf(now);
  return isoWeekOf(new Date(cur.weekStart.getTime() - back * 7 * 86400000));
}

// ----------------------------------------------------------------------------
// Kalibrasyon kovaları / ECE
// ----------------------------------------------------------------------------
export const N_BINS = 10;

export interface BinAcc { bin: number; n: number; sum_pred: number; sum_obs: number }

export function binIndex(p: number, bins = N_BINS): number {
  if (!Number.isFinite(p)) return -1;
  return Math.min(bins - 1, Math.max(0, Math.floor(p * bins)));
}

export function makeBinAccs(bins = N_BINS): BinAcc[] {
  return Array.from({ length: bins }, (_, i) => ({ bin: i, n: 0, sum_pred: 0, sum_obs: 0 }));
}

export function addToBins(accs: BinAcc[], p: number, y: boolean): void {
  const i = binIndex(p, accs.length);
  if (i < 0) return;
  accs[i].n++; accs[i].sum_pred += p; accs[i].sum_obs += y ? 1 : 0;
}

/** Beklenen kalibrasyon hatası; kova toplamlarından (haftalar toplanabilir). */
export function eceFromBins(bins: Array<{ n: number; sum_pred: number; sum_obs: number }>): number | null {
  const N = bins.reduce((s, b) => s + b.n, 0);
  if (!N) return null;
  let e = 0;
  for (const b of bins) if (b.n) e += (b.n / N) * Math.abs(b.sum_pred / b.n - b.sum_obs / b.n);
  return r4(e);
}

/** Toplama yardımcısı: aynı `bin` indeksli kayıtları birleştirir. */
export function mergeBins(groups: Array<Array<{ bin: number; n: number; sum_pred: number; sum_obs: number }>>, bins = N_BINS): BinAcc[] {
  const out = makeBinAccs(bins);
  for (const g of groups) for (const b of g) {
    if (b.bin < 0 || b.bin >= bins) continue;
    out[b.bin].n += b.n; out[b.bin].sum_pred += Number(b.sum_pred); out[b.bin].sum_obs += Number(b.sum_obs);
  }
  return out;
}
