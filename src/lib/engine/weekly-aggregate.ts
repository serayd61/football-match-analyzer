// ============================================================================
// HAFTALIK TOPLAMA — saf fonksiyonlar (DB yok; birim testli)
// ----------------------------------------------------------------------------
// Girdi: bir ISO haftada sonuçlanmış engine_predictions satırları (+ kapsam
// bayrağı, kapanış oranı, haftadan önce fit edilmiş kalibrasyon eğrileri).
// Çıktı: engine_weekly_metrics / engine_calibration_bins / engine_version_pairs
// tablolarına yazılacak satırlar.
//
// Gruplar: (model_version, league_id) — league_id 0 = kapsanan liglerin toplamı.
// 'official' sanal sürümü: fixture başına tek resmi satır (lib/site/official.ts),
// public site'ın gördüğü karne budur.
// ============================================================================

import { applyCurve, type Knot } from '@/lib/calibration';
import { finiteOrNull } from '@/lib/calibration-eval';
import { deriveDoubleChance, isDoubleChanceCorrect } from '@/lib/double-chance';
import { pickOfficial, OFFICIAL_MODEL_VERSION } from '@/lib/site/official';
import { addRoi, mkRoi, type OddsRow } from '@/lib/site/roi';
import {
  rowScores, scoreBinary, makeBinAccs, addToBins, eceFromBins, type BinAcc, type Outcome, type RowScores,
} from './scoring';
import { pairedBootstrap, type PairedStats } from './gate';

export type Market = '1x2' | 'dc' | 'ou25' | 'btts';
export const MARKETS: Market[] = ['1x2', 'dc', 'ou25', 'btts'];
export const OFFICIAL = 'official';

export interface WeekRow {
  fixture_id: number;
  model_version: string | null;
  updated_at?: string | null;
  league_id: number | null;
  league_name?: string | null;
  kickoff: string;
  p_home: unknown; p_draw: unknown; p_away: unknown;
  p_over25?: unknown; p_btts_yes?: unknown;
  pick: string | null;
  confidence?: unknown;
  correct: boolean | null;
  result: Outcome | null;
  home_score: unknown; away_score: unknown;
  ou_pick?: string | null; ou_correct?: boolean | null;
  btts_pick?: string | null; btts_correct?: boolean | null;
  ll_1x2?: unknown; brier_1x2?: unknown; ll_ou25?: unknown; brier_ou25?: unknown; ll_btts?: unknown; brier_btts?: unknown;
  /** caller fills (model-coverage) */
  covered?: boolean;
}

export interface Curves { pick: Knot[]; ou: Knot[]; btts: Knot[]; fittedAt: { pick: string | null; ou: string | null; btts: string | null } }
export const NO_CURVES: Curves = { pick: [], ou: [], btts: [], fittedAt: { pick: null, ou: null, btts: null } };

/** Normalize edilmiş satır: skorlar garanti (eksikse yerinde hesaplanır). */
export interface ScoredRow {
  fixtureId: number;
  version: string;
  leagueId: number;
  kickoff: string;
  covered: boolean;
  p: { home: number; draw: number; away: number } | null;
  pOver: number | null;
  pBtts: number | null;
  conf: number | null;
  pick: string | null;
  result: Outcome;
  hs: number; as: number;
  s: RowScores;
  scoredOnTheFly: boolean;
}

export function normalizeRow(r: WeekRow): ScoredRow | null {
  const hs = finiteOrNull(r.home_score), as = finiteOrNull(r.away_score);
  if (hs == null || as == null || !r.result) return null;
  const ph = finiteOrNull(r.p_home), pd = finiteOrNull(r.p_draw), pa = finiteOrNull(r.p_away);
  const p = ph != null && pd != null && pa != null ? { home: ph, draw: pd, away: pa } : null;
  const hasStored = finiteOrNull(r.ll_1x2) != null;
  const s: RowScores = hasStored
    ? {
        result: r.result,
        correct: r.correct === true,
        ou_pick: (r.ou_pick as any) ?? null, ou_correct: r.ou_correct ?? null,
        btts_pick: (r.btts_pick as any) ?? null, btts_correct: r.btts_correct ?? null,
        ll_1x2: finiteOrNull(r.ll_1x2), brier_1x2: finiteOrNull(r.brier_1x2),
        ll_ou25: finiteOrNull(r.ll_ou25), brier_ou25: finiteOrNull(r.brier_ou25),
        ll_btts: finiteOrNull(r.ll_btts), brier_btts: finiteOrNull(r.brier_btts),
      }
    : rowScores(r, hs, as);
  const conf = finiteOrNull(r.confidence) ?? (p ? Math.max(p.home, p.draw, p.away) : null);
  return {
    fixtureId: Number(r.fixture_id),
    version: r.model_version || 'dc-1.0',
    leagueId: Number(r.league_id ?? 0),
    kickoff: r.kickoff,
    covered: !!r.covered,
    p, pOver: finiteOrNull(r.p_over25), pBtts: finiteOrNull(r.p_btts_yes),
    conf, pick: r.pick, result: r.result, hs, as, s,
    scoredOnTheFly: !hasStored,
  };
}

