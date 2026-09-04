import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { db, REVALIDATE } from './db';
import { SITE_LEAGUES, type SiteLeague } from './leagues';
import { coveredLeagueIds } from './results';
import { loadContext } from './predictions';
import { applyCurve } from '@/lib/calibration';
import { deriveOverUnder, deriveBtts } from '@/lib/goal-markets';

// ---------------------------------------------------------------------------
// Track-record aggregates for the public site. Everything here is computed
// from settled rows with a final score in covered leagues; nothing is
// filtered by outcome. Cached for an hour.
// ---------------------------------------------------------------------------

const Row = z.object({
  fixture_id: z.coerce.number(),
  league_id: z.coerce.number().nullable(),
  kickoff: z.string(),
  p_home: z.coerce.number(),
  p_draw: z.coerce.number(),
  p_away: z.coerce.number(),
  p_over25: z.coerce.number().nullable(),
  p_btts_yes: z.coerce.number().nullable(),
  pick: z.enum(['1', 'X', '2']).nullable(),
  confidence: z.coerce.number().nullable(),
  correct: z.boolean().nullable(),
  result: z.enum(['H', 'D', 'A']).nullable(),
  home_score: z.coerce.number(),
  away_score: z.coerce.number(),
});
type Row = z.infer<typeof Row>;

const ROW_COLS = 'fixture_id, league_id, kickoff, p_home, p_draw, p_away, p_over25, p_btts_yes, pick, confidence, correct, result, home_score, away_score';
const PAGE = 1000;
const MAX_ROWS = 20000;

async function fetchSettled(ids: number[]): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db()
      .from('engine_predictions')
      .select(ROW_COLS)
      .eq('settled', true)
      .not('home_score', 'is', null)
      .in('league_id', ids)
      .order('kickoff', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const parsed = z.array(Row).safeParse(data);
    if (!parsed.success) { console.error('[site/performance] schema mismatch', parsed.error.issues.slice(0, 3)); break; }
    out.push(...parsed.data);
    if (parsed.data.length < PAGE) break;
  }
  return out;
}

interface OddsRow { fixture_id: number; phase: string; home_odds: number; draw_odds: number; away_odds: number; captured_at: string }

/** Latest closing (else opening) 1X2 odds per fixture. */
async function fetchOdds(): Promise<Map<number, OddsRow>> {
  const { data } = await db()
    .from('prediction_odds')
    .select('fixture_id, phase, home_odds, draw_odds, away_odds, captured_at')
    .order('captured_at', { ascending: false })
    .limit(5000);
  const map = new Map<number, OddsRow>();
  for (const r of (data || []) as OddsRow[]) {
    const cur = map.get(r.fixture_id);
    if (!cur || (cur.phase !== 'closing' && r.phase === 'closing')) map.set(r.fixture_id, r);
  }
  return map;
}

export interface Bucket { n: number; won: number; acc: number | null; brier: number | null }
export interface LeagueBucket extends Bucket { league: SiteLeague }
export interface MonthBucket extends Bucket { month: string }
export interface MarketBucket extends Bucket { market: '1x2' | 'ou25' | 'btts' }
export interface CalBin { lo: number; hi: number; n: number; predicted: number; observed: number }
export interface Roi { bets: number; staked: number; returned: number; profit: number; roi: number; won: number; from: string | null; to: string | null; marketAcc: number | null; marketBrier: number | null }

export interface PerformanceReport {
  overall: Bucket;
  leagues: LeagueBucket[];
  markets: MarketBucket[];
  months: MonthBucket[];
  calibration: CalBin[];
  roi: Roi | null;
  from: string | null;
  to: string | null;
  computedAt: string;
}

const mk = (): { n: number; won: number; sq: number } => ({ n: 0, won: 0, sq: 0 });
const fin = (b: { n: number; won: number; sq: number }): Bucket => ({ n: b.n, won: b.won, acc: b.n ? b.won / b.n : null, brier: b.n ? b.sq / b.n : null });

/** Multi-class Brier for one 1X2 row (0 = perfect, 2 = worst). */
function brier1x2(r: Row): number {
  const y = { H: [1, 0, 0], D: [0, 1, 0], A: [0, 0, 1] }[r.result!];
  return (r.p_home - y[0]) ** 2 + (r.p_draw - y[1]) ** 2 + (r.p_away - y[2]) ** 2;
}

