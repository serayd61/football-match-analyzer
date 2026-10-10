import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleStanding, groupStandingDays, type StoredStandingPick } from '@/lib/site/standing-picks-rule';

test('settleStanding: 1X2 by result, Ü/A 2,5 both sides, KG both sides', () => {
  assert.equal(settleStanding('1x2', '1', 2, 1), true);
  assert.equal(settleStanding('1x2', '1', 1, 1), false);
  assert.equal(settleStanding('1x2', 'X', 1, 1), true);
  assert.equal(settleStanding('1x2', '2', 0, 3), true);
  assert.equal(settleStanding('ou25', 'over', 2, 1), true);
  assert.equal(settleStanding('ou25', 'over', 1, 1), false);
  assert.equal(settleStanding('ou25', 'under', 1, 1), true);
  assert.equal(settleStanding('ou25', 'under', 3, 0), false);
  assert.equal(settleStanding('btts', 'yes', 1, 1), true);
  assert.equal(settleStanding('btts', 'yes', 2, 0), false);
  assert.equal(settleStanding('btts', 'no', 2, 0), true);
  assert.equal(settleStanding('btts', 'no', 1, 2), false);
});

const pick = (fixtureId: number, market: any, selection: string, kickoff: string): StoredStandingPick => ({
  fixtureId, market, selection, kickoff, leagueLabel: 'Eredivisie', leagueSlug: 'eredivisie', covered: true,
  homeName: 'A', awayName: 'B', homeCrest: null, awayCrest: null, modelP: 0.6, marketP: 0.55, edge: 0.05,
  verdict: 'strong', acc: 0.6, evidenceN: 20, evidenceWon: 12, scope: 'league',
});

test('groupStandingDays: Zurich days newest first, winners and losers together, pending counted apart', () => {
  const rows = [
    pick(1, '1x2', '1', '2026-10-10T18:30:00Z'),   // 10 Eki, 1-1 → kaybetti
    pick(1, 'ou25', 'over', '2026-10-10T18:30:00Z'), // 10 Eki, 2 gol → kaybetti
    pick(2, 'btts', 'yes', '2026-10-10T12:00:00Z'),  // 10 Eki, 2-1 → tuttu
    pick(3, '1x2', '2', '2026-10-09T22:30:00Z'),     // Zürih'te 10 Eki 00:30 → 10 Eki, skor yok → bekliyor
    pick(4, 'ou25', 'under', '2026-10-09T18:00:00Z'), // 9 Eki, 1-0 → tuttu
  ];
  const scores = new Map<number, [number, number]>([[1, [1, 1]], [2, [2, 1]], [4, [1, 0]]]);
  const days = groupStandingDays(rows, scores);
  assert.deepEqual(days.map((d) => d.day), ['2026-10-10', '2026-10-09']);
  const d10 = days[0];
  assert.equal(d10.n, 3); assert.equal(d10.won, 1); assert.equal(d10.pending, 1);
  assert.deepEqual(d10.byMarket, { '1x2': { n: 1, won: 0 }, ou25: { n: 1, won: 0 }, btts: { n: 1, won: 1 } });
  // gün içinde başlama saatine göre; kaybedenler listede kalır
  assert.deepEqual(d10.picks.map((p) => [p.fixtureId, p.market, p.won]), [[3, '1x2', null], [2, 'btts', true], [1, '1x2', false], [1, 'ou25', false]]);
  assert.equal(d10.picks[0].homeScore, null);
  const d9 = days[1];
  assert.equal(d9.n, 1); assert.equal(d9.won, 1); assert.equal(d9.pending, 0);
  assert.deepEqual(d9.picks[0], { ...rows[4], homeScore: 1, awayScore: 0, won: true });
});
