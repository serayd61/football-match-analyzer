import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standingFor } from '@/lib/site/match-standing';
import type { SignalTable } from '@/lib/site/signal-buckets';

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

test('1X2 uses the edge bucket when a market exists and falls back to league evidence with n≥10', () => {
  const rows = standingFor({ leagueSlug: 'eredivisie', pick: '1', pHome: 0.57, pDraw: 0.24, pAway: 0.19, over: null, btts: null, market: { pHome: 0.74, pDraw: 0.16, pAway: 0.10 }, bttsMarketYes: null }, tables);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.primary.kind, 'edge');
  assert.equal(r.primary.bucket, '≤−5');
  assert.equal(r.scope, 'league');
  assert.equal(r.n, 18);
  assert.equal(r.verdict, 'strong');
  assert.equal(r.secondary?.kind, 'level');
});

test('goal markets use the level bucket; thin league evidence falls back to all leagues; clash is secondary', () => {
  const rows = standingFor({ leagueSlug: 'eredivisie', pick: '1', pHome: 0.57, pDraw: 0.24, pAway: 0.19, over: { pick: 'over', pRaw: 0.67 }, btts: { pick: 'yes', pRaw: 0.55 }, market: { pHome: 0.74, pDraw: 0.16, pAway: 0.10 }, bttsMarketYes: null }, tables);
  const ou = rows.find((r) => r.market === 'ou25')!, bt = rows.find((r) => r.market === 'btts')!;
  assert.equal(ou.primary.bucket, '60–70%');
  assert.equal(ou.scope, 'league');
  assert.equal(ou.verdict, 'strong');
  assert.equal(ou.secondary?.kind, 'clash');
  assert.equal(ou.secondary?.bucket, '≥10');
  assert.equal(bt.primary.bucket, '50–60%');
  assert.equal(bt.scope, 'all'); // lig kovası 9 maç → tüm ligler
  assert.equal(bt.verdict, 'weak'); // 111/229 = %48
  assert.equal(bt.secondary, null); // KG %55 eşik altı, oran yok
});

test('no pick → no rows; no market → 1X2 falls back to level', () => {
  assert.deepEqual(standingFor({ leagueSlug: null, pick: null, pHome: 0.4, pDraw: 0.3, pAway: 0.3, over: null, btts: null, market: null, bttsMarketYes: null }, tables), []);
  const r = standingFor({ leagueSlug: null, pick: '2', pHome: 0.2, pDraw: 0.2, pAway: 0.6, over: null, btts: null, market: null, bttsMarketYes: null }, tables)[0];
  assert.equal(r.primary.kind, 'level');
  assert.equal(r.primary.bucket, '60–70%');
  assert.equal(r.scope, 'all');
  assert.equal(r.verdict, 'strong'); // 31/41
});
