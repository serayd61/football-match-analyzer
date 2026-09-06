import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairedBootstrap, pairedFromSums, promotionVerdict } from '@/lib/engine/gate';

test('paired bootstrap: consistent negative differences → b better, CI excludes 0', () => {
  const d = Array.from({ length: 400 }, (_, i) => -0.02 + ((i % 7) - 3) * 0.003);
  const s = pairedBootstrap(d, 500, 1)!;
  assert.equal(s.n, 400);
  assert.ok(s.mean < 0);
  assert.ok(s.hi < 0 && s.bBetter && !s.bWorse);
  // deterministic with the same seed
  assert.deepEqual(pairedBootstrap(d, 500, 1), s);
});

test('paired bootstrap: noise around zero → inconclusive', () => {
  const d = Array.from({ length: 300 }, (_, i) => (i % 2 ? 0.05 : -0.05));
  const s = pairedBootstrap(d, 500, 3)!;
  assert.ok(s.lo <= 0 && s.hi >= 0);
  assert.equal(s.bBetter, false);
  assert.equal(s.bWorse, false);
  assert.equal(pairedBootstrap([0.1]), null);
});

test('pairedFromSums matches the sample mean and shrinks with n', () => {
  const d = Array.from({ length: 1000 }, (_, i) => -0.01 + ((i % 5) - 2) * 0.004);
  const sum = d.reduce((s, x) => s + x, 0), sum2 = d.reduce((s, x) => s + x * x, 0);
  const s = pairedFromSums(d.length, sum, sum2)!;
  assert.equal(s.mean, -0.01);
  assert.ok(s.hi < 0 && s.bBetter);
  const small = pairedFromSums(10, sum / 100, sum2 / 100)!;
  assert.ok(small.hi - small.lo > s.hi - s.lo);
  assert.equal(pairedFromSums(1, 0, 0), null);
});

test('promotion verdict enforces weeks, n, improvement and CI', () => {
  const good = { n: 800, mean: -0.012, lo: -0.02, hi: -0.004, bBetter: true, bWorse: false };
  assert.deepEqual(promotionVerdict({ weeks: 4, primary: good, secondary: [null, null] }), { pass: true, reasons: [] });
  const few = promotionVerdict({ weeks: 2, primary: { ...good, n: 300 }, secondary: [] });
  assert.equal(few.pass, false);
  assert.ok(few.reasons.some((r) => r.startsWith('weeks')));
  assert.ok(few.reasons.some((r) => r.startsWith('paired n')));
  const weak = promotionVerdict({ weeks: 6, primary: { ...good, mean: -0.001, hi: 0.002 }, secondary: [] });
  assert.equal(weak.pass, false);
  assert.equal(weak.reasons.length, 2);
  const worseSecondary = promotionVerdict({ weeks: 6, primary: good, secondary: [{ n: 700, mean: 0.01, lo: 0.002, hi: 0.018, bBetter: false, bWorse: true }] });
  assert.equal(worseSecondary.pass, false);
  assert.equal(promotionVerdict({ weeks: 6, primary: null, secondary: [] }).reasons[0], 'no paired 1x2 rows');
});
