import 'server-only';
import { unstable_cache } from 'next/cache';
import { leagueBySlug } from './leagues';

// League tables from the fixtures feed (`football-get-standing-all`).
// One upstream call per league per 6 hours (Next data cache), served to
// pages through a 1-hour unstable_cache. Canonical league ids work here
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

async function fetchStandings(leagueId: number): Promise<StandingRow[]> {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return [];
  const res = await fetch(`https://${HOST}/football-get-standing-all?leagueid=${leagueId}`, {
    headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': key },
    next: { revalidate: 6 * 3600 },
  });
  if (!res.ok) { console.error(`[site/standings] ${leagueId} HTTP ${res.status}`); return []; }
  const json = await res.json();
  const list: any[] = json?.response?.standing || json?.standing || [];
  return list
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
}

/** Full table for a covered league; empty array when unavailable. */
export const getStandings = unstable_cache(
  async (slug: string): Promise<StandingRow[]> => {
    const league = leagueBySlug(slug);
    if (!league) return [];
    try { return await fetchStandings(league.ids[0]); } catch (e) { console.error('[site/standings]', e); return []; }
  },
  ['site-standings'],
  { revalidate: 3600 },
);

/** teamId → row, for quick position lookups on match rows. */
export async function standingsIndex(slug: string): Promise<Map<number, StandingRow>> {
  const rows = await getStandings(slug);
  return new Map(rows.map((r) => [r.teamId, r]));
}
