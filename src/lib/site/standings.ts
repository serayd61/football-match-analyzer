import { ffKeys, ffNoteBadKey, FF_TIMEOUT_MS } from '@/lib/data-sources/free-football';
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getRedisClient } from '@/lib/cache/redis';
import { noteFeedQuota } from '@/lib/data-sources/feed-quota';
import { leagueBySlug } from './leagues';
import { loadStandings, STANDINGS_KEEP_S, type StandingsEntry, type StandingsFetch } from './standings-cache';

// League tables from the fixtures feed (`football-get-standing-all`).
// One upstream call per league per 6 hours, held in Redis (see standings-cache.ts:
// the Next data cache did not hold these — every page view reached the feed and
// the monthly quota ran out on 2026-11-25). Canonical league ids work here
// (verified 2026-09-04 for 47, 42, 268), so no catalog lookup is needed.

const HOST = 'free-api-live-football-data.p.rapidapi.com';

export interface StandingRow {
  pos: number;
  teamId: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  deduction: number | null;
  /** feed's qualification colour (e.g. green = CL, red = relegation) */
  qualColor: string | null;
}

async function fetchStandings(leagueId: number): Promise<StandingsFetch<StandingRow>> {
  // Anahtar zinciri free-football ile ortak (2026-09-17: FOOTBALL_API_KEY geçersiz kaldı).
  let res: Response | null = null;
  try {
    for (const key of ffKeys()) {
      res = await fetch(`https://${HOST}/football-get-standing-all?leagueid=${leagueId}`, {
        headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': key },
        // ISR ağacı: no-store burada sayfayı dinamiğe düşürür (bkz. tests/isr-anon-tree).
        next: { revalidate: 6 * 3600 },
        signal: AbortSignal.timeout(FF_TIMEOUT_MS),
      });
      if (res.status !== 401 && res.status !== 403) break;
      ffNoteBadKey(key);
    }
  } catch (e: any) {
    console.error(`[site/standings] ${leagueId} failed: ${e?.message}`);
    return { ok: false, status: null };
  }
  if (res) noteFeedQuota(res.headers);
  if (!res || !res.ok) { console.error(`[site/standings] ${leagueId} HTTP ${res?.status}`); return { ok: false, status: res?.status ?? null }; }
  const json = await res.json();
  const list: any[] = json?.response?.standing || json?.standing || [];
  const rows = list
    .map((r) => {
      const [gf, ga] = String(r.scoresStr || '0-0').split('-').map((x: string) => Number(x) || 0);
      return {
        pos: Number(r.idx) || 0, teamId: Number(r.id) || 0, name: String(r.name || r.shortName || ''),
        played: Number(r.played) || 0, won: Number(r.wins) || 0, drawn: Number(r.draws) || 0, lost: Number(r.losses) || 0,
        gf, ga, gd: Number(r.goalConDiff) || gf - ga, pts: Number(r.pts) || 0,
        deduction: r.deduction != null ? Number(r.deduction) : null, qualColor: r.qualColor || null,
      };
    })
    .filter((r) => r.teamId && r.name)
    .sort((a, b) => a.pos - b.pos);
  return { ok: true, rows };
}

const entryKey = (id: number) => `standings:v1:${id}`;
const missKey = (id: number) => `standings:miss:${id}`;

// Örnek içi kısa bellek: bir liste sayfası aynı ligi birçok kez, 17 ligi tek istekte
// sorar; her biri Redis'e gitmesin, eşzamanlı istekler tek akış çağrısında birleşsin.
const MEMO_MS = 5 * 60_000;
const memo = new Map<number, { at: number; rows: Promise<StandingRow[]> }>();

// Redis istemcisi no-store fetch kullanır; ISR sayfalarında yalnız unstable_cache
// içinden çağrılabilir (fixtures.ts ile aynı düzen). Asıl önbellek Redis'tir:
// bu sarmalayıcı tutmasa bile akışa lig başına 6 saatte bir gidilir.
const loadCached = unstable_cache(
  async (leagueId: number): Promise<StandingRow[]> => loadFromStore(leagueId),
  ['site-standings-v2'],
  { revalidate: 15 * 60 },
);

async function loadFromStore(leagueId: number): Promise<StandingRow[]> {
  const redis = getRedisClient();
  const { rows } = await loadStandings<StandingRow>(leagueId, {
    now: () => Date.now(),
    read: async (id) => {
      const [entry, miss] = await Promise.all([redis.get<StandingsEntry<StandingRow>>(entryKey(id)), redis.get(missKey(id))]);
      return { entry: entry && Array.isArray(entry.rows) ? entry : null, miss: miss != null };
    },
    write: async (id, entry) => { await redis.set(entryKey(id), entry, { ex: STANDINGS_KEEP_S }); },
    markMiss: async (id, seconds) => { await redis.set(missKey(id), '1', { ex: seconds }); },
    fetch: fetchStandings,
  });
  return rows;
}

/** Full table for a covered league; empty array when unavailable. */
export async function getStandings(slug: string): Promise<StandingRow[]> {
  const league = leagueBySlug(slug);
  if (!league) return [];
  const id = league.ids[0];
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.rows;
  // Redis'e ulaşılamazsa akışa DÜŞÜLMEZ: önbelleksiz yol kotayı bir haftada bitirdi.
  const rows = loadCached(id).catch((e) => { console.error('[site/standings]', e?.message || e); return [] as StandingRow[]; });
  memo.set(id, { at: Date.now(), rows });
  return rows;
}

/** teamId → row, for quick position lookups on match rows. */
export async function standingsIndex(slug: string): Promise<Map<number, StandingRow>> {
  const rows = await getStandings(slug);
  return new Map(rows.map((r) => [r.teamId, r]));
}
