// Denetim 2026-09-18 (B01): service-role ile yazan / ücretli LLM çağıran uçlar
// anonim çağrıda DB'ye ya da dış API'ye dokunmadan 401 dönmeli.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { hasServiceSecret, serviceOnlyGuard } from '@/lib/api/dev-only';

process.env.CRON_SECRET = 'test-cron-secret';
delete process.env.ADMIN_SECRET;

const req = (method: string, auth?: string, body?: unknown) =>
  new NextRequest('http://localhost/api/x', {
    method,
    headers: auth ? { authorization: auth, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test('serviceOnlyGuard: no header, wrong secret and bare secret are rejected', () => {
  assert.equal(serviceOnlyGuard(req('POST'))?.status, 401);
  assert.equal(serviceOnlyGuard(req('POST', 'Bearer nope'))?.status, 401);
  assert.equal(serviceOnlyGuard(req('POST', 'test-cron-secret'))?.status, 401);
  assert.equal(serviceOnlyGuard(req('POST', 'Bearer test-cron-secret')), null);
});

test('hasServiceSecret is false when no secret is configured', () => {
  const saved = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    assert.equal(hasServiceSecret(req('POST', 'Bearer ')), false);
    assert.equal(hasServiceSecret(req('POST', 'Bearer undefined')), false);
  } finally {
    process.env.CRON_SECRET = saved;
  }
});

const guarded: Array<[string, 'GET' | 'POST']> = [
  ['@/app/api/unified/settle/route', 'POST'],
  ['@/app/api/cron/settle-unified/route', 'GET'],
  ['@/app/api/cron/settle-unified/route', 'POST'],
  ['@/app/api/cron/auto-analyze-matches/route', 'GET'],
  ['@/app/api/cron/auto-analyze-matches/route', 'POST'],
  ['@/app/api/v2/settle/route', 'POST'],
  ['@/app/api/performance/recalculate/route', 'POST'],
  ['@/app/api/webhooks/match-ended/route', 'GET'],
  ['@/app/api/webhooks/match-ended/route', 'POST'],
  ['@/app/api/analyze-deepseek-master/route', 'POST'],
  ['@/app/api/deepseek-master/route', 'POST'],
  ['@/app/api/deepseek-evaluate/route', 'POST'],
  ['@/app/api/auto-predict/route', 'POST'],
];

for (const [mod, method] of guarded) {
  test(`anonymous ${method} ${mod.replace('@/app', '').replace('/route', '')} → 401`, async () => {
    const handler = (await import(mod))[method] as (r: NextRequest) => Promise<Response>;
    const body = method === 'POST' ? { fixtureId: 1, homeScore: 9, awayScore: 0 } : undefined;
    const res = await handler(req(method, undefined, body));
    assert.equal(res.status, 401);
  });
}

test('unified/settle rejects out-of-range and non-integer scores even with a valid secret', async () => {
  const { POST } = await import('@/app/api/unified/settle/route');
  for (const bad of [
    { fixtureId: 1, homeScore: -1, awayScore: 0 },
    { fixtureId: 1, homeScore: 1.5, awayScore: 0 },
    { fixtureId: 1, homeScore: 99, awayScore: 0 },
    { fixtureId: 1, homeScore: '2', awayScore: 0 },
    { homeScore: 1, awayScore: 0 },
  ]) {
    const res = await POST(req('POST', 'Bearer test-cron-secret', bad));
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});
