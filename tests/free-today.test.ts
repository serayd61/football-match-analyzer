import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeFromPosts, freeViewFor } from '../src/lib/site/free-today-rule';
import { encodeSentLegs, parseSentLegs, settleSent, isWinningDay, winbackRecordKey, type SentLeg } from '../src/lib/site/winback-results';
import { buildWinbackEmail, winbackSubject, type WinbackEmailInput } from '../src/lib/email-winback';

// Günün ücretsiz maçları + e-postadaki sonuç bloğu (2026-11-14).

const T = '2026-11-21', Y = '2026-11-20';

test('free list: only posted daily / winback rows of today and yesterday count', () => {
  const r = freeFromPosts([
    { kind: 'daily', day: T, status: 'posted', fixture_ids: [11, 12, 13] },
    { kind: 'daily', day: T, status: 'posted', fixture_ids: [11, 12, 13] },   // second platform, same list
    { kind: 'winback', day: T, status: 'posted', fixture_ids: [12, 14] },
    { kind: 'daily', day: Y, status: 'posted', fixture_ids: [21] },
    { kind: 'daily', day: '2026-11-19', status: 'posted', fixture_ids: [31] }, // too old
    { kind: 'daily', day: T, status: 'skipped', fixture_ids: [41] },           // never published
    { kind: 'coupon', day: T, status: 'posted', fixture_ids: [51] },           // other post kinds stay Pro
    { kind: 'result', day: T, status: 'posted', fixture_ids: [61] },
  ], T, Y);
  assert.deepEqual(r.today.sort(), [11, 12, 13, 14]);
  assert.deepEqual(r.open.sort(), [11, 12, 13, 14, 21]);
});

test('free list: empty day, bad ids and a missing yesterday', () => {
  assert.deepEqual(freeFromPosts([], T, Y), { today: [], open: [] });
  assert.deepEqual(freeFromPosts([{ kind: 'daily', day: T, status: 'posted', fixture_ids: ['7', 0, -3, 'x', null, 8.5] }], T, Y), { today: [7], open: [7] });
  assert.deepEqual(freeFromPosts([{ kind: 'daily', day: T, status: 'posted', fixture_ids: null }], T, Y), { today: [], open: [] });
  assert.deepEqual(freeFromPosts([{ kind: 'daily', day: Y, status: 'posted', fixture_ids: [21] }], T), { today: [], open: [] });
  // timestamp-typed day column still matches
  assert.deepEqual(freeFromPosts([{ kind: 'daily', day: `${T}T00:00:00+00:00`, status: 'posted', fixture_ids: [9] }], T, Y).today, [9]);
});

test('free view: only a signed-in member whose access ended', () => {
  assert.equal(freeViewFor('expired', true), true);
  assert.equal(freeViewFor('expired', false), false);
  assert.equal(freeViewFor('anon', true), false);   // visitors must register
  assert.equal(freeViewFor('trial', true), false);  // already sees everything, no "free" banner
  assert.equal(freeViewFor('pro', true), false);
});

const SENT: SentLeg[] = [
  { fixtureId: 1, home: 'Alpha', away: 'Beta', market: 'ou25', selection: 'over', label: 'Over 2.5' },
  { fixtureId: 2, home: 'Gamma', away: 'Delta', market: 'btts', selection: 'yes', label: 'BTTS Yes' },
  { fixtureId: 3, home: 'Epsilon', away: 'Zeta', market: '1x2', selection: '1', label: 'Epsilon win' },
];

test('sent record: round trip, and broken rows are dropped rather than guessed', () => {
  assert.deepEqual(parseSentLegs(encodeSentLegs(SENT)), SENT);
  assert.deepEqual(parseSentLegs(null), []);
  assert.deepEqual(parseSentLegs('not json'), []);
  assert.deepEqual(parseSentLegs('{"a":1}'), []);
  assert.deepEqual(parseSentLegs(JSON.stringify([{ fixtureId: 1, home: 'A', away: 'B', market: 'corners', selection: 'x', label: 'L' }, { fixtureId: 0, home: 'A', away: 'B', market: 'ou25', label: 'L' }, { fixtureId: 5, home: 'A', away: '', market: 'ou25', label: 'L' }])), []);
  assert.equal(winbackRecordKey('2026-11-21'), 'winback|2026-11-21|email|en');
});

