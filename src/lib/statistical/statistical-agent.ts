// ============================================================================
// STATISTICAL AGENT — Dixon-Coles motorunu unified-consensus'a bağlayan katman
// + walk-forward backtest düzeneği (data leakage YOK).
// ============================================================================

import { DixonColesModel, MatchRow, MarketProbabilities } from './dixon-coles';
import { blendWithMarket, type MatchOdds } from '@/lib/odds/blend';
import { blendWithElo, type EloParams } from '@/lib/odds/elo-blend';

export interface StatAgentOutput {
  source: 'dixon-coles';
  expectedGoals: { home: number; away: number };
  matchResult: { prediction: 'HOME' | 'DRAW' | 'AWAY'; probabilities: { home: number; draw: number; away: number }; confidence: number };
  overUnder25: { prediction: 'OVER' | 'UNDER'; probability: number; confidence: number };
  btts: { prediction: 'YES' | 'NO'; probability: number; confidence: number };
  mostLikelyScore: string;
  groundTruth: MarketProbabilities;
}

function toConfidence(probs: number[]): number {
  const max = Math.max(...probs);
  return Math.round(Math.min(95, Math.max(50, max * 100)));
}

/**
 * Görünen takım adını modeldeki takım adına eşler (birebir → case-insensitive
 * → normalize → içerik). Eşleşme yoksa null (çağıran DC'yi atlar).
 */
export function resolveTeam(model: DixonColesModel, name: string): string | null {
  if (!name) return null;
  const teams = Object.keys(model.getParams().attack);
  if (teams.includes(name)) return name;
  const norm = (s: string) =>
    s.toLowerCase().replace(/\b(fc|cf|afc|sc|cd|ac|as|bk|if|sk)\b/g, '').replace(/[^a-z0-9]/g, '').trim();
  const t = norm(name);
  if (!t) return null;
  for (const tm of teams) if (norm(tm) === t) return tm;
  for (const tm of teams) {
    const n = norm(tm);
    if (n && (n.includes(t) || t.includes(n))) return tm;
  }
  return null;
}

/** MarketProbabilities (saf DC veya blend'lenmiş) → StatAgentOutput haritası. */
function statOutputFromGroundTruth(gt: MarketProbabilities): StatAgentOutput {
  const mr = gt.matchResult;
  const mrEntries: [string, number][] = [['HOME', mr.home], ['DRAW', mr.draw], ['AWAY', mr.away]];
  mrEntries.sort((a, b) => b[1] - a[1]);

  return {
    source: 'dixon-coles',
    expectedGoals: gt.expectedGoals,
    matchResult: {
      prediction: mrEntries[0][0] as 'HOME' | 'DRAW' | 'AWAY',
      probabilities: mr,
      confidence: toConfidence([mr.home, mr.draw, mr.away]),
    },
    overUnder25: {
      prediction: gt.overUnder['2.5'].over > 0.5 ? 'OVER' : 'UNDER',
      probability: Math.max(gt.overUnder['2.5'].over, gt.overUnder['2.5'].under),
      confidence: toConfidence([gt.overUnder['2.5'].over, gt.overUnder['2.5'].under]),
    },
    btts: {
      prediction: gt.btts.yes > 0.5 ? 'YES' : 'NO',
      probability: Math.max(gt.btts.yes, gt.btts.no),
      confidence: toConfidence([gt.btts.yes, gt.btts.no]),
    },
    mostLikelyScore: gt.mostLikelyScore,
    groundTruth: gt,
  };
}

/**
 * DC tahmini üretir. `odds` verilirse çıktı PİYASA oranıyla harmanlanır
 * (DEFAULT_MARKET_WEIGHT) — backtest-blend ile doğrulanmış, isabeti/kalibrasyonu
 * iyileştiren çıpa. Oran yoksa saf DC döner (davranış değişmez).
 */
export function runStatisticalAgent(
  model: DixonColesModel,
  home: string,
  away: string,
  odds?: MatchOdds | null
): StatAgentOutput {
  const gt = model.predict(home, away);
  const blended = odds ? blendWithMarket(gt, odds) : gt;
  return statOutputFromGroundTruth(blended);
}

/**
 * Mevcut (saf DC) StatAgentOutput'u piyasa oranıyla yeniden harmanlar.
 * unified-consensus'ta DC, oranlar gelmeden ÖNCE hesaplandığı için kullanılır:
 * oran agent'ı tamamlandıktan sonra DC çıktısını piyasaya çekeriz.
 */
export function applyOddsBlend(stat: StatAgentOutput, odds: MatchOdds | null | undefined): StatAgentOutput {
  if (!odds) return stat;
  return statOutputFromGroundTruth(blendWithMarket(stat.groundTruth, odds));
}

/**
 * DC çıktısını ELO ile harmanlar (Faz 2). Piyasa harmanından ÖNCE, DC predict'ten
 * hemen sonra uygulanır: ELO modelin bağımsız gücünü iyileştirir (backtest 5/5 lig
 * log-loss+Brier↓). ELO verisi/param yoksa stat aynen döner (graceful).
 * eloHome/eloAway sayısal ELO (elo-store'daki ratings'ten, model takım adıyla).
 */
