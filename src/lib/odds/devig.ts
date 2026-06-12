// ============================================================================
// DE-VIG — bahisçi oranlarından "gerçek" (marjsız) olasılık çıkarma.
//
// Bahisçi oranları margin (overround / vig) içerir: ham implied olasılıkların
// toplamı 1'den büyüktür (tipik 1X2'de ~1.05). Bu fazlalık bahisçinin kârı.
// Gerçek olasılığa ulaşmak için marjı çıkarırız.
//
// İki yöntem:
//   • multiplicative — implied olasılıkları toplamları 1 olacak şekilde normalize
//     eder. Basit, sağlam, standart. (favori-longshot biası'nı düzeltmez.)
//   • shin — Shin (1992/1993) modeli: bilgili (insider) bahis oranını tahmin
//     ederek marjı orantısız dağıtır; favori-longshot biasını kısmen düzeltir,
//     genelde multiplicative'den biraz daha kalibre.
//
// Hepsi SAF fonksiyon — backtest'te ve canlı tahminde aynı kod.
// ============================================================================

/** Ondalık oranın ham implied olasılığı (marj dahil): 1/odds. */
export function impliedFromDecimal(odds: number): number {
  return odds > 1 ? 1 / odds : 0;
}

/** Bir oran setinin bahisçi marjı (overround). 1X2'de tipik ~0.05 = %5. */
export function bookmakerMargin(decimalOdds: number[]): number {
  const sum = decimalOdds.reduce((s, o) => s + impliedFromDecimal(o), 0);
  return sum - 1;
}

/**
 * Multiplicative (basit normalize) de-vig.
 * implied_i / Σ implied → toplam tam 1 olan gerçek olasılıklar.
 */
export function devigMultiplicative(decimalOdds: number[]): number[] {
  const implied = decimalOdds.map(impliedFromDecimal);
  const sum = implied.reduce((s, p) => s + p, 0);
  if (sum <= 0) return decimalOdds.map(() => 0);
  return implied.map((p) => p / sum);
}

/**
 * Shin de-vig. z = bilgili bahis oranı (insider proportion) tahmin edilir,
 * gerçek olasılık p_i şu denklemden çözülür:
 *   q_i = ( sqrt(z^2 + 4(1-z) q_i^2 / Σq) ... )  → sabit nokta iterasyonu.
 * Pratik, sağlam bir sabit-nokta uygulaması kullanıyoruz (Newton'a gerek yok).
 *
 * Kaynak: Shin, H.S. (1993); Štrumbelj (2014) karşılaştırması bunu en iyi
 * basit-de-vig yöntemlerinden biri olarak gösterir.
 */
export function devigShin(decimalOdds: number[]): number[] {
  const q = decimalOdds.map(impliedFromDecimal);
  const sumQ = q.reduce((s, p) => s + p, 0);
  if (sumQ <= 0) return decimalOdds.map(() => 0);
  const n = q.length;

  // z'yi sabit nokta ile çöz (0 = marj yok). Booth/Štrumbelj iterasyonu.
  let z = 0;
  for (let iter = 0; iter < 100; iter++) {
    let s = 0;
    for (const qi of q) {
      s += Math.sqrt(z * z + 4 * (1 - z) * (qi * qi) / sumQ);
    }
    const zNext = (s - 2) / (n - 2 || 1);
    if (!Number.isFinite(zNext) || Math.abs(zNext - z) < 1e-10) {
      z = Math.max(0, Math.min(0.2, zNext));
      break;
    }
    z = Math.max(0, Math.min(0.2, zNext));
  }

  const p = q.map((qi) => (Math.sqrt(z * z + 4 * (1 - z) * (qi * qi) / sumQ) - z) / (2 * (1 - z)));
  const sumP = p.reduce((s, v) => s + v, 0);
  return sumP > 0 ? p.map((v) => v / sumP) : devigMultiplicative(decimalOdds);
}

export type DevigMethod = 'multiplicative' | 'shin';

export function devig(decimalOdds: number[], method: DevigMethod = 'shin'): number[] {
  return method === 'shin' ? devigShin(decimalOdds) : devigMultiplicative(decimalOdds);
}

// ── Pazar-özel yardımcılar (DC çıktısıyla aynı şekil) ────────────────────────

/** 1X2 ondalık oranlardan gerçek olasılık. */
export function marketMatchResult(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  method: DevigMethod = 'shin'
): { home: number; draw: number; away: number } {
  const [home, draw, away] = devig([homeOdds, drawOdds, awayOdds], method);
  return { home, draw, away };
}

/** Üst/Alt (tek çizgi) ondalık oranlardan gerçek olasılık. */
export function marketOverUnder(
  overOdds: number,
  underOdds: number,
  method: DevigMethod = 'shin'
): { over: number; under: number } {
  const [over, under] = devig([overOdds, underOdds], method);
  return { over, under };
}

/** KG Var/Yok ondalık oranlardan gerçek olasılık. */
export function marketBtts(
  yesOdds: number,
  noOdds: number,
  method: DevigMethod = 'shin'
): { yes: number; no: number } {
  const [yes, no] = devig([yesOdds, noOdds], method);
  return { yes, no };
}
