// Google Play Billing — pure, I/O-free half of src/lib/site/play.ts
// (2026-11-10). Lives in its own module WITHOUT `server-only` so
// tests/play-billing.test.ts can import it under node:test; the API client in
// play.ts re-exports everything from here.

// ---------------------------------------------------------------------------
// Products — must match the subscription products created in Play Console
// (Monetize → Products → Subscriptions) and the ids the Android bridge queries.
// ---------------------------------------------------------------------------

/** Play productId → app plan. Mirrors src/lib/site/plans.ts prices. */
export const PLAY_PRODUCTS: Record<string, { plan: 'PRO' | 'PRO_YEARLY' }> = {
  fa_pro_monthly: { plan: 'PRO' },
  fa_pro_yearly: { plan: 'PRO_YEARLY' },
};

export function isKnownPlayProduct(productId: string | null | undefined): boolean {
  return !!productId && productId in PLAY_PRODUCTS;
}

// ---------------------------------------------------------------------------
// Pure mapping: subscriptionsv2 state -> our subscription row
// ---------------------------------------------------------------------------

/** Subset of purchases.subscriptionsv2.get we rely on. */
export type PlaySubscriptionV2 = {
  subscriptionState?: string;
  acknowledgementState?: string;
  linkedPurchaseToken?: string | null;
  startTime?: string;
  testPurchase?: unknown;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<{ productId?: string; expiryTime?: string }>;
};

export type PlayEntitlement = {
  /** Does this purchase currently grant Pro access? */
  entitled: boolean;
  /** Value for subscriptions.status (mirrors the Stripe vocabulary). */
  status: 'active' | 'past_due' | 'canceled';
  /** profiles.subscription_status value. */
  profileStatus: 'active' | 'free';
  productId: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  acknowledged: boolean;
  test: boolean;
};

/**
 * Map a subscriptionsv2 resource to our entitlement vocabulary.
 *
 * Play states (developer docs):
 *  ACTIVE            paid, auto-renewing             → entitled
 *  CANCELED          auto-renew off, NOT yet expired → entitled until expiry
 *  IN_GRACE_PERIOD   payment failed, access kept     → entitled (Play policy)
 *  ON_HOLD           payment failed, access revoked  → not entitled
 *  PAUSED / EXPIRED / PENDING / anything else        → not entitled
 */
export function playEntitlement(sub: PlaySubscriptionV2, now: Date = new Date()): PlayEntitlement {
  const state = (sub.subscriptionState || '').replace('SUBSCRIPTION_STATE_', '');
  const line = sub.lineItems?.[0];
  const productId = line?.productId ?? null;
  const periodEnd = line?.expiryTime ?? null;
  const notExpired = !periodEnd || Date.parse(periodEnd) > now.getTime();

  const entitled =
    (state === 'ACTIVE' || state === 'IN_GRACE_PERIOD' || state === 'CANCELED') && notExpired;

  const status: PlayEntitlement['status'] = entitled
    ? 'active'
    : state === 'ON_HOLD' || state === 'IN_GRACE_PERIOD'
      ? 'past_due'
      : 'canceled';

  return {
    entitled,
    status,
    profileStatus: entitled ? 'active' : 'free',
    productId,
    periodEnd,
    cancelAtPeriodEnd: state === 'CANCELED',
    acknowledged: sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    test: sub.testPurchase != null,
  };
}

// ---------------------------------------------------------------------------
// Pure parsing: RTDN Pub/Sub push body -> notification
// ---------------------------------------------------------------------------

/** https://developer.android.com/google/play/billing/rtdn-reference */
export const RTDN_TYPES: Record<number, string> = {
  1: 'RECOVERED', 2: 'RENEWED', 3: 'CANCELED', 4: 'PURCHASED', 5: 'ON_HOLD',
  6: 'IN_GRACE_PERIOD', 7: 'RESTARTED', 9: 'DEFERRED', 10: 'PAUSED',
  11: 'PAUSE_SCHEDULE_CHANGED', 12: 'REVOKED', 13: 'EXPIRED',
  20: 'PENDING_PURCHASE_CANCELED',
};

export type RtdnMessage =
  | { kind: 'test' }
  | { kind: 'voided'; purchaseToken: string }
  | { kind: 'subscription'; purchaseToken: string; type: number; typeName: string; subscriptionId: string | null }
  | { kind: 'ignored'; reason: string };

/**
 * Decode a Pub/Sub push envelope ({ message: { data: base64(json) } }).
 * Never throws: malformed input becomes { kind: 'ignored' } so the endpoint
 * can 200 it away instead of making Pub/Sub retry forever.
 */
export function parseRtdn(body: unknown): RtdnMessage {
  try {
    const data = (body as any)?.message?.data;
    if (typeof data !== 'string') return { kind: 'ignored', reason: 'no message.data' };
    const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (decoded.testNotification) return { kind: 'test' };
    const voided = decoded.voidedPurchaseNotification;
    if (voided?.purchaseToken) return { kind: 'voided', purchaseToken: voided.purchaseToken };
    const sub = decoded.subscriptionNotification;
    if (sub?.purchaseToken) {
      const type = Number(sub.notificationType) || 0;
      return {
        kind: 'subscription',
        purchaseToken: sub.purchaseToken,
        type,
        typeName: RTDN_TYPES[type] || `UNKNOWN_${type}`,
        subscriptionId: sub.subscriptionId || null,
      };
    }
    return { kind: 'ignored', reason: 'no subscription/voided/test payload' };
  } catch (e: any) {
    return { kind: 'ignored', reason: `decode failed: ${e?.message}` };
  }
}
