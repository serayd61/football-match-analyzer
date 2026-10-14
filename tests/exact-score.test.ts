import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMatrix, exactScorePick, scoreBucket, settleScore, addTally, emptyTally, hitRate, EXACT_SCORE_MIN } from '@/lib/site/exact-score';

test('scoreMatrix is a normalized distribution sorted by probability', () => {
  const m = scoreMatrix(1.4, 1.1);
  const sum = m.reduce((s, x) => s + x.p, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  for (let i = 1; i < m.length; i++) assert.ok(m[i - 1].p >= m[i].p);
  assert.equal(m.length, 121);
});

test('Dixon-Coles rho lifts 0-0 and 1-1, lowers 1-0 / 0-1 vs plain Poisson', () => {
  const dc = scoreMatrix(1.2, 1.0, -0.10);
  const plain = scoreMatrix(1.2, 1.0, 0);
  const at = (m: typeof dc, h: number, a: number) => m.find((s) => s.home === h && s.away === a)!.p;
  assert.ok(at(dc, 0, 0) > at(plain, 0, 0));
  assert.ok(at(dc, 1, 1) > at(plain, 1, 1));
  assert.ok(at(dc, 1, 0) < at(plain, 1, 0));
});

test('exactScorePick: low-scoring favourite yields 1-0 or 0-0 above 15%; open game yields null', () => {
  const p = exactScorePick(1.1, 0.5)!;
  assert.ok(p && p.p >= EXACT_SCORE_MIN);
  assert.ok((p.home === 1 && p.away === 0) || (p.home === 0 && p.away === 0));
  assert.equal(exactScorePick(2.1, 1.9), null);
  assert.equal(exactScorePick(null, 1.0), null);
  assert.equal(exactScorePick(1.0, undefined), null);
});

test('buckets, settlement and tallies', () => {
  assert.equal(scoreBucket(0.15), '15-18');
  assert.equal(scoreBucket(0.18), '18-20');
  assert.equal(scoreBucket(0.25), '20+');
  assert.equal(settleScore({ home: 1, away: 0 }, 1, 0), true);
  assert.equal(settleScore({ home: 1, away: 0 }, 0, 1), false);
  assert.equal(settleScore({ home: 1, away: 0 }, null, 0), null);
  const t = emptyTally();
  addTally(t, true, 0.2); addTally(t, false, 0.16);
  assert.equal(t.n, 2); assert.equal(t.won, 1); assert.ok(Math.abs(t.claimed - 0.36) < 1e-12);
  assert.equal(hitRate(t), 0.5);
  assert.equal(hitRate(emptyTally()), null);
});
