import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStandings, STANDINGS_FRESH_MS, STANDINGS_MISS_S, STANDINGS_MISS_429_S, type StandingsDeps, type StandingsEntry, type StandingsFetch } from '@/lib/site/standings-cache';
import { feedQuotaFromHeaders, feedQuotaNotice } from '@/lib/data-sources/feed-quota';

type Row = { teamId: number };
const NOW = Date.UTC(2026, 10, 28, 12);

function harness(init: { entry?: StandingsEntry<Row> | null; miss?: boolean; res: StandingsFetch<Row> }) {
  const state = { entry: init.entry ?? null, miss: init.miss ?? false, fetches: 0, missSeconds: 0 };
  const deps: StandingsDeps<Row> = {
    now: () => NOW,
    read: async () => ({ entry: state.entry, miss: state.miss }),
    write: async (_id, e) => { state.entry = e; },
    markMiss: async (_id, s) => { state.miss = true; state.missSeconds = s; },
    fetch: async () => { state.fetches++; return init.res; },
  };
  return { state, deps };
}

test('a fresh stored table never reaches the feed', async () => {
  const h = harness({ entry: { rows: [{ teamId: 1 }], at: NOW - STANDINGS_FRESH_MS + 1000 }, res: { ok: true, rows: [{ teamId: 9 }] } });
  const out = await loadStandings(47, h.deps);
  assert.deepEqual(out, { rows: [{ teamId: 1 }], source: 'fresh' });
  assert.equal(h.state.fetches, 0);
});

test('an expired table is fetched once, stored, then served fresh', async () => {
  const h = harness({ entry: { rows: [{ teamId: 1 }], at: NOW - STANDINGS_FRESH_MS - 1 }, res: { ok: true, rows: [{ teamId: 2 }] } });
  assert.deepEqual(await loadStandings(47, h.deps), { rows: [{ teamId: 2 }], source: 'fetched' });
  assert.deepEqual(await loadStandings(47, h.deps), { rows: [{ teamId: 2 }], source: 'fresh' });
  assert.equal(h.state.fetches, 1);
});

test('a failing feed serves the stale copy and is not retried while the miss mark stands', async () => {
  const h = harness({ entry: { rows: [{ teamId: 1 }], at: NOW - 3 * STANDINGS_FRESH_MS }, res: { ok: false, status: 429 } });
  assert.deepEqual(await loadStandings(47, h.deps), { rows: [{ teamId: 1 }], source: 'stale' });
  assert.equal(h.state.missSeconds, STANDINGS_MISS_429_S);
  assert.deepEqual(await loadStandings(47, h.deps), { rows: [{ teamId: 1 }], source: 'stale' });
  assert.equal(h.state.fetches, 1);
});

test('no copy and a failing feed gives an empty table, with the shorter wait for non-429 errors', async () => {
  const h = harness({ res: { ok: false, status: 502 } });
  assert.deepEqual(await loadStandings(47, h.deps), { rows: [], source: 'empty' });
  assert.equal(h.state.missSeconds, STANDINGS_MISS_S);
  await loadStandings(47, h.deps);
  assert.equal(h.state.fetches, 1);
});

test('an empty answer does not overwrite the last good table', async () => {
  const h = harness({ entry: { rows: [{ teamId: 1 }], at: NOW - 2 * STANDINGS_FRESH_MS }, res: { ok: true, rows: [] } });
  assert.deepEqual(await loadStandings(47, h.deps), { rows: [{ teamId: 1 }], source: 'stale' });
  assert.deepEqual(h.state.entry?.rows, [{ teamId: 1 }]);
});

const headers = (h: Record<string, string>) => (n: string) => h[n] ?? null;

test('feed quota is read from RapidAPI headers; a negative remainder counts as zero', () => {
  const q = feedQuotaFromHeaders(headers({ 'x-ratelimit-requests-limit': '200000', 'x-ratelimit-requests-remaining': '-1', 'x-ratelimit-requests-reset': '345938' }), NOW)!;
  assert.deepEqual(q, { limit: 200000, remaining: 0, resetAtMs: NOW + 345938_000, at: NOW });
  assert.equal(feedQuotaFromHeaders(headers({}), NOW), null);
});

test('quota notice: silent under 70%, warn, alarm from 85%, out at zero, silent after the reset', () => {
  const q = (remaining: number) => ({ limit: 200000, remaining, resetAtMs: NOW + 4 * 86_400_000, at: NOW });
  assert.equal(feedQuotaNotice(q(80000), NOW), null);
  assert.equal(feedQuotaNotice(q(50000), NOW)?.level, 'warn');
  assert.equal(feedQuotaNotice(q(20000), NOW)?.level, 'alarm');
  const out = feedQuotaNotice(q(0), NOW)!;
  assert.equal(out.level, 'out');
  assert.match(out.text, /KOTASI BİTTİ/);
  assert.equal(feedQuotaNotice(q(0), NOW + 5 * 86_400_000), null);
  assert.equal(feedQuotaNotice(null, NOW), null);
});
