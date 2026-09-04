import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { getOrSet } from '@/lib/cache/redis';
import { getLiveMatches } from '@/lib/data-sources/free-football';
import { db, REVALIDATE } from './db';
import { supabaseAdmin } from '@/lib/supabase';
import { SITE_LEAGUES } from './leagues';
import { getStandings } from './standings';
import { getMarketBook } from './markets';
import { scoreMatrix, bttsProb } from './poisson';
import { loadContext, mapRow, parseRows, COLS, type SitePrediction, type MarketSnapshot } from './predictions';

// ---------------------------------------------------------------------------
// Data for the signed-in dashboard: batch market snapshots, live scores,
// the "value radar" (model vs bookmaker across today's covered fixtures) and
// the per-user watchlist. Everything that is per-user is read without ISR
// caching; shared feeds go through Redis / unstable_cache like the public site.
// ---------------------------------------------------------------------------

const num = z.coerce.number();

/** Latest closing (else opening) 1X2 snapshot for many fixtures in one query. */
export const getMarketSnapshots = unstable_cache(
  async (fixtureIds: number[]): Promise<Record<number, MarketSnapshot>> => {
    const ids = Array.from(new Set(fixtureIds)).sort((a, b) => a - b);
    if (!ids.length) return {};
    const { data } = await db()
      .from('prediction_odds')
      .select('fixture_id, phase, provider, captured_at, minutes_to_kickoff, home_odds, draw_odds, away_odds, overround, p_home_market, p_draw_market, p_away_market')
      .in('fixture_id', ids)
      .order('captured_at', { ascending: false })
      .limit(ids.length * 12);
    const out: Record<number, MarketSnapshot> = {};
    const S = z.object({
      fixture_id: num, phase: z.enum(['opening', 'closing']), provider: z.string().nullable(), captured_at: z.string(),
      minutes_to_kickoff: num.nullable(), home_odds: num, draw_odds: num, away_odds: num, overround: num.nullable(),
      p_home_market: num, p_draw_market: num, p_away_market: num,
    });
    for (const raw of (data || []) as any[]) {
      const r = S.safeParse(raw);
      if (!r.success) continue;
      const d = r.data;
      const cur = out[d.fixture_id];
      // Rows arrive newest first: keep the first row per fixture, but let a
      // closing snapshot replace an opening one.
      if (cur && !(cur.phase === 'opening' && d.phase === 'closing')) continue;
      out[d.fixture_id] = {
        phase: d.phase, provider: d.provider, capturedAt: d.captured_at, minutesToKickoff: d.minutes_to_kickoff,
        homeOdds: d.home_odds, drawOdds: d.draw_odds, awayOdds: d.away_odds, overround: d.overround,
        pHome: d.p_home_market, pDraw: d.p_draw_market, pAway: d.p_away_market,
      };
    }
    return out;
  },
  ['site-market-batch'],
  { revalidate: REVALIDATE.fixtures },
);

// ---------------------------------------------------------------------------
// Live scores (feed "current live"), shared through Redis for 60 s.
// ---------------------------------------------------------------------------

export interface LiveScore { id: number; homeScore: number | null; awayScore: number | null; finished: boolean }

export async function getLiveNow(): Promise<Map<number, LiveScore>> {
  let list: LiveScore[] = [];
  try {
    list = await getOrSet<LiveScore[]>(
      'site:live',
      async () => (await getLiveMatches()).map((m) => ({ id: m.id, homeScore: m.homeScore, awayScore: m.awayScore, finished: m.finished })),
      60,
    );
  } catch (e) {
    console.error('[site/dashboard] live feed failed', e);
  }
  return new Map(list.map((l) => [l.id, l]));
}

// ---------------------------------------------------------------------------
// Value radar: largest model-vs-market gaps across a set of rated fixtures.
// 1X2 comes from the snapshot (margin removed by the odds cron); BTTS from the
// bookmaker's own market where captured. Edges are raw model minus market.
// ---------------------------------------------------------------------------

export interface ValueRow {
  fixtureId: number;
  row: SitePrediction;
  market: '1x2' | 'btts';
  selection: '1' | 'X' | '2' | 'yes' | 'no';
  model: number;
  market_p: number;
  odds: number;
  edge: number;
}