export function applyEloBlend(
  stat: StatAgentOutput,
  eloHome: number | null | undefined,
  eloAway: number | null | undefined,
  params: EloParams | null | undefined
): StatAgentOutput {
  if (eloHome == null || eloAway == null || !params) return stat;
  return statOutputFromGroundTruth(blendWithElo(stat.groundTruth, eloHome, eloAway, params));
}

/**
 * LLM prompt'larına enjekte edilecek anchor bloğu.
 * KRİTİK KURAL: LLM olasılıkları başlangıç noktası alır,
 * gerekçesiz ±%10'dan fazla saptıramaz.
 */
export function buildHybridPromptBlock(stat: StatAgentOutput, home: string, away: string): string {
  const mr = stat.matchResult.probabilities;
  return `
İSTATİSTİKSEL MODEL ÇIKTISI (Dixon-Coles, ${home} vs ${away}):
Bu olasılıklar geçmiş maçlardan matematiksel olarak HESAPLANMIŞTIR — uydurma değil.
- Beklenen gol: ${home} ${stat.expectedGoals.home.toFixed(2)} - ${stat.expectedGoals.away.toFixed(2)} ${away}
- Maç sonucu: Ev %${(mr.home * 100).toFixed(1)} | Beraberlik %${(mr.draw * 100).toFixed(1)} | Dep %${(mr.away * 100).toFixed(1)}
- Üst 2.5: %${(stat.groundTruth.overUnder['2.5'].over * 100).toFixed(1)}
- KG Var: %${(stat.groundTruth.btts.yes * 100).toFixed(1)}
- En olası skor: ${stat.mostLikelyScore}

GÖREVİN: Bu olasılıkları BAŞLANGIÇ noktası al. Sadece modelin göremediği
nicel-olmayan faktörler için ayarla: kadro/sakatlık haberleri, motivasyon
(küme düşme/şampiyonluk/derbi), takım rotasyonu, hava, taraftar baskısı.
Her ayarlamayı GEREKÇELENDİR. Gerekçesiz olasılığı %10'dan fazla değiştirme.
`.trim();
}

export interface BacktestResult {
  totalMatches: number;
  matchResult: { correct: number; accuracy: number };
  overUnder25: { correct: number; accuracy: number };
  btts: { correct: number; accuracy: number };
  logLoss: number;
  brierScore: number;
}

export function backtest(
  allMatches: MatchRow[],
  opts: { minTrainMatches?: number; xi?: number; iters?: number } = {}
): BacktestResult {
  const minTrain = opts.minTrainMatches ?? 60;
  const sorted = [...allMatches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let mrCorrect = 0, ouCorrect = 0, bttsCorrect = 0;
  let tested = 0, logLoss = 0, brier = 0;

  for (let i = minTrain; i < sorted.length; i++) {
    const train = sorted.slice(0, i);
    const m = sorted[i];
    const seen = new Set<string>();
    train.forEach((t) => { seen.add(t.homeTeam); seen.add(t.awayTeam); });
    if (!seen.has(m.homeTeam) || !seen.has(m.awayTeam)) continue;

    const model = new DixonColesModel();
    model.fit(train, { xi: opts.xi ?? 0.0025, iters: opts.iters ?? 120, lr: 0.08 });
    const pred = model.predict(m.homeTeam, m.awayTeam);

    const actualMR = m.homeGoals > m.awayGoals ? 'home' : m.homeGoals === m.awayGoals ? 'draw' : 'away';
    const actualOver = m.homeGoals + m.awayGoals > 2.5;
    const actualBtts = m.homeGoals >= 1 && m.awayGoals >= 1;

    const mr = pred.matchResult;
    const predMR = mr.home >= mr.draw && mr.home >= mr.away ? 'home' : mr.draw >= mr.away ? 'draw' : 'away';
    if (predMR === actualMR) mrCorrect++;
    if ((pred.overUnder['2.5'].over > 0.5) === actualOver) ouCorrect++;
    if ((pred.btts.yes > 0.5) === actualBtts) bttsCorrect++;

    const pActual = mr[actualMR as 'home' | 'draw' | 'away'];
    logLoss -= Math.log(Math.max(pActual, 1e-12));
    for (const k of ['home', 'draw', 'away'] as const) {
      const y = k === actualMR ? 1 : 0;
      brier += Math.pow(mr[k] - y, 2);
    }
    tested++;
  }

  return {
    totalMatches: tested,
    matchResult: { correct: mrCorrect, accuracy: tested ? mrCorrect / tested : 0 },
    overUnder25: { correct: ouCorrect, accuracy: tested ? ouCorrect / tested : 0 },
    btts: { correct: bttsCorrect, accuracy: tested ? bttsCorrect / tested : 0 },
    logLoss: tested ? logLoss / tested : 0,
    brierScore: tested ? brier / tested : 0,
  };
}
