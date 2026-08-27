// ============================================================================
// PİYASA MODELİ — maç detayı oran feed'inden algoritmik tahmin
// ----------------------------------------------------------------------------
// Maç detayını çektiğimiz kaynağın oran endpoint'i (free-football
// /football-event-odds) her maç için YALNIZCA 1X2 marketi verir (ölçüm
// 2026-08-27: GB/BR/DE sağlayıcılarında tek market). Bu modül o marj
// arındırılmış 1X2 olasılıklarından deterministik bir tahmin üretir:
//
//   1) 1X2 → bağımsız Poisson (λ_ev, λ_dep) ters çözümü (ızgara + rafine;
//      70 gerçek maçta ort. yeniden-üretim hatası 0.0006 — kayıpsız).
//   2) Skor matrisi → en olası skorlar, Ü/A 2.5, KG olasılıkları.
//
// ÖLÇÜM (2026-08-27, n=70, prediction_odds ⋈ engine_predictions, kapanış):
//   1X2 favori     : %41.4 (motor aynı maçlarda %38.6 — piyasa önde)
//   Çifte şans     : %75.7
//   Ü/A 2.5 seçimi : TEK TARAFLI — "Üst" derken %84.2 (n=19),
//                    "Alt" derken %39.2 (n=51). Sebep: 1X2 maç TEMPOSUNU
//                    taşımaz; ters çözüm toplam golü sistematik düşük tahmin
//                    eder. Feed'de Ü/A marketi OLMADIĞI için düzeltilemez.
//   KG seçimi      : %54.3 (taban hep-Var %60) — güvenilmez.
//
// SONUÇ: matchResult + doubleChance piyasa kalitesinde (güvenilir);
// overUnder25 yalnızca prediction='OVER' iken güvenilir (trusted alanı);
// btts HER ZAMAN trusted=false. Arayüz trusted=false alanları GÖSTERMEZ,
// LLM anchor'ı da onları vermez. Örneklem büyüyünce yeniden ölçülmeli.
//
// Kullanım yeri: unified-consensus — Dixon-Coles kapsam DIŞI kaldığında
// (242 modelsiz lig) LLM'e zemin ve maç sayfasına kart sağlar. Motorun
// kendi karnesine (engine_predictions) YAZMAZ.
// ============================================================================

import type { MatchOdds } from '@/lib/data-sources/free-football';
import { deriveDoubleChance, type DoubleChance } from '@/lib/double-chance';

export interface MarketModelOutput {
  source: 'market-model';
  provider: string;
  overround: number;
  matchResult: {
    prediction: 'HOME' | 'DRAW' | 'AWAY';
    probabilities: { home: number; draw: number; away: number };
    confidence: number; // %50-95, en yüksek olasılıktan
  };
  doubleChance: DoubleChance | null;
  expectedGoals: { home: number; away: number }; // ters çözüm — yaklaşık
  mostLikelyScore: string;
  topScores: { score: string; prob: number }[];
  overUnder25: { prediction: 'OVER' | 'UNDER'; probability: number; trusted: boolean };
  btts: { prediction: 'YES' | 'NO'; probability: number; trusted: boolean };
  fitError: number; // 1X2 yeniden-üretim hatası (tanı; ~0.001 beklenir)
}

const MAXG = 10;

function poissonRow(l: number): number[] {
  const p = [Math.exp(-l)];
  for (let k = 1; k <= MAXG; k++) p[k] = (p[k - 1] * l) / k;
  return p;
}

interface GridResult {
  H: number; D: number; A: number;
  over: number; btts: number;
  top: { score: string; prob: number }[];
}

function scoreGrid(lh: number, la: number): GridResult {
  const P = poissonRow(lh), Q = poissonRow(la);
  let H = 0, D = 0, A = 0, over = 0, btts = 0;
  const cells: { score: string; prob: number }[] = [];
  for (let h = 0; h <= MAXG; h++) {
    for (let a = 0; a <= MAXG; a++) {
      const p = P[h] * Q[a];
      if (h > a) H += p; else if (h === a) D += p; else A += p;
      if (h + a >= 3) over += p;
      if (h > 0 && a > 0) btts += p;
      if (h <= 5 && a <= 5) cells.push({ score: `${h}-${a}`, prob: p });
    }
  }
  cells.sort((x, y) => y.prob - x.prob);
  return { H, D, A, over, btts, top: cells.slice(0, 6) };
}

/**
 * 1X2 olasılıklarından (λ_ev, λ_dep) ters çözümü. Kaba ızgara (0.15-4.0,
 * adım 0.1) + iki kademe yerel rafine (0.02 → 0.005). ~50ms, bağımlılık yok.
 */
