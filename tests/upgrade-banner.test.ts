import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upgradeBannerKind } from '@/components/site/UpgradeBanner';
import { playBillingSupported, playBillingAvailable, resolveAppMode, waitForPlayBilling } from '@/lib/site/play-billing';
import { yearlySavingPct } from '@/lib/site/plans';
import en from '../messages/en.json';
import de from '../messages/de.json';
import it from '../messages/it.json';
import tr from '../messages/tr.json';

// Pro şeridi (2026-11-14): Pro olmayan üyeye her sayfada; web'de ve Play
// uygulamasında (v1.3.0+) planlara, köprüsüz eski uygulamada güncellemeye gider.

test('banner: trial and expired members, on every page except pricing and login', () => {
  for (const s of ['trial', 'expired'] as const) {
    for (const p of ['/', '/matches', '/en/performance', '/dashboard', '/predictions', '/de/predictions/5', '/picks', '/coupon', '/account', '/pricing-guide']) {
      assert.equal(upgradeBannerKind(s, p, 'web', false), 'offer', `${s} ${p}`);
    }
    for (const p of ['/pricing', '/tr/pricing', '/login', '/en/login']) assert.equal(upgradeBannerKind(s, p, 'web', false), null, `${s} ${p}`);
  }
  for (const s of ['anon', 'pro', null] as const) assert.equal(upgradeBannerKind(s, '/', 'web', false), null, String(s));
});

test('banner: Play app sells through Play Billing, an old app is asked to update', () => {
  assert.equal(upgradeBannerKind('expired', '/', 'app-billing', false), 'offer');
  assert.equal(upgradeBannerKind('trial', '/predictions', 'app-billing', false), 'offer');
  // No billing bridge: never a plans link (Play payments policy), only the update prompt.
  assert.equal(upgradeBannerKind('expired', '/', 'app-legacy', false), 'update');
  assert.equal(upgradeBannerKind('trial', '/matches', 'app-legacy', false), 'update');
  assert.equal(upgradeBannerKind('pro', '/', 'app-legacy', false), null);
  assert.equal(upgradeBannerKind('expired', '/pricing', 'app-legacy', false), null);
});

test('banner: hidden until the mode is known, when closed, and for trial members without a yearly plan', () => {
  assert.equal(upgradeBannerKind('expired', '/', null, false), null);
  assert.equal(upgradeBannerKind('expired', '/', 'web', true), null);
  assert.equal(upgradeBannerKind('expired', '/', 'app-legacy', true), null);
  // Yearly Stripe price missing: only the old "trial ended" message makes sense on the web.
  assert.equal(upgradeBannerKind('trial', '/', 'web', false, false), null);
  assert.equal(upgradeBannerKind('expired', '/', 'web', false, false), 'offer');
  // The app's yearly plan lives in Play, independent of the Stripe env.
  assert.equal(upgradeBannerKind('trial', '/', 'app-billing', false, false), 'offer');
});

test('app mode: billing bridge present vs old app vs web', () => {
  const full = { billingReady: () => false, queryProducts: () => {}, purchase: () => {}, queryPurchases: () => {} };
  assert.equal(playBillingSupported(full), true, 'supported even while still connecting');
  assert.equal(playBillingAvailable(full), false);
  assert.equal(playBillingAvailable({ ...full, billingReady: () => true }), true);
  assert.equal(playBillingAvailable({ ...full, billingReady: () => { throw new Error('x'); } }), false);
  for (const b of [null, undefined, {}, { share: () => {} }, { billingReady: () => true }]) assert.equal(playBillingSupported(b), false);
  assert.equal(resolveAppMode(false, full), 'web');
  assert.equal(resolveAppMode(true, full), 'app-billing');
  assert.equal(resolveAppMode(true, { share: () => {} }), 'app-legacy');
  assert.equal(resolveAppMode(true, null), 'app-legacy');
});

test('waitForPlayBilling: resolves once the native client connects, gives up after the tries', async () => {
  let calls = 0;
  const late = { billingReady: () => ++calls >= 3, queryProducts: () => {}, purchase: () => {}, queryPurchases: () => {} };
  const noSleep = async () => {};
  assert.equal(await waitForPlayBilling(late, 5, 1, noSleep), true);
  const never = { ...late, billingReady: () => false };
  assert.equal(await waitForPlayBilling(never, 3, 1, noSleep), false);
});

test('strings exist in all four locales, the claim matches the prices, no gambling-coded wording', () => {
  // "more than 50%" in the app and "{pct}%" on the web must stay true (plans.ts).
  assert.ok(yearlySavingPct() > 50, `yearly saving ${yearlySavingPct()}%`);
  for (const [name, m] of Object.entries({ en, de, it, tr }) as Array<[string, any]>) {
    for (const k of ['bannerKicker', 'bannerTitle', 'bannerLead', 'bannerCta', 'bannerClose', 'offerKicker', 'offerTitleYearly', 'offerTitleApp', 'updateKicker', 'updateTitle', 'appUpdateCta', 'twaLead']) {
      assert.ok(m.paywall?.[k], `${name} paywall.${k}`);
      assert.ok(!/18\+|bookmaker|buchmacher|bahisçi|\btips?\b|\bpicks?\b/i.test(m.paywall[k]), `${name} ${k} wording`);
    }
    assert.ok(m.paywall.offerTitleYearly.includes('{pct}'), `${name} offerTitleYearly placeholder`);
    assert.ok(m.paywall.offerTitleApp.includes('50'), `${name} offerTitleApp`);
    for (const k of ['appUpdateNote', 'appUpdateCta', 'playUnavailable', 'playRetry']) assert.ok(m.v2?.pricing?.[k], `${name} v2.pricing.${k}`);
    // The dead-end sentence must be gone from the in-app paywall and pricing card.
    assert.ok(!('twaNote' in m.v2.pricing), `${name} v2.pricing.twaNote removed`);
  }
  assert.ok(!/not available in this app/i.test(en.paywall.twaLead));
});
