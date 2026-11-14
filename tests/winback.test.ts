import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectWinbackRecipients, winbackHistory, winbackKey, parseTs, WINBACK_MAX_STEPS, WINBACK_KEY_PREFIX } from '@/lib/site/winback';
import { buildWinbackEmail, winbackSubject, type WinbackEmailInput } from '@/lib/email-winback';
import type { TrialUser } from '@/lib/site/trial-emails';

// Geri kazanım serisi (2026-11-14): denemesi biten üyeye 3 günde bir, en çok 5 kez.
const DAY = 86_400_000;
const now = Date.parse('2026-11-20T07:30:00Z');
const iso = (t: number) => new Date(t).toISOString();
/** deneme bitişi `endedDaysAgo` gün önce olan üye */
const user = (email: string, endedDaysAgo: number, extra: Partial<TrialUser> = {}): TrialUser =>
  ({ email, name: null, createdAt: iso(now - (endedDaysAgo + 7) * DAY), trialEndsAt: iso(now - endedDaysAgo * DAY), subscriptionStatus: 'free', ...extra });
const sent = (email: string, step: number, daysAgo: number) => ({ email, campaign_key: winbackKey(step), sent_at: iso(now - daysAgo * DAY) });

test('winback: starts 3 days after the trial ended, never during the trial or the "ended" window', () => {
  const users = [user('a@x.io', -2), user('b@x.io', 0.5), user('c@x.io', 2.9), user('d@x.io', 3), user('e@x.io', 40)];
  const r = selectWinbackRecipients(users, new Map(), { now });
  assert.deepEqual(r.map((x) => x.email), ['d@x.io', 'e@x.io']);
  assert.ok(r.every((x) => x.step === 1));
});

test('winback: subscribers, unsubscribed, admins and broken addresses are skipped', () => {
  const users = [
    user('paid@x.io', 10, { subscriptionStatus: 'active' }), user('due@x.io', 10, { subscriptionStatus: 'past_due' }),
    user('unsub@x.io', 10), user('admin@x.io', 10), user('not-an-email', 10), user('ok@x.io', 10), user('OK@x.io', 10),
  ];
  const r = selectWinbackRecipients(users, new Map(), { now, unsubscribed: new Set(['unsub@x.io']), exclude: new Set(['admin@x.io']) });
  assert.deepEqual(r.map((x) => x.email), ['ok@x.io']);
});

test('winback: one mail every 3 days per person, at most 5, then silence', () => {
  const users = [user('a@x.io', 20), user('b@x.io', 20), user('c@x.io', 20), user('d@x.io', 20)];
  const h = winbackHistory([
    sent('a@x.io', 1, 1),                       // yesterday → wait
    sent('b@x.io', 1, 6), sent('b@x.io', 2, 3), // 3 days ago → step 3 today
    ...[1, 2, 3, 4, 5].map((s) => sent('c@x.io', s, 20 - s * 3)), // all five sent
    sent('d@x.io', 1, 2.98),                    // cron ran a few minutes later last time → still due
  ], now);
  const r = selectWinbackRecipients(users, h, { now });
  assert.deepEqual(r.map((x) => `${x.email}:${x.step}`).sort(), ['b@x.io:3', 'd@x.io:2']);
  assert.equal(WINBACK_MAX_STEPS, 5);
});

test('winback: a failed attempt also counts, and an unreadable timestamp blocks instead of repeating', () => {
  const h = winbackHistory([{ email: 'A@x.io ', campaign_key: winbackKey(2), sent_at: null }, { email: 'z@x.io', campaign_key: 'trial-ended-2026-11', sent_at: iso(now) }], now);
  assert.deepEqual(h.get('a@x.io'), { steps: 2, lastAt: now });
  assert.equal(h.has('z@x.io'), false, 'other campaigns are ignored');
  assert.deepEqual(selectWinbackRecipients([user('a@x.io', 20)], h, { now }), []);
});

test('winback: the series only starts for trials that ended in the last 120 days, but a started one finishes', () => {
  const users = [user('old@x.io', 200), user('started@x.io', 200), user('edge@x.io', 120)];
  const h = winbackHistory([sent('started@x.io', 1, 4)], now);
  const r = selectWinbackRecipients(users, h, { now });
  assert.deepEqual(r.map((x) => `${x.email}:${x.step}`), ['edge@x.io:1', 'started@x.io:2']);
  assert.equal(selectWinbackRecipients(users, new Map(), { now, maxAgeDays: 365 }).length, 3);
});

