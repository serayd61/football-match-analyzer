import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyStandingBoard } from '@/lib/site/daily-standing';
import type { SignalTable } from '@/lib/site/signal-buckets';

// Aynı kova tabloları match-standing.test.ts ile (Eredivisie ligi + tüm ligler).
const league: any = { slug: 'eredivisie', name: 'Eredivisie' };
const cell = (won: number, n: number) => ({ n, won, acc: n ? won / n : null });
const table = (market: any, kind: any, buckets: string[], all: [number, number][], lg?: [number, number][]): SignalTable => ({
  market, kind, buckets, all: all.map(([w, n]) => cell(w, n)),
  leagues: lg ? [{ league, n: lg.reduce((a, [, n]) => a + n, 0), cells: lg.map(([w, n]) => cell(w, n)) }] : [],
});
const LEVEL = ['<50%', '50–60%', '60–70%', '≥70%'], EDGE = ['≤−5', '−5…0', '0…+5', '+5…+10', '>+10'], CLASH = ['<5', '5–10', '≥10'];
const tables: SignalTable[] = [
  table('1x2', 'level', LEVEL, [[80, 210], [32, 75], [31, 41], [14, 20]], [[6, 20], [8, 17], [3, 4], [3, 4]]),
  table('1x2', 'edge', EDGE, [[33, 60], [32, 62], [31, 63], [9, 26], [9, 44]], [[10, 18], [1, 4], [4, 6], [1, 2], [1, 7]]),
  table('ou25', 'level', LEVEL, [[0, 0], [105, 189], [71, 119], [27, 38]], [[0, 0], [7, 11], [19, 23], [10, 11]]),
  table('ou25', 'clash', CLASH, [[16, 25], [6, 6], [15, 18]], [[6, 8], [2, 2], [11, 11]]),
  table('btts', 'level', LEVEL, [[0, 0], [111, 229], [74, 104], [9, 13]], [[0, 0], [8, 9], [25, 33], [3, 3]]),
  table('btts', 'edge', EDGE, [[7, 10], [29, 51], [65, 95], [33, 78], [10, 20]], [[2, 2], [5, 7], [17, 19], [6, 7], [2, 2]]),
];

const row = (fixtureId: number, over: any, btts: any, extra: Partial<any> = {}): any => ({
  fixtureId, league, covered: true, hasModel: true, settled: false, status: 'scheduled', kickoff: `2026-10-08T${String(10 + fixtureId).padStart(2, '0')}:00:00Z`,
  pick: '1', pHome: 0.57, pDraw: 0.24, pAway: 0.19, overUnder: over, btts, ...extra,
});

test('only strong verdicts are listed, grouped by market, with model-minus-market edge', () => {
  const rows = [
    // 1X2: edge ≤−5 (lig 10/18 = %56 → güçlü); Üst %67 seviye (lig 19/23 → güçlü); KG %55 → orta → listelenmez
    row(1, { pick: 'over', pRaw: 0.67, pMarket: 0.60 }, { pick: 'yes', pRaw: 0.55, pMarket: 0.50 }),
    // 1X2: fark >+10 (lig 1/7 → tüm ligler 9/44 = %20 → zayıf); KG Var %72 (lig 3/3 <10 → tüm 9/13 = %69 → güçlü)
    row(2, null, { pick: 'yes', pRaw: 0.72, pMarket: 0.65 }, { pHome: 0.80, pDraw: 0.12, pAway: 0.08 }),
    // oynanmış maç taranmaz
    row(3, { pick: 'over', pRaw: 0.67, pMarket: 0.60 }, null, { settled: true }),
    // kapsam dışı taranmaz
    row(4, { pick: 'over', pRaw: 0.67, pMarket: null }, null, { covered: false }),
  ];
  const m = { 1: { pHome: 0.74, pDraw: 0.16, pAway: 0.10 }, 2: { pHome: 0.62, pDraw: 0.22, pAway: 0.16 } };
  const b = dailyStandingBoard(rows, m, tables);
  assert.equal(b.scanned, 2);
  assert.equal(b.matches, 2);
  assert.deepEqual(b.markets.map((x) => x.market), ['1x2', 'ou25', 'btts']);
  const x12 = b.markets[0].picks, ou = b.markets[1].picks, bt = b.markets[2].picks;
  assert.deepEqual(x12.map((p) => p.fixtureId), [1]);
  assert.equal(x12[0].selection, '1');
  assert.ok(Math.abs(x12[0].edge! - (0.57 - 0.74)) < 1e-9);
  assert.equal(x12[0].standing.scope, 'league');
  assert.deepEqual(ou.map((p) => p.fixtureId), [1]);
  assert.ok(Math.abs(ou[0].edge! - 0.07) < 1e-9);
  assert.deepEqual(bt.map((p) => p.fixtureId), [2]);
  assert.ok(Math.abs(bt[0].edge! - 0.07) < 1e-9);
  assert.equal(bt[0].standing.scope, 'all');
});