export const getPerformance = unstable_cache(
  async (leagueSlug?: string | null): Promise<PerformanceReport> => {
    const idMap = await coveredLeagueIds();
    const slugOfId = new Map<number, string>();
    for (const [slug, ids] of Object.entries(idMap)) for (const id of ids) slugOfId.set(id, slug);
    const ids = leagueSlug ? idMap[leagueSlug] || [] : Object.values(idMap).flat();

    const [rows, odds, ctx] = await Promise.all([fetchSettled(ids), fetchOdds(), loadContext()]);
    const decided = rows.filter((r) => r.result != null && r.pick != null);

    const overall = mk();
    const byLeague = new Map<string, ReturnType<typeof mk>>();
    const byMonth = new Map<string, ReturnType<typeof mk>>();
    const ou = mk(), btts = mk();
    const bins: Array<{ lo: number; hi: number; n: number; sumP: number; won: number }> = [];
    for (let i = 0; i < 7; i++) bins.push({ lo: 0.3 + i * 0.1, hi: 0.4 + i * 0.1, n: 0, sumP: 0, won: 0 });
    const roi = { bets: 0, staked: 0, returned: 0, won: 0, from: null as string | null, to: null as string | null, mAcc: 0, mSq: 0 };

    for (const r of decided) {
      const won = r.correct === true;
      const sq = brier1x2(r);
      const add = (b: ReturnType<typeof mk>) => { b.n++; if (won) b.won++; b.sq += sq; };
      add(overall);
      const slug = r.league_id != null ? slugOfId.get(r.league_id) : undefined;
      if (slug) { if (!byLeague.has(slug)) byLeague.set(slug, mk()); add(byLeague.get(slug)!); }
      const month = r.kickoff.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, mk());
      add(byMonth.get(month)!);

      // Calibration on the calibrated confidence shown to visitors.
      const conf = applyCurve(r.confidence, ctx.curves.pick);
      if (conf != null) {
        const bin = bins.find((b) => conf >= b.lo && conf < b.hi) || (conf >= 1 ? bins[bins.length - 1] : null);
        if (bin) { bin.n++; bin.sumP += conf; if (won) bin.won++; }
      }

      // Goal markets: settled from the score, scored on the raw model probability.
      const total = r.home_score + r.away_score;
      const o = deriveOverUnder(r.p_over25);
      if (o && r.p_over25 != null) { ou.n++; const hit = o.pick === 'over' ? total > 2.5 : total < 2.5; if (hit) ou.won++; ou.sq += (r.p_over25 - (total > 2.5 ? 1 : 0)) ** 2; }
      const b = deriveBtts(r.p_btts_yes);
      const both = r.home_score > 0 && r.away_score > 0;
      if (b && r.p_btts_yes != null) { btts.n++; const hit = (b.pick === 'yes') === both; if (hit) btts.won++; btts.sq += (r.p_btts_yes - (both ? 1 : 0)) ** 2; }

      // Flat-stake ROI: 1 unit on the model pick at the closing price.
      const od = odds.get(r.fixture_id);
      if (od) {
        const price = r.pick === '1' ? od.home_odds : r.pick === 'X' ? od.draw_odds : od.away_odds;
        if (price > 1) {
          roi.bets++; roi.staked += 1; if (won) { roi.returned += price; roi.won++; }
          roi.from = roi.from ?? r.kickoff; roi.to = r.kickoff;
          // Market benchmark: the bookmaker favourite, and its margin-free Brier.
          const inv = [1 / od.home_odds, 1 / od.draw_odds, 1 / od.away_odds];
          const s = inv[0] + inv[1] + inv[2];
          const mp = inv.map((x) => x / s);
          const fav = mp.indexOf(Math.max(...mp));
          const idx = r.result === 'H' ? 0 : r.result === 'D' ? 1 : 2;
          if (fav === idx) roi.mAcc++;
          roi.mSq += mp.reduce((acc, p, i) => acc + (p - (i === idx ? 1 : 0)) ** 2, 0);
        }
      }
    }

    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, b]) => ({ month, ...fin(b) }));
    const leagues = SITE_LEAGUES.filter((l) => byLeague.has(l.slug)).map((l) => ({ league: l, ...fin(byLeague.get(l.slug)!) })).sort((a, b) => b.n - a.n);

    return {
      overall: fin(overall),
      leagues,
      markets: [
        { market: '1x2', ...fin(overall) },
        { market: 'ou25', ...fin(ou) },
        { market: 'btts', ...fin(btts) },
      ],
      months,
      calibration: bins.filter((b) => b.n > 0).map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, predicted: b.sumP / b.n, observed: b.won / b.n })),
      roi: roi.bets ? { bets: roi.bets, staked: roi.staked, returned: roi.returned, profit: roi.returned - roi.staked, roi: (roi.returned - roi.staked) / roi.staked, won: roi.won, from: roi.from, to: roi.to, marketAcc: roi.mAcc / roi.bets, marketBrier: roi.mSq / roi.bets } : null,
      from: decided[0]?.kickoff ?? null,
      to: decided[decided.length - 1]?.kickoff ?? null,
      computedAt: new Date().toISOString(),
    };
  },
  ['site-performance'],
  { revalidate: REVALIDATE.performance },
);
