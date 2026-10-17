import type { SiteLeague } from './leagues';

// ============================================================================
// League tables from the settled record (SEO Faz 1c, 2026-10-17): the xG/xPTS
// table and the goal-statistics table of one league, computed from this
// season's settled engine rows. Pure (unit-tested); the reader lives in
// league-tables-data.ts.
//
// Honesty rule: the "expected goals" are the model's PRE-MATCH goal
// expectations (its attack/defence fit, stored before kick-off, never
// revised), not shot-based xG — the page says so. Only settled matches are
// aggregated, so no upcoming prediction reaches the page; per-match figures
// are never emitted, only club totals.
// ============================================================================

export interface SettledLeagueRow {
  fixtureId: number;
  kickoff: string;
  homeId: number | null;
  homeName: string;
  awayId: number | null;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  /** model goal expectations (null when the row was not rated before kick-off) */
  lambdaHome: number | null;
  lambdaAway: number | null;
  pHome: number;
  pDraw: number;
  pAway: number;
  hasModel: boolean;
}

/** First day of the current season for a league (calendar-year leagues start 1 January). */
export function seasonStart(league: Pick<SiteLeague, 'slug'>, now = new Date()): Date {
  const y = now.getUTCFullYear();
  if (league.slug === 'brasileirao') return new Date(Date.UTC(y, 0, 1));
  return new Date(Date.UTC(now.getUTCMonth() >= 6 ? y : y - 1, 6, 1));
}

export interface XgRow { id: number; name: string; n: number; gf: number; ga: number; xgf: number; xga: number; xgd: number; pts: number; xpts: number; luck: number }

const scored = (r: SettledLeagueRow) => r.homeScore != null && r.awayScore != null;
const rated = (r: SettledLeagueRow) => r.hasModel && r.lambdaHome != null && r.lambdaAway != null && r.pHome > 0 && r.pAway > 0 && r.pDraw >= 0;

/** xG / xPTS table: rated settled matches only, sorted by expected goal difference. */
export function xgTable(rows: SettledLeagueRow[]): XgRow[] {
  const m = new Map<number, XgRow>();
  const get = (id: number, name: string) => { let x = m.get(id); if (!x) { x = { id, name, n: 0, gf: 0, ga: 0, xgf: 0, xga: 0, xgd: 0, pts: 0, xpts: 0, luck: 0 }; m.set(id, x); } x.name = name; return x; };
  for (const r of rows) {
    if (!scored(r) || !rated(r) || !r.homeId || !r.awayId) continue;
    const h = get(r.homeId, r.homeName), a = get(r.awayId, r.awayName);
    const hs = r.homeScore!, as = r.awayScore!;
    h.n++; a.n++;
    h.gf += hs; h.ga += as; a.gf += as; a.ga += hs;
    h.xgf += r.lambdaHome!; h.xga += r.lambdaAway!; a.xgf += r.lambdaAway!; a.xga += r.lambdaHome!;
    h.pts += hs > as ? 3 : hs === as ? 1 : 0; a.pts += as > hs ? 3 : hs === as ? 1 : 0;
    h.xpts += r.pHome * 3 + r.pDraw; a.xpts += r.pAway * 3 + r.pDraw;
  }
  const out = [...m.values()].map((x) => ({ ...x, xgd: x.xgf - x.xga, luck: x.pts - x.xpts }));
  return out.sort((p, q) => q.xgd - p.xgd || q.xpts - p.xpts || p.name.localeCompare(q.name));
}

export interface GoalsRow { id: number; name: string; n: number; gf: number; ga: number; avgFor: number; avgAgainst: number; avgTotal: number; over25: number; btts: number; cleanSheets: number; failedToScore: number }

/** Goal statistics per club: every settled match with a score (rated or not), sorted by over-2.5 share. */
export function goalsTable(rows: SettledLeagueRow[]): GoalsRow[] {
  const m = new Map<number, { id: number; name: string; n: number; gf: number; ga: number; over: number; btts: number; cs: number; fts: number }>();
  const get = (id: number, name: string) => { let x = m.get(id); if (!x) { x = { id, name, n: 0, gf: 0, ga: 0, over: 0, btts: 0, cs: 0, fts: 0 }; m.set(id, x); } x.name = name; return x; };
  for (const r of rows) {
    if (!scored(r) || !r.homeId || !r.awayId) continue;
    const hs = r.homeScore!, as = r.awayScore!, tot = hs + as;
    for (const [id, name, f, a] of [[r.homeId, r.homeName, hs, as], [r.awayId, r.awayName, as, hs]] as Array<[number, string, number, number]>) {
      const x = get(id, name);
      x.n++; x.gf += f; x.ga += a;
      if (tot > 2.5) x.over++;
      if (hs > 0 && as > 0) x.btts++;
      if (a === 0) x.cs++;
      if (f === 0) x.fts++;
    }
  }
  const out: GoalsRow[] = [...m.values()].map((x) => ({ id: x.id, name: x.name, n: x.n, gf: x.gf, ga: x.ga, avgFor: x.gf / x.n, avgAgainst: x.ga / x.n, avgTotal: (x.gf + x.ga) / x.n, over25: x.over / x.n, btts: x.btts / x.n, cleanSheets: x.cs, failedToScore: x.fts }));
  return out.sort((p, q) => q.over25 - p.over25 || q.avgTotal - p.avgTotal || p.name.localeCompare(q.name));
}

export interface LeagueGoalSummary { n: number; avgGoals: number; over25: number; btts: number }

/** League-wide goal facts over the same rows. */
export function leagueGoalSummary(rows: SettledLeagueRow[]): LeagueGoalSummary | null {
  let n = 0, goals = 0, over = 0, btts = 0;
  for (const r of rows) {
    if (!scored(r)) continue;
    const tot = r.homeScore! + r.awayScore!;
    n++; goals += tot; if (tot > 2.5) over++; if (r.homeScore! > 0 && r.awayScore! > 0) btts++;
  }
  return n ? { n, avgGoals: goals / n, over25: over / n, btts: btts / n } : null;
}
