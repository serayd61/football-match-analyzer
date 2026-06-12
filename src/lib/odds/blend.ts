// ============================================================================
// BLEND — Dixon-Coles olasılıklarını PİYASA (kapanış oranı) olasılığıyla
// harmanlar. Kapanış oranı futbolun en güçlü tek tahmincisidir; DC'yi ona
// doğru çekmek hem isabeti hem kalibrasyonu (log-loss) iyileştirir.
//
//   p_blend = (1 - w) · p_DC  +  w · p_market      (w = piyasaya güven ağırlığı)
//
// Harmandan sonra her pazar yeniden normalize edilir (toplam = 1).
// Piyasa verisi olmayan pazarlar DC değeriyle aynen kalır (graceful fallback).
//
// w optimal değeri backtest-blend.ts ile out-of-sample seçilir. Tipik futbol
// için piyasaya ağır yaslanmak doğrudur (w ≈ 0.6–0.75).
// ============================================================================

import type { MarketProbabilities } from '@/lib/statistical/dixon-coles';
import {
  marketMatchResult,
  marketOverUnder,
  marketBtts,
  bookmakerMargin,
  type DevigMethod,
} from './devig';

/** Bir maç için elde edilebilen bahisçi oranları (hepsi opsiyonel). */
export interface MatchOdds {
  matchResult?: { home: number; draw: number; away: number };
  /** Üst/Alt oranları çizgi-bazlı, örn. { '2.5': { over: 1.9, under: 1.95 } } */
  overUnder?: Record<string, { over: number; under: number }>;
  btts?: { yes: number; no: number };
}

export interface BlendOptions {
  /** Piyasaya güven ağırlığı 0..1 (0 = saf DC, 1 = saf piyasa). Varsayılan 0.65. */
  marketWeight?: number;
  /** De-vig yöntemi. Varsayılan 'shin'. */
  method?: DevigMethod;
}

/**
 * Production varsayılan piyasa ağırlığı.
 * backtest-blend.ts (3 lig × 2 sezon, ~2000 maç, gerçek Pinnacle/Bet365 oranı) ile
 * doğrulandı. w=0.7'de DC-tek'e göre 1X2 isabeti ~%48 → ~%52'ye, log-loss ~%4-6
 * iyileşiyor; kazanımın ~%95'ini alırken DC katkısını ~%30 koruyup "value"
 * (piyasaya karşı edge) tespitini ve oran eksik/bayat olduğunda dayanıklılığı sağlar.
 * (w=1 saf bahisçi oranını aynen satmak demektir — model katkısı ve edge sıfırlanır.)
 */
export const DEFAULT_MARKET_WEIGHT = 0.7;

function mix(dc: number, market: number, w: number): number {
  return (1 - w) * dc + w * market;
}

function normalize2(a: number, b: number): [number, number] {
  const s = a + b;
  return s > 0 ? [a / s, b / s] : [a, b];
}

function normalize3(a: number, b: number, c: number): [number, number, number] {
  const s = a + b + c;
  return s > 0 ? [a / s, b / s, c / s] : [a, b, c];
}

/**
 * DC olasılıklarını piyasa oranıyla harmanlar. Oran verisi yoksa DC'yi
 * değiştirmeden döndürür. Çıktı yine MarketProbabilities (drop-in).
 *
 * NOT: expectedGoals, correctScore, scoreMatrix DC'den korunur (piyasa bunları
 * vermez). mostLikelyScore da DC'nin skor matrisinden gelir. 1X2 / Üst-Alt /
 * BTTS harmanlanır — bahis ürününün asıl pazarları bunlardır.
 */
export function blendWithMarket(
  dc: MarketProbabilities,
  odds: MatchOdds | null | undefined,
  opts: BlendOptions = {}
): MarketProbabilities {
  if (!odds) return dc;
  const w = Math.max(0, Math.min(1, opts.marketWeight ?? DEFAULT_MARKET_WEIGHT));
  const method = opts.method ?? 'shin';
  if (w === 0) return dc;

  const out: MarketProbabilities = {
    ...dc,
    matchResult: { ...dc.matchResult },
    overUnder: { ...dc.overUnder },
    btts: { ...dc.btts },
  };

  // 1X2
  if (odds.matchResult) {
    const m = marketMatchResult(odds.matchResult.home, odds.matchResult.draw, odds.matchResult.away, method);
    const [h, d, a] = normalize3(
      mix(dc.matchResult.home, m.home, w),
      mix(dc.matchResult.draw, m.draw, w),
      mix(dc.matchResult.away, m.away, w)
    );
    out.matchResult = { home: h, draw: d, away: a };
  }

  // Üst/Alt — yalnızca piyasa oranı olan çizgiler harmanlanır
  if (odds.overUnder) {
    const nextOU: Record<string, { over: number; under: number }> = { ...dc.overUnder };
    for (const [line, o] of Object.entries(odds.overUnder)) {
      const dcLine = dc.overUnder[line];
      if (!dcLine) continue;
      const m = marketOverUnder(o.over, o.under, method);
      const [over, under] = normalize2(mix(dcLine.over, m.over, w), mix(dcLine.under, m.under, w));
      nextOU[line] = { over, under };
    }
    out.overUnder = nextOU;
  }

  // KG Var/Yok
  if (odds.btts) {
    const m = marketBtts(odds.btts.yes, odds.btts.no, method);
    const [yes, no] = normalize2(mix(dc.btts.yes, m.yes, w), mix(dc.btts.no, m.no, w));
    out.btts = { yes, no };
  }

  return out;
}

/**
 * "Value" (kapanış oranına karşı edge) — harmanlanmış olasılık piyasa implied
 * olasılığından ne kadar yüksekse o kadar değerli bahis. Ürünün dürüst kuzey
 * yıldızı: pozitif value = uzun vadede + ROI beklentisi.
 *   edge = p_model − p_market_implied (marjlı, yani gerçek bahis fiyatı)
 */
export function valueEdge(modelProb: number, decimalOdds: number): number {
  const impliedWithVig = decimalOdds > 1 ? 1 / decimalOdds : 1;
  return modelProb - impliedWithVig;
}

/** Bilgi amaçlı: oran setinin marjını yüzde olarak döndürür (UI rozetleri için). */
export function marginPct(decimalOdds: number[]): number {
  return +(bookmakerMargin(decimalOdds) * 100).toFixed(2);
}
