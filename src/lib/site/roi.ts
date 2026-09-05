// Pure ROI / benchmark accumulators for the performance report (unit-tested).

export interface OddsRow { fixture_id: number; phase: 'opening' | 'closing'; provider: string | null; home_odds: number; draw_odds: number; away_odds: number; captured_at: string }
export type Pick1x2 = '1' | 'X' | '2';
export type Result1x2 = 'H' | 'D' | 'A';

export function isPickCorrect(pick: Pick1x2 | null, result: Result1x2): boolean {
  return (pick === '1' && result === 'H') || (pick === 'X' && result === 'D') || (pick === '2' && result === 'A');
}

export interface RoiAcc { bets: number; staked: number; returned: number; won: number; from: string | null; to: string | null; mAcc: number; mSq: number; providers: Set<string> }
export const mkRoi = (): RoiAcc => ({ bets: 0, staked: 0, returned: 0, won: 0, from: null, to: null, mAcc: 0, mSq: 0, providers: new Set() });

/** Flat-stake ROI of the model pick at the given price, plus the market's own accuracy/Brier on the same rows. */
export function addRoi(acc: RoiAcc, r: { pick: Pick1x2 | null; result: Result1x2 | null; kickoff: string }, od: OddsRow, won: boolean): boolean {
  const price = r.pick === '1' ? od.home_odds : r.pick === 'X' ? od.draw_odds : od.away_odds;
  if (!(price > 1) || !(od.home_odds > 1) || !(od.draw_odds > 1) || !(od.away_odds > 1)) return false;
  acc.bets++; acc.staked += 1; if (won) { acc.returned += price; acc.won++; }
  acc.from = acc.from ?? r.kickoff; acc.to = r.kickoff;
  if (od.provider) acc.providers.add(od.provider);
  const inv = [1 / od.home_odds, 1 / od.draw_odds, 1 / od.away_odds];
  const s = inv[0] + inv[1] + inv[2];
  const mp = inv.map((x) => x / s);
  const fav = mp.indexOf(Math.max(...mp));
  const idx = r.result === 'H' ? 0 : r.result === 'D' ? 1 : 2;
  if (fav === idx) acc.mAcc++;
  acc.mSq += mp.reduce((a, p, i) => a + (p - (i === idx ? 1 : 0)) ** 2, 0);
  return true;
}

export interface Roi {
  phase: 'opening' | 'closing';
  bets: number; staked: number; returned: number; profit: number; roi: number; won: number;
  from: string | null; to: string | null;
  /** decided rows without a usable price of this phase (shown, never silently dropped) */
  missing: number;
  /** share of decided rows with a price of this phase */
  coverage: number;
  providers: string[];
  marketAcc: number | null; marketBrier: number | null;
}

export function finishRoi(acc: RoiAcc, phase: 'opening' | 'closing', decided: number): Roi | null {
  if (!acc.bets) return null;
  return {
    phase, bets: acc.bets, staked: acc.staked, returned: acc.returned, profit: acc.returned - acc.staked,
    roi: (acc.returned - acc.staked) / acc.staked, won: acc.won, from: acc.from, to: acc.to,
    missing: decided - acc.bets, coverage: decided ? acc.bets / decided : 0, providers: [...acc.providers].sort(),
    marketAcc: acc.mAcc / acc.bets, marketBrier: acc.mSq / acc.bets,
  };
}
