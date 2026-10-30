import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTrialRecipients } from '@/lib/site/trial-emails';

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

test('first picks day 1 only; strong picks day 4–5 with more than 1 day left (2026-10-30 cadence)', () => {
  const first = selectTrialRecipients(users, 'first', { now });
  assert.deepEqual(first.map((r) => [r.email, r.daysLeft]), [['b@x.io', 6]]);
  const strong = selectTrialRecipients(users, 'strong', { now });
  assert.deepEqual(strong.map((r) => r.email), []);
  const u5 = [{ email: 'g@x.io', name: 'G', createdAt: d(4.5) }, { email: 'h@x.io', name: 'H', createdAt: d(5.5) }];
  // 5,5 günlük hesap (1,5 gün kaldı) strong'a değil ending'e düşer: aynı gün iki mail yok
  assert.deepEqual(selectTrialRecipients(u5, 'strong', { now }).map((r) => [r.email, r.daysLeft]), [['g@x.io', 3]]);
  assert.deepEqual(selectTrialRecipients(u5, 'ending', { now }).map((r) => r.email), ['h@x.io']);
});
