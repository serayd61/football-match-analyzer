import 'server-only';
import { dbFresh } from './db';
import { resolveOfficialVersion, officialFilter } from './official';
import { freezeState } from './showcase-rule';
import { coverageById } from '@/lib/coverage/registry';
import { buildRecoModel, recommend, settleReco, RECO_RULE_VERSION, RECO_GATE, type RecoHistoryRow, type RecoMarket, type RecoMarketInput, type RecoSelection } from './recommend-rule';
import { latestPhase } from './odds-phases';
import { marketYes } from './goal-blend';

// ============================================================================
// ÖNERİLEN SEÇİM — hesap + dondurma + karne. Kural recommend-rule.ts'te (saf).
// Saatlik cron: son HISTORY_DAYS günün sonuçlanmış maçlarından modeli kurar
// (walk-forward, backtest ile aynı), önümüzdeki N günün maçlarına seçim yazar;
// başlamaya ≤3 saat kala satır donar ve bir daha değişmez (DB tetikleyicisi de
// korur). Karne yalnız dondurulmuş satırlarla, skor engine_predictions'tan.
// Gizli ligler (league_coverage.status='hidden') ne öğrenmeye ne seçime girer.
// Faz 2 (5 Eki): yalnız kayıt — sitede gösterilmez.
// ============================================================================

const TABLE = 'site_reco_picks';
export const HISTORY_DAYS = 180;
const PAGE = 1000;

type Cov = Awaited<ReturnType<typeof coverageById>>;
const isHidden = (cov: Cov, id: number | null) => id != null && cov.get(Number(id))?.status === 'hidden';
const isCovered = (cov: Cov, id: number | null) => id != null && cov.get(Number(id))?.status === 'whitelist';

/** Fixture → son faz marjsız piyasa olasılıkları (prediction_odds; yalnız kapsanan liglerde var). */
async function loadMarkets(ids: number[]): Promise<Map<number, RecoMarketInput>> {
  const by = new Map<number, any[]>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await dbFresh().from('prediction_odds')
      .select('fixture_id, phase, captured_at, p_home_market, p_draw_market, p_away_market, over25_odds, under25_odds, btts_yes_odds, btts_no_odds')
      .in('fixture_id', ids.slice(i, i + 150)).limit(150 * 6);
    for (const r of (data ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
  }
  const out = new Map<number, RecoMarketInput>();
  for (const [k, rows] of by) {
    const l = latestPhase(rows); if (!l) continue;
    const num = (v: any) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
    const m: RecoMarketInput = {
      pHome: num(l.p_home_market), pDraw: num(l.p_draw_market), pAway: num(l.p_away_market),
      pOver25: marketYes(num(l.over25_odds), num(l.under25_odds)),
      pBttsYes: marketYes(num(l.btts_yes_odds), num(l.btts_no_odds)),
    };
    if (m.pHome != null || m.pOver25 != null || m.pBttsYes != null) out.set(k, m);
  }
  return out;
}

async function loadHistory(official: string | null, cov: Cov, now: number): Promise<RecoHistoryRow[]> {
  const since = new Date(now - HISTORY_DAYS * 86_400_000).toISOString();
  const out: RecoHistoryRow[] = [];
  for (let from = 0; from < 100_000; from += PAGE) {
    const { data, error } = await officialFilter(dbFresh().from('engine_predictions')
      .select('fixture_id, league_id, kickoff, p_home, p_draw, p_away, p_over25, p_btts_yes, home_score, away_score'), official)
      .eq('settled', true).not('home_score', 'is', null).not('away_score', 'is', null)
      .gte('kickoff', since).lt('kickoff', new Date(now).toISOString())
      .order('kickoff').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`reco history: ${error.message}`);
    for (const r of (data ?? []) as any[]) {
      if (isHidden(cov, r.league_id)) continue;
      out.push({ leagueId: r.league_id, pHome: r.p_home, pDraw: r.p_draw, pAway: r.p_away, pOver25: r.p_over25, pBttsYes: r.p_btts_yes, kickoff: r.kickoff, h: Number(r.home_score), a: Number(r.away_score), fixtureId: Number(r.fixture_id) } as RecoHistoryRow & { fixtureId: number });
    }
    if (!data || data.length < PAGE) break;
  }
  // Geçmişin oranlı maçları (kapsanan ligler) harmanlı kovaları beslesin — canlıyla aynı anahtar.
  const covered = out.filter((r) => isCovered(cov, r.leagueId)).map((r) => (r as any).fixtureId as number);
  const mk = await loadMarkets(covered);
  for (const r of out) { const m = mk.get((r as any).fixtureId); if (m) r.market = m; }
  return out;
}

