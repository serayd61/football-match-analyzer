import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDrift, driftVsPick } from '@/lib/site/odds-drift-rule';
import { phaseForMinutes, latestPhase } from '@/lib/site/odds-phases';

const pt = (phase: string, h: number, d: number, a: number, at = '2026-09-12T00:00:00Z') => {
  const s = 1 / h + 1 / d + 1 / a;
  return { phase, capturedAt: at, provider: null, minutesToKickoff: null, homeOdds: h, drawOdds: d, awayOdds: a, pHome: 1 / h / s, pDraw: 1 / d / s, pAway: 1 / a / s, bttsYes: null, bttsNo: null };
};

test('phase windows map minutes-to-kickoff in order', () => {
  assert.deepEqual([3000, 1400, 700, 300, 150, 60].map(phaseForMinutes), ['opening', 'h24', 'h12', 'h6', 'h3', 'closing']);
});

test('latestPhase prefers the latest phase, not the newest timestamp', () => {
  const rows = [{ phase: 'closing', captured_at: '2026-09-12T10:00:00Z' }, { phase: 'h3', captured_at: '2026-09-12T11:00:00Z' }, { phase: 'bogus', captured_at: '2026-09-12T12:00:00Z' }];
  assert.equal(latestPhase(rows)?.phase, 'closing');
});

test('drift is last minus first in probability points and flags notable moves', () => {
  const d = computeDrift([pt('h3', 1.85, 3.9, 4.0, '2026-09-12T12:00:00Z'), pt('opening', 2.1, 3.9, 3.25, '2026-09-12T04:00:00Z')]);
  assert.ok(d);
  assert.equal(d.points, 2);
  assert.equal(d.first.phase, 'opening');
  assert.ok(d.dHome > 0.03 && d.dAway < -0.03);
  assert.equal(d.mover, '1');
  assert.equal(d.notable, true);
  assert.equal(driftVsPick(d, '1'), 'toward');
  assert.equal(driftVsPick(d, '2'), 'away');
  assert.equal(driftVsPick(d, 'X'), 'flat');
});

test('single point → no movement, not notable', () => {
  const d = computeDrift([pt('opening', 2.0, 3.5, 3.6)]);
  assert.ok(d);
  assert.equal(d.notable, false);
  assert.equal(driftVsPick(d, '1'), 'flat');
});
