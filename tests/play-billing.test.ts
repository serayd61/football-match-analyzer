import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRtdn, playEntitlement, type PlaySubscriptionV2 } from '@/lib/site/play-shared';
import { selectPlayOffers, type PlayOffer } from '@/lib/site/play-billing';

const NOW = new Date('2026-11-10T12:00:00Z');
const FUTURE = '2026-12-10T12:00:00.000Z';
const PAST = '2026-11-01T12:00:00.000Z';

const sub = (state: string, expiry: string, extra: Partial<PlaySubscriptionV2> = {}): PlaySubscriptionV2 => ({
  subscriptionState: `SUBSCRIPTION_STATE_${state}`,
  lineItems: [{ productId: 'fa_pro_monthly', expiryTime: expiry }],
  ...extra,
});

test('playEntitlement: ACTIVE grants access, EXPIRED/ON_HOLD/PAUSED do not', () => {
  const active = playEntitlement(sub('ACTIVE', FUTURE), NOW);
  assert.deepEqual(
    [active.entitled, active.status, active.profileStatus, active.productId, active.periodEnd],
    [true, 'active', 'active', 'fa_pro_monthly', FUTURE],
  );

  assert.equal(playEntitlement(sub('EXPIRED', PAST), NOW).entitled, false);
  const hold = playEntitlement(sub('ON_HOLD', FUTURE), NOW);
  assert.deepEqual([hold.entitled, hold.status, hold.profileStatus], [false, 'past_due', 'free']);
  assert.equal(playEntitlement(sub('PAUSED', FUTURE), NOW).entitled, false);
});

test('playEntitlement: CANCELED keeps access until expiry (cancel_at_period_end), grace period keeps access', () => {
  const canceled = playEntitlement(sub('CANCELED', FUTURE), NOW);
  assert.deepEqual([canceled.entitled, canceled.status, canceled.cancelAtPeriodEnd], [true, 'active', true]);

  // Auto-renew off AND past expiry: no access.
  assert.equal(playEntitlement(sub('CANCELED', PAST), NOW).entitled, false);

  const grace = playEntitlement(sub('IN_GRACE_PERIOD', FUTURE), NOW);
  assert.deepEqual([grace.entitled, grace.status], [true, 'active']);
});

test('playEntitlement: acknowledgement and test-purchase flags come through', () => {
  const acked = playEntitlement(sub('ACTIVE', FUTURE, { acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }), NOW);
  assert.equal(acked.acknowledged, true);
  const fresh = playEntitlement(sub('ACTIVE', FUTURE, { acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', testPurchase: {} }), NOW);
  assert.deepEqual([fresh.acknowledged, fresh.test], [false, true]);
});

const push = (payload: object) => ({ message: { data: Buffer.from(JSON.stringify(payload)).toString('base64') } });

test('parseRtdn: subscription, test and voided notifications; garbage never throws', () => {
  const s = parseRtdn(push({ subscriptionNotification: { notificationType: 4, purchaseToken: 'tok1', subscriptionId: 'fa_pro_monthly' } }));
  assert.deepEqual(s, { kind: 'subscription', purchaseToken: 'tok1', type: 4, typeName: 'PURCHASED', subscriptionId: 'fa_pro_monthly' });

  assert.equal(parseRtdn(push({ testNotification: { version: '1.0' } })).kind, 'test');
  assert.deepEqual(parseRtdn(push({ voidedPurchaseNotification: { purchaseToken: 'tok2' } })), { kind: 'voided', purchaseToken: 'tok2' });

  assert.equal(parseRtdn(null).kind, 'ignored');
  assert.equal(parseRtdn({ message: { data: '%%%not-base64-json%%%' } }).kind, 'ignored');
  assert.equal(parseRtdn(push({ somethingElse: 1 })).kind, 'ignored');
});

test('selectPlayOffers: base-plan offer wins over intro offer, unknown products ignored', () => {
  const offer = (productId: string, billingPeriod: string, offerToken: string): PlayOffer =>
    ({ productId, basePlanId: 'base', offerToken, formattedPrice: '$9.90', billingPeriod });

  const offers = [
    offer('fa_pro_monthly', 'P1W', 'intro-token'),   // intro phase offer
    offer('fa_pro_monthly', 'P1M', 'monthly-token'), // plain base plan
    offer('fa_pro_yearly', 'P1Y', 'yearly-token'),
    offer('some_other_product', 'P1M', 'x'),
  ];
  const picked = selectPlayOffers(offers);
  assert.equal(picked.monthly?.offerToken, 'monthly-token');
  assert.equal(picked.yearly?.offerToken, 'yearly-token');

  // Yearly product not configured in Play yet → null, monthly falls back to the only offer.
  const partial = selectPlayOffers([offer('fa_pro_monthly', 'P1W', 'only-token')]);
  assert.equal(partial.monthly?.offerToken, 'only-token');
  assert.equal(partial.yearly, null);
});