test('BTTS "no" pick flips the market side; missing market gives null edge and still lists by level', () => {
  const rows = [row(1, null, { pick: 'no', pRaw: 0.72, pMarket: 0.60 }), row(2, null, { pick: 'yes', pRaw: 0.72, pMarket: null })];
  const b = dailyStandingBoard(rows, {}, tables);
  const bt = b.markets[2].picks;
  assert.equal(bt.length, 2);
  const no = bt.find((p) => p.fixtureId === 1)!, yes = bt.find((p) => p.fixtureId === 2)!;
  assert.equal(no.selection, 'no');
  assert.ok(Math.abs(no.edge! - 0.12) < 1e-9);
  assert.equal(yes.edge, null);
  // 1X2 piyasa yok → level kovası (%50–60: lig 8/17 = %47 → zayıf) → listelenmez
  assert.equal(b.markets[0].picks.length, 0);
});

test('verdict set can widen to mid; picks sort by hit rate then sample size', () => {
  const rows = [
    row(1, { pick: 'over', pRaw: 0.67, pMarket: null }, null),   // lig 19/23 = %83
    row(2, { pick: 'over', pRaw: 0.72, pMarket: null }, null),   // lig 10/11 = %91
    row(3, { pick: 'over', pRaw: 0.55, pMarket: null }, null),   // lig 7/11 = %64 → orta
  ];
  const b = dailyStandingBoard(rows, {}, tables, new Set(['strong', 'mid']));
  assert.deepEqual(b.markets[1].picks.map((p) => p.fixtureId), [2, 1, 3]);
  assert.deepEqual(b.markets[1].picks.map((p) => p.verdict), ['strong', 'strong', 'mid']);
});

test('outside callback: observe-league rows are scanned through it; without it they are skipped', () => {
  const obs = row(9, { pick: 'over', pRaw: 0.70, pMarket: 0.66 }, null, { covered: false, league: null, leagueId: 111 });
  const cov = row(1, { pick: 'over', pRaw: 0.67, pMarket: 0.60 }, null);
  const none = dailyStandingBoard([obs, cov], {}, tables);
  assert.equal(none.scanned, 1);
  const strongOver = (r: any) => [{ market: 'ou25', selection: 'over', modelP: r.overUnder.pRaw, primary: { kind: 'edge', bucket: '0…+5', league: null, all: { n: 30, won: 25, acc: 25 / 30 } }, secondary: null, acc: 25 / 30, n: 30, won: 25, scope: 'all', verdict: 'strong' }];
  const b = dailyStandingBoard([obs, cov], {}, tables, undefined, (r) => (r.leagueId === 111 ? strongOver(r) as any : null));
  assert.equal(b.scanned, 2);
  assert.deepEqual(b.markets[1].picks.map((p) => p.fixtureId).sort(), [1, 9]);
  const o = b.markets[1].picks.find((p) => p.fixtureId === 9)!;
  assert.ok(Math.abs(o.edge! - 0.04) < 1e-9);
});
