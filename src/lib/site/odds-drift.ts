import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';
import { computeDrift, type DriftPoint, type OddsDrift } from './odds-drift-rule';

export type { DriftPoint, OddsDrift };

/** Bir maçın oran serisi (faz sırasına göre) ve açılış→son hareket özeti. */
export const getOddsDrift = unstable_cache(
  async (fixtureId: number): Promise<OddsDrift | null> => {
    const { data } = await db()
      .from('prediction_odds')
      .select('phase, provider, captured_at, minutes_to_kickoff, home_odds, draw_odds, away_odds, p_home_market, p_draw_market, p_away_market, btts_yes_odds, btts_no_odds')
      .eq('fixture_id', fixtureId)
      .order('captured_at', { ascending: true })
      .limit(12);
    if (!data?.length) return null;
    const points: DriftPoint[] = (data as any[]).map((r) => ({
      phase: String(r.phase), capturedAt: String(r.captured_at), provider: r.provider ?? null,
      minutesToKickoff: r.minutes_to_kickoff == null ? null : Number(r.minutes_to_kickoff),
      homeOdds: Number(r.home_odds), drawOdds: Number(r.draw_odds), awayOdds: Number(r.away_odds),
      pHome: Number(r.p_home_market), pDraw: Number(r.p_draw_market), pAway: Number(r.p_away_market),
      bttsYes: r.btts_yes_odds > 1 ? Number(r.btts_yes_odds) : null, bttsNo: r.btts_no_odds > 1 ? Number(r.btts_no_odds) : null,
    }));
    return computeDrift(points);
  },
  ['site-odds-drift-v1'],
  { revalidate: REVALIDATE.results },
);
