// ============================================================================
// HAFTALIK İNCELEME — DB katmanı (okuma, toplama, yazma, rapor)
// ----------------------------------------------------------------------------
// computeWeek(sb, key)  → geçen ISO haftanın sonuçlanmış satırlarını okur,
//                          weekly-aggregate ile toplar, üç tabloya UPSERT eder.
// buildReport(sb, key)  → yuvarlanan pencereyle karşılaştırır, uyarı + öneri
//                          üretir, engine_weekly_reports + engine_learning_log yazar.
// Hiçbir şey otomatik terfi etmez: öneriler admin onayı bekler (Faz 3).
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';
import type { OddsRow } from '@/lib/site/roi';
import { resolveOfficialVersion } from '@/lib/site/official';
import { finiteOrNull } from '@/lib/calibration-eval';
import { isoWeekLabel, type IsoWeek } from './scoring';
import { aggregateWeek, OFFICIAL, type Curves, type WeekRow, type AggregateOutput, type MetricRow, type Market } from './weekly-aggregate';
import { pairedFromSums, promotionVerdict, PROMOTION_GATE, type PairedStats } from './gate';

const PAGE = 1000;
const ACTOR = 'cron:engine-weekly-review';

const WEEK_COLS =
  'fixture_id, model_version, updated_at, league_id, league_name, kickoff, p_home, p_draw, p_away, p_over25, p_btts_yes, ' +
  'pick, confidence, correct, result, home_score, away_score, ou_pick, ou_correct, btts_pick, btts_correct, ' +
  'll_1x2, brier_1x2, ll_ou25, brier_ou25, ll_btts, brier_btts';

