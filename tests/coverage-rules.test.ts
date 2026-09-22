import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateLeague, evaluateLeague, COVERAGE_GATE } from '@/lib/coverage/rules';

const row = (o: Partial<Parameters<typeof aggregateLeague>[0][number]>) => ({ p_over25: null, p_btts_yes: null, home_score: 1, away_score: 1, correct: null, ll_1x2: null, kickoff: '2026-09-01T12:00:00Z', ...o });

test('aggregateLeague counts threshold legs and their hits; unscored rows are skipped', () => {
  const s = aggregateLeague([
    row({ p_over25: 0.70, home_score: 2, away_score: 1, correct: true, ll_1x2: 0.5 }),   // Üst ✓, KG ✓ değil (eşik altı)
    row({ p_over25: 0.66, home_score: 1, away_score: 0, correct: false, ll_1x2: 1.0 }),  // Üst ✗
    row({ p_btts_yes: 0.61, home_score: 1, away_score: 1 }),                             // KG ✓
    row({ p_btts_yes: 0.90, home_score: null }),                                          // skorsuz → atla
  ], 180);
  assert.equal(s.n, 3);
  assert.deepEqual(s.ouHi, { n: 2, won: 1 });
  assert.deepEqual(s.bttsHi, { n: 1, won: 1 });
  assert.deepEqual(s.x12, { n: 2, won: 1, ll: 0.75 });
});

const stats = (ou: [number, number], bt: [number, number], n = 100) => ({ n, x12: { n, won: 50, ll: 1 }, ouHi: { n: ou[1], won: ou[0] }, bttsHi: { n: bt[1], won: bt[0] }, lastKickoff: null, windowDays: 180 });

test('observe league is proposed for promotion only above the gate with enough legs', () => {
  assert.equal(evaluateLeague('observe', stats([30, 40], [20, 40]))?.type, 'promote');      // Üst 75%
  assert.equal(evaluateLeague('observe', stats([20, 40], [25, 40]))?.type, 'promote');      // KG 62.5%
  assert.equal(evaluateLeague('observe', stats([30, 39], [20, 39])), null);                 // n < 40
  assert.equal(evaluateLeague('observe', stats([25, 40], [24, 40])), null);                 // 62.5% Üst < 65, KG 60% < 62
});

test('whitelist league is proposed for demotion when a goal market falls below the floor; excluded strong league becomes a watch candidate', () => {
  assert.equal(evaluateLeague('whitelist', stats([21, 40], [30, 40]))?.type, 'demote');     // Üst 52.5% < 55
  assert.equal(evaluateLeague('whitelist', stats([26, 40], [30, 40])), null);               // 65% / 75%
  const w = evaluateLeague('excluded', stats([30, 40], [10, 40], COVERAGE_GATE.watchMinN));
  assert.equal(w?.type, 'watch'); assert.equal(w?.to, 'observe');
  assert.equal(evaluateLeague('excluded', stats([30, 40], [10, 40], 59)), null);
});
