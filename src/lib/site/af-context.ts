// ============================================================================
// Maç bağlamı — eksikler (sakatlık/ceza) + açıklanan kadro (af_fixture_context)
// ----------------------------------------------------------------------------
// Neden: model sezonluk takım gücü hesaplar, o hafta kimin eksik olduğunu
// bilmez (2026-09-14). Kaynak API-Football (af_fixture_map eşlemesi üzerinden).
// Yazan: cron /api/cron/af-context (saat başı :25) D..D+2 için toplu; ayrıca
// maç sayfası okuması eksik/gecikmiş veriyi yerinde tamamlar (kadro 75 dk kala
// açıklanır, saatlik cron pencereyi kaçırabilir). Bütçe: eksikler ≤48 s kala
// 6 s'de bir (~40 maç × 4 ≈ 160/gün), kadro maç başına 1–2 çağrı.
// Şimdilik yalnız gösterim; seçim kuralına ve modele GİRMEZ (2. aşama: backtest).
// ============================================================================
import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, dbFresh } from './db';
import { listDayFresh } from './fixtures';
import { todayYmd, addDays } from './time';
import { afIdsFor } from './af-map';
import { afInjuries, afLineups, injuriesDue, lineupsDue, hasApiFootballKey, type AfInjury, type AfLineup } from '@/lib/data-sources/api-football';

const TABLE = 'af_fixture_context';

export interface AfContext {
  fixtureId: number;
  injuries: AfInjury[] | null;
  injuriesAt: string | null;
  lineups: AfLineup[] | null;
  lineupsAt: string | null;
}

interface Row { fixture_id: number; af_fixture_id: number; kickoff: string; injuries: any; injuries_at: string | null; lineups: any; lineups_at: string | null }

const toCtx = (r: Row | null | undefined): AfContext | null => r ? ({
  fixtureId: Number(r.fixture_id),
  injuries: Array.isArray(r.injuries) ? (r.injuries as AfInjury[]) : null, injuriesAt: r.injuries_at ?? null,
  lineups: Array.isArray(r.lineups) && r.lineups.length ? (r.lineups as AfLineup[]) : null, lineupsAt: r.lineups_at ?? null,
}) : null;

interface Target { fixtureId: number; afId: number; kickoff: string; home: string; away: string }

/** Tek maç için gerekeni çek ve yaz (eksikler süresi dolduysa, kadro penceredeyse). */
async function refreshOne(t: Target, row: Row | null, now: number, force = false) {
  const out = { calls: 0, injuries: false, lineups: false, errors: [] as string[] };
  const patch: Record<string, unknown> = {};
  const nowIso = new Date(now).toISOString();
  if (force || injuriesDue(t.kickoff, now, row?.injuries_at ?? null)) {
    out.calls++;
    const r = await afInjuries(t.afId, t.home, t.away);
    if (r.ok) { patch.injuries = r.rows; patch.injuries_at = nowIso; out.injuries = true; } else out.errors.push(`injuries ${t.fixtureId}: ${r.error}`);
  }
  const have = Array.isArray(row?.lineups) && row!.lineups.length > 0;
  if ((force && !have) || lineupsDue(t.kickoff, now, have)) {
    out.calls++;
    const r = await afLineups(t.afId, t.home, t.away);
    if (r.ok) { if (r.lineups) { patch.lineups = r.lineups; patch.lineups_at = nowIso; out.lineups = true; } }
    else out.errors.push(`lineups ${t.fixtureId}: ${r.error}`);
  }
  if (Object.keys(patch).length) {
    const { error } = await dbFresh().from(TABLE).upsert({ fixture_id: t.fixtureId, af_fixture_id: t.afId, kickoff: t.kickoff, updated_at: nowIso, ...patch }, { onConflict: 'fixture_id' });
    if (error) out.errors.push(`upsert ${t.fixtureId}: ${error.message}`);
  }
  return out;
}

