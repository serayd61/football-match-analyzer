import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strongBoard, strongToday, SHOWCASE_NOISE } from '@/lib/site/strong-markets';

const lg = (id: number, name: string, status: string, strong: any[]) => ({ league_id: id, name, ccode: 'X', status, stats: { strong } });
test('strongBoard ranks leagues per market and drops noise/hidden leagues', () => {
  const b = strongBoard([
    lg(1, '3. Divisjon Avd. 5', 'excluded', [{ market: 'ou25', from: 0.75, n: 38, won: 33 }, { market: 'btts', from: 0.7, n: 36, won: 28 }]),
    lg(2, 'Premier League U18', 'excluded', [{ market: 'ou25', from: 0.75, n: 39, won: 34 }]),
    lg(3, 'Club Friendlies', 'excluded', [{ market: 'ou25', from: 0.75, n: 29, won: 24 }]),
    lg(4, 'Isthmian Premier Division', 'excluded', [{ market: 'btts', from: 0.7, n: 24, won: 17 }]),
    lg(5, 'Some Hidden', 'hidden', [{ market: 'ou25', from: 0.75, n: 20, won: 20 }]),
    lg(6, 'Challenge Cup', 'excluded', [{ market: 'x12', from: 0.7, n: 15, won: 11 }]),
  ], 3);
  assert.deepEqual(b.map((x) => [x.market, x.rows.map((r) => r.name)]), [['ou25', ['3. Divisjon Avd. 5']], ['btts', ['3. Divisjon Avd. 5', 'Isthmian Premier Division']]]);
  assert.ok(SHOWCASE_NOISE.test('Toppserien') && SHOWCASE_NOISE.test('Liga MX Femenil Apertura') && !SHOWCASE_NOISE.test('Eerste Divisie'));
});

test('strongToday keeps matches whose pick sits in a strong zone, sorted by kickoff', () => {
  const cov = new Map<number, any>([[1, { name: 'Isthmian Premier Division', status: 'excluded', strong: [{ market: 'btts', from: 0.7, n: 24, won: 17 }] }], [2, { name: 'Eredivisie', status: 'whitelist', strong: [{ market: 'ou25', from: 0.75, n: 40, won: 32 }] }]]);
  const mk = (id: number, leagueId: number, kickoff: string, over: number | null, btts: number | null) => ({ row: { id, kickoff }, leagueId, leagueName: '', kickoff, input: { pick: '1' as const, pHome: 0.5, pDraw: 0.3, pAway: 0.2, over: over != null ? { pick: 'over' as const, pRaw: over } : null, btts: btts != null ? { pick: 'yes' as const, pRaw: btts } : null } });
  const rows = strongToday([mk(1, 1, '2026-09-24T19:45:00Z', 0.6, 0.74), mk(2, 2, '2026-09-24T18:00:00Z', 0.8, 0.9), mk(3, 2, '2026-09-24T20:00:00Z', 0.6, 0.9), mk(4, 9, '2026-09-24T12:00:00Z', 0.9, 0.9)], (id) => cov.get(id));
  assert.deepEqual(rows.map((r) => [r.row.id, r.pick.market, r.pick.selection]), [[2, 'ou25', 'over'], [1, 'btts', 'yes']]);
});
