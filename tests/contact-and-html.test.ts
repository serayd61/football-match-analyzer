// Güvenlik turu 2026-09-24: /api/contact GET herkese açıktı (service-role ile
// tüm iletişim mesajlarını — ad, e-posta, metin — döndürüyordu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { escapeHtml } from '@/lib/api/html';

process.env.CRON_SECRET = 'test-cron-secret';

test('escapeHtml neutralises markup and quotes', () => {
  assert.equal(escapeHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(escapeHtml("a&b'c"), 'a&amp;b&#39;c');
  assert.equal(escapeHtml(null), '');
});

test('anonymous GET /api/contact → 401 without touching the DB', async () => {
  const { GET } = await import('@/app/api/contact/route');
  const res = await GET(new NextRequest('http://localhost/api/contact'));
  assert.equal(res.status, 401);
});

test('POST /api/contact still validates required fields', async () => {
  const { POST } = await import('@/app/api/contact/route');
  const res = await POST(
    new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  ', email: 'a@b.co', subject: 's', message: 'm' }),
    }),
  );
  assert.equal(res.status, 400);
});

test('POST /api/contact rejects malformed email', async () => {
  const { POST } = await import('@/app/api/contact/route');
  const res = await POST(
    new NextRequest('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'n', email: 'nope', subject: 's', message: 'm' }),
    }),
  );
  assert.equal(res.status, 400);
});