export function invertPoissonFrom1X2(
  pHome: number,
  pDraw: number,
  pAway: number,
): { lambdaHome: number; lambdaAway: number; fitError: number } {
  let best = { err: Number.POSITIVE_INFINITY, lh: 1.3, la: 1.1 };
  const scan = (lh0: number, lh1: number, la0: number, la1: number, step: number) => {
    for (let lh = lh0; lh <= lh1; lh += step) {
      for (let la = la0; la <= la1; la += step) {
        const g = scoreGrid(lh, la);
        const err = (g.H - pHome) ** 2 + (g.D - pDraw) ** 2 + (g.A - pAway) ** 2;
        if (err < best.err) best = { err, lh, la };
      }
    }
  };
  scan(0.15, 4.0, 0.15, 4.0, 0.1);
  scan(Math.max(0.05, best.lh - 0.1), best.lh + 0.1, Math.max(0.05, best.la - 0.1), best.la + 0.1, 0.02);
  scan(Math.max(0.05, best.lh - 0.02), best.lh + 0.02, Math.max(0.05, best.la - 0.02), best.la + 0.02, 0.005);
  return { lambdaHome: best.lh, lambdaAway: best.la, fitError: Math.sqrt(best.err) };
}

/** Marj arındırılmış oranlardan tam model çıktısı. Geçersiz girdi → null. */
export function marketModel(odds: MatchOdds): MarketModelOutput | null {
  const { pHome, pDraw, pAway } = odds;
  if (![pHome, pDraw, pAway].every((x) => Number.isFinite(x) && x > 0 && x < 1)) return null;

  const inv = invertPoissonFrom1X2(pHome, pDraw, pAway);
  const g = scoreGrid(inv.lambdaHome, inv.lambdaAway);

  const entries: Array<['HOME' | 'DRAW' | 'AWAY', number]> = [
    ['HOME', pHome], ['DRAW', pDraw], ['AWAY', pAway],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const rd = (x: number) => Math.round(x * 1000) / 1000;

  const overP = g.over;
  const bttsP = g.btts;
  return {
    source: 'market-model',
    provider: odds.provider,
    overround: odds.overround,
    matchResult: {
      prediction: entries[0][0],
      // 1X2 için ASIL değer piyasanın kendisi — ters çözümden yeniden
      // türetilmez (kayıpsız da olsa dolaylama gereksiz).
      probabilities: { home: pHome, draw: pDraw, away: pAway },
      confidence: Math.round(Math.min(95, Math.max(50, entries[0][1] * 100))),
    },
    doubleChance: deriveDoubleChance(pHome, pDraw, pAway),
    expectedGoals: { home: rd(inv.lambdaHome), away: rd(inv.lambdaAway) },
    mostLikelyScore: g.top[0]?.score || '1-1',
    topScores: g.top.map((s) => ({ score: s.score, prob: rd(s.prob) })),
    // Ölçüm başlıktaki gibi: Üst tarafı güvenilir, Alt tarafı değil.
    overUnder25: {
      prediction: overP >= 0.5 ? 'OVER' : 'UNDER',
      probability: rd(overP >= 0.5 ? overP : 1 - overP),
      trusted: overP >= 0.5,
    },
    btts: {
      prediction: bttsP >= 0.5 ? 'YES' : 'NO',
      probability: rd(bttsP >= 0.5 ? bttsP : 1 - bttsP),
      trusted: false,
    },
    fitError: rd(inv.fitError),
  };
}

/**
 * LLM anchor bloğu — buildHybridPromptBlock ile aynı sözleşme (Türkçe,
 * "başlangıç noktası al" görevi). trusted=false pazarlar KASITLI olarak
 * verilmez: LLM'e güvenilmez sayı enjekte etmek onu çapalamak demektir.
 */
export function buildMarketPromptBlock(m: MarketModelOutput, home: string, away: string): string {
  const mr = m.matchResult.probabilities;
  const dcLine = m.doubleChance
    ? `\n- Çifte şans ${m.doubleChance.pick}: %${(m.doubleChance.p * 100).toFixed(1)}`
    : '';
  const ouLine = m.overUnder25.trusted
    ? `\n- Üst 2.5 eğilimi: %${(m.overUnder25.probability * 100).toFixed(1)} (oran türevi, yaklaşık)`
    : '';
  return `
PİYASA MODELİ ÇIKTISI (bahis piyasası oranlarından, ${home} vs ${away}):
Bu olasılıklar ${m.provider} kapanış oranlarından marj arındırılarak elde edildi —
piyasanın kolektif tahminidir, uydurma değil. (Bu ligde Dixon-Coles modeli yok.)
- Maç sonucu: Ev %${(mr.home * 100).toFixed(1)} | Beraberlik %${(mr.draw * 100).toFixed(1)} | Dep %${(mr.away * 100).toFixed(1)}${dcLine}
- Beklenen gol (oran türevi, yaklaşık): ${home} ${m.expectedGoals.home.toFixed(2)} - ${m.expectedGoals.away.toFixed(2)} ${away}
- En olası skor: ${m.mostLikelyScore}${ouLine}

GÖREVİN: Bu olasılıkları BAŞLANGIÇ noktası al. Sadece piyasanın geç
fiyatlayabileceği faktörler için ayarla: son dakika kadro/sakatlık haberi,
motivasyon (küme düşme/şampiyonluk/derbi), rotasyon, hava. Her ayarlamayı
GEREKÇELENDİR. Gerekçesiz olasılığı %10'dan fazla değiştirme. Toplam gol /
KG pazarları için bu bloktan sayı TÜRETME — o marketlerin oranı elimizde yok.
`.trim();
}