export async function valueRadar(rows: SitePrediction[], minEdge = 0.04, limit = 12): Promise<ValueRow[]> {
  const rated = rows.filter((r) => r.hasModel && !r.settled);
  if (!rated.length) return [];
  const snaps = await getMarketSnapshots(rated.map((r) => r.fixtureId));
  const out: ValueRow[] = [];
  const books = await Promise.all(rated.map((r) => (snaps[r.fixtureId] ? getMarketBook(r.fixtureId) : Promise.resolve(null))));
  rated.forEach((r, i) => {
    const s = snaps[r.fixtureId];
    if (!s) return;
    const cands: Array<Omit<ValueRow, 'fixtureId' | 'row' | 'edge'>> = [
      { market: '1x2', selection: '1', model: r.pHome, market_p: s.pHome, odds: s.homeOdds },
      { market: '1x2', selection: 'X', model: r.pDraw, market_p: s.pDraw, odds: s.drawOdds },
      { market: '1x2', selection: '2', model: r.pAway, market_p: s.pAway, odds: s.awayOdds },
    ];
    const book = books[i];
    if (book?.btts && r.lambdaHome != null && r.lambdaAway != null) {
      const by = bttsProb(scoreMatrix(r.lambdaHome, r.lambdaAway));
      cands.push({ market: 'btts', selection: 'yes', model: by, market_p: book.btts.pA, odds: book.btts.a });
      cands.push({ market: 'btts', selection: 'no', model: 1 - by, market_p: book.btts.pB, odds: book.btts.b });
    }
    // One line per fixture: its largest positive gap.
    const best = cands.map((c) => ({ ...c, edge: c.model - c.market_p })).sort((a, b) => b.edge - a.edge)[0];
    if (best && best.edge >= minEdge) out.push({ fixtureId: r.fixtureId, row: r, ...best });
  });
  return out.sort((a, b) => b.edge - a.edge).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Team directory (for the watchlist picker): every club in a covered league's
// current table. One cached call per league, refreshed hourly.
// ---------------------------------------------------------------------------

export interface TeamRef { id: number; name: string; league: string; leagueSlug: string }

export const teamDirectory = unstable_cache(
  async (): Promise<TeamRef[]> => {
    const lists = await Promise.all(SITE_LEAGUES.map(async (l) => {
      try {
        const rows = await getStandings(l.slug);
        return rows.map((r) => ({ id: r.teamId, name: r.name, league: l.name, leagueSlug: l.slug }));
      } catch { return [] as TeamRef[]; }
    }));
    return lists.flat().sort((a, b) => a.league.localeCompare(b.league) || a.name.localeCompare(b.name));
  },
  ['site-team-directory'],
  { revalidate: 3600 },
);

// ---------------------------------------------------------------------------
// Watchlist (per user). Table: site_watchlist — see
// src/lib/supabase/migrations/create_site_watchlist.sql. If the table is
// missing the dashboard shows the section as unavailable instead of failing.
// ---------------------------------------------------------------------------

export interface WatchItem { teamId: number; teamName: string; leagueSlug: string | null }

export async function readWatchlist(email: string): Promise<{ items: WatchItem[]; available: boolean }> {
  // Per-user: must not go through db(), whose fetch layer caches responses
  // for 5 minutes (the dashboard would show a stale list after add/remove).
  const { data, error } = await supabaseAdmin
    .from('site_watchlist')
    .select('team_id, team_name, league_slug')
    .eq('user_email', email)
    .order('created_at', { ascending: true })
    .limit(30);
  if (error) {
    if (!/site_watchlist/.test(error.message) && !/relation/.test(error.message)) console.error('[site/dashboard] watchlist read failed', error.message);
    return { items: [], available: false };
  }
  return {
    available: true,
    items: (data || []).map((r: any) => ({ teamId: Number(r.team_id), teamName: String(r.team_name), leagueSlug: r.league_slug ?? null })),
  };
}

/** Next unsettled rated match of a club (either side), if the engine has one. */
export const nextMatchForTeam = unstable_cache(
  async (teamId: number): Promise<SitePrediction | null> => {
    const { data } = await db()
      .from('engine_predictions')
      .select(COLS)
      .eq('settled', false)
      .or(`home_id.eq.${teamId},away_id.eq.${teamId}`)
      .gte('kickoff', new Date(Date.now() - 2 * 3600e3).toISOString())
      .order('kickoff', { ascending: true })
      .limit(1);
    const rows = parseRows(data);
    if (!rows.length) return null;
    const ctx = await loadContext();
    return mapRow(rows[0], ctx);
  },
  ['site-team-next'],
  { revalidate: REVALIDATE.fixtures },
);
