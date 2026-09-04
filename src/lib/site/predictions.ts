import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { db, REVALIDATE } from './db';
import { resolveLeague, type SiteLeague } from './leagues';
import { zonedStartOfDay, addDays } from './time';
import { getCatalogMap } from '@/lib/league-catalog';
import { getCalibration, applyCurve, type Knot } from '@/lib/calibration';
import { deriveDoubleChance } from '@/lib/double-chance';
import { deriveOverUnder, deriveBtts } from '@/lib/goal-markets';

// ---------------------------------------------------------------------------
// Row schema (engine_predictions). Validated with zod so a schema drift in
// the DB fails loudly in logs instead of rendering NaN.
// ---------------------------------------------------------------------------
const num = z.coerce.number();
const numN = z.coerce.number().nullable();

export const EngineRow = z.object({
  fixture_id: num,
  league_id: numN,
  league_name: z.string().nullable(),
  home_id: numN,
  home_name: z.string(),
  away_id: numN,
  away_name: z.string(),
  kickoff: z.string(),
  p_home: num,
  p_draw: num,
  p_away: num,
  p_over25: numN,
  p_btts_yes: numN,
  lambda_home: numN,
  lambda_away: numN,
  pick: z.enum(['1', 'X', '2']).nullable(),
  confidence: numN,
  rationale: z.string().nullable(),
  settled: z.boolean().nullable(),
  home_score: numN,
  away_score: numN,
  result: z.enum(['H', 'D', 'A']).nullable(),
  correct: z.boolean().nullable(),
  model_version: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
});
export type EngineRowT = z.infer<typeof EngineRow>;

export const COLS =
  'fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, ' +
  'p_home, p_draw, p_away, p_over25, p_btts_yes, lambda_home, lambda_away, ' +
  'pick, confidence, rationale, settled, home_score, away_score, result, correct, model_version, updated_at';

export type Outcome = 'won' | 'lost' | 'void' | 'pending';

export interface SitePrediction {
  fixtureId: number;
  league: SiteLeague | null;
  leagueName: string;
  leagueId: number | null;
  covered: boolean;
  homeId: number | null;
  homeName: string;
  awayId: number | null;
  awayName: string;
  homeCrest: string | null;
  awayCrest: string | null;
  kickoff: string;
  pHome: number;
  pDraw: number;
  pAway: number;
  lambdaHome: number | null;
  lambdaAway: number | null;
  pick: '1' | 'X' | '2' | null;
  /** calibrated pick probability (isotonic curve), null if not available */
  confidence: number | null;
  confidenceRaw: number | null;
  doubleChance: ReturnType<typeof deriveDoubleChance>;
  overUnder: { pick: 'over' | 'under'; p: number | null; pRaw: number } | null;
  btts: { pick: 'yes' | 'no'; p: number | null; pRaw: number } | null;
  rationale: string | null;
  settled: boolean;
  homeScore: number | null;
  awayScore: number | null;
  result: 'H' | 'D' | 'A' | null;
  outcome: Outcome;
  modelVersion: string | null;
  updatedAt: string | null;
}

const crest = (id: number | null) => (id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : null);

function outcomeOf(r: EngineRowT): Outcome {
  if (!r.settled) return 'pending';
  if (r.result == null) return 'void';
  return r.correct ? 'won' : 'lost';
}

interface Curves { pick: Knot[]; ou: Knot[]; btts: Knot[] }

export async function loadContext(): Promise<{ catalog: Map<number, { ccode: string; name: string }>; curves: Curves }> {
  const EMPTY = { knots: [] as Knot[] };
  const [catalog, c1, c2, c3] = await Promise.all([
    getCatalogMap().catch(() => new Map()),
    getCalibration('1x2').catch(() => EMPTY),
    getCalibration('ou25').catch(() => EMPTY),
    getCalibration('btts').catch(() => EMPTY),
  ]);
  return { catalog: catalog as any, curves: { pick: c1.knots, ou: c2.knots, btts: c3.knots } };
}

