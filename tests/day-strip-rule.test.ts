import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripDays, horizonOf, publishDayFor, emptyReason, shownResultsTotal, parseOutcome, PUBLISH_LEAD_DAYS, FREEZE_HOURS, isProvisional } from '@/lib/site/day-strip-rule';

// Gün şeridi (overview-1.0): hangi günlerde tahmin var, ufuk nerede, boş gün ne anlatır.
const today = '2026-11-03';

test('strip: yesterday → today+5, consecutive, month boundary safe', () => {
  const days = stripDays('2026-10-30');
  assert.deepEqual(days, ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.equal(stripDays(today).length, 7);
});

test('horizon: last day from today with covered predictions; past days ignored', () => {
  const counts = [
    { date: '2026-11-02', covered: 40 },
    { date: '2026-11-03', covered: 12 },
    { date: '2026-11-04', covered: 9 },
    { date: '2026-11-05', covered: 0 },
    { date: '2026-11-06', covered: 0 },
  ];
  assert.equal(horizonOf(counts, today), '2026-11-04');
  assert.equal(horizonOf([{ date: '2026-11-02', covered: 40 }], today), null);
  assert.equal(horizonOf([], today), null);
});

test('publish day: PUBLISH_LEAD_DAYS before the match day (iki katmanlı ufuk: 5 gün ön tahmin)', () => {
  assert.equal(PUBLISH_LEAD_DAYS, 5);
  assert.equal(publishDayFor('2026-11-10'), '2026-11-05');
});

test('provisional: row written more than FREEZE_HOURS before kick-off; settled/unknown never', () => {
  assert.equal(FREEZE_HOURS, 48);
  const ko = '2026-11-09T20:00:00Z';
  assert.equal(isProvisional(ko, '2026-11-05T14:00:00Z'), true);   // 4 gün önce yazıldı → ön
  assert.equal(isProvisional(ko, '2026-11-07T21:00:00Z'), false);  // 47 sa kala → kesin
  assert.equal(isProvisional(ko, '2026-11-07T19:00:00Z'), true);   // 49 sa kala → ön
  assert.equal(isProvisional(ko, '2026-11-05T14:00:00Z', true), false);
  assert.equal(isProvisional(ko, null), false);
  assert.equal(isProvisional('bad', '2026-11-05T14:00:00Z'), false);
});

test('empty reason: past / pending beyond horizon / none inside the window', () => {
  assert.equal(emptyReason('2026-11-01', today, '2026-11-04'), 'past');
  assert.equal(emptyReason('2026-11-10', today, '2026-11-04'), 'pending');
  assert.equal(emptyReason('2026-11-10', today, null), 'pending');
  // Inside the engine window (today+5) an empty day is a genuinely empty calendar, not "not yet".
  assert.equal(emptyReason('2026-11-07', today, '2026-11-04'), 'none');
  assert.equal(emptyReason('2026-11-05', today, '2026-11-04'), 'none');
  assert.equal(emptyReason(today, today, null), 'none');
  // A day the horizon already reached is never "pending".
  assert.equal(emptyReason('2026-11-06', today, '2026-11-08'), 'none');
});

test('results outcome filter: page total follows the filter', () => {
  const totals = { total: 100, won: 58, lost: 42 };
  assert.equal(shownResultsTotal(null, totals), 100);
  assert.equal(shownResultsTotal('won', totals), 58);
  assert.equal(shownResultsTotal('lost', totals), 42);
  assert.equal(parseOutcome('lost'), 'lost');
  assert.equal(parseOutcome('won'), 'won');
  assert.equal(parseOutcome('void'), null);
  assert.equal(parseOutcome(undefined), null);
});