export interface RecoRow {
  fixtureId: number; kickoff: string; leagueName: string | null; homeName: string; awayName: string; covered: boolean;
  market: RecoMarket | null; selection: RecoSelection | null; q: number | null; pDisplay: number | null; pRaw: number | null;
  frozen: boolean;
}

const r4 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10000) / 10000);

/** Önümüzdeki `days` günün maçları için seçim; write=false ise yazmaz (önizleme). */
export async function computeReco(days = 3, write = true, now = Date.now()) {
  const official = await resolveOfficialVersion();
  const cov = await coverageById();
  const history = await loadHistory(official, cov, now);
  const model = buildRecoModel(history);

  const { data: up, error } = await officialFilter(dbFresh().from('engine_predictions')
    .select('fixture_id, league_id, league_name, home_name, away_name, kickoff, p_home, p_draw, p_away, p_over25, p_btts_yes, model_version'), official)
    .eq('settled', false).gt('kickoff', new Date(now).toISOString()).lt('kickoff', new Date(now + days * 86_400_000).toISOString())
    .order('kickoff').limit(3000);
  if (error) throw new Error(`reco upcoming: ${error.message}`);
  const rows = ((up ?? []) as any[]).filter((r) => !isHidden(cov, r.league_id));

  const ids = rows.map((r) => Number(r.fixture_id));
  const markets = await loadMarkets(rows.filter((r) => isCovered(cov, r.league_id)).map((r) => Number(r.fixture_id)));
  const frozen = new Set<number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await dbFresh().from(TABLE).select('fixture_id').in('fixture_id', ids.slice(i, i + 200)).eq('frozen', true);
    for (const r of (data ?? []) as any[]) frozen.add(Number(r.fixture_id));
  }

  const nowIso = new Date(now).toISOString();
  const upserts: any[] = [];
  const picks: RecoRow[] = [];
  let skipped = 0, froze = 0, late = 0, noPick = 0;
  for (const r of rows) {
    const fid = Number(r.fixture_id);
    if (frozen.has(fid)) { skipped++; continue; }
    const state = freezeState(r.kickoff, now);
    if (state === 'late') { late++; continue; }
    const input = { leagueId: r.league_id, pHome: r.p_home, pDraw: r.p_draw, pAway: r.p_away, pOver25: r.p_over25, pBttsYes: r.p_btts_yes, market: markets.get(fid) ?? null };
    const { pick, candidates } = recommend(input, model.stats, RECO_GATE, model.meta);
    const pDisplay = pick ? pick.pDisplay : null;
    if (!pick) noPick++;
    const freeze = state === 'freeze';
    if (freeze) froze++;
    const covered = isCovered(cov, r.league_id);
    upserts.push({
      fixture_id: fid, kickoff: r.kickoff, league_id: r.league_id, league_name: r.league_name, home_name: r.home_name, away_name: r.away_name, covered,
      market: pick?.market ?? null, selection: pick?.selection ?? null, q: r4(pick?.q), p_display: r4(pDisplay), p_raw: r4(pick?.pRaw), base_rate: r4(pick?.base),
      candidates: candidates.map((c) => ({ market: c.market, selection: c.selection, pRaw: r4(c.pRaw), p: r4(c.p), blended: c.blended, q: r4(c.q), pDisplay: r4(c.pDisplay), base: r4(c.base), passes: c.passes })),
      rule_version: RECO_RULE_VERSION, model_version: r.model_version, frozen: freeze, frozen_at: freeze ? nowIso : null, computed_at: nowIso,
    });
    picks.push({ fixtureId: fid, kickoff: r.kickoff, leagueName: r.league_name, homeName: r.home_name, awayName: r.away_name, covered, market: pick?.market ?? null, selection: pick?.selection ?? null, q: r4(pick?.q), pDisplay: r4(pDisplay), pRaw: r4(pick?.pRaw), frozen: freeze });
  }
  let writeError: string | null = null;
  if (write) {
    for (let i = 0; i < upserts.length && !writeError; i += 200) {
      const { error: e } = await dbFresh().from(TABLE).upsert(upserts.slice(i, i + 200), { onConflict: 'fixture_id' });
      if (e) writeError = e.message;
    }
  }
  return {
    model: { historyRows: model.rows, historyDays: model.days, metaPicks: model.metaPicks, withMarket: markets.size },
    considered: rows.length, written: write && !writeError ? upserts.length : 0, frozeNow: froze, alreadyFrozen: skipped, late, noPick,
    error: writeError, picks,
  };
}

