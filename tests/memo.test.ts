// memoTTL: süreç içi TTL önbelleği (2026-11-04, Disk IO uyarısı).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoTTL } from '../src/lib/site/memo';

test('ttl içinde tek yükleme, eşzamanlı çağrılar tek istek', async () => {
  let n = 0;
  const get = memoTTL(60_000, async () => { n++; await new Promise((r) => setTimeout(r, 5)); return n; });
  const [a, b] = await Promise.all([get(), get()]);
  assert.equal(a, 1); assert.equal(b, 1);
  assert.equal(await get(), 1);
  assert.equal(n, 1);
});

test('ttl dolunca yeniden yükler, invalidate hemen yeniler', async () => {
  let n = 0;
  const get = memoTTL(10, async () => ++n);
  assert.equal(await get(), 1);
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(await get(), 2);
  get.invalidate();
  assert.equal(await get(), 3);
});

test('yükleme hata verirse eldeki bayat değer döner, değer yoksa hata fırlar', async () => {
  let fail = false;
  const get = memoTTL(10, async () => { if (fail) throw new Error('db'); return 'ok'; });
  assert.equal(await get(), 'ok');
  fail = true;
  await new Promise((r) => setTimeout(r, 15));
  assert.equal(await get(), 'ok');
  const fresh = memoTTL(10, async () => { throw new Error('db'); });
  await assert.rejects(fresh(), /db/);
});
