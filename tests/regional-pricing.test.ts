import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONAL_COUNTRIES, REGIONAL_YEARLY, countryFromHeaders, isRegionalCountry, yearlyAmountFor } from '@/lib/site/regional';
import { PLAN_PRICES, yearlyPerMonth, yearlySavingPct } from '@/lib/site/plans';

// Bölgesel yıllık fiyat (2026-11-16): Afrika IP'sine $19, diğerlerine $49.
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

test('fiyat seçimi: bölge + env açık → 19; aksi hâlde 49', () => {
  assert.deepEqual(yearlyAmountFor('NG', true), { amount: 19, regional: true });
  assert.deepEqual(yearlyAmountFor('DE', true), { amount: 49, regional: false });
  assert.deepEqual(yearlyAmountFor('NG', false), { amount: 49, regional: false }, 'env yoksa bölgesel kapalı');
  assert.deepEqual(yearlyAmountFor(null, true), { amount: 49, regional: false });
  assert.equal(REGIONAL_YEARLY.amount, 19);
  assert.equal(PLAN_PRICES.yearly.amount, 49);
});

test('türetilen rakamlar: $19 → ayda $1.58, aylık 12×9.90’a göre %84 tasarruf', () => {
  assert.equal(yearlyPerMonth(19), 1.58);
  assert.equal(yearlySavingPct(PLAN_PRICES.monthly.amount, 19), 84);
  assert.equal(yearlyPerMonth(49), 4.08);
});

test('dört dilde regionalNote çevirisi var ve yer tutucular tam', async () => {
  const { readFileSync } = await import('node:fs');
  for (const l of ['en', 'tr', 'de', 'it']) {
    const txt = JSON.parse(readFileSync(`messages/${l}.json`, 'utf8')).v2.pricing.regionalNote as string;
    assert.ok(txt.includes('{yearly}') && txt.includes('{standard}'), l);
  }
});