export function mapRow(r: EngineRowT, ctx: Awaited<ReturnType<typeof loadContext>>): SitePrediction {
  const cat = r.league_id != null ? ctx.catalog.get(Number(r.league_id)) : undefined;
  const league = resolveLeague(r.league_name, r.league_id, cat?.ccode);
  const ou = deriveOverUnder(r.p_over25);
  const bt = deriveBtts(r.p_btts_yes);
  const leagueName = r.league_name && !/^League \d+$/.test(r.league_name) ? r.league_name : cat?.name || r.league_name || '';
  return {
    fixtureId: r.fixture_id,
    league,
    leagueName: league?.name || leagueName,
    leagueId: r.league_id,
    covered: !!league,
    homeId: r.home_id,
    homeName: r.home_name,
    awayId: r.away_id,
    awayName: r.away_name,
    homeCrest: crest(r.home_id),
    awayCrest: crest(r.away_id),
    kickoff: r.kickoff,
    pHome: r.p_home,
    pDraw: r.p_draw,
    pAway: r.p_away,
    lambdaHome: r.lambda_home,
    lambdaAway: r.lambda_away,
    pick: r.pick,
    confidence: applyCurve(r.confidence, ctx.curves.pick),
    confidenceRaw: r.confidence,
    doubleChance: deriveDoubleChance(r.p_home, r.p_draw, r.p_away),
    overUnder: ou ? { pick: ou.pick, p: applyCurve(ou.p, ctx.curves.ou), pRaw: ou.p } : null,
    btts: bt ? { pick: bt.pick, p: applyCurve(bt.p, ctx.curves.btts), pRaw: bt.p } : null,
    rationale: r.rationale,
    settled: !!r.settled,
    homeScore: r.home_score,
    awayScore: r.away_score,
    result: r.result,
    outcome: outcomeOf(r),
    modelVersion: r.model_version,
    updatedAt: r.updated_at ?? null,
  };
}

