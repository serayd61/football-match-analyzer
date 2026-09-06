import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finiteOrNull, goalPoints, temporalSplit, holdoutBrier, walkForwardBins } from '@/lib/calibration-eval';

test('finiteOrNull rejects null/empty/NaN instead of turning them into 0', () => {
  assert.equal(finiteOrNull(null), null);
  assert.equal(finiteOrNull(undefined), null);
  assert.equal(finiteOrNull(''), null);
  assert.equal(finiteOrNull('  '), null);
  assert.equal(finiteOrNull('abc'), null);
  assert.equal(finiteOrNull(Infinity), null);
  assert.equal(finiteOrNull(true), null);
  assert.equal(finiteOrNull('0.42'), 0.42);
  assert.equal(finiteOrNull(0), 0);
});

test('a missing over-2.5 probability is skipped, not counted as a 100% "under" call', () => {
  const pts = goalPoints([
    { home_score: 2, away_score: 1, p_over25: null, p_btts_yes: 0.7 },
    { home_score: 2, away_score: 1, p_over25: '', p_btts_yes: 0.7 },
    { home_score: 0, away_score: 0, p_over25: 0.3, p_btts_yes: null },
    { home_score: null, away_score: 1, p_over25: 0.6, p_btts_yes: 0.6 },
    { home_score: 1, away_score: 1, p_over25: 1.4, p_btts_yes: 0.5 },
  ]);
  assert.equal(pts.ou25.length, 1);
  assert.deepEqual({ x: pts.ou25[0].x, y: pts.ou25[0].y }, { x: 0.7, y: 1 }); // under pick, 0-0 → hit
  assert.equal(pts.btts.length, 3);
  assert.deepEqual(pts.skipped, { noScore: 1, noOu: 2, noBtts: 1, outOfRange: 1 });
});

test('temporal split keeps chronology and refuses to split a small sample', () => {
  const xs = Array.from({ length: 1000 }, (_, i) => i);
  const { train, holdout } = temporalSplit(xs, 0.2, 300);
  assert.equal(train.length, 800);
  assert.equal(holdout[0], 800);
  assert.equal(temporalSplit(xs.slice(0, 100), 0.2, 300).holdout.length, 0);
});

test('holdout Brier is measured on rows the curve never saw', () => {
  // Over-confident model: says 0.6 / 0.8 but hits 50% / 60% of the time (two levels → a real curve).
  const mk = (n: number, seed: number) => Array.from({ length: n }, (_, i) => (i % 2 ? { x: 0.8, y: (i * 7 + seed) % 10 < 6 ? 1 : 0 } : { x: 0.6, y: (i * 3 + seed) % 10 < 5 ? 1 : 0 }));
  const train = mk(400, 0), holdout = mk(100, 3);
  const h = holdoutBrier(train, holdout);
  assert.ok(h && h.n === 100);
  assert.ok(h!.after <= h!.before, 'calibration should not hurt a stationary over-confident sample');
  assert.equal(holdoutBrier(train, []), null);
});

test('walk-forward never scores a month with its own or later data', () => {
  const month = (m: number, n: number, hit: number) =>
    Array.from({ length: n }, (_, i) => ({ x: 0.7, y: i % 10 < hit ? 1 : 0, t: Date.UTC(2026, m, 1 + (i % 27)) }));
  const pts = [...month(0, 200, 7), ...month(1, 200, 7), ...month(2, 100, 2)];
  const wf = walkForwardBins(pts, 300);
  assert.equal(wf.warmup, 400, 'months 0 and 1 are warm-up (prior < 300 until both are seen)');
  assert.equal(wf.scored, 100);
  assert.equal(wf.firstScoredMonth, '2026-03');
  // Curve fitted on months 0–1 (70% hit at x=0.7) scores month 2 (20% hit): calibrated ≈ 0.7, observed 0.2.
  const bin = wf.bins.find((b) => b.n === 100)!;
  assert.ok(Math.abs(bin.predicted - 0.7) < 0.02);
  assert.ok(Math.abs(bin.observed - 0.2) < 0.001);
});
