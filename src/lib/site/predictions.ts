import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { db, REVALIDATE } from './db';
import { resolveLeague, type SiteLeague } from './leagues';
import { zonedStartOfDay, addDays } from './time';
import { pickOfficial, officialFilter } from './official';
import { statusOfRow, type MatchStatus, type ModelStatus } from './status';
import { asOfFilter } from './asof';
import { applyCurve, type Knot } from '@/lib/calibration';
import { deriveDoubleChance } from '@/lib/double-chance';
import { deriveOverUnder, deriveBtts } from '@/lib/goal-markets';

// ---------------------------------------------------------------------------
// Row schema (engine_predictions). Validated with zod so a schema drift in
// the DB fails loudly in logs instead of rendering NaN. Denetim 2026-09-05:
// olasılıklar 0–1 aralığında ve toplamı 1 ± 0.03 olmalı; bir satır bozuksa
// yalnız o satır karantinaya alınır (önceden tüm gün boş dönüyordu).
// ---------------------------------------------------------------------------
const num = z.coerce.number();
const numN = z.coerce.number().nullable();
const prob = z.coerce.number().min(0).max(1);
const probN = z.coerce.number().min(0).max(1).nullable();

export const PROB_SUM_TOLERANCE = 0.03;

export const EngineRow = z
  .object({
    fixture_id: num,
    league_id: numN,
    league_name: z.string().nullable(),
    home_id: numN,
    home_name: z.string(),
    away_id: numN,
    away_name: z.string(),
    kickoff: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'kickoff must be a datetime'),
    p_home: prob,
    p_draw: prob,
    p_away: prob,
    p_over25: probN,
    p_btts_yes: probN,
    lambda_home: numN,
    lambda_away: numN,
    pick: z.enum(['1', 'X', '2']).nullable(),
    confidence: probN,
    rationale: z.string().nullable(),
    settled: z.boolean().nullable(),
    home_score: numN,
    away_score: numN,
    result: z.enum(['H', 'D', 'A']).nullable(),
    correct: z.boolean().nullable(),
    model_version: z.string().nullable(),
    updated_at: z.string().nullable().optional(),
  })
  .refine((r) => Math.abs(r.p_home + r.p_draw + r.p_away - 1) <= PROB_SUM_TOLERANCE, {
    message: '1X2 probabilities do not sum to 1',
    path: ['p_home'],
  });
export type EngineRowT = z.infer<typeof EngineRow>;

export const COLS =
  'fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, ' +
  'p_home, p_draw, p_away, p_over25, p_btts_yes, lambda_home, lambda_away, ' +
  'pick, confidence, rationale, settled, home_score, away_score, result, correct, model_version, updated_at';

export type Outcome = 'won' | 'lost' | 'void' | 'pending';

export type { MatchStatus, ModelStatus };

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
  /** false for feed fixtures the model has not rated yet */
  hasModel: boolean;
  status: MatchStatus;
  modelStatus: ModelStatus;
  /** Quality flag: the stored row was last written after kick-off (not a clean pre-match record). */
  publishedAfterKickoff: boolean;
}

const crest = (id: number | null) => (id ? `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png` : null);

function outcomeOf(r: EngineRowT): Outcome {
  if (!r.settled) return 'pending';
  if (r.result == null) return 'void';
  return r.correct ? 'won' : 'lost';
}

interface Curves { pick: Knot[]; ou: Knot[]; btts: Knot[] }

// Catalog + calibration curves read through the site client (the legacy
// helpers use `no-store` fetches, which cannot run inside a static build).
async function readCatalog(): Promise<Map<number, { ccode: string; name: string }>> {
  const { data } = await db().from('league_catalog').select('league_id, name, ccode').limit(5000);
  const map = new Map<number, { ccode: string; name: string }>();
  for (const r of (data || []) as any[]) map.set(Number(r.league_id), { name: r.name, ccode: r.ccode || '' });
  return map;
}

export interface CurveMeta { segment: string; fittedAt: string | null; nSamples: number | null }

async function readCurve(market: '1x2' | 'ou25' | 'btts'): Promise<{ knots: Knot[]; meta: CurveMeta | null }> {
  const prefer = market === '1x2' ? ['covered', 'all'] : [market];
  const { data } = await db()
    .from('confidence_calibration')
    .select('segment, knots, fitted_at, n_samples')
    .in('segment', prefer)
    .order('fitted_at', { ascending: false })
    .limit(10);
  for (const seg of prefer) {
    const row = (data || []).find((r: any) => r.segment === seg) as any;
    if (row) return { knots: Array.isArray(row.knots) ? row.knots : [], meta: { segment: row.segment, fittedAt: row.fitted_at ?? null, nSamples: row.n_samples ?? null } };
  }
  return { knots: [], meta: null };
}

export interface SiteContext {
  catalog: Map<number, { ccode: string; name: string }>;
  curves: Curves;
  curveMeta: { pick: CurveMeta | null; ou: CurveMeta | null; btts: CurveMeta | null };
}

export async function loadContext(): Promise<SiteContext> {
  const empty = { knots: [] as Knot[], meta: null as CurveMeta | null };
  const [catalog, pick, ou, btts] = await Promise.all([
    readCatalog().catch(() => new Map<number, { ccode: string; name: string }>()),
    readCurve('1x2').catch(() => empty),
    readCurve('ou25').catch(() => empty),
    readCurve('btts').catch(() => empty),
  ]);
  return { catalog, curves: { pick: pick.knots, ou: ou.knots, btts: btts.knots }, curveMeta: { pick: pick.meta, ou: ou.meta, btts: btts.meta } };
}

