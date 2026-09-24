import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumBuckets, coverageStanding, coverageRisk, leagueSummary, strongPickFor, strongRisk } from '@/lib/site/coverage-risk';
import type { LeagueStats } from '@/lib/coverage/rules';

const stats = (buckets: LeagueStats['buckets'], n = 50): LeagueStats => ({ n, x12: { n: 40, won: 24, ll: null }, ouHi: { n: 20, won: 15 }, bttsHi: { n: 5, won: 4 }, buckets, lastKickoff: null, windowDays: 180 });

test('sumBuckets adds cells across leagues', () => {
  const all = sumBuckets([stats({ x12: { '≥80': { n: 10, won: 8 } }, ou25: {}, under25: {}, btts: {} }), stats({ x12: { '≥80': { n: 5, won: 2 }, '70–80': { n: 3, won: 2 } }, ou25: { '≥85': { n: 4, won: 4 } }, under25: {}, btts: {} }), null]);
  assert.deepEqual(all.x12['≥80'], { n: 15, won: 10 });
  assert.deepEqual(all.x12['70–80'], { n: 3, won: 2 });
  assert.deepEqual(all.ou25['≥85'], { n: 4, won: 4 });
});

test('coverageStanding uses the league cell at ≥10 matches, else the out-of-coverage total; risk follows the 1X2 cell', () => {
  const league = { x12: { '≥80': { n: 12, won: 10 } }, ou25: { '≥85': { n: 3, won: 3 } }, under25: {}, btts: { '≥80': { n: 20, won: 12 } } };
  const all = { x12: { '≥80': { n: 398, won: 298 } }, ou25: { '≥85': { n: 274, won: 208 } }, under25: { '≥75': { n: 714, won: 457 } }, btts: { '≥80': { n: 175, won: 121 } } };
  const rows = coverageStanding({ pick: '1', pHome: 0.83, pDraw: 0.1, pAway: 0.07, over: { pick: 'over', pRaw: 0.9 }, btts: { pick: 'yes', pRaw: 0.82 } }, league, all);
  assert.deepEqual(rows.map((r) => [r.market, r.scope, r.n, r.verdict, r.primary.bucket]), [['1x2', 'league', 12, 'strong', '≥80'], ['ou25', 'all', 274, 'strong', '≥85'], ['btts', 'league', 20, 'mid', '≥80']]);
  assert.equal(coverageRisk(rows), 'low');                         // 10/12 = 83%
  const under = coverageStanding({ pick: '2', pHome: 0.1, pDraw: 0.2, pAway: 0.7, over: { pick: 'under', pRaw: 0.2 }, btts: { pick: 'no', pRaw: 0.3 } }, null, all);
  assert.deepEqual(under.map((r) => [r.market, r.primary.bucket, r.acc]), [['1x2', '70–80', null], ['ou25', '≥75', 457 / 714]]); // 70–80 hücresi yok → veri az; KG Yok satırı yok
  assert.equal(coverageRisk(under), 'high');
  assert.equal(coverageRisk(coverageStanding({ pick: '1', pHome: 0.83, pDraw: 0.1, pAway: 0.07, over: null, btts: null }, null, all)), 'low'); // 298/398 = 75%
});

test('leagueSummary hides thin markets', () => {
  assert.deepEqual(leagueSummary(stats({ x12: {}, ou25: {}, under25: {}, btts: {} })), { n: 50, x12: 60, ou: 75, btts: null });
  assert.deepEqual(leagueSummary(null), { n: 0, x12: null, ou: null, btts: null });
});

test('strongPickFor prefers goal markets and requires the pick to sit in the strong zone', () => {
  const strong = [{ market: 'btts' as const, from: 0.7, n: 24, won: 17 }, { market: 'x12' as const, from: 0.7, n: 20, won: 15 }];
  const sp = strongPickFor({ pick: '1', pHome: 0.75, pDraw: 0.15, pAway: 0.1, over: { pick: 'over', pRaw: 0.6 }, btts: { pick: 'yes', pRaw: 0.72 } }, strong)!;
  assert.deepEqual([sp.market, sp.selection, sp.p], ['btts', 'yes', 0.72]);
  assert.equal(strongRisk(sp), 'medium');   // 17/24 = 71%
  const x = strongPickFor({ pick: '1', pHome: 0.75, pDraw: 0.15, pAway: 0.1, over: null, btts: { pick: 'yes', pRaw: 0.55 } }, strong)!;
  assert.deepEqual([x.market, x.selection], ['x12', '1']);
  assert.equal(strongRisk(x), 'low');       // 15/20 = 75%
  assert.equal(strongPickFor({ pick: '2', pHome: 0.3, pDraw: 0.3, pAway: 0.4, over: null, btts: null }, strong), null);
  assert.equal(strongPickFor({ pick: '1', pHome: 0.9, pDraw: 0.05, pAway: 0.05, over: null, btts: null }, []), null);
});
