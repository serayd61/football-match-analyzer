import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAfInjuries, parseAfLineups, injuriesDue, lineupsDue, sideFor } from '@/lib/data-sources/api-football-pure';

const H = 60 * 60_000;

test('parseAfInjuries maps API-Football team names to our home/away sides', () => {
  const resp = [
    { player: { name: 'D. Boloca', type: 'Missing Fixture', reason: 'Muscle Injury' }, team: { name: 'Sassuolo' } },
    { player: { name: 'G. Chiesa', type: 'Questionable', reason: 'Knock' }, team: { name: 'Juventus' } },
    { player: { name: '', type: 'Missing Fixture' }, team: { name: 'Juventus' } },
  ];
  const rows = parseAfInjuries(resp, 'US Sassuolo Calcio', 'Juventus FC');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.side), ['home', 'away']);
  assert.equal(rows[1].type, 'Questionable');
  assert.equal(rows[1].reason, 'Knock');
});

test('sideFor falls back to response order when names do not match', () => {
  assert.equal(sideFor('Unknown XI', 'Torino', 'AS Roma', 0), 'home');
  assert.equal(sideFor('Unknown XI', 'Torino', 'AS Roma', 1), 'away');
  assert.equal(sideFor('AS Roma', 'Torino', 'Roma', 0), 'away');
});

test('parseAfLineups returns null until both XIs are complete', () => {
  const xi = (n: number) => Array.from({ length: n }, (_, i) => ({ player: { id: i, name: `P${i}`, number: i + 1, pos: i ? 'D' : 'G', grid: null } }));
  const team = (name: string, n: number) => ({ team: { name }, formation: '4-3-3', coach: { name: 'Coach' }, startXI: xi(n), substitutes: xi(5) });
  assert.equal(parseAfLineups([], 'Torino', 'Roma'), null);
  assert.equal(parseAfLineups([team('Torino', 11)], 'Torino', 'Roma'), null);
  assert.equal(parseAfLineups([team('Torino', 11), team('AS Roma', 10)], 'Torino', 'Roma'), null);
  const ok = parseAfLineups([team('AS Roma', 11), team('Torino', 11)], 'Torino', 'Roma')!;
  assert.deepEqual(ok.map((l) => l.side), ['away', 'home']);
  assert.equal(ok[0].startXI.length, 11);
  assert.equal(ok[0].bench.length, 5);
  assert.equal(ok[0].startXI[0].pos, 'G');
});

test('injuriesDue: within 48h before kick-off, refreshed every 6h, never after kick-off', () => {
  const k = '2026-09-14T18:45:00Z', kMs = Date.parse(k);
  assert.equal(injuriesDue(k, kMs - 72 * H, null), false);
  assert.equal(injuriesDue(k, kMs - 30 * H, null), true);
  assert.equal(injuriesDue(k, kMs - 30 * H, new Date(kMs - 33 * H).toISOString()), false);
  assert.equal(injuriesDue(k, kMs - 30 * H, new Date(kMs - 37 * H).toISOString()), true);
  assert.equal(injuriesDue(k, kMs + 1, null), false);
});

test('lineupsDue: from ~75 min before to 4h after kick-off, only when missing', () => {
  const k = '2026-09-14T18:45:00Z', kMs = Date.parse(k);
  assert.equal(lineupsDue(k, kMs - 2 * H, false), false);
  assert.equal(lineupsDue(k, kMs - 70 * 60_000, false), true);
  assert.equal(lineupsDue(k, kMs + 3 * H, false), true);
  assert.equal(lineupsDue(k, kMs + 5 * H, false), false);
  assert.equal(lineupsDue(k, kMs - 10 * 60_000, true), false);
});
