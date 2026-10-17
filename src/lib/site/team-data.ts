import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { COLS, parseRows, mapRow, loadContext } from './predictions';
import { idsForLeague } from './results';
import { resolveOfficialVersion, officialFilter } from './official';
import { resolveLeague } from './leagues';
import { publicMatchView, type PublicMatch } from './match-public';
import { buildTeamIndex, type TeamEntry, type TeamSeed } from './teams';

// Server-side reads for the team pages (SEO Faz 1b). The index comes from the
// engine rows of the covered leagues: every club that played or is scheduled
// in the window below, with the league of its most recent row. Refreshed hourly.

const INDEX_PAST_DAYS = 200, INDEX_FUTURE_DAYS = 60;
const TEAM_PAST_DAYS = 365, TEAM_FUTURE_DAYS = 45;

export const listTeams = unstable_cache(
  async (): Promise<TeamEntry[]> => {
    const ids = await idsForLeague(null);
    const official = await resolveOfficialVersion();
    const now = Date.now();
    const { data, error } = await officialFilter(db().from('engine_predictions').select('fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, model_version'), official)
      .in('league_id', ids)
      .gte('kickoff', new Date(now - INDEX_PAST_DAYS * 86400e3).toISOString())
      .lt('kickoff', new Date(now + INDEX_FUTURE_DAYS * 86400e3).toISOString())
      .order('kickoff', { ascending: true })
      .limit(8000);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    const seeds = new Map<number, TeamSeed & { last: string }>();
    for (const r of (data || []) as Array<{ league_id: number | null; league_name: string | null; home_id: number | null; home_name: string | null; away_id: number | null; away_name: string | null; kickoff: string }>) {
      const league = resolveLeague(r.league_name, r.league_id, r.league_id != null ? ctx.catalog.get(Number(r.league_id))?.ccode : null);
      if (!league) continue;
      for (const [id, name] of [[r.home_id, r.home_name], [r.away_id, r.away_name]] as Array<[number | null, string | null]>) {
        if (!id || !name) continue;
        const cur = seeds.get(id);
        if (!cur) seeds.set(id, { id, name, league, n: 1, last: r.kickoff });
        else { cur.n++; if (r.kickoff >= cur.last) { cur.last = r.kickoff; cur.name = name; cur.league = league; } }
      }
    }
    return buildTeamIndex([...seeds.values()].map(({ last: _l, ...s }) => s));
  },
  ['site-teams-v1'],
  { revalidate: REVALIDATE.performance },
);

export async function getTeamBySlug(slug: string): Promise<TeamEntry | null> {
  const list = await listTeams();
  return list.find((t) => t.slug === slug) ?? null;
}

/** One club's covered fixtures, oldest first: settled results of the last year and fixtures up to six weeks ahead. */
export const listPublicForTeam = unstable_cache(
  async (teamId: number): Promise<PublicMatch[]> => {
    const ids = await idsForLeague(null);
    const official = await resolveOfficialVersion();
    const now = Date.now();
    const { data, error } = await officialFilter(db().from('engine_predictions').select(COLS), official)
      .in('league_id', ids)
      .or(`home_id.eq.${teamId},away_id.eq.${teamId}`)
      .gte('kickoff', new Date(now - TEAM_PAST_DAYS * 86400e3).toISOString())
      .lt('kickoff', new Date(now + TEAM_FUTURE_DAYS * 86400e3).toISOString())
      .order('kickoff', { ascending: true })
      .limit(150);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    return parseRows(data, official).map((r) => mapRow(r, ctx)).filter((p) => p.covered && p.league).map(publicMatchView);
  },
  ['site-public-team-v1'],
  { revalidate: REVALIDATE.results },
);
