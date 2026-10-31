import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOpsReport, opsReportSubject, opsReportText } from '@/lib/site/ops-report';

const now = Date.parse('2026-10-31T19:00:00Z');
const h = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();
const d = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();

const input = {
  users: [
    { id: '1', email: 'new-google@x.io', name: 'G', createdAt: h(3), passwordHash: null },             // pencerede, Google
    { id: '2', email: 'new-pass@x.io', name: null, createdAt: h(11), passwordHash: 'hash' },           // pencerede, şifre
    { id: '3', email: 'old@x.io', name: 'O', createdAt: h(13), passwordHash: 'hash' },                  // pencere dışı (13 saat)
    { id: '4', email: 'ended@x.io', name: 'E', createdAt: d(7.2), passwordHash: 'hash' },               // deneme 4,8 saat önce bitti, dönmedi
    { id: '5', email: 'converted@x.io', name: 'C', createdAt: d(7.1), passwordHash: null },             // deneme bitti ama Stripe aboneliği var
    { id: '6', email: 'manual@x.io', name: 'M', createdAt: d(7.3), passwordHash: 'hash' },              // manuel uzun erişim (2099)
    { id: '7', email: 'soon@x.io', name: 'S', createdAt: d(6.8), passwordHash: 'hash' },                // 4,8 saat sonra bitecek
    { id: '8', email: 'extended@x.io', name: 'X', createdAt: d(20), passwordHash: 'hash' },             // trial_ends_at uzatılmış, 2 saat önce bitti
    { id: '9', email: 'NEW-GOOGLE@x.io', name: 'dup', createdAt: h(3), passwordHash: null },           // mükerrer
  ],
  profiles: [
    { email: 'new-google@x.io', lastSeenAt: h(1), firstMatchViewAt: h(1) },
    { email: 'manual@x.io', subscriptionStatus: 'active', subscriptionEnd: '2099-01-01T00:00:00Z' },
    { email: 'extended@x.io', trialEndsAt: '2026-10-31T17:00:00.000' },  // saat dilimsiz → UTC
    { email: 'ended@x.io', lastSeenAt: d(7.1) },
  ],
  subs: [{ userId: '5', status: 'active', currentPeriodEnd: d(-20), stripeSubscriptionId: 'sub_1' }],
};

test('yeni kayıtlar: son 12 saat, yöntem ve aktivasyon izi', () => {
  const r = buildOpsReport(input, { now });
  assert.deepEqual(r.newSignups.map((x) => [x.email, x.method, x.access]), [['new-google@x.io', 'google', 'trial'], ['new-pass@x.io', 'password', 'trial']]);
  assert.equal(r.newSignups[0].firstMatchViewAt, h(1));
  assert.equal(r.newSignups[0].returned, true); // kayıt 3 saat önce, görülme 1 saat önce → 2 saat sonra geri gelmiş
});

test('denemesi bitenler: dönmeyen, Pro’ya geçen ve manuel erişimli ayrı etiketlenir', () => {
  const r = buildOpsReport(input, { now });
  const m = new Map(r.trialEnded.map((x) => [x.email, x.access]));
  assert.equal(m.get('ended@x.io'), 'expired');
  assert.equal(m.get('converted@x.io'), 'paid');
  assert.equal(m.get('manual@x.io'), 'paid');
  assert.equal(m.get('extended@x.io'), 'expired');
  assert.ok(!m.has('soon@x.io'));
  assert.deepEqual(r.trialEndingSoon.map((x) => x.email), ['soon@x.io']);
});

test('toplamlar ve metin', () => {
  const r = buildOpsReport(input, { now });
  assert.equal(r.totals.users, 8);
  assert.equal(r.totals.paid, 2);
  assert.equal(r.totals.trialActive, 4); // new-google, new-pass, old, soon
  const subj = opsReportSubject(r);
  assert.ok(subj.includes('2 yeni kayıt') && subj.includes('4 deneme bitti'), subj);
  const text = opsReportText(r);
  assert.ok(text.includes('PRO’YA GEÇTİ') && text.includes('dönmedi'));
});