test('winback: most recently ended first (the daily batch limit cuts the oldest)', () => {
  const r = selectWinbackRecipients([user('old@x.io', 90), user('new@x.io', 4), user('mid@x.io', 30)], new Map(), { now });
  assert.deepEqual(r.map((x) => x.email), ['new@x.io', 'mid@x.io', 'old@x.io']);
});

test('parseTs: a timestamp without zone is UTC', () => {
  assert.equal(parseTs('2026-11-14 09:00:54.355'), Date.parse('2026-11-14T09:00:54.355Z'));
  assert.equal(parseTs('2026-11-14T09:00:54.355+00:00'), Date.parse('2026-11-14T09:00:54.355Z'));
  assert.ok(Number.isNaN(parseTs(null)));
});

const base: WinbackEmailInput = {
  step: 1, maxSteps: 5, name: 'Ada <b>', dateLabel: '20 November', tz: 'CET',
  legs: [{ time: '18:30', home: 'Estrela & Co', away: 'Benfica', league: 'Liga Portugal', selection: 'Benfica win', modelPct: 79.6 }, { time: '21:00', home: 'Lazio', away: 'Roma', league: 'Serie A', selection: 'Over 2.5', modelPct: 61 }],
  stats: { n: 20, won: 13 }, monthly: 9.9, yearly: 49, savingPct: 59, promoCode: 'PRO50',
  pricingUrl: 'https://footballanalytics.pro/pricing?utm_campaign=winback_s1', matchesUrl: 'https://footballanalytics.pro/matches', playUrl: 'https://play.google.com/store/apps/details?id=pro.footballanalytics', telegramUrl: 'https://t.me/fanalytics_pro',
  unsubscribeUrl: 'https://footballanalytics.pro/api/unsubscribe?email=a%40x.io&token=t',
};

test('winback mail: free matches, real prices, Google Play news, unsubscribe; input is escaped', () => {
  const { subject, html, text } = buildWinbackEmail(base);
  assert.match(subject, /Android app/);
  for (const body of [html, text]) {
    assert.match(body, /Benfica win/); assert.match(body, /model 80%/); assert.match(body, /Over 2\.5/);
    assert.match(body, /\$9\.90\/month/); assert.match(body, /\$49\.00\/year/); assert.match(body, /59% less/);
    assert.match(body, /Google Play/); assert.match(body, /t\.me\/fanalytics_pro/);
    assert.ok(body.includes(base.unsubscribeUrl)); assert.ok(body.includes(base.pricingUrl));
    assert.match(body, /1 of 5/);
    assert.match(body, /13 of 20/);
  }
  assert.ok(html.includes('Ada &lt;b&gt;') && !html.includes('Ada <b>'), 'name escaped');
  assert.ok(html.includes('Estrela &amp; Co'));
  // no saving claim without a yearly plan, no record line on a thin sample
  const plain = buildWinbackEmail({ ...base, yearly: null, savingPct: null, promoCode: null, stats: { n: 4, won: 3 } });
  assert.ok(!/less than twelve|\/year|PRO50|of 4 correct/.test(plain.html + plain.text));
});

test('winback mail: subject changes by step and the last one says it is the last', () => {
  const subj = [1, 2, 3, 4, 5].map((step) => winbackSubject({ ...base, step }));
  assert.equal(new Set(subj).size >= 4, true, subj.join(' | '));
  assert.match(subj[2], /59% less/);
  assert.match(subj[4], /Last note/);
  const last = buildWinbackEmail({ ...base, step: 5 });
  assert.match(last.html, /This was the last one/); assert.match(last.text, /last of these notes/);
  assert.match(winbackSubject({ ...base, step: 2, legs: base.legs.slice(0, 1) }), /free match\b/);
  for (const s of subj) assert.ok(!/\b(tips?|sure|guaranteed|banko|bonus)\b/i.test(s), s);
});

test('winback cron: scheduled once a day and took the old re-engagement slot', () => {
  const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons as Array<{ path: string; schedule: string }>;
  const w = crons.filter((c) => c.path.startsWith('/api/cron/winback'));
  assert.equal(w.length, 1); assert.equal(w[0].schedule, '30 7 * * *');
  assert.equal(crons.some((c) => c.path.includes('type=reengage')), false);
  assert.ok(crons.length <= 40, `cron count ${crons.length}`);
  assert.ok(winbackKey(3).startsWith(WINBACK_KEY_PREFIX));
});
