import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateLeague, evaluateLeague, isProposalEligibleName, bucketOf, COVERAGE_GATE } from '@/lib/coverage/rules';

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
  const w = evaluateLeague('excluded', stats([30, 40], [26, 40], COVERAGE_GATE.watchMinN));
  assert.equal(w?.type, 'watch'); assert.equal(w?.to, 'observe');
  assert.equal(evaluateLeague('excluded', stats([30, 40], [10, 40], COVERAGE_GATE.watchMinN)), null); // tek pazar yetmez
  assert.equal(evaluateLeague('excluded', stats([30, 40], [26, 40], COVERAGE_GATE.watchMinN - 1)), null);
});

test('friendlies, women, youth, reserve and lower amateur tiers are never proposal-eligible', () => {
  for (const n of ['Club Friendlies', 'Frauen-Bundesliga', 'Ajax (W)', 'Premier League 2', 'U21 Premier League', 'MLS Next Pro', '3. Divisjon Avd. 2', 'Ettan Soedra', 'Regionalliga North', 'Serie A (W)']) {
    assert.equal(isProposalEligibleName(n), false, n);
  }
  for (const n of ['Eliteserien', 'Superettan', 'Major League Soccer', 'Süper Lig', '1. Divisjon']) assert.equal(isProposalEligibleName(n), true, n);
});

test('bucketOf labels and aggregateLeague fills per-market buckets', () => {
  assert.equal(bucketOf('x12', 0.83), '≥80'); assert.equal(bucketOf('x12', 0.5), '50–60'); assert.equal(bucketOf('ou25', 0.9), '≥85');
  assert.equal(bucketOf('under25', 0.6), null); assert.equal(bucketOf('under25', 0.76), '≥75');
  const s = aggregateLeague([
    row({ p_home: 0.85, p_draw: 0.1, p_away: 0.05, p_over25: 0.9, p_btts_yes: 0.3, home_score: 3, away_score: 0 }),
    row({ p_home: 0.2, p_draw: 0.2, p_away: 0.6, p_over25: 0.2, p_btts_yes: 0.85, home_score: 1, away_score: 1 }),
  ], 180);
  assert.deepEqual(s.buckets!.x12['≥80'], { n: 1, won: 1 });
  assert.deepEqual(s.buckets!.x12['60–70'], { n: 1, won: 0 });
  assert.deepEqual(s.buckets!.ou25['≥85'], { n: 1, won: 1 });
  assert.deepEqual(s.buckets!.under25['≥75'], { n: 1, won: 1 });   // 1-0.2 = 0.8 → Alt ✓ (1-1)
  assert.deepEqual(s.buckets!.btts['≥80'], { n: 1, won: 1 });
});
