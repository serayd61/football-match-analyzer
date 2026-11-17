import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TARGETS, mergeRegionalConfigs, pickRegionsVersion, usdMoney, fmt } from '../scripts/play-regional-prices';
import { REGIONAL_MONTHLY, REGIONAL_YEARLY } from '@/lib/site/regional';

// Play bölgesel fiyat betiği (2026-11-16): saf yarısı. Afrika bölgeleri yeni
// fiyatı alır, Play'in desteklemediği Afrika ülkeleri atlanır, diğer bölgeler
// (DE, US…) olduğu gibi kalır.

test('hedefler web ile aynı rakamlar: $2.99 aylık, $19 yıllık', () => {
  assert.deepEqual(TARGETS.map((t) => [t.productId, t.basePlanId, t.usd]), [['fa_pro_monthly', 'monthly', REGIONAL_MONTHLY.amount], ['fa_pro_yearly', 'yearly', REGIONAL_YEARLY.amount]]);
  assert.deepEqual(usdMoney(2.99), { currencyCode: 'USD', units: '2', nanos: 990_000_000 });
  assert.deepEqual(usdMoney(19), { currencyCode: 'USD', units: '19', nanos: 0 });
  assert.equal(fmt({ currencyCode: 'NGN', units: '4500', nanos: 0 }), '4500 NGN');
  assert.equal(fmt({ currencyCode: 'USD', units: '2', nanos: 990_000_000 }), '2.99 USD');
});

test('merge: Afrika değişir, diğerleri korunur, desteklenmeyen atlanır', () => {
  const existing = [
    { regionCode: 'DE', newSubscriberAvailability: true, price: { currencyCode: 'EUR', units: '9', nanos: 490_000_000 } },
    { regionCode: 'NG', newSubscriberAvailability: true, price: { currencyCode: 'NGN', units: '15000', nanos: 0 } },
  ];
  const converted = { DE: { currencyCode: 'EUR', units: '2', nanos: 790_000_000 }, NG: { currencyCode: 'NGN', units: '4500', nanos: 0 }, ZA: { currencyCode: 'ZAR', units: '55', nanos: 0 } };
  const { regionalConfigs, changed, skipped } = mergeRegionalConfigs(existing, converted, new Set(['NG', 'ZA', 'SD']));
  assert.deepEqual(changed, ['NG', 'ZA']);
  assert.deepEqual(skipped, ['SD'], 'Play desteklemiyorsa atlanır');
  const by = Object.fromEntries(regionalConfigs.map((c) => [c.regionCode, c]));
  assert.equal(fmt(by.DE.price), '9.49 EUR', 'Almanya dokunulmaz');
  assert.equal(fmt(by.NG.price), '4500 NGN');
  assert.equal(fmt(by.ZA.price), '55 ZAR');
  assert.equal(by.ZA.newSubscriberAvailability, true);
  assert.equal(regionalConfigs.length, 3);
});

// 2026-11-17: sabit '2022/02' ile patch 400 döndü ("Invalid currency for region
// code AR … Expected USD but got ARS"). Sürüm Play'in convert yanıtından gelir.
test('bölge sürümü: önce elle verilen, sonra Play yanıtı; ikisi de yoksa hata', () => {
  assert.equal(pickRegionsVersion(undefined, '2025/03'), '2025/03');
  assert.equal(pickRegionsVersion('2025/01', '2025/03'), '2025/01', 'elle verilen kazanır');
  assert.throws(() => pickRegionsVersion(undefined, undefined), /bölge sürümü/);
  assert.throws(() => pickRegionsVersion('latest', undefined), /bölge sürümü/);
});
