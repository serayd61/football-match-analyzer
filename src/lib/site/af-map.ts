import 'server-only';
import { db } from './db';
import { listDayFresh } from './fixtures';
import { todayYmd, addDays } from './time';
import { AF_LEAGUE, afFixtures, afSeasonFor, matchFixtures, hasApiFootballKey } from '@/lib/data-sources/api-football';

// FotMob fikstür id ↔ API-Football fikstür id eşleme tablosu (af_fixture_map).
// Saat başı: D..D+2 kapsanan maçlardan eşlenmemiş olanlar için lig+gün başına
// tek API-Football çağrısı; eşleşenler kalıcı yazılır, kalanlar bir sonraki
// turda yeniden denenir (kadro/erteleme değişebilir). Eşleşme adı+saat ile.

const TABLE = 'af_fixture_map';

export async function afIdsFor(fixtureIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  for (let i = 0; i < fixtureIds.length; i += 200) {
    const { data } = await db().from(TABLE).select('fixture_id, af_fixture_id').in('fixture_id', fixtureIds.slice(i, i + 200));
    for (const r of (data ?? []) as any[]) out.set(Number(r.fixture_id), Number(r.af_fixture_id));
  }
  return out;
}

export async function buildAfMap(days = 3, maxCalls = 40) {
  if (!hasApiFootballKey()) return { ok: false, error: 'API_FOOTBALL_KEY yok', calls: 0, mapped: 0, unmatched: [] as any[] };
  const today = todayYmd();
  const rows: any[] = [];
  for (let d = 0; d < days; d++) rows.push(...(await listDayFresh(addDays(today, d))).rows.filter((r) => r.covered && r.league && AF_LEAGUE[r.league.slug]));
  const have = await afIdsFor(rows.map((r) => r.fixtureId));
  const todo = rows.filter((r) => !have.has(r.fixtureId));
  // lig + UTC gün grupları
  const groups = new Map<string, any[]>();
  for (const r of todo) groups.set(`${r.league.slug}|${r.kickoff.slice(0, 10)}`, [...(groups.get(`${r.league.slug}|${r.kickoff.slice(0, 10)}`) ?? []), r]);
  let calls = 0, mapped = 0; const unmatched: any[] = []; const errors: string[] = [];
  for (const [key, grp] of groups) {
    if (calls >= maxCalls) break;
    const [slug, ymd] = key.split('|');
    const res = await afFixtures(AF_LEAGUE[slug], afSeasonFor(slug, grp[0].kickoff), ymd);
    calls++;
    if (!res.ok) { errors.push(`${key}: ${res.error}`); if (/limit|403|401/i.test(res.error)) break; continue; }
    const m = matchFixtures(grp.map((r) => ({ fixtureId: r.fixtureId, kickoff: r.kickoff, home: r.homeName, away: r.awayName })), res.rows);
    const matchedIds = new Set(m.map((x) => x.fixtureId));
    for (const r of grp) if (!matchedIds.has(r.fixtureId)) unmatched.push({ fixtureId: r.fixtureId, match: `${r.homeName} – ${r.awayName}`, league: slug, afCandidates: res.rows.map((t) => `${t.home} – ${t.away}`).slice(0, 12) });
    if (m.length) {
      const { error } = await db().from(TABLE).upsert(m.map((x) => ({ fixture_id: x.fixtureId, af_fixture_id: x.afId, league_slug: slug, score: x.score, kickoff: grp.find((r) => r.fixtureId === x.fixtureId)!.kickoff })), { onConflict: 'fixture_id' });
      if (error) errors.push(`upsert: ${error.message}`); else mapped += m.length;
    }
  }
  return { ok: errors.length === 0, calls, candidates: rows.length, alreadyMapped: have.size, mapped, unmatched, errors };
}
