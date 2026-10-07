// Risk label for a pick, derived from its calibrated confidence (0–1).
// Thresholds (design handoff 2026-09-11): Low ≥ 74%, Medium 65–73%, High < 65%.
// A pick without a calibrated confidence is treated as High risk — the
// honest default when the model can't say how sure it is.
export type Risk = 'low' | 'medium' | 'high';

export const RISK_LOW = 0.74;
export const RISK_MEDIUM = 0.65;

export function riskOf(confidence: number | null | undefined): Risk {
  if (confidence == null) return 'high';
  if (confidence >= RISK_LOW) return 'low';
  if (confidence >= RISK_MEDIUM) return 'medium';
  return 'high';
}

/** Expected loss rate in whole percent (100 − confidence). */
export function lossRate(confidence: number | null | undefined): number | null {
  if (confidence == null) return null;
  return Math.max(0, Math.min(100, 100 - Math.round(confidence * 100)));
}

// ── Piyasa koruması (2026-09-27, canlı denetim n=403, kapanış oranı) ──────────
// Model seçimi piyasa favorisinden AYRIŞTIĞINDA isabet %27.7 (65 maç); piyasa favorisi
// %45'in altındaysa ("sıkı maç") anlaşsa bile %27.9 (111 maç). Anlaşıp favori ≥ %55 ise
// %68.1. Güvenden gelen etiket yalnız YÜKSELTİLİR, hiç düşürülmez: koruma edge iddiası
// değil, kayıp kesicidir. Piyasa yoksa etiket değişmez.
// ── Fark koruması (2026-10-08, 422 kapanış-oranlı maç, Tem–Eyl) ───────────────
// Seçimin model olasılığı piyasanın marjsız olasılığının ≥5 puan ÜSTÜNDEYSE isabet
// %30 (115 maç: +5…+10 %33, ≥+10 %27); −5…+1 bandında %50–56, piyasa ≥%70 favoriyken
// model altındaysa %90. Pozitif "fark" değer değil aşırı güven sinyali: risk 'high'a
// yükselir. Sıra: disagree > over > tight (ayrışma zaten en kötü kova).
export type MarketFlag = 'disagree' | 'over' | 'tight' | null;
/** Model seçimi piyasadan bu kadar (olasılık) yukarıdaysa 'over'. */
export const OVER_EDGE = 0.05;
/** 'over' kovasının canlı sicili (yüzde) — uyarı metinlerinde kullanılır. */
export const OVER_ACC = 30;
/** Piyasa favorisi bu olasılığın altındaysa maç "sıkı" sayılır. */
export const TIGHT_FAV = 0.45;

export interface MarketProbs { pHome: number; pDraw: number; pAway: number }

export function marketFavourite(m: MarketProbs): '1' | 'X' | '2' {
  if (m.pHome >= m.pDraw && m.pHome >= m.pAway) return '1';
  if (m.pAway >= m.pHome && m.pAway >= m.pDraw) return '2';
  return 'X';
}

export function marketPickP(pick: '1' | 'X' | '2' | null | undefined, m: MarketProbs | null | undefined): number | null {
  if (!pick || !m) return null;
  return pick === '1' ? m.pHome : pick === '2' ? m.pAway : m.pDraw;
}

/** `pickP`: seçimin model olasılığı (verilirse fark koruması da çalışır). */
export function marketFlag(pick: '1' | 'X' | '2' | null | undefined, m: MarketProbs | null | undefined, pickP?: number | null): MarketFlag {
  if (!pick || !m) return null;
  const fav = marketFavourite(m);
  if (fav !== pick) return 'disagree';
  const mp = marketPickP(pick, m);
  if (pickP != null && mp != null && pickP - mp >= OVER_EDGE - 1e-9) return 'over';
  if (Math.max(m.pHome, m.pDraw, m.pAway) < TIGHT_FAV) return 'tight';
  return null;
}

/** Güven etiketi + piyasa koruması: bayrak varsa risk 'high'a yükselir. */
export function riskWithMarket(confidence: number | null | undefined, pick: '1' | 'X' | '2' | null | undefined, m: MarketProbs | null | undefined, pickP?: number | null): { risk: Risk; flag: MarketFlag } {
  const flag = marketFlag(pick, m, pickP);
  return { risk: flag ? 'high' : riskOf(confidence), flag };
}