/** Cron: D..D+2 penceresindeki eşlenmiş maçlar için toplu tazeleme. */
export async function syncAfContext(days = 3, maxCalls = 80, now = Date.now()) {
  if (!hasApiFootballKey()) return { ok: false, error: 'API_FOOTBALL_KEY yok', calls: 0 };
  const today = todayYmd();
  const rows: any[] = [];
  for (let d = 0; d < days; d++) rows.push(...(await listDayFresh(addDays(today, d))).rows.filter((r) => r.covered));
  const ids = rows.map((r) => r.fixtureId);
  const afIds = await afIdsFor(ids);
  const targets: Target[] = rows.filter((r) => afIds.has(r.fixtureId)).map((r) => ({ fixtureId: r.fixtureId, afId: afIds.get(r.fixtureId)!, kickoff: r.kickoff, home: r.homeName, away: r.awayName }));
  const existing = new Map<number, Row>();
  for (let i = 0; i < targets.length; i += 200) {
    const { data } = await dbFresh().from(TABLE).select('*').in('fixture_id', targets.slice(i, i + 200).map((t) => t.fixtureId));
    for (const r of (data ?? []) as Row[]) existing.set(Number(r.fixture_id), r);
  }
  let calls = 0, injuries = 0, lineups = 0; const errors: string[] = [];
  // kadro penceresindekiler önce (zaman kritik), sonra eksikler
  const due = targets.filter((t) => { const row = existing.get(t.fixtureId) ?? null; return lineupsDue(t.kickoff, now, !!row?.lineups?.length) || injuriesDue(t.kickoff, now, row?.injuries_at ?? null); })
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  for (const t of due) {
    if (calls >= maxCalls) break;
    const r = await refreshOne(t, existing.get(t.fixtureId) ?? null, now);
    calls += r.calls; if (r.injuries) injuries++; if (r.lineups) lineups++; errors.push(...r.errors);
    if (errors.some((e) => /limit|403|401/i.test(e))) break;
  }
  return { ok: errors.length === 0, candidates: targets.length, due: due.length, calls, injuries, lineups, errors };
}

/** Admin: tek maçı zorla tazele (eksikler her zaman, kadro yoksa). */
export async function refreshAfContext(fixtureId: number, home: string, away: string, kickoff: string) {
  const afId = (await afIdsFor([fixtureId])).get(fixtureId);
  if (!afId) return { ok: false, error: 'eşleme yok' };
  const { data } = await dbFresh().from(TABLE).select('*').eq('fixture_id', fixtureId).maybeSingle();
  const r = await refreshOne({ fixtureId, afId, kickoff, home, away }, (data as Row) ?? null, Date.now(), true);
  return { ok: r.errors.length === 0, ...r };
}

/**
 * Maç sayfası okuması: tablo satırı; kadro penceresi açık ve kadro yoksa (ya da
 * eksikler hiç alınmadıysa) yerinde tamamlar. 5 dk önbellek.
 */
export const getAfContext = unstable_cache(
  async (fixtureId: number, home: string, away: string, kickoff: string): Promise<AfContext | null> => {
    const { data } = await db().from(TABLE).select('*').eq('fixture_id', fixtureId).maybeSingle();
    let row = (data as Row | null) ?? null;
    const now = Date.now();
    const needLineups = lineupsDue(kickoff, now, !!row?.lineups?.length);
    const needInjuries = !row?.injuries_at && injuriesDue(kickoff, now, null);
    if ((needLineups || needInjuries) && hasApiFootballKey()) {
      const afId = (await afIdsFor([fixtureId])).get(fixtureId);
      if (afId) {
        const r = await refreshOne({ fixtureId, afId, kickoff, home, away }, row, now);
        if (r.injuries || r.lineups) {
          const { data: fresh } = await dbFresh().from(TABLE).select('*').eq('fixture_id', fixtureId).maybeSingle();
          row = (fresh as Row | null) ?? row;
        }
      }
    }
    return toCtx(row);
  },
  ['site-af-context-v1'],
  { revalidate: 5 * 60 },
);
