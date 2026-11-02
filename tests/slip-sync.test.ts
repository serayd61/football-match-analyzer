import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSlipSync, mergeSlips, sameSlip, rowToLeg, legToRow } from '@/lib/site/slip-sync';
import { legKey, type SlipLeg } from '@/lib/site/slip-rule';

const leg = (fixtureId: number, market: SlipLeg['market'] = 'ou25', selection: SlipLeg['selection'] = 'over', extra: Partial<SlipLeg> = {}): SlipLeg => ({
  fixtureId, kickoff: '2026-11-03T18:00:00.000Z', leagueLabel: 'Premier League', homeName: 'A', awayName: 'B', market, selection, p: 0.6, odds: 1.8, addedAt: '2026-11-02T10:00:00.000Z', ...extra,
});

test('planSlipSync: gelen bacaklar upsert, listede olmayan aktifler removed', () => {
  const a = leg(1), b = leg(2, 'btts', 'yes'), c = leg(3, '1x2', '1');
  const plan = planSlipSync([legKey(a), legKey(c)], [a, b, b]);
  assert.deepEqual(plan.upserts.map(legKey), [legKey(a), legKey(b)]);
  assert.deepEqual(plan.removeKeys, [legKey(c)]);
  assert.deepEqual(planSlipSync([], []), { upserts: [], removeKeys: [] });
});

test('mergeSlips: yuva çakışmasında sunucu kazanır, yerel geri kalan eklenir', () => {
  const server = [leg(1, 'ou25', 'over')];
  const local = [leg(1, 'ou25', 'under'), leg(2, 'btts', 'yes')];
  const m = mergeSlips(server, local);
  assert.deepEqual(m.map(legKey), ['1:ou25:over', '2:btts:yes']);
  assert.ok(sameSlip(m, [leg(2, 'btts', 'yes'), leg(1, 'ou25', 'over')]));
  assert.ok(!sameSlip(m, server));
});

test('satır ↔ bacak dönüşümü; handikap çizgisi korunur, bozuk satır elenir', () => {
  const ah = leg(7, 'ah', 'home', { line: -0.75, odds: null });
  const row = legToRow('u@x.io', ah);
  assert.equal(row.leg_key, '7:ah:home:-0.75');
  assert.equal(row.line, -0.75);
  const back = rowToLeg({ ...row, removed_at: null });
  assert.ok(back);
  assert.equal(back.line, -0.75);
  assert.equal(back.odds, null);
  assert.equal(legToRow('u@x.io', leg(1)).line, null);
  assert.equal(rowToLeg({ ...row, market: 'nope', removed_at: null }), null);
});