test('results: wins and misses are both listed; unfinished matches are left out', () => {
  const r = settleSent(SENT, new Map([[1, [2, 1]], [2, [1, 0]], [3, [0, 0]]]))!;
  assert.equal(r.n, 3); assert.equal(r.won, 1);
  assert.deepEqual(r.rows.map((x) => [x.score, x.won]), [['2–1', true], ['1–0', false], ['0–0', false]]);
  const part = settleSent(SENT, new Map([[3, [3, 1]]]))!;
  assert.deepEqual([part.n, part.won, part.rows[0].home], [1, 1, 'Epsilon']);
  assert.equal(settleSent(SENT, new Map()), null);
  assert.equal(settleSent([], new Map([[1, [1, 1]]])), null);
});

test('winning day = majority correct', () => {
  assert.equal(isWinningDay({ n: 3, won: 2 }), true);
  assert.equal(isWinningDay({ n: 3, won: 1 }), false);
  assert.equal(isWinningDay({ n: 2, won: 1 }), false);
  assert.equal(isWinningDay({ n: 1, won: 1 }), true);
  assert.equal(isWinningDay(null), false);
});

const base = (over: Partial<WinbackEmailInput> = {}): WinbackEmailInput => ({
  step: 2, maxSteps: 5, name: 'Sam', dateLabel: '21 November', tz: 'CET',
  legs: [
    { time: '18:30', home: 'Alpha', away: 'Beta', league: 'League A', selection: 'Over 2.5', modelPct: 64, url: 'https://footballanalytics.pro/predictions/1?utm_source=email' },
    { time: '21:00', home: 'Gamma', away: 'Delta', league: 'League B', selection: 'Gamma win', modelPct: 58, url: 'https://footballanalytics.pro/predictions/2?utm_source=email' },
  ],
  stats: null, monthly: 9.9, yearly: 49, savingPct: 59, promoCode: null,
  pricingUrl: 'https://x/pricing', matchesUrl: 'https://x/matches', playUrl: 'https://x/play', telegramUrl: 'https://t.me/x', unsubscribeUrl: 'https://x/unsub',
  ...over,
});
const WIN = { dateLabel: '18 November', n: 3, won: 2, rows: [
  { home: 'Eta', away: 'Theta', label: 'Over 2.5', score: '3–1', won: true },
  { home: 'Iota', away: 'Kappa', label: 'BTTS Yes', score: '1–0', won: false },
  { home: 'Lambda', away: 'Mu', label: 'Lambda win', score: '2–0', won: true },
] };

test('email: match rows link to the match page', () => {
  const m = buildWinbackEmail(base());
  assert.ok(m.html.includes('href="https://footballanalytics.pro/predictions/1?utm_source=email"'));
  assert.ok(m.html.includes('Full analysis, free'));
  assert.ok(m.text.includes('https://footballanalytics.pro/predictions/2?utm_source=email'));
  const plain = buildWinbackEmail(base({ legs: [{ time: '18:30', home: 'Alpha', away: 'Beta', league: 'League A', selection: 'Over 2.5', modelPct: 64 }] }));
  assert.ok(!plain.html.includes('Full analysis, free'));
  assert.ok(!plain.html.includes('opens in full today'));
});

test('email: previous results open the mail, misses included; no record means no block', () => {
  const m = buildWinbackEmail(base({ last: WIN }));
  assert.ok(m.html.includes('Last time · 18 November: 2 of 3 correct'));
  assert.ok(m.html.includes('Missed') && m.html.includes('Correct'));
  assert.ok(m.html.indexOf('Last time ·') < m.html.indexOf("Today's free matches ·"), 'results come before today\'s list');
  assert.ok(m.text.includes('Iota 1–0 Kappa: BTTS Yes, missed'));
  for (const none of [undefined, null, { dateLabel: 'x', n: 0, won: 0, rows: [] }]) {
    const e = buildWinbackEmail(base({ last: none as any }));
    assert.ok(!e.html.includes('Last time'));
    assert.ok(!e.text.includes('Last time'));
  }
});

test('email subject: a winning day is promoted, a losing day and the last step are not', () => {
  assert.equal(winbackSubject(base({ last: WIN })), "Last time: 2 of 3 correct. Today's 2 free matches are open");
  assert.equal(winbackSubject(base({ last: { ...WIN, won: 1 } })), "Today's 2 free matches from the model");
  assert.ok(winbackSubject(base({ step: 5, last: WIN })).startsWith('Last note from us'));
  assert.equal(winbackSubject(base({ last: { ...WIN, n: 1, won: 1 }, legs: base().legs.slice(0, 1) })), "Last time: 1 of 1 correct. Today's free match is open");
  // no banned promotional wording anywhere in the mail
  const all = `${buildWinbackEmail(base({ last: WIN })).html} ${winbackSubject(base({ last: WIN }))}`.toLowerCase();
  for (const w of ['sure bet', 'banker', 'guaranteed', 'tipster', 'bonus']) assert.ok(!all.includes(w), w);
});