// ----------------------------------------------------------------------------
// Pazar akümülatörü
// ----------------------------------------------------------------------------
interface MarketAcc {
  n: number; correct: number; sumBrier: number; sumLL: number;
  sumConf: number; nConf: number; sumConfBrierRaw: number; sumConfBrierCal: number;
  bins: Record<string, BinAcc[]>;
  roi: ReturnType<typeof mkRoi>; oddsN: number; modelAccOnOdds: number;
}
const mkAcc = (outcomes: string[]): MarketAcc => ({
  n: 0, correct: 0, sumBrier: 0, sumLL: 0, sumConf: 0, nConf: 0, sumConfBrierRaw: 0, sumConfBrierCal: 0,
  bins: Object.fromEntries(outcomes.map((o) => [o, makeBinAccs()])),
  roi: mkRoi(), oddsN: 0, modelAccOnOdds: 0,
});
const BIN_OUTCOMES: Record<Market, string[]> = { '1x2': ['H', 'D', 'A'], dc: [], ou25: ['over'], btts: ['yes'] };

function addRow(acc: Record<Market, MarketAcc>, r: ScoredRow, curves: Curves, odds?: OddsRow | null): void {
  // --- 1X2 ---
  if (r.p && r.s.ll_1x2 != null && r.s.brier_1x2 != null) {
    const a = acc['1x2'];
    a.n++; if (r.s.correct) a.correct++;
    a.sumBrier += r.s.brier_1x2; a.sumLL += r.s.ll_1x2;
    if (r.conf != null) {
      a.nConf++; a.sumConf += r.conf;
      const hit = r.s.correct ? 1 : 0;
      a.sumConfBrierRaw += (r.conf - hit) ** 2;
      const c = applyCurve(r.conf, curves.pick) ?? r.conf;
      a.sumConfBrierCal += (c - hit) ** 2;
    }
    const s = r.p.home + r.p.draw + r.p.away || 1;
    addToBins(a.bins.H, r.p.home / s, r.result === 'H');
    addToBins(a.bins.D, r.p.draw / s, r.result === 'D');
    addToBins(a.bins.A, r.p.away / s, r.result === 'A');
    if (odds && r.pick && addRoi(a.roi, { pick: r.pick as any, result: r.result, kickoff: r.kickoff }, odds, r.s.correct)) {
      a.oddsN++; if (r.s.correct) a.modelAccOnOdds++;
    }
    // --- Çifte şans (aynı olasılıklardan) ---
    const dc = deriveDoubleChance(r.p.home, r.p.draw, r.p.away);
    if (dc) {
      const d = acc.dc;
      const hit = isDoubleChanceCorrect(dc.pick, r.result);
      const sc = scoreBinary(Math.min(1, dc.p / s), hit);
      d.n++; if (hit) d.correct++; d.sumBrier += sc.brier; d.sumLL += sc.ll;
      d.nConf++; d.sumConf += dc.p / s; d.sumConfBrierRaw += sc.brier; d.sumConfBrierCal += sc.brier; // DC için eğri yok
    }
  }
  // --- Ü/A 2.5 ---
  if (r.pOver != null && r.s.ll_ou25 != null && r.s.brier_ou25 != null && r.s.ou_correct != null) {
    const a = acc.ou25;
    a.n++; if (r.s.ou_correct) a.correct++;
    a.sumBrier += r.s.brier_ou25; a.sumLL += r.s.ll_ou25;
    const conf = r.pOver >= 0.5 ? r.pOver : 1 - r.pOver;
    const hit = r.s.ou_correct ? 1 : 0;
    a.nConf++; a.sumConf += conf; a.sumConfBrierRaw += (conf - hit) ** 2;
    a.sumConfBrierCal += ((applyCurve(conf, curves.ou) ?? conf) - hit) ** 2;
    addToBins(a.bins.over, r.pOver, r.hs + r.as >= 3);
  }
  // --- KG ---
  if (r.pBtts != null && r.s.ll_btts != null && r.s.brier_btts != null && r.s.btts_correct != null) {
    const a = acc.btts;
    a.n++; if (r.s.btts_correct) a.correct++;
    a.sumBrier += r.s.brier_btts; a.sumLL += r.s.ll_btts;
    const conf = r.pBtts >= 0.5 ? r.pBtts : 1 - r.pBtts;
    const hit = r.s.btts_correct ? 1 : 0;
    a.nConf++; a.sumConf += conf; a.sumConfBrierRaw += (conf - hit) ** 2;
    a.sumConfBrierCal += ((applyCurve(conf, curves.btts) ?? conf) - hit) ** 2;
    addToBins(a.bins.yes, r.pBtts, r.hs > 0 && r.as > 0);
  }
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const ratio = (a: number, b: number) => (b ? r4(a / b) : null);

export interface MetricRow {
  iso_year: number; iso_week: number; week_start: string;
  league_id: number; market: Market; model_version: string;
  n: number; n_correct: number; accuracy: number | null; brier: number | null; log_loss: number | null; ece: number | null;
  avg_confidence: number | null; conf_brier_raw: number | null; conf_brier_cal: number | null; calib_fitted_at: string | null;
  odds_n: number | null; market_accuracy: number | null; market_brier: number | null; model_accuracy_on_odds: number | null; roi_closing: number | null;
}
export interface BinRow { iso_year: number; iso_week: number; market: Market; outcome: string; model_version: string; bin: number; n: number; sum_pred: number; sum_obs: number }
export interface PairRow { iso_year: number; iso_week: number; version_a: string; version_b: string; market: Market; n: number; sum_d: number; sum_d2: number; acc_a: number; acc_b: number; bootstrap: PairedStats | null }

export interface WeekKey { isoYear: number; isoWeek: number; weekStart: Date }

function finish(acc: MarketAcc, m: Market, key: WeekKey, leagueId: number, version: string, curves: Curves): MetricRow | null {
  if (!acc.n) return null;
  const ece = m === 'dc' ? null : eceFromBins(Object.values(acc.bins).flat());
  const fittedAt = m === '1x2' ? curves.fittedAt.pick : m === 'ou25' ? curves.fittedAt.ou : m === 'btts' ? curves.fittedAt.btts : null;
  const hasOdds = m === '1x2' && acc.roi.bets > 0;
  return {
    iso_year: key.isoYear, iso_week: key.isoWeek, week_start: key.weekStart.toISOString().slice(0, 10),
    league_id: leagueId, market: m, model_version: version,
    n: acc.n, n_correct: acc.correct,
    accuracy: ratio(acc.correct, acc.n), brier: ratio(acc.sumBrier, acc.n), log_loss: ratio(acc.sumLL, acc.n), ece,
    avg_confidence: ratio(acc.sumConf, acc.nConf),
    conf_brier_raw: ratio(acc.sumConfBrierRaw, acc.nConf),
    conf_brier_cal: fittedAt ? ratio(acc.sumConfBrierCal, acc.nConf) : null,
    calib_fitted_at: fittedAt,
    odds_n: hasOdds ? acc.roi.bets : null,
    market_accuracy: hasOdds ? ratio(acc.roi.mAcc, acc.roi.bets) : null,
    market_brier: hasOdds ? ratio(acc.roi.mSq, acc.roi.bets) : null,
    model_accuracy_on_odds: hasOdds ? ratio(acc.modelAccOnOdds, acc.oddsN) : null,
    roi_closing: hasOdds ? r4((acc.roi.returned - acc.roi.staked) / acc.roi.staked) : null,
  };
}

export interface AggregateInput {
  key: WeekKey;
  rows: WeekRow[];
  curves?: Curves;
  /** kapanış oranı: fixture → satır */
  closingOdds?: Map<number, OddsRow>;
  /** resmi sürüm (env ya da engine_model_versions.active); undefined → env varsayılanı, null → "en yeni satır" kuralı */
  official?: string | null;
}

export interface AggregateOutput {
  metrics: MetricRow[];
  bins: BinRow[];
  pairs: PairRow[];
  versions: string[];
  /** en çok satırı olan gerçek sürüm (çift karşılaştırmasında referans) */
  referenceVersion: string | null;
  quality: { rows: number; usable: number; scoredOnTheFly: number; covered: number };
}

export function aggregateWeek(input: AggregateInput): AggregateOutput {
  const curves = input.curves ?? NO_CURVES;
  // Normalize; orijinal indeksi koru (resmi küme seçimi için).
  const scored: ScoredRow[] = [];
  const sourceIndex: number[] = [];
  input.rows.forEach((r, i) => { const s = normalizeRow(r); if (s) { scored.push(s); sourceIndex.push(i); } });
  const quality = {
    rows: input.rows.length, usable: scored.length,
    scoredOnTheFly: scored.filter((r) => r.scoredOnTheFly).length,
    covered: scored.filter((r) => r.covered).length,
  };

  // Resmi küme: pickOfficial fixture başına tek satır seçer (site ile aynı kural).
  const officialIdx = new Set(
    pickOfficial(
      input.rows.map((r, i) => ({ fixture_id: Number(r.fixture_id), model_version: r.model_version, updated_at: r.updated_at ?? null, i })),
      input.official === undefined ? OFFICIAL_MODEL_VERSION : input.official,
    ).map((x) => x.i),
  );
  const officialSet = new Set(scored.filter((_, j) => officialIdx.has(sourceIndex[j])));

  // Gruplar
  const groups = new Map<string, { version: string; leagueId: number; acc: Record<Market, MarketAcc> }>();
  const get = (version: string, leagueId: number) => {
    const k = `${version}|${leagueId}`;
    let g = groups.get(k);
    if (!g) {
      g = { version, leagueId, acc: { '1x2': mkAcc(BIN_OUTCOMES['1x2']), dc: mkAcc([]), ou25: mkAcc(BIN_OUTCOMES.ou25), btts: mkAcc(BIN_OUTCOMES.btts) } };
      groups.set(k, g);
    }
    return g;
  };
  const versionCount = new Map<string, number>();
  for (const r of scored) {
    const odds = input.closingOdds?.get(r.fixtureId) ?? null;
    versionCount.set(r.version, (versionCount.get(r.version) ?? 0) + 1);
    addRow(get(r.version, r.leagueId).acc, r, curves, odds);
    if (r.covered) addRow(get(r.version, 0).acc, r, curves, odds);
    if (officialSet.has(r)) {
      addRow(get(OFFICIAL, r.leagueId).acc, r, curves, odds);
      if (r.covered) addRow(get(OFFICIAL, 0).acc, r, curves, odds);
    }
  }

  const metrics: MetricRow[] = [];
  const bins: BinRow[] = [];
  for (const g of groups.values()) {
    for (const m of MARKETS) {
      const row = finish(g.acc[m], m, input.key, g.leagueId, g.version, curves);
      if (row) metrics.push(row);
      if (g.leagueId === 0 && m !== 'dc') {
        for (const [outcome, accs] of Object.entries(g.acc[m].bins)) {
          for (const b of accs) if (b.n) bins.push({ iso_year: input.key.isoYear, iso_week: input.key.isoWeek, market: m, outcome, model_version: g.version, bin: b.bin, n: b.n, sum_pred: r4(b.sum_pred), sum_obs: b.sum_obs });
        }
      }
    }
  }

  // Sürüm çiftleri (aynı fixture, iki gerçek sürüm)
  const versions = [...versionCount.keys()].sort();
  const referenceVersion = versions.length ? [...versionCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] : null;
  const pairs: PairRow[] = [];
  if (referenceVersion && versions.length > 1) {
    const byFixture = new Map<number, Map<string, ScoredRow>>();
    for (const r of scored) {
      if (!byFixture.has(r.fixtureId)) byFixture.set(r.fixtureId, new Map());
      byFixture.get(r.fixtureId)!.set(r.version, r);
    }
    for (const vb of versions) {
      if (vb === referenceVersion) continue;
      for (const m of ['1x2', 'ou25', 'btts'] as const) {
        const d: number[] = []; let accA = 0, accB = 0;
        for (const vs of byFixture.values()) {
          const a = vs.get(referenceVersion), b = vs.get(vb);
          if (!a || !b) continue;
          const la = m === '1x2' ? a.s.ll_1x2 : m === 'ou25' ? a.s.ll_ou25 : a.s.ll_btts;
          const lb = m === '1x2' ? b.s.ll_1x2 : m === 'ou25' ? b.s.ll_ou25 : b.s.ll_btts;
          if (la == null || lb == null) continue;
          d.push(lb - la);
          const ca = m === '1x2' ? a.s.correct : m === 'ou25' ? a.s.ou_correct : a.s.btts_correct;
          const cb = m === '1x2' ? b.s.correct : m === 'ou25' ? b.s.ou_correct : b.s.btts_correct;
          if (ca) accA++; if (cb) accB++;
        }
        if (!d.length) continue;
        pairs.push({
          iso_year: input.key.isoYear, iso_week: input.key.isoWeek, version_a: referenceVersion, version_b: vb, market: m,
          n: d.length, sum_d: r4(d.reduce((s, x) => s + x, 0)), sum_d2: r4(d.reduce((s, x) => s + x * x, 0)),
          acc_a: accA, acc_b: accB, bootstrap: pairedBootstrap(d),
        });
      }
    }
  }

  return { metrics, bins, pairs, versions, referenceVersion, quality };
}
