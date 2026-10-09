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
  // pRaw = seçilen tarafın olasılığı (Alt %80, KG Yok %70) — GoalCall.pRaw ile aynı anlam
  const under = coverageStanding({ pick: '2', pHome: 0.1, pDraw: 0.2, pAway: 0.7, over: { pick: 'under', pRaw: 0.8 }, btts: { pick: 'no', pRaw: 0.7 } }, null, all);
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

test('coverageStanding with market + edge: 1X2 primary is the edge bucket, level secondary; goal markets get edge as secondary', () => {
  const edge = { x12: { '>+10': { n: 20, won: 4 }, '0…+5': { n: 25, won: 15 } }, ou25: { '0…+5': { n: 12, won: 10 } }, btts: {} };
  const all = { x12: { '>+10': { n: 68, won: 18 }, '0…+5': { n: 96, won: 47 } }, ou25: { '0…+5': { n: 19, won: 16 } }, btts: { '−5…0': { n: 85, won: 50 } } };
  const lv = { x12: { '70–80': { n: 30, won: 20 } }, ou25: { '65–75': { n: 28, won: 19 } }, under25: {}, btts: { '60–70': { n: 30, won: 24 } } };
  const input = { pick: '1' as const, pHome: 0.73, pDraw: 0.15, pAway: 0.12, over: { pick: 'over' as const, pRaw: 0.69 }, btts: { pick: 'yes' as const, pRaw: 0.66 } };
  const rows = coverageStanding(input, lv, lv, { x12: { pHome: 0.61, pDraw: 0.22, pAway: 0.17 }, overYes: 0.65, bttsYes: 0.69 }, { league: edge, all });
  const x = rows.find((r) => r.market === '1x2')!, o = rows.find((r) => r.market === 'ou25')!, b = rows.find((r) => r.market === 'btts')!;
  assert.equal(x.primary.kind, 'edge'); assert.equal(x.primary.bucket, '>+10'); assert.equal(x.scope, 'league'); assert.equal(x.acc, 0.2); assert.equal(x.verdict, 'weak');
  assert.equal(x.secondary?.kind, 'level'); assert.equal(x.secondary?.bucket, '70–80');
  assert.equal(o.primary.kind, 'level'); assert.equal(o.secondary?.kind, 'edge'); assert.equal(o.secondary?.bucket, '0…+5'); assert.equal(o.secondary?.league?.n, 12);
  assert.equal(b.secondary?.kind, 'edge'); assert.equal(b.secondary?.bucket, '−5…0'); assert.equal(b.secondary?.league?.n, 0); assert.equal(b.secondary?.all.n, 85);
  // piyasa yoksa eski davranış
  const plain = coverageStanding(input, lv, lv);
  assert.equal(plain.find((r) => r.market === '1x2')!.primary.kind, 'level');
});
