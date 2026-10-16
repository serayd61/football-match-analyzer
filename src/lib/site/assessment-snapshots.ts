import 'server-only';
import { dbFresh as db } from './db';
import { listDayFresh } from './fixtures';
import { latestPhase } from './odds-phases';
import { todayYmd, addDays } from './time';
import { loadAssessDeps, assessWithDeps } from './assess';
import type { MarketSnapshot } from './predictions';
import { SNAPSHOT_TABLE, inSnapshotWindow, toSnapshotRows, snapshotKey, settleSnapshots, type AssessmentSnapshotRow, type StoredSnapshot, type SnapshotRecord } from './assessment-snapshot-rule';
import { ASSESSMENT_RULE_VERSION, type AssessmentStatus } from './assessment';

// ============================================================================
// GÖLGE KAYIT — yazma + okuma (2026-10-16). Kural assessment-snapshot-rule.ts'te.
// Saatlik standing-picks cron'u (:45) çağırır: D..D+2 penceresinde başlamaya
// ≤3 saat kalmış modelli maçların değerlendirmesi, tüm durumlarıyla, bir kez
// yazılır. Önbelleksiz istemci + en geç faz oranı (vitrin/picks ile aynı).
// Tablo yoksa hata loglanır, cron'un diğer işi etkilenmez.
// ============================================================================

/** En geç faz 1X2 anlık görüntüsü — doğrudan DB, önbelleksiz (oran + zaman + sağlayıcı dahil). */
async function freshSnapshots(ids: number[]): Promise<Record<number, MarketSnapshot>> {
  const out: Record<number, MarketSnapshot> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db().from('prediction_odds')
      .select('fixture_id, phase, provider, captured_at, minutes_to_kickoff, home_odds, draw_odds, away_odds, overround, p_home_market, p_draw_market, p_away_market')
      .in('fixture_id', ids.slice(i, i + 100))
      .limit(100 * 6);
    const by = new Map<number, any[]>();
    for (const r of (data ?? []) as any[]) { const k = Number(r.fixture_id); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
    for (const [k, rows] of by) {
      const l = latestPhase(rows);
      if (!l || l.p_home_market == null) continue;
      out[k] = {
        phase: String(l.phase), provider: l.provider ?? null, capturedAt: String(l.captured_at), minutesToKickoff: l.minutes_to_kickoff == null ? null : Number(l.minutes_to_kickoff),
        homeOdds: Number(l.home_odds), drawOdds: Number(l.draw_odds), awayOdds: Number(l.away_odds), overround: l.overround == null ? null : Number(l.overround),
        pHome: Number(l.p_home_market), pDraw: Number(l.p_draw_market), pAway: Number(l.p_away_market),
      };
    }
  }
  return out;
}

export interface SnapshotResult {
  window: number;
  /** pencere içindeki modelli, oynanmamış maç */
  candidates: number;
  /** yazılmak istenen satır (pazar başına) */
  attempted: number;
  /** bu turda GERÇEKTEN eklenen (var olanlar atlandı) */
  inserted: number;
  byStatus: Record<AssessmentStatus, number>;
  ruleVersion: string;
  error: string | null;
}

/** D..D+days-1 penceresinde başlamaya ≤3 saat kalan maçların değerlendirmesini bir kez yazar; write=false yalnız sayar. */
export async function recordAssessmentSnapshots(days = 3, write = true, now = Date.now()): Promise<SnapshotResult> {
  const today = todayYmd();
  const rows = [];
  for (let d = 0; d < days; d++) {
    const day = await listDayFresh(addDays(today, d));
    rows.push(...day.rows.filter((r) => r.hasModel && !r.settled && r.status === 'scheduled' && inSnapshotWindow(r.kickoff, now)));
  }
  const byStatus: Record<AssessmentStatus, number> = { supported: 0, conflicting: 0, insufficient: 0 };
  const base = { window: days, candidates: rows.length, ruleVersion: ASSESSMENT_RULE_VERSION };
  if (!rows.length) return { ...base, attempted: 0, inserted: 0, byStatus, error: null };

  const ids = rows.map((r) => r.fixtureId);
  const deps = await loadAssessDeps(ids, { snapshots: await freshSnapshots(ids), now });
  const out: AssessmentSnapshotRow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const a = assessWithDeps(r, deps);
    if (!a) continue;
    for (const s of toSnapshotRows(a.assessment, { fixtureId: r.fixtureId, kickoff: r.kickoff, leagueId: r.leagueId, leagueSlug: r.league?.slug ?? null, covered: r.covered, homeName: r.homeName, awayName: r.awayName })) {
      const k = snapshotKey(s);
      if (seen.has(k)) continue; // aynı fixture iki günde listelenmişse tek satır
      seen.add(k); out.push(s); byStatus[s.status]++;
    }
  }

  let inserted = 0, error: string | null = null;
  if (write && out.length) {
    for (let i = 0; i < out.length; i += 200) {
      // ignoreDuplicates: var olan (fixture, pazar, kural) satırı DOKUNULMADAN geçilir → tekrar eden tur idempotent.
      const { data, error: e } = await db().from(SNAPSHOT_TABLE).upsert(out.slice(i, i + 200), { onConflict: 'fixture_id,market,rule_version', ignoreDuplicates: true }).select('fixture_id');
      if (e) { error = e.message; console.error('[assessment-snapshots] insert failed', e.message); break; }
      inserted += (data ?? []).length;
    }
  }
  return { ...base, attempted: out.length, inserted, byStatus, error };
}

/**
 * Keşifsel gölge karnesi: son N günün anlık görüntüleri (başlaması ≥3 saat geçmiş),
 * skor engine_predictions'tan. Tablo yoksa boş kayıt döner.
 */
export async function assessmentHistory(days = 30, now = Date.now(), ruleVersion = ASSESSMENT_RULE_VERSION): Promise<SnapshotRecord & { rows: number }> {
  const from = new Date(now - days * 86400_000).toISOString();
  const cutoff = new Date(now - 3 * 3600_000).toISOString();
  const { data, error } = await db().from(SNAPSHOT_TABLE).select('fixture_id, market, selection, status, kickoff, rule_version')
    .eq('rule_version', ruleVersion).gte('kickoff', from).lt('kickoff', cutoff).order('kickoff', { ascending: true }).limit(5000);
  if (error) { console.error('[assessment-snapshots] history read failed', error.message); return { ...settleSnapshots([], new Map()), rows: 0 }; }
  const rows: StoredSnapshot[] = ((data ?? []) as any[]).map((r) => ({ fixtureId: Number(r.fixture_id), market: r.market, selection: String(r.selection), status: r.status, kickoff: String(r.kickoff), ruleVersion: String(r.rule_version) }));
  const ids = [...new Set(rows.map((r) => r.fixtureId))];
  const scores = new Map<number, [number, number]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: sc } = await db().from('engine_predictions').select('fixture_id, home_score, away_score')
      .in('fixture_id', ids.slice(i, i + 200)).not('home_score', 'is', null).not('away_score', 'is', null);
    for (const s of (sc ?? []) as any[]) if (!scores.has(Number(s.fixture_id))) scores.set(Number(s.fixture_id), [Number(s.home_score), Number(s.away_score)]);
  }
  return { ...settleSnapshots(rows, scores), rows: rows.length };
}
