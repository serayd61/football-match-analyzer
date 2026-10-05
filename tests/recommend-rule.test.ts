import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatesFor, recommend, settleReco, bucketKey, buildRecoModel, RecoStats, RecoMeta, RECO_GATE, type RecoInput } from '@/lib/site/recommend-rule';

const base: RecoInput = { leagueId: 7, pHome: 0.35, pDraw: 0.30, pAway: 0.35 - 0.001, pOver25: 0.66, pBttsYes: 0.42 };

test('one candidate per market, on the model side', () => {
  const c = candidatesFor(base);
  assert.deepEqual(c.map((x) => [x.market, x.selection]), [['1x2', '1'], ['ou25', 'over'], ['btts', 'no']]);
  assert.ok(Math.abs(c[2].pRaw - 0.58) < 1e-9);
});

test('bucket key groups home/away favourites, keeps the draw apart', () => {
  assert.equal(bucketKey('1x2', '1', 0.62), bucketKey('1x2', '2', 0.61));
  assert.notEqual(bucketKey('1x2', 'X', 0.62), bucketKey('1x2', '1', 0.62));
  assert.equal(bucketKey('ou25', 'over', 1), 'ou25:over:19');
});

test('settlement for every selection', () => {
  assert.equal(settleReco('ou25', 'over', 2, 1), true);
  assert.equal(settleReco('ou25', 'under', 2, 1), false);
  assert.equal(settleReco('btts', 'no', 2, 0), true);
  assert.equal(settleReco('btts', 'yes', 1, 1), true);
  assert.equal(settleReco('1x2', 'X', 1, 1), true);
  assert.equal(settleReco('1x2', '2', 0, 1), true);
});

test('empty history: honest p falls back to raw p, gate still applies', () => {
  const r = recommend(base, new RecoStats());
  assert.equal(r.pick?.market, 'ou25');
  assert.ok(Math.abs(r.pick!.q - 0.66) < 1e-9);
});

test('an overconfident bucket is pulled down by its own record and loses the pick', () => {
  const s = new RecoStats();
  // 200 geçmiş maç: aynı Üst kovası (%65–70) yalnız %50 tutmuş.
  for (let k = 0; k < 200; k++) s.add({ ...base, leagueId: 99 }, k % 2 ? 2 : 1, 1); // 3 gol / 2 gol sırayla
  const q = s.honestP(candidatesFor(base)[1], null);
  assert.ok(q < 0.53 && q > 0.5, `q=${q}`);
  const r = recommend(base, s);
  assert.equal(r.pick, null); // hiçbir aday kapıyı geçmiyor
});

test('goal side needs lift over its base rate', () => {
  const s = new RecoStats();
  // Taban: maçların %62'si Üst. Üst kovası %64 tutuyor → kazanç +2 < +5.
  const inp: RecoInput = { leagueId: 1, pHome: 0.4, pDraw: 0.3, pAway: 0.3, pOver25: 0.64, pBttsYes: 0.5 };
  for (let k = 0; k < 500; k++) s.add({ ...inp, leagueId: 2 }, k % 100 < 64 ? 2 : 1, k % 100 < 64 ? 1 : 0);
  const r = recommend(inp, s, { ...RECO_GATE });
  const ou = r.candidates.find((c) => c.market === 'ou25')!;
  assert.ok(ou.q >= 0.6 && !ou.passes, `q=${ou.q} base=${ou.base}`);
});

test('league record overrides the global bucket once it has weight', () => {
  const s = new RecoStats();
  const inp: RecoInput = { leagueId: 5, pHome: 0.62, pDraw: 0.22, pAway: 0.16, pOver25: null, pBttsYes: null };
  for (let k = 0; k < 300; k++) s.add({ ...inp, leagueId: 6 }, k % 10 < 6 ? 2 : 0, 1); // genel: %60
  for (let k = 0; k < 80; k++) s.add(inp, k % 10 < 8 ? 2 : 0, 1);                       // lig 5: %80
  const r = recommend(inp, s);
  assert.equal(r.pick?.market, '1x2');
  assert.ok(r.pick!.q > 0.7, `q=${r.pick!.q}`);
});

test('draw and BTTS-no are never recommended, even when confident', () => {
  const r = recommend({ leagueId: null, pHome: 0.1, pDraw: 0.8, pAway: 0.1, pOver25: 0.5, pBttsYes: 0.1 }, new RecoStats());
  assert.equal(r.pick, null);
  assert.ok(r.candidates.every((c) => !c.passes));
});

test('display probability learns from the rule\'s own record', () => {
  const m = new RecoMeta(50);
  const p = { market: 'ou25' as const, selection: 'over' as const, q: 0.70 };
  assert.ok(Math.abs(m.displayP(p) - 0.70) < 1e-9); // kayıt yok → q
  for (let k = 0; k < 500; k++) m.add(p, k % 10 < 6); // geçmiş: %60
  const d = m.displayP(p);
  assert.ok(d > 0.6 && d < 0.62, `d=${d}`);
});

test('buildRecoModel learns walk-forward and fills the display record after burn-in', () => {
  const rows = [];
  for (let d = 0; d < 40; d++) for (let k = 0; k < 10; k++) {
    const day = new Date(Date.UTC(2026, 6, 1 + d)).toISOString();
    rows.push({ leagueId: 1, pHome: 0.7, pDraw: 0.18, pAway: 0.12, pOver25: null, pBttsYes: null, kickoff: day, h: k < 7 ? 2 : 0, a: 1 });
  }
  const m = buildRecoModel(rows, RECO_GATE, 30);
  assert.equal(m.days, 40);
  assert.equal(m.metaPicks, 100); // son 10 gün × 10 maç
  const q = m.stats.honestP(candidatesFor(rows[0])[0], 1);
  assert.ok(Math.abs(q - 0.7) < 0.01, `q=${q}`);
});
