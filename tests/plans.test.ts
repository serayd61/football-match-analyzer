import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_PRICES, PROMO, money, promoActive, promoMonthly, yearlyPerMonth, yearlySavingPct } from '@/lib/site/plans';

test('yearly $49 reads as $4.08/month and 59% under 12 × $9.90', () => {
  assert.equal(PLAN_PRICES.monthly.amount, 9.9);
  assert.equal(PLAN_PRICES.yearly.amount, 49);
  assert.equal(yearlyPerMonth(), 4.08);
  assert.equal(yearlySavingPct(), 59);
  assert.equal(money(yearlyPerMonth()), '$4.08');
});

test('PRO50 is 50% off for 3 months on the monthly price and ends 31 Dec 2026 UTC', () => {
  assert.equal(PROMO.code, 'PRO50');
  assert.equal(promoMonthly(), 4.95);
  assert.equal(promoActive(Date.parse('2026-11-04T12:00:00Z')), true);
  assert.equal(promoActive(Date.parse('2026-12-31T23:59:00Z')), true);
  assert.equal(promoActive(Date.parse('2027-01-01T00:00:00Z')), false);
});
