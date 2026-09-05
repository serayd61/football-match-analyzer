import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devOnlyGuard, hasServiceSecret } from '@/lib/api/dev-only';

const req = (auth?: string) => ({ headers: { get: (n: string) => (n === 'authorization' ? auth ?? null : null) } });

test('unauthenticated write/test endpoints are hidden in production', () => {
  const env = process.env.NODE_ENV;
  const secret = process.env.CRON_SECRET;
  (process.env as any).NODE_ENV = 'production';
  process.env.CRON_SECRET = 's3cret';
  try {
    assert.equal(devOnlyGuard(req())?.status, 404);
    assert.equal(devOnlyGuard(req('Bearer wrong'))?.status, 404);
    assert.equal(devOnlyGuard(req('Bearer s3cret')), null);
    assert.equal(hasServiceSecret(req('s3cret')), false, 'scheme is required');
  } finally {
    (process.env as any).NODE_ENV = env;
    if (secret == null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
  }
});

test('no secret configured → nothing unlocks production', () => {
  const env = process.env.NODE_ENV;
  const s1 = process.env.CRON_SECRET, s2 = process.env.ADMIN_SECRET;
  (process.env as any).NODE_ENV = 'production';
  delete process.env.CRON_SECRET; delete process.env.ADMIN_SECRET;
  try {
    assert.equal(devOnlyGuard(req('Bearer anything'))?.status, 404);
  } finally {
    (process.env as any).NODE_ENV = env;
    if (s1 != null) process.env.CRON_SECRET = s1;
    if (s2 != null) process.env.ADMIN_SECRET = s2;
  }
});
