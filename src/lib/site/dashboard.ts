import 'server-only';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { getOrSet } from '@/lib/cache/redis';
import { getLiveMatches } from '@/lib/data-sources/free-football';
import { db, REVALIDATE, ODDS_TAG } from './db';
import { resolveOfficialVersion, officialFilter } from './official';
import { supabaseAdmin } from '@/lib/supabase';
import { SITE_LEAGUES } from './leagues';
import { getStandings } from './standings';
import { getMarketBook } from './markets';
import { PHASE_ORDER, type OddsPhase } from './odds-phases';
import { scoreMatrix, bttsProb } from './poisson';
import { loadContext, mapRow, parseRows, COLS, type SitePrediction, type MarketSnapshot } from './predictions';
import { marketOf, type MatchAssessment, type MarketAssessment } from './assessment';

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
      fixture_id: num, phase: z.string(), provider: z.string().nullable(), captured_at: z.string(),
      minutes_to_kickoff: num.nullable(), home_odds: num, draw_odds: num, away_odds: num, overround: num.nullable(),
      p_home_market: num, p_draw_market: num, p_away_market: num,
    });
    for (const raw of (data || []) as any[]) {
      const r = S.safeParse(raw);
      if (!r.success) continue;
      const d = r.data;
      const cur = out[d.fixture_id];
      // Rows arrive newest first; the latest phase (closing > h3 > … > opening) wins.
      if (cur && (PHASE_ORDER[d.phase as OddsPhase] ?? -1) <= (PHASE_ORDER[cur.phase as OddsPhase] ?? -1)) continue;
      out[d.fixture_id] = {
        phase: d.phase, provider: d.provider, capturedAt: d.captured_at, minutesToKickoff: d.minutes_to_kickoff,
        homeOdds: d.home_odds, drawOdds: d.draw_odds, awayOdds: d.away_odds, overround: d.overround,
        pHome: d.p_home_market, pDraw: d.p_draw_market, pAway: d.p_away_market,
      };
    }
    return out;
  },
  ['site-market-batch'],
  { revalidate: REVALIDATE.fixtures, tags: [ODDS_TAG] },
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
// Model–market divergences (eski adı "value radar", 2026-10-16): modelin KENDİ
// seçiminde piyasanın üstünde kaldığı maçlar. 1X2 anlık görüntüden (marj oran
// cron'unda alınmış), KG bahisçinin kendi pazarından. Fark = ham model − piyasa.
// Pozitif fark fırsat DEĞİL: canlı denetim (+5 üstü %30) ve backtest (≥+5 → ROI
// −23) bunu aşırı güven bandı olarak ölçtü; her satır ortak değerlendirme
// durumunu taşır (assess-1.0) ve sıralama yalnız fark büyüklüğüdür.
// Denetim 2026-09-05: the BTTS model figure is the STORED p_btts_yes (the same
// record the list and the calibration use); the Poisson grid is only a
// fallback when the row has no stored value, and every line says which
// (`source`).
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
  source: 'stored' | 'derived';
  /** ortak değerlendirme (o pazar için); değerlendirme yoksa null */
  assessment: MarketAssessment | null;
}

/** BTTS "yes" probability with provenance: stored record first, Poisson grid as fallback. */
export function bttsYesProb(r: Pick<SitePrediction, 'btts' | 'lambdaHome' | 'lambdaAway'>): { p: number; source: 'stored' | 'derived' } | null {
  if (r.btts) return { p: r.btts.pick === 'yes' ? r.btts.pRaw : 1 - r.btts.pRaw, source: 'stored' };
  if (r.lambdaHome != null && r.lambdaAway != null) return { p: bttsProb(scoreMatrix(r.lambdaHome, r.lambdaAway)), source: 'derived' };
  return null;
}

export async function valueRadar(rows: SitePrediction[], assessmentOf: (fixtureId: number) => MatchAssessment | null = () => null, minEdge = 0.04, limit = 12): Promise<ValueRow[]> {
  const rated = rows.filter((r) => r.hasModel && !r.settled);
  if (!rated.length) return [];
  const snaps = await getMarketSnapshots(rated.map((r) => r.fixtureId));
  const out: ValueRow[] = [];
  const books = await Promise.all(rated.map((r) => (snaps[r.fixtureId] ? getMarketBook(r.fixtureId) : Promise.resolve(null))));
  rated.forEach((r, i) => {
    const s = snaps[r.fixtureId];
    if (!s) return;
    const a = assessmentOf(r.fixtureId);
    // Yalnız modelin KENDİ seçimleri: değerlendirme o seçim için var; seçim dışı taraflar listeye girmez.
    const cands: Array<Omit<ValueRow, 'fixtureId' | 'row' | 'edge'>> = [];
    if (r.pick) {
      const model = r.pick === '1' ? r.pHome : r.pick === '2' ? r.pAway : r.pDraw;
      const market_p = r.pick === '1' ? s.pHome : r.pick === '2' ? s.pAway : s.pDraw;
      const odds = r.pick === '1' ? s.homeOdds : r.pick === '2' ? s.awayOdds : s.drawOdds;
      cands.push({ market: '1x2', selection: r.pick, model, market_p, odds, source: 'stored', assessment: marketOf(a, '1x2') });
    }
    const book = books[i];
    if (book?.btts) {
      const by = bttsYesProb(r);
      if (by) {
        const yes = r.btts ? r.btts.pick === 'yes' : by.p >= 0.5;
        cands.push(yes
          ? { market: 'btts', selection: 'yes', model: by.p, market_p: book.btts.pA, odds: book.btts.a, source: by.source, assessment: marketOf(a, 'btts') }
          : { market: 'btts', selection: 'no', model: 1 - by.p, market_p: book.btts.pB, odds: book.btts.b, source: by.source, assessment: marketOf(a, 'btts') });
      }
    }
    // One line per fixture: its largest positive gap (a divergence to inspect, not a ranking of opportunity).
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
// supabase/legacy/app/create_site_watchlist.sql. If the table is
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
    const official = await resolveOfficialVersion();
    const { data } = await officialFilter(db()
      .from('engine_predictions')
      .select(COLS), official)
      .eq('settled', false)
      .or(`home_id.eq.${teamId},away_id.eq.${teamId}`)
      .gte('kickoff', new Date(Date.now() - 2 * 3600e3).toISOString())
      .order('kickoff', { ascending: true })
      .limit(1);
    const rows = parseRows(data, official);
    if (!rows.length) return null;
    const ctx = await loadContext();
    return mapRow(rows[0], ctx);
  },
  ['site-team-next-v2'],
  { revalidate: REVALIDATE.fixtures },
);