/** Which calibration curves are live (segment, sample size, fit date) — for UI provenance labels. */
export const getCalibrationMeta = unstable_cache(
  async (): Promise<SiteContext['curveMeta']> => (await loadContext()).curveMeta,
  ['site-curve-meta'],
  { revalidate: REVALIDATE.performance },
);

export function mapRow(r: EngineRowT, ctx: SiteContext, now = Date.now()): SitePrediction {
  const cat = r.league_id != null ? ctx.catalog.get(Number(r.league_id)) : undefined;
  const league = resolveLeague(r.league_name, r.league_id, cat?.ccode);
  const ou = deriveOverUnder(r.p_over25);
  const bt = deriveBtts(r.p_btts_yes);
  const leagueName = r.league_name && !/^League \d+$/.test(r.league_name) ? r.league_name : cat?.name || r.league_name || '';
  const publishedAfterKickoff = !!r.updated_at && !r.settled && Date.parse(r.updated_at) > Date.parse(r.kickoff);
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
    hasModel: true,
    status: statusOfRow(r, now),
    modelStatus: 'ready',
    publishedAfterKickoff,
  };
}

export interface ParseReport { rows: EngineRowT[]; rejected: number; issues: string[] }

/** Row-level validation: bad rows are quarantined and counted, good rows survive. */
export function parseRowsDetailed(data: unknown): ParseReport {
  if (!Array.isArray(data)) return { rows: [], rejected: 0, issues: data == null ? [] : ['payload is not an array'] };
  const rows: EngineRowT[] = [];
  const issues: string[] = [];
  let rejected = 0;
  for (const raw of data) {
    const p = EngineRow.safeParse(raw);
    if (p.success) { rows.push(p.data); continue; }
    rejected++;
    if (issues.length < 5) {
      const fid = raw && typeof raw === 'object' ? (raw as any).fixture_id : '?';
      issues.push(`fixture ${fid}: ${p.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    }
  }
  if (rejected) console.error(`[site/predictions] ${rejected}/${data.length} rows quarantined`, issues);
  return { rows: pickOfficial(rows), rejected, issues };
}

export function parseRows(data: unknown): EngineRowT[] {
  return parseRowsDetailed(data).rows;
}

// ---------------------------------------------------------------------------
// Queries (all cached with unstable_cache; keys include every argument)
// ---------------------------------------------------------------------------

/** Predictions with kick-off on the given Zurich calendar day. */
export const listPredictionsForDay = unstable_cache(
  async (ymd: string): Promise<SitePrediction[]> => {
    const from = zonedStartOfDay(ymd).toISOString();
    const to = zonedStartOfDay(addDays(ymd, 1)).toISOString();
    const { data, error } = await officialFilter(db()
      .from('engine_predictions')
      .select(COLS)
      .gte('kickoff', from)
      .lt('kickoff', to))
      .order('kickoff', { ascending: true })
      .limit(600);
    if (error) throw new Error(error.message);
    const ctx = await loadContext();
    return parseRows(data).map((r) => mapRow(r, ctx));
  },
  ['site-predictions-day-v2'],
  { revalidate: REVALIDATE.fixtures },
);

/** Next calendar day (Zurich) after `ymd` that has any covered prediction, or null. */
export const nextDayWithPredictions = unstable_cache(
  async (ymd: string, direction: 1 | -1 = 1): Promise<string | null> => {
    const pivot = zonedStartOfDay(addDays(ymd, direction === 1 ? 1 : 0)).toISOString();
    let q = officialFilter(db().from('engine_predictions').select('kickoff, league_id, league_name')).limit(400);
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

/** The official prediction of a fixture (deterministic across model versions). */
export const getPrediction = unstable_cache(
  async (fixtureId: number): Promise<SitePrediction | null> => {
    const { data, error } = await officialFilter(db().from('engine_predictions').select(COLS).eq('fixture_id', fixtureId))
      .order('updated_at', { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    const rows = parseRows(data);
    if (!rows.length) return null;
    const ctx = await loadContext();
    return mapRow(rows[0], ctx);
  },
  ['site-prediction-v2'],
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

/**
 * Recent settled meetings between the two clubs known to the engine (H2H).
 * `before` (ISO) bounds the window to matches that kicked off strictly earlier
 * — pass the examined match's kick-off so it never lists itself or later games
 * (denetim 2026-09-05). Source is the engine archive, not a full fixture history.
 */
export const getHeadToHead = unstable_cache(
  async (homeId: number, awayId: number, limit = 6, before: string | null = null): Promise<SitePrediction[]> => {
    let q = officialFilter(db()
      .from('engine_predictions')
      .select(COLS)
      .eq('settled', true)
      .not('result', 'is', null)
      .or(`and(home_id.eq.${homeId},away_id.eq.${awayId}),and(home_id.eq.${awayId},away_id.eq.${homeId})`));
    q = asOfFilter(q, before);
    const { data } = await q.order('kickoff', { ascending: false }).limit(limit);
    const ctx = await loadContext();
    return parseRows(data).map((r) => mapRow(r, ctx));
  },
  ['site-h2h-v2'],
  { revalidate: REVALIDATE.results },
);

/** Last N settled matches of a team (either side), newest first, optionally as of `before`. */
export const getTeamForm = unstable_cache(
  async (teamId: number, limit = 6, before: string | null = null): Promise<SitePrediction[]> => {
    let q = officialFilter(db()
      .from('engine_predictions')
      .select(COLS)
      .eq('settled', true)
      .not('result', 'is', null)
      .or(`home_id.eq.${teamId},away_id.eq.${teamId}`));
    q = asOfFilter(q, before);
    const { data } = await q.order('kickoff', { ascending: false }).limit(limit);
    const ctx = await loadContext();
    return parseRows(data).map((r) => mapRow(r, ctx));
  },
  ['site-form-v2'],
  { revalidate: REVALIDATE.results },
);