export function parseRows(data: unknown): EngineRowT[] {
  const parsed = z.array(EngineRow).safeParse(data);
  if (!parsed.success) {
    console.error('[site/predictions] schema mismatch', parsed.error.issues.slice(0, 3));
    return [];
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Queries (all cached with unstable_cache; keys include every argument)
// ---------------------------------------------------------------------------

/** Predictions with kick-off on the given Zurich calendar day. */
export const listPredictionsForDay = unstable_cache(
  async (ymd: string): Promise<SitePrediction[]> => {
    const from = zonedStartOfDay(ymd).toISOString();
    const to = zonedStartOfDay(addDays(ymd, 1)).toISOString();
    const { data, error } = await db()
      .from('engine_predictions')
      .select(COLS)
      .gte('kickoff', from)
      .lt('kickoff', to)
      .order('kickoff', { ascending: true })
      .limit(600);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    return parseRows(data).map((r) => mapRow(r, ctx));
  },
  ['site-predictions-day'],
  { revalidate: REVALIDATE.fixtures },
);

/** Next calendar day (Zurich) after `ymd` that has any covered prediction, or null. */
export const nextDayWithPredictions = unstable_cache(
  async (ymd: string, direction: 1 | -1 = 1): Promise<string | null> => {
    const pivot = zonedStartOfDay(addDays(ymd, direction === 1 ? 1 : 0)).toISOString();
    let q = db().from('engine_predictions').select('kickoff, league_id, league_name').limit(400);
    q = direction === 1 ? q.gte('kickoff', pivot).order('kickoff', { ascending: true }) : q.lt('kickoff', pivot).order('kickoff', { ascending: false });
    const { data } = await q;
    if (!data?.length) return null;
    const ctx = await loadContext();
    for (const r of data as any[]) {
      const cat = r.league_id != null ? ctx.catalog.get(Number(r.league_id)) : undefined;
      if (resolveLeague(r.league_name, r.league_id, cat?.ccode)) {
        const { ymdOf } = await import('./time');
        return ymdOf(r.kickoff);
      }
    }
    return null;
  },
  ['site-predictions-nextday'],
  { revalidate: REVALIDATE.fixtures },
);

export const getPrediction = unstable_cache(
  async (fixtureId: number): Promise<SitePrediction | null> => {
    const { data, error } = await db().from('engine_predictions').select(COLS).eq('fixture_id', fixtureId).limit(1);
    if (error) throw new Error(error.message);
    const rows = parseRows(data);
    if (!rows.length) return null;
    const ctx = await loadContext();
    return mapRow(rows[0], ctx);
  },
  ['site-prediction'],
  { revalidate: REVALIDATE.fixtures },
);

export interface MarketSnapshot {
  phase: 'opening' | 'closing';
  provider: string | null;
  capturedAt: string;
  minutesToKickoff: number | null;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  overround: number | null;
  pHome: number;
  pDraw: number;
  pAway: number;
}

/** Latest closing (else opening) 1X2 market snapshot for a fixture. */
export const getMarketSnapshot = unstable_cache(
  async (fixtureId: number): Promise<MarketSnapshot | null> => {
    const { data } = await db()
      .from('prediction_odds')
      .select('phase, provider, captured_at, minutes_to_kickoff, home_odds, draw_odds, away_odds, overround, p_home_market, p_draw_market, p_away_market')
      .eq('fixture_id', fixtureId)
      .order('captured_at', { ascending: false })
      .limit(10);
    if (!data?.length) return null;
    const row = (data as any[]).find((r) => r.phase === 'closing') || data[0];
    const S = z.object({
      phase: z.enum(['opening', 'closing']), provider: z.string().nullable(), captured_at: z.string(),
      minutes_to_kickoff: numN, home_odds: num, draw_odds: num, away_odds: num, overround: numN,
      p_home_market: num, p_draw_market: num, p_away_market: num,
    }).safeParse(row);
    if (!S.success) return null;
    const r = S.data;
    return {
      phase: r.phase, provider: r.provider, capturedAt: r.captured_at, minutesToKickoff: r.minutes_to_kickoff,
      homeOdds: r.home_odds, drawOdds: r.draw_odds, awayOdds: r.away_odds, overround: r.overround,
      pHome: r.p_home_market, pDraw: r.p_draw_market, pAway: r.p_away_market,
    };
  },
  ['site-market'],
  { revalidate: REVALIDATE.fixtures },
);

/** Recent settled meetings between the two clubs known to the engine (H2H). */
export const getHeadToHead = unstable_cache(
  async (homeId: number, awayId: number, limit = 6): Promise<SitePrediction[]> => {
    const { data } = await db()
      .from('engine_predictions')
      .select(COLS)
      .eq('settled', true)
      .not('result', 'is', null)
      .or(`and(home_id.eq.${homeId},away_id.eq.${awayId}),and(home_id.eq.${awayId},away_id.eq.${homeId})`)
      .order('kickoff', { ascending: false })
      .limit(limit);
    const ctx = await loadContext();
    return parseRows(data).map((r) => mapRow(r, ctx));
  },
  ['site-h2h'],
  { revalidate: REVALIDATE.results },
);

/** Last N settled matches of a team (either side), newest first. */
export const getTeamForm = unstable_cache(
  async (teamId: number, limit = 6): Promise<SitePrediction[]> => {
    const { data } = await db()
      .from('engine_predictions')
      .select(COLS)
      .eq('settled', true)
      .not('result', 'is', null)
      .or(`home_id.eq.${teamId},away_id.eq.${teamId}`)
      .order('kickoff', { ascending: false })
      .limit(limit);
    const ctx = await loadContext();
    return parseRows(data).map((r) => mapRow(r, ctx));
  },
  ['site-form'],
  { revalidate: REVALIDATE.results },
);