interface Cell { n: number; won: number; p: number }
const cell = (): Cell => ({ n: 0, won: 0, p: 0 });

/** Son `days` günün dondurulmuş seçimlerinin karnesi (skor engine_predictions'tan). */
export async function recoRecord(days = 30, now = Date.now()) {
  const from = new Date(now - days * 86_400_000).toISOString();
  const { data, error } = await dbFresh().from(TABLE)
    .select('fixture_id, market, selection, p_display, covered, kickoff')
    .eq('frozen', true).gte('kickoff', from).lt('kickoff', new Date(now).toISOString()).limit(5000);
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  const official = await resolveOfficialVersion();
  const score = new Map<number, [number, number]>();
  const ids = rows.map((r) => Number(r.fixture_id));
  for (let i = 0; i < ids.length; i += 200) {
    const { data: s } = await officialFilter(dbFresh().from('engine_predictions').select('fixture_id, home_score, away_score'), official)
      .in('fixture_id', ids.slice(i, i + 200)).not('home_score', 'is', null).not('away_score', 'is', null);
    for (const x of (s ?? []) as any[]) score.set(Number(x.fixture_id), [Number(x.home_score), Number(x.away_score)]);
  }
  const all = cell(), byMarket: Record<string, Cell> = {}, bySeg: Record<string, Cell> = {};
  let settledMatches = 0, noPick = 0, pending = 0;
  for (const r of rows) {
    const sc = score.get(Number(r.fixture_id));
    if (!sc) { pending++; continue; }
    settledMatches++;
    if (!r.market) { noPick++; continue; }
    const won = settleReco(r.market, r.selection, sc[0], sc[1]);
    const p = Number(r.p_display);
    for (const c of [all, (byMarket[`${r.market}:${r.selection}`] ??= cell()), (bySeg[r.covered ? 'covered' : 'outside'] ??= cell())]) { c.n++; if (won) c.won++; c.p += p; }
  }
  const fmt = (c: Cell) => ({ n: c.n, won: c.won, acc: c.n ? Math.round((c.won / c.n) * 1000) / 10 : null, claimed: c.n ? Math.round((c.p / c.n) * 1000) / 10 : null });
  return {
    days, settledMatches, pending, noPick, coverage: settledMatches ? Math.round(((settledMatches - noPick) / settledMatches) * 1000) / 10 : null,
    all: fmt(all), byMarket: Object.fromEntries(Object.entries(byMarket).map(([k, v]) => [k, fmt(v)])), bySegment: Object.fromEntries(Object.entries(bySeg).map(([k, v]) => [k, fmt(v)])),
  };
}
