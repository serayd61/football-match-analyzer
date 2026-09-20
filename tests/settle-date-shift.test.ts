import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleEnginePredictions, nextDay } from '@/lib/engine/settle';

// Sahte Supabase: engine_predictions select/update zinciri
function fakeSb(rows: any[]) {
  const updates: any[] = [];
  const chain = (result: any) => {
    const c: any = {};
    for (const k of ['select', 'eq', 'lt', 'order', 'limit', 'in', 'not', 'is']) c[k] = () => c;
    c.then = (res: any) => Promise.resolve(result).then(res);
    return c;
  };
  const sb: any = {
    from: () => ({
      select: () => chain({ data: rows, error: null }),
      update: (patch: any) => { const c = chain({ error: null }); c.eq = (_: string, id: number) => { updates.push({ id, ...patch }); return c; }; c.in = (_: string, ids: number[]) => { ids.forEach((id) => updates.push({ id, ...patch })); return c; }; return c; },
    }),
  };
  return { sb, updates };
}

const m = (id: number, hs: number | null, as: number | null, finished = true) => ({ id, homeScore: hs, awayScore: as, finished }) as any;
const row = (id: number, fixture_id: number, kickoff: string) => ({ id, fixture_id, kickoff, pick: '1', p_home: 0.5, p_draw: 0.3, p_away: 0.2, p_over25: 0.6, p_btts_yes: 0.55 });

test('nextDay', () => {
  assert.equal(nextDay('2026-09-18'), '2026-09-19');
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
});

test('late kick-off listed under the next feed date still settles; feed fetched once per date', async () => {
  const rows = [row(1, 5795456, '2026-09-18T19:00:00Z'), row(2, 111, '2026-09-18T14:00:00Z'), row(3, 222, '2026-09-19T13:00:00Z')];
  const { sb, updates } = fakeSb(rows);
  const calls: string[] = [];
  const feed = async (d: string) => {
    calls.push(d);
    if (d === '2026-09-18') return [m(111, 1, 1)];
    if (d === '2026-09-19') return [m(5795456, 3, 0), m(222, 2, 2)];
    return [];
  };
  const res = await settleEnginePredictions(sb, { now: new Date('2026-09-20T10:00:00Z'), fetch: feed });
  assert.deepEqual(calls, ['2026-09-18', '2026-09-19', '2026-09-20']);
  assert.equal(res.settled, 3);
  assert.equal(res.skipped.notFound, 0);
  const brent = updates.find((u) => u.id === 1);
  assert.equal(brent.home_score, 3); assert.equal(brent.away_score, 0); assert.equal(brent.settled, true);
});

test('stale notFound rows are voided only when the next-day bucket was fetched', async () => {
  const rows = [row(1, 999, '2026-09-01T20:00:00Z')];
  const { sb, updates } = fakeSb(rows);
  const failing = async (d: string) => { if (d === '2026-09-02') throw new Error('boom'); return []; };
  const res = await settleEnginePredictions(sb, { now: new Date('2026-09-20T10:00:00Z'), fetch: failing });
  assert.equal(res.skipped.notFound, 1); assert.equal(res.voided, 0); assert.equal(updates.length, 0);

  const { sb: sb2, updates: u2 } = fakeSb(rows);
  const res2 = await settleEnginePredictions(sb2, { now: new Date('2026-09-20T10:00:00Z'), fetch: async () => [] });
  assert.equal(res2.voided, 1); assert.equal(u2[0].result, null);
});
