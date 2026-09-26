import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchOffer } from '@/lib/site/offer';
import { selectTrialRecipients } from '@/lib/site/trial-emails';

test('launch offer needs a coupon, respects the end date, defaults the price', () => {
  assert.equal(launchOffer({}), null);
  assert.deepEqual(launchOffer({ LAUNCH_OFFER_COUPON: 'launch-990' }, new Date('2026-10-01T00:00:00Z')), { coupon: 'launch-990', price: 9.9, until: null });
  assert.equal(launchOffer({ LAUNCH_OFFER_COUPON: 'x', LAUNCH_OFFER_UNTIL: '2026-10-31' }, new Date('2026-10-31T20:00:00Z'))?.until, '2026-10-31');
  assert.equal(launchOffer({ LAUNCH_OFFER_COUPON: 'x', LAUNCH_OFFER_UNTIL: '2026-10-31' }, new Date('2026-11-01T01:00:00Z')), null);
  assert.equal(launchOffer({ LAUNCH_OFFER_COUPON: 'x', LAUNCH_OFFER_UNTIL: 'bad' }), null);
  assert.equal(launchOffer({ LAUNCH_OFFER_COUPON: 'x', LAUNCH_OFFER_PRICE: '12.50' })?.price, 12.5);
});

const now = Date.parse('2026-10-10T09:00:00Z');
const d = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
const users = [
  { email: 'a@x.io', name: 'A', createdAt: d(2.5) },                                  // mid
  { email: 'b@x.io', name: null, createdAt: d(1) },                                    // çok yeni
  { email: 'c@x.io', name: 'C', createdAt: d(5.5) },                                   // ending (1,5 gün kaldı)
  { email: 'd@x.io', name: 'D', createdAt: d(9) },                                     // deneme bitmiş
  { email: 'e@x.io', name: 'E', createdAt: d(3), subscriptionStatus: 'trialing' },     // abone
  { email: 'f@x.io', name: 'F', createdAt: d(20), trialEndsAt: d(-1.2) },              // uzatılmış deneme, 1,2 gün kaldı → ending
  { email: 'A@x.io', name: 'dup', createdAt: d(2.5) },                                 // mükerrer (büyük harf)
  { email: 'bad', name: null, createdAt: d(2.5) },
];

test('mid picks day 2–3 signups with more than 2 days left; ending picks the last 2 days', () => {
  const mid = selectTrialRecipients(users, 'mid', { now });
  assert.deepEqual(mid.map((r) => [r.email, r.daysLeft]), [['a@x.io', 5]]);
  const ending = selectTrialRecipients(users, 'ending', { now });
  assert.deepEqual(ending.map((r) => [r.email, r.daysLeft]), [['c@x.io', 2], ['f@x.io', 2]]);
});

test('unsubscribed and already-sent are skipped', () => {
  assert.equal(selectTrialRecipients(users, 'mid', { now, unsubscribed: new Set(['a@x.io']) }).length, 0);
  assert.equal(selectTrialRecipients(users, 'ending', { now, alreadySent: new Set(['c@x.io']) }).map((r) => r.email).join(), 'f@x.io');
});
