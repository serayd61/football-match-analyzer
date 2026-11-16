import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONAL_COUNTRIES, REGIONAL_MONTHLY, REGIONAL_PLAN_IDS, REGIONAL_YEARLY, countryFromHeaders, isRegionalCountry, monthlyAmountFor, pricesFor, yearlyAmountFor } from '@/lib/site/regional';
import { PLAN_PRICES, yearlyPerMonth, yearlySavingPct } from '@/lib/site/plans';

// Bölgesel fiyat (2026-11-16): Afrika IP'sine yıllık $19 / aylık $2,99, diğerlerine $49 / $9,90.
// Ülke yalnız Vercel başlığından okunur; env yoksa herkes standart fiyatı görür.

const h = (map: Record<string, string>) => ({ get: (k: string) => map[k.toLowerCase()] ?? null });

test('Afrika listesi 54 BM üyesi, Nijerya içinde, Avrupa/ABD dışında', () => {
  assert.equal(REGIONAL_COUNTRIES.size, 54);
  for (const c of ['NG', 'ML', 'ZA', 'EG', 'MA', 'KE']) assert.equal(isRegionalCountry(c), true, c);
  for (const c of ['DE', 'CH', 'US', 'TR', 'BH', 'HU', 'IQ', 'IN']) assert.equal(isRegionalCountry(c), false, c);
  assert.equal(isRegionalCountry('ng'), true, 'küçük harf de geçer');
  assert.equal(isRegionalCountry(null), false);
  assert.equal(isRegionalCountry(''), false);
});

test('ülke Vercel başlığından okunur; bozuk değer null', () => {
  assert.equal(countryFromHeaders(h({ 'x-vercel-ip-country': 'NG' })), 'NG');
  assert.equal(countryFromHeaders(h({ 'x-vercel-ip-country': ' de ' })), 'DE');
  assert.equal(countryFromHeaders(h({ 'x-vercel-ip-country': 'XXX' })), null);
  assert.equal(countryFromHeaders(h({})), null);
});

test('yıllık seçimi: bölge + env açık → 19; aksi hâlde 49', () => {
  assert.deepEqual(yearlyAmountFor('NG', true), { amount: 19, regional: true });
  assert.deepEqual(yearlyAmountFor('DE', true), { amount: 49, regional: false });
  assert.deepEqual(yearlyAmountFor('NG', false), { amount: 49, regional: false }, 'env yoksa bölgesel kapalı');
  assert.deepEqual(yearlyAmountFor(null, true), { amount: 49, regional: false });
  assert.equal(REGIONAL_YEARLY.amount, 19);
  assert.equal(PLAN_PRICES.yearly.amount, 49);
});

test('aylık seçimi: bölge + env açık → 2.99; aksi hâlde 9.90', () => {
  assert.deepEqual(monthlyAmountFor('NG', true), { amount: 2.99, regional: true });
  assert.deepEqual(monthlyAmountFor('DE', true), { amount: 9.9, regional: false });
  assert.deepEqual(monthlyAmountFor('NG', false), { amount: 9.9, regional: false }, 'env yoksa bölgesel kapalı');
  assert.equal(REGIONAL_MONTHLY.amount, 2.99);
  assert.deepEqual([...REGIONAL_PLAN_IDS].sort(), ['PRO_PPP', 'PRO_YEARLY_PPP']);
});

test('pricesFor: ikisi birden; yalnız biri açıksa karışık ama regional=true', () => {
  assert.deepEqual(pricesFor('NG', { monthly: true, yearly: true }), { monthly: 2.99, yearly: 19, regional: true });
  assert.deepEqual(pricesFor('DE', { monthly: true, yearly: true }), { monthly: 9.9, yearly: 49, regional: false });
  assert.deepEqual(pricesFor('NG', { monthly: false, yearly: true }), { monthly: 9.9, yearly: 19, regional: true });
  assert.deepEqual(pricesFor('NG', { monthly: false, yearly: false }), { monthly: 9.9, yearly: 49, regional: false });
});

test('türetilen rakamlar: $19 → ayda $1.58; bölgesel yıllık 12×2.99’a göre %47, standart %59', () => {
  assert.equal(yearlyPerMonth(19), 1.58);
  assert.equal(yearlySavingPct(2.99, 19), 47);
  assert.equal(yearlySavingPct(PLAN_PRICES.monthly.amount, PLAN_PRICES.yearly.amount), 59);
  assert.equal(yearlyPerMonth(49), 4.08);
});

test('dört dilde regionalNote çevirisi var ve dört yer tutucu tam', async () => {
  const { readFileSync } = await import('node:fs');
  for (const l of ['en', 'tr', 'de', 'it']) {
    const txt = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).v2.pricing.regionalNote as string;
    for (const ph of ['{monthly}', '{yearly}', '{stdMonthly}', '{stdYearly}']) assert.ok(txt.includes(ph), `${l} ${ph}`);
  }
});
