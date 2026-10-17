import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { COLS, parseRows, mapRow, loadContext } from './predictions';
import { idsForLeague } from './results';
import { resolveOfficialVersion, officialFilter } from './official';
import { leagueBySlug } from './leagues';
import { seasonStart, type SettledLeagueRow } from './league-tables';

/**
 * This season's settled matches of one covered league, reduced to the fields
 * the league tables aggregate (SEO Faz 1c). Settled rows only: the model's
 * pre-match figures of a finished match are part of the public record.
 */
export const listSettledLeagueRows = unstable_cache(
  async (slug: string): Promise<SettledLeagueRow[]> => {
    const league = leagueBySlug(slug);
    if (!league) return [];
    const ids = await idsForLeague(league);
    if (!ids.length) return [];
    const official = await resolveOfficialVersion();
    const { data, error } = await officialFilter(db().from('engine_predictions').select(COLS), official)
      .in('league_id', ids)
      .eq('settled', true)
      .not('home_score', 'is', null)
      .gte('kickoff', seasonStart(league).toISOString())
      .order('kickoff', { ascending: true })
      .limit(800);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    return parseRows(data, official).map((r) => mapRow(r, ctx)).filter((p) => p.covered && p.league).map((p) => ({
      fixtureId: p.fixtureId, kickoff: p.kickoff, homeId: p.homeId, homeName: p.homeName, awayId: p.awayId, awayName: p.awayName,
      homeScore: p.homeScore, awayScore: p.awayScore, lambdaHome: p.lambdaHome, lambdaAway: p.lambdaAway, pHome: p.pHome, pDraw: p.pDraw, pAway: p.pAway, hasModel: p.hasModel,
    }));
  },
  ['site-settled-league-rows-v1'],
  { revalidate: REVALIDATE.performance },
);