async function fetchWeekRows(sb: SupabaseClient, key: IsoWeek): Promise<WeekRow[]> {
  const rows: WeekRow[] = [];
  for (let from = 0; from < 100000; from += PAGE) {
    const { data, error } = await sb
      .from('engine_predictions')
      .select(WEEK_COLS)
      .eq('settled', true)
      .not('result', 'is', null)
      .gte('kickoff', key.weekStart.toISOString())
      .lt('kickoff', key.weekEnd.toISOString())
      .order('kickoff', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`engine_predictions read: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as unknown as WeekRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Haftadaki tüm satırların durumu (kapsam / gecikme uyarıları için). */
async function fetchWeekCounts(sb: SupabaseClient, key: IsoWeek) {
  const base = () => sb.from('engine_predictions').select('id', { count: 'exact', head: true })
    .gte('kickoff', key.weekStart.toISOString()).lt('kickoff', key.weekEnd.toISOString());
  const [all, pending, voided] = await Promise.all([
    base(),
    base().eq('settled', false),
    base().eq('settled', true).is('result', null),
  ]);
  return { total: all.count ?? 0, pending: pending.count ?? 0, voided: voided.count ?? 0 };
}

/** Haftadan ÖNCE fit edilmiş en son eğriler (sızıntısız walk-forward). */
async function fetchCurvesBefore(sb: SupabaseClient, weekStart: Date): Promise<Curves> {
  const { data, error } = await sb
    .from('confidence_calibration')
    .select('segment, knots, fitted_at')
    .lt('fitted_at', weekStart.toISOString())
    .order('fitted_at', { ascending: false })
    .limit(40);
  const out: Curves = { pick: [], ou: [], btts: [], fittedAt: { pick: null, ou: null, btts: null } };
  if (error || !data) return out;
  const first = (seg: string) => data.find((r: any) => r.segment === seg);
  const pick = first('covered') ?? first('all');
  const ou = first('ou25'), btts = first('btts');
  if (pick && Array.isArray(pick.knots) && pick.knots.length >= 2) { out.pick = pick.knots; out.fittedAt.pick = pick.fitted_at; }
  if (ou && Array.isArray(ou.knots) && ou.knots.length >= 2) { out.ou = ou.knots; out.fittedAt.ou = ou.fitted_at; }
  if (btts && Array.isArray(btts.knots) && btts.knots.length >= 2) { out.btts = btts.knots; out.fittedAt.btts = btts.fitted_at; }
  return out;
}

/** Kapanış oranı (fixture başına en yeni 'closing'); 200'lük parçalar. */
async function fetchClosingOdds(sb: SupabaseClient, fixtureIds: number[]): Promise<Map<number, OddsRow>> {
  const map = new Map<number, OddsRow>();
  const ids = [...new Set(fixtureIds)];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await sb
      .from('prediction_odds')
      .select('fixture_id, phase, provider, home_odds, draw_odds, away_odds, captured_at')
      .in('fixture_id', chunk)
      .eq('phase', 'closing')
      .order('captured_at', { ascending: false })
      .limit(chunk.length * 3);
    if (error) { console.error('[weekly] odds read failed:', error.message); continue; }
    for (const r of (data || []) as any[]) {
      const fid = Number(r.fixture_id);
      if (map.has(fid)) continue;
      const h = finiteOrNull(r.home_odds), d = finiteOrNull(r.draw_odds), a = finiteOrNull(r.away_odds);
      if (h == null || d == null || a == null) continue;
      map.set(fid, { fixture_id: fid, phase: 'closing', provider: r.provider ?? null, home_odds: h, draw_odds: d, away_odds: a, captured_at: r.captured_at });
    }
  }
  return map;
}

export interface ComputeResult {
  week: string;
  counts: { total: number; pending: number; voided: number };
  quality: AggregateOutput['quality'];
  written: { metrics: number; bins: number; pairs: number };
  oddsCoverage: number | null;
  aggregate: AggregateOutput;
}

export async function computeWeek(sb: SupabaseClient, key: IsoWeek): Promise<ComputeResult> {
  const week = isoWeekLabel(key);
  const [rows, counts, curves, catalog] = await Promise.all([
    fetchWeekRows(sb, key),
    fetchWeekCounts(sb, key),
    fetchCurvesBefore(sb, key.weekStart),
    getCatalogMap().catch(() => new Map()),
  ]);

  for (const r of rows) {
    const cat = r.league_id != null ? catalog.get(Number(r.league_id)) : undefined;
    const name = isUnresolvedLeagueName(r.league_name) && cat ? cat.name : r.league_name;
    r.covered = isModelCovered(name, r.league_id, cat?.ccode);
  }

  const [closingOdds, official] = await Promise.all([
    fetchClosingOdds(sb, rows.map((r) => Number(r.fixture_id))),
    resolveOfficialVersion(),
  ]);
  const aggregate = aggregateWeek({ key, rows, curves, closingOdds, official });

  // --- yaz (idempotent upsert) ---
  const written = { metrics: 0, bins: 0, pairs: 0 };
  if (aggregate.metrics.length) {
    const { error } = await sb.from('engine_weekly_metrics')
      .upsert(aggregate.metrics.map((m) => ({ ...m, computed_at: new Date().toISOString() })), { onConflict: 'iso_year,iso_week,league_id,market,model_version' });
    if (error) throw new Error(`engine_weekly_metrics upsert: ${error.message}`);
    written.metrics = aggregate.metrics.length;
  }
  if (aggregate.bins.length) {
    // Kovalar hafta içinde tam yeniden hesaplanır: eski satırlar (artık boş kova) kalmasın.
    await sb.from('engine_calibration_bins').delete().eq('iso_year', key.isoYear).eq('iso_week', key.isoWeek);
    const { error } = await sb.from('engine_calibration_bins').insert(aggregate.bins);
    if (error) throw new Error(`engine_calibration_bins insert: ${error.message}`);
    written.bins = aggregate.bins.length;
  }
  await sb.from('engine_version_pairs').delete().eq('iso_year', key.isoYear).eq('iso_week', key.isoWeek);
  if (aggregate.pairs.length) {
    const { error } = await sb.from('engine_version_pairs')
      .insert(aggregate.pairs.map(({ bootstrap: _b, ...p }) => p));
    if (error) throw new Error(`engine_version_pairs insert: ${error.message}`);
    written.pairs = aggregate.pairs.length;
  }

  const decided = new Set(rows.map((r) => Number(r.fixture_id))).size;
  return {
    week, counts, quality: aggregate.quality, written,
    oddsCoverage: decided ? Math.round((closingOdds.size / decided) * 1000) / 1000 : null,
    aggregate,
  };
}

// ----------------------------------------------------------------------------
// RAPOR — yuvarlanan pencere, uyarılar, öneriler
// ----------------------------------------------------------------------------
export interface Alert { code: string; severity: 'info' | 'warn' | 'critical'; message: string; evidence?: Record<string, unknown> }
export interface Proposal { type: 'promote' | 'retire' | 'keep_shadow' | 'investigate'; subject: string; text: string; evidence: Record<string, unknown> }

export interface WeeklySummary {
  week: string; weekStart: string; weekEnd: string; generatedAt: string;
  quality: { total: number; settled: number; pending: number; voided: number; settledRatio: number | null; covered: number; scoredOnTheFly: number; oddsCoverage: number | null };
  markets: Record<string, {
    n: number; accuracy: number | null; brier: number | null; logLoss: number | null; ece: number | null;
    avgConfidence: number | null; confBrierRaw: number | null; confBrierCal: number | null;
    rolling4: { weeks: number; n: number; logLoss: number | null; accuracy: number | null; brier: number | null } | null;
    deltaLogLoss: number | null;
  }>;
  benchmark: { oddsN: number | null; marketAccuracy: number | null; marketBrier: number | null; modelAccuracyOnOdds: number | null; roiClosing: number | null } | null;
  versions: Array<{ version: string; n: number; accuracy: number | null; logLoss: number | null }>;
  pairs: Array<{
    versionA: string; versionB: string; market: Market;
    week: PairedStats | null; rolling: (PairedStats & { weeks: number }) | null; verdict: { pass: boolean; reasons: string[] } | null;
  }>;
  alerts: Alert[];
  proposals: Proposal[];
}

const ROLLING_WEEKS = 4;
const PAIR_WINDOW_WEEKS = 8;
const LL_REGRESSION = 0.02;
const ECE_MAX = 0.05;
const SETTLED_MIN = 0.9;

function weekOrder(y: number, w: number) { return y * 100 + w; }

async function fetchRolling(sb: SupabaseClient, key: IsoWeek, version: string, leagueId: number, weeks: number): Promise<MetricRow[]> {
  const { data, error } = await sb
    .from('engine_weekly_metrics')
    .select('*')
    .eq('model_version', version)
    .eq('league_id', leagueId)
    .lt('week_start', key.weekStart.toISOString().slice(0, 10))
    .order('week_start', { ascending: false })
    .limit(weeks * 4);
  if (error) { console.error('[weekly] rolling read failed:', error.message); return []; }
  return (data || []) as MetricRow[];
}

function rollingFor(rows: MetricRow[], market: Market) {
  const rs = rows.filter((r) => r.market === market);
  const weeks = new Set(rs.map((r) => weekOrder(r.iso_year, r.iso_week))).size;
  const n = rs.reduce((s, r) => s + r.n, 0);
  if (!n) return null;
  const w = (f: (r: MetricRow) => number | null) => {
    let num = 0, den = 0;
    for (const r of rs) { const v = f(r); if (v != null) { num += Number(v) * r.n; den += r.n; } }
    return den ? Math.round((num / den) * 10000) / 10000 : null;
  };
  return { weeks, n, logLoss: w((r) => r.log_loss), accuracy: w((r) => r.accuracy), brier: w((r) => r.brier) };
}

async function fetchPairWindow(sb: SupabaseClient, key: IsoWeek) {
  const { data, error } = await sb
    .from('engine_version_pairs')
    .select('iso_year, iso_week, version_a, version_b, market, n, sum_d, sum_d2')
    .lte('iso_year', key.isoYear)
    .order('iso_year', { ascending: false })
    .order('iso_week', { ascending: false })
    .limit(500);
  if (error) return [];
  const cur = weekOrder(key.isoYear, key.isoWeek);
  return (data || []).filter((r: any) => weekOrder(r.iso_year, r.iso_week) <= cur)
    .filter((r: any) => {
      // son PAIR_WINDOW_WEEKS hafta (yaklaşık: yıl sınırı için 100'lük sıra kullanılır)
      const d = (key.isoYear - r.iso_year) * 53 + (key.isoWeek - r.iso_week);
      return d >= 0 && d < PAIR_WINDOW_WEEKS;
    });
}

async function issuedAfterKickoff(sb: SupabaseClient, key: IsoWeek): Promise<number | null> {
  try {
    const { count, error } = await sb
      .from('engine_prediction_history')
      .select('id', { count: 'exact', head: true })
      .gte('kickoff_at_issue', key.weekStart.toISOString())
      .lt('kickoff_at_issue', key.weekEnd.toISOString())
      .eq('quality_flags->>issued_after_kickoff', 'true');
    if (error) return null;
    return count ?? 0;
  } catch { return null; }
}

export async function buildReport(sb: SupabaseClient, key: IsoWeek, computed: ComputeResult): Promise<WeeklySummary> {
  const week = isoWeekLabel(key);
  const agg = computed.aggregate;
  const official0 = (m: Market) => agg.metrics.find((x) => x.model_version === OFFICIAL && x.league_id === 0 && x.market === m) ?? null;

  const [rollingRows, pairWindow, lateIssues] = await Promise.all([
    fetchRolling(sb, key, OFFICIAL, 0, ROLLING_WEEKS),
    fetchPairWindow(sb, key),
    issuedAfterKickoff(sb, key),
  ]);

  const markets: WeeklySummary['markets'] = {};
  for (const m of ['1x2', 'dc', 'ou25', 'btts'] as Market[]) {
    const cur = official0(m);
    const roll = rollingFor(rollingRows, m);
    markets[m] = {
      n: cur?.n ?? 0, accuracy: cur?.accuracy ?? null, brier: cur?.brier ?? null, logLoss: cur?.log_loss ?? null, ece: cur?.ece ?? null,
      avgConfidence: cur?.avg_confidence ?? null, confBrierRaw: cur?.conf_brier_raw ?? null, confBrierCal: cur?.conf_brier_cal ?? null,
      rolling4: roll,
      deltaLogLoss: cur?.log_loss != null && roll?.logLoss != null ? Math.round((Number(cur.log_loss) - roll.logLoss) * 10000) / 10000 : null,
    };
  }

  const b = official0('1x2');
  const benchmark = b && b.odds_n
    ? { oddsN: b.odds_n, marketAccuracy: b.market_accuracy, marketBrier: b.market_brier, modelAccuracyOnOdds: b.model_accuracy_on_odds, roiClosing: b.roi_closing }
    : null;

  const versions = agg.versions.map((v) => {
    const r = agg.metrics.find((x) => x.model_version === v && x.league_id === 0 && x.market === '1x2');
    return { version: v, n: r?.n ?? 0, accuracy: r?.accuracy ?? null, logLoss: r?.log_loss ?? null };
  });

  // Sürüm çiftleri: bu hafta (bootstrap) + yuvarlanan pencere (Σ'lerden)
  const pairs: WeeklySummary['pairs'] = [];
  const pairKeys = new Set<string>();
  for (const p of agg.pairs) pairKeys.add(`${p.version_a}|${p.version_b}`);
  for (const p of pairWindow as any[]) pairKeys.add(`${p.version_a}|${p.version_b}`);
  for (const k of pairKeys) {
    const [va, vb] = k.split('|');
    const per: Record<string, { weekStats: PairedStats | null; rolling: (PairedStats & { weeks: number }) | null }> = {};
    for (const m of ['1x2', 'ou25', 'btts'] as Market[]) {
      const cur = agg.pairs.find((p) => p.version_a === va && p.version_b === vb && p.market === m);
      const win = (pairWindow as any[]).filter((p) => p.version_a === va && p.version_b === vb && p.market === m);
      const n = win.reduce((s, r) => s + Number(r.n), 0);
      const sumD = win.reduce((s, r) => s + Number(r.sum_d), 0);
      const sumD2 = win.reduce((s, r) => s + Number(r.sum_d2), 0);
      const rollStats = pairedFromSums(n, sumD, sumD2);
      per[m] = { weekStats: cur?.bootstrap ?? null, rolling: rollStats ? { ...rollStats, weeks: new Set(win.map((r) => weekOrder(r.iso_year, r.iso_week))).size } : null };
    }
    const verdict = promotionVerdict({
      weeks: per['1x2'].rolling?.weeks ?? 0,
      primary: per['1x2'].rolling,
      secondary: [per.ou25.rolling, per.btts.rolling],
    });
    for (const m of ['1x2', 'ou25', 'btts'] as Market[]) {
      pairs.push({ versionA: va, versionB: vb, market: m, week: per[m].weekStats, rolling: per[m].rolling, verdict: m === '1x2' ? verdict : null });
    }
  }

  // --- Uyarılar ---
  const alerts: Alert[] = [];
  const total = computed.counts.total;
  const settledRatio = total ? Math.round(((total - computed.counts.pending) / total) * 1000) / 1000 : null;
  if (settledRatio != null && settledRatio < SETTLED_MIN) alerts.push({ code: 'settled_ratio_low', severity: 'warn', message: `Only ${(settledRatio * 100).toFixed(1)}% of the week's rows are settled`, evidence: computed.counts });
  if (total && computed.counts.voided / total > 0.1) alerts.push({ code: 'void_spike', severity: 'warn', message: `${computed.counts.voided} of ${total} rows voided (unsettleable)`, evidence: computed.counts });
  if (b && b.n < 50) alerts.push({ code: 'few_rows', severity: 'info', message: `Only ${b.n} covered 1X2 rows this week — weekly numbers are noisy; read the rolling window`, evidence: { n: b.n } });
  if (b?.ece != null && Number(b.ece) > ECE_MAX && b.n >= 100) alerts.push({ code: 'ece_high', severity: 'warn', message: `1X2 ECE ${Number(b.ece).toFixed(3)} > ${ECE_MAX}`, evidence: { ece: b.ece, n: b.n } });
  for (const m of ['1x2', 'ou25', 'btts'] as Market[]) {
    const d = markets[m].deltaLogLoss;
    if (d != null && d > LL_REGRESSION && markets[m].n >= 50) {
      alerts.push({ code: 'logloss_regression', severity: 'warn', message: `${m} log-loss ${markets[m].logLoss} is ${d.toFixed(3)} worse than the ${ROLLING_WEEKS}-week average ${markets[m].rolling4?.logLoss}`, evidence: { market: m, delta: d } });
    }
  }
  // Kalibrasyon 3 ardışık hafta zarar veriyor mu (bu hafta + önceki 2)?
  {
    const hist = rollingRows.filter((r) => r.market === '1x2').sort((a, c) => weekOrder(c.iso_year, c.iso_week) - weekOrder(a.iso_year, a.iso_week)).slice(0, 2);
    const seq = [b, ...hist].filter((r): r is MetricRow => !!r && r.conf_brier_cal != null && r.conf_brier_raw != null);
    if (seq.length === 3 && seq.every((r) => Number(r.conf_brier_cal) > Number(r.conf_brier_raw))) {
      alerts.push({ code: 'calibration_harmful', severity: 'warn', message: 'Display calibration made 1X2 confidence Brier worse for 3 consecutive weeks', evidence: { weeks: seq.map((r) => `${r.iso_year}-W${r.iso_week}: raw ${r.conf_brier_raw} cal ${r.conf_brier_cal}`) } });
    }
  }
  if (lateIssues != null && lateIssues > 0) alerts.push({ code: 'issued_after_kickoff', severity: 'critical', message: `${lateIssues} prediction(s) were (re)published after kickoff this week`, evidence: { count: lateIssues } });
  if (computed.quality.scoredOnTheFly > 0) alerts.push({ code: 'scores_missing', severity: 'info', message: `${computed.quality.scoredOnTheFly} settled rows had no stored per-row scores (scored in memory; run settle-engine?backfill=1)`, evidence: { count: computed.quality.scoredOnTheFly } });
  if (benchmark && benchmark.modelAccuracyOnOdds != null && benchmark.marketAccuracy != null && benchmark.oddsN! >= 50 && Number(benchmark.modelAccuracyOnOdds) < Number(benchmark.marketAccuracy) - 0.05) {
    alerts.push({ code: 'below_market', severity: 'info', message: `Model accuracy on priced rows ${benchmark.modelAccuracyOnOdds} vs bookmaker favourite ${benchmark.marketAccuracy}`, evidence: benchmark });
  }

  // --- Öneriler (hiçbiri otomatik uygulanmaz) ---
  const proposals: Proposal[] = [];
  for (const p of pairs.filter((x) => x.market === '1x2')) {
    const ev = { versionA: p.versionA, versionB: p.versionB, rolling: p.rolling, verdict: p.verdict, gate: PROMOTION_GATE };
    if (p.verdict?.pass) proposals.push({ type: 'promote', subject: p.versionB, text: `${p.versionB} beats ${p.versionA} on paired 1X2 log-loss over ${p.rolling?.weeks} weeks (Δ ${p.rolling?.mean}, 95% CI [${p.rolling?.lo}, ${p.rolling?.hi}], n ${p.rolling?.n}); OU/BTTS not worse. Ready for admin activation.`, evidence: ev });
    else if (p.rolling?.bWorse && (p.rolling.weeks ?? 0) >= PROMOTION_GATE.minWeeks) proposals.push({ type: 'retire', subject: p.versionB, text: `${p.versionB} is significantly worse than ${p.versionA} over ${p.rolling.weeks} weeks (Δ ${p.rolling.mean}, CI [${p.rolling.lo}, ${p.rolling.hi}]). Consider retiring the shadow.`, evidence: ev });
    else proposals.push({ type: 'keep_shadow', subject: p.versionB, text: `Keep ${p.versionB} in shadow: ${p.verdict?.reasons.join('; ') || 'insufficient evidence'}.`, evidence: ev });
  }
  if (alerts.some((a) => a.code === 'logloss_regression')) proposals.push({ type: 'investigate', subject: week, text: 'Log-loss regressed vs the rolling window: check store freshness (results.jsonl), newly promoted teams (n_eff), and fixture-list coverage before touching parameters.', evidence: { alerts: alerts.filter((a) => a.code === 'logloss_regression') } });

  const summary: WeeklySummary = {
    week, weekStart: key.weekStart.toISOString(), weekEnd: key.weekEnd.toISOString(), generatedAt: new Date().toISOString(),
    quality: {
      total, settled: total - computed.counts.pending, pending: computed.counts.pending, voided: computed.counts.voided, settledRatio,
      covered: computed.quality.covered, scoredOnTheFly: computed.quality.scoredOnTheFly, oddsCoverage: computed.oddsCoverage,
    },
    markets, benchmark, versions, pairs, alerts, proposals,
  };

  // --- yaz ---
  const { error: repErr } = await sb.from('engine_weekly_reports')
    .upsert({ iso_year: key.isoYear, iso_week: key.isoWeek, summary, generated_at: summary.generatedAt }, { onConflict: 'iso_year,iso_week' });
  if (repErr) throw new Error(`engine_weekly_reports upsert: ${repErr.message}`);

  const logRows: any[] = [{ layer: 'review', action: 'report', subject: week, after: { markets, benchmark, quality: summary.quality }, actor: ACTOR, note: `${alerts.length} alert(s), ${proposals.length} proposal(s)` }];
  for (const a of alerts) {
    if (a.severity === 'info') continue;
    logRows.push({ layer: a.code === 'calibration_harmful' ? 'calibration' : 'review', action: 'alert', subject: `${week}/${a.code}`, evidence: a.evidence ?? null, actor: ACTOR, note: a.message });
  }
  for (const p of proposals) {
    if (p.type === 'keep_shadow') continue;
    // subject hafta önekiyle başlar → aynı hafta yeniden hesaplanırsa temizlenebilir
    logRows.push({ layer: p.type === 'investigate' ? 'review' : 'version', action: 'propose', subject: `${week}/${p.type}/${p.subject}`, evidence: p.evidence, actor: ACTOR, note: p.text });
  }
  // Aynı hafta yeniden hesaplanırsa günlük çift kayıt üretmesin: bu haftanın cron kayıtlarını sil.
  await sb.from('engine_learning_log').delete().eq('actor', ACTOR).like('subject', `${week}%`);
  const { error: logErr } = await sb.from('engine_learning_log').insert(logRows);
  if (logErr) console.error('[weekly] learning log insert failed:', logErr.message);

  return summary;
}
