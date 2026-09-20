import 'server-only';
import { dbFresh } from './db';
import { PHASE_ORDER } from './odds-phases';
import type { GoalBook } from './goal-blend';

// Son görüş (en geç faz) gol pazarı oranları — prediction_odds'tan tek sorgu/100 id.
// KG akıştan (FotMob), Üst 2,5 API-Football'dan; iki taraf da lazım (devig).
// Denetim B05: 100 id × 6 faz = 600 satır, PostgREST max-rows altında.
const CHUNK = 100;

export async function latestGoalBook(ids: number[]): Promise<Map<number, GoalBook>> {
  const out = new Map<number, GoalBook>();
  const best = new Map<number, number>();
  const uniq = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n)))];
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const chunk = uniq.slice(i, i + CHUNK);
    const { data, error } = await dbFresh()
      .from('prediction_odds')
      .select('fixture_id, phase, over25_odds, under25_odds, btts_yes_odds, btts_no_odds')
      .in('fixture_id', chunk)
      .limit(CHUNK * 6);
    if (error) { console.error('[goal-book]', error.message); continue; }
    for (const r of (data ?? []) as any[]) {
      const k = Number(r.fixture_id);
      const rk = (PHASE_ORDER as Record<string, number>)[r.phase] ?? -1;
      if (rk < (best.get(k) ?? -1)) continue;
      best.set(k, rk);
      const n = (x: any) => (x != null && Number(x) > 1 ? Number(x) : null);
      out.set(k, { over25: n(r.over25_odds), under25: n(r.under25_odds), bttsYes: n(r.btts_yes_odds), bttsNo: n(r.btts_no_odds), phase: r.phase ?? null });
    }
  }
  return out;
}
