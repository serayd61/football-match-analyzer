import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.FOOTBALL_DATA_API_KEY = 'test-key';

function fakeFetch(statuses: number[], calls: string[]) {
  return async (url: string | URL | Request): Promise<Response> => {
    calls.push(String(url));
    const status = statuses.shift() ?? 200;
    const body = status === 200 ? JSON.stringify({ matches: [{ status: 'FINISHED', utcDate: '2026-10-03T00:00:00Z', homeTeam: { name: 'A' }, awayTeam: { name: 'B' }, score: { fullTime: { home: 1, away: 0 } } }] }) : '';
    return new Response(body, { status, headers: status === 429 ? { 'Retry-After': '0' } : {} });
  };
}

test('fetchFinishedMatches retries once after a 429 and succeeds', async () => {
  const { fetchFinishedMatches } = await import('@/lib/statistical/data-loader');
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = fakeFetch([429, 200], calls) as typeof fetch;
  try {
    const rows = await fetchFinishedMatches('BSA', 2025);
    assert.equal(rows.length, 1);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = orig; }
});

test('fetchFinishedMatches gives up after the second 429', async () => {
  const { fetchFinishedMatches } = await import('@/lib/statistical/data-loader');
  const orig = globalThis.fetch;
  globalThis.fetch = fakeFetch([429, 429], []) as typeof fetch;
  try {
    await assert.rejects(() => fetchFinishedMatches('BSA', 2025), /429/);
  } finally { globalThis.fetch = orig; }
});
