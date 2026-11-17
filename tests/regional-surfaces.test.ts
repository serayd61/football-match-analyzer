import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGIONAL_MONTHLY, REGIONAL_YEARLY, offerFor, parseRegionFlags, pricesFromFlags, regionFlags, regionFlagsFromCookie,
} from '@/lib/site/regional';
import { PLAN_PRICES } from '@/lib/site/plans';
import { showRegionalStrip } from '@/components/site/RegionalStrip';
import { memberCountry, memberOffer } from '@/lib/site/member-country';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// Bölgesel fiyatın site genelinde gösterimi (2026-11-17). Önceki durum: indirim
// yalnız /pricing'de görünüyordu; kilitli seçim, ana sayfa, şerit ve e-postalar
// Afrika'daki ziyaretçiye de $9,90 yazıyordu.

const ON = { monthly: true, yearly: true };

test('çerez bayrağı: bölge içi ve fiyat açıksa m/y, aksi halde boş', () => {
  assert.equal(regionFlags('NG', ON), 'my');
  assert.equal(regionFlags('ng', ON), 'my', 'küçük harf de kabul');
  assert.equal(regionFlags('NG', { monthly: true, yearly: false }), 'm');
  assert.equal(regionFlags('NG', { monthly: false, yearly: true }), 'y');
  assert.equal(regionFlags('NG', { monthly: false, yearly: false }), '', 'Stripe fiyatı yoksa bölgesel gösterilmez');
  assert.equal(regionFlags('CH', ON), '');
  assert.equal(regionFlags(null, ON), '');
});

test('çerez okuma: yalnız tanınan değerler; başka çerezlerle karışmaz', () => {
  assert.equal(regionFlagsFromCookie('fa_ppp=my'), 'my');
  assert.equal(regionFlagsFromCookie('NEXT_LOCALE=en; fa_ppp=m; fa_twa=1'), 'm');
  assert.equal(regionFlagsFromCookie('xfa_ppp=my'), '', 'ad son ek eşleşmesi sayılmaz');
  assert.equal(regionFlagsFromCookie('fa_ppp=mx'), '');
  assert.equal(regionFlagsFromCookie(''), '');
  assert.equal(regionFlagsFromCookie(null), '');
  assert.equal(parseRegionFlags('ym'), '', 'sıra sabit: my');
});

test('bayraktan fiyat: m aylığı, y yıllığı değiştirir', () => {
  assert.deepEqual(pricesFromFlags('my'), { monthly: REGIONAL_MONTHLY.amount, yearly: REGIONAL_YEARLY.amount, regional: true });
  assert.deepEqual(pricesFromFlags('m'), { monthly: REGIONAL_MONTHLY.amount, yearly: PLAN_PRICES.yearly.amount, regional: true });
  assert.deepEqual(pricesFromFlags(''), { monthly: PLAN_PRICES.monthly.amount, yearly: PLAN_PRICES.yearly.amount, regional: false });
});

test('e-posta teklifi: bölgesel üyede kupon yok, yıllık plan kapalıysa yıllık yazılmaz', () => {
  const all = { monthly: true, yearly: true, yearlyPlan: true };
  assert.deepEqual(offerFor('NG', all), { monthly: 2.99, yearly: 19, regional: true, promo: false });
  assert.deepEqual(offerFor('DE', all), { monthly: 9.9, yearly: 49, regional: false, promo: true });
  assert.deepEqual(offerFor(null, all), { monthly: 9.9, yearly: 49, regional: false, promo: true }, 'ülke bilinmiyorsa standart');
  assert.equal(offerFor('NG', { monthly: true, yearly: false, yearlyPlan: false }).yearly, null);
});

test('üye ülkesi: son görülen öncelikli, yoksa kayıt ülkesi; haritada yoksa standart', () => {
  assert.equal(memberCountry({ last_country: 'KE', signup_country: 'NG' }), 'KE');
  assert.equal(memberCountry({ last_country: null, signup_country: 'NG' }), 'NG');
  assert.equal(memberCountry({}), null);
  assert.equal(memberOffer(new Map(), 'a@b.co').regional, false);
});

test('şerit: yalnız bölgesel ANONİM ziyaretçiye, web\'de, /pricing ve /login dışında', () => {
  assert.equal(showRegionalStrip('my', 'unauthenticated', '/en', 'web', false), true);
  assert.equal(showRegionalStrip('m', 'unauthenticated', '/tr/matches', 'web', false), true);
  assert.equal(showRegionalStrip('y', 'unauthenticated', '/en', 'web', false), false, 'metin aylık rakamı söyler');
  assert.equal(showRegionalStrip('', 'unauthenticated', '/en', 'web', false), false);
  assert.equal(showRegionalStrip('my', 'authenticated', '/en', 'web', false), false, 'üye UpgradeBanner görür');
  assert.equal(showRegionalStrip('my', 'loading', '/en', 'web', false), false);
  assert.equal(showRegionalStrip('my', 'unauthenticated', '/en/pricing', 'web', false), false);
  assert.equal(showRegionalStrip('my', 'unauthenticated', '/de/login', 'web', false), false);
  assert.equal(showRegionalStrip('my', 'unauthenticated', '/en', 'app-billing', false), false, 'uygulamada fiyatı Play gösterir');
  assert.equal(showRegionalStrip('my', 'unauthenticated', '/en', null, false), false, 'mod bilinmeden gösterilmez');
  assert.equal(showRegionalStrip('my', 'unauthenticated', '/en', 'web', true), false);
});

test('metinler: dört dilde sabit fiyat kalmadı, yer tutucular yerinde', () => {
  for (const [name, m] of [['en', en], ['de', de], ['it', it], ['tr', tr]] as [string, any][]) {
    assert.ok(m.paywall.bannerTitle.includes('{price}'), `${name} bannerTitle {price}`);
    assert.ok(!/9[.,]90/.test(m.paywall.bannerTitle), `${name} bannerTitle sabit fiyat içermez`);
    assert.ok(m.paywall.regionalKicker, `${name} regionalKicker`);
    for (const ph of ['{monthly}', '{stdMonthly}']) assert.ok(m.paywall.regionalStrip.includes(ph), `${name} regionalStrip ${ph}`);
    assert.ok(m.paywall.unlockLong.includes('{price}'), `${name} unlockLong {price}`);
  }
});
