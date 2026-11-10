// Google Play Billing — web side of the WebView bridge (2026-11-10).
//
// The Play app (android-app/, versionCode ≥ 5) extends window.FootballAnalyticsApp
// with billing methods. Calls are asynchronous: the page passes a requestId,
// the native side answers through window.__faPlayBillingResult(requestId, json).
// This module wraps that into Promises. Pure module (no React, no Next imports)
// so the selection helpers are unit-testable; every entry point guards on the
// bridge actually having the methods (older app versions do not).
//
// Flow (PlayPurchase.tsx): queryProducts → Play-localized prices → purchase →
// POST /api/play/verify with the purchase token → server grants Pro.

export type PlayBillingBridge = {
  /** True when the native BillingClient is connected and subscriptions are supported. */
  billingReady?: () => boolean;
  queryProducts?: (productIdsJson: string, requestId: number) => void;
  purchase?: (productId: string, offerToken: string, accountId: string, requestId: number) => void;
  queryPurchases?: (requestId: number) => void;
};

/** One subscription offer as reported by the native side. */
export type PlayOffer = {
  productId: string;
  basePlanId: string;
  offerToken: string;
  /** Play-localized, e.g. "₺99,99" — shown as-is, never reformatted. */
  formattedPrice: string;
  /** ISO 8601 period of the base phase, e.g. "P1M" / "P1Y". */
  billingPeriod: string;
};

export type PlayPurchaseResult = { purchaseToken: string; productId: string };
export type PlayOwnedPurchase = { purchaseToken: string; productIds: string[]; acknowledged: boolean };

/** Product ids sold in the Play app — must match Play Console and lib/site/play.ts. */
export const PLAY_PRODUCT_MONTHLY = 'fa_pro_monthly';
export const PLAY_PRODUCT_YEARLY = 'fa_pro_yearly';

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Pick the offer to sell per plan: the plain base-plan offer (no offerId) when
 * present, otherwise the first offer listed for the product. Unknown products
 * are ignored.
 */
export function selectPlayOffers(offers: PlayOffer[]): { monthly: PlayOffer | null; yearly: PlayOffer | null } {
  const pick = (productId: string): PlayOffer | null => {
    const forProduct = offers.filter((o) => o.productId === productId && o.offerToken);
    return forProduct.find((o) => /^P1[MY]$/.test(o.billingPeriod)) || forProduct[0] || null;
  };
  return { monthly: pick(PLAY_PRODUCT_MONTHLY), yearly: pick(PLAY_PRODUCT_YEARLY) };
}

/** Does this bridge expose a usable, connected billing client? */
export function playBillingAvailable(bridge: unknown): bridge is Required<PlayBillingBridge> {
  const b = bridge as PlayBillingBridge | null;
  if (!b || typeof b.billingReady !== 'function' || typeof b.queryProducts !== 'function' || typeof b.purchase !== 'function') return false;
  try {
    return b.billingReady() === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Request/response plumbing
// ---------------------------------------------------------------------------

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
const pending = new Map<number, Pending>();
let nextId = 1;
let installed = false;

export class PlayBillingError extends Error {
  code: 'cancelled' | 'pending' | 'timeout' | 'error';
  constructor(code: PlayBillingError['code'], message?: string) {
    super(message || code);
    this.code = code;
  }
}

/** Install the global callback the native side calls. Idempotent. */
function installCallback() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  (window as any).__faPlayBillingResult = (requestId: number, payload: unknown) => {
    const p = pending.get(requestId);
    if (!p) return;
    pending.delete(requestId);
    clearTimeout(p.timer);
    const r = payload as any;
    if (r && r.ok) p.resolve(r);
    else p.reject(new PlayBillingError(r?.code === 'cancelled' ? 'cancelled' : r?.code === 'pending' ? 'pending' : 'error', r?.message));
  };
}

function call<T>(invoke: (requestId: number) => void, timeoutMs: number): Promise<T> {
  installCallback();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new PlayBillingError('timeout'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      invoke(id);
    } catch (e: any) {
      pending.delete(id);
      clearTimeout(timer);
      reject(new PlayBillingError('error', e?.message));
    }
  });
}

// ---------------------------------------------------------------------------
// Bridge calls
// ---------------------------------------------------------------------------

export async function queryPlayProducts(bridge: Required<PlayBillingBridge>): Promise<PlayOffer[]> {
  const res = await call<{ ok: true; offers: PlayOffer[] }>(
    (id) => bridge.queryProducts(JSON.stringify([PLAY_PRODUCT_MONTHLY, PLAY_PRODUCT_YEARLY]), id),
    20_000,
  );
  return Array.isArray(res.offers) ? res.offers : [];
}

/**
 * Launch the native purchase flow. Resolves once Play reports the purchase
 * (the user can sit in the Play sheet for a while — generous timeout).
 * `accountId` is the signed-in app user id, stored by Play as
 * obfuscatedExternalAccountId so the server can attribute the purchase.
 */
export async function purchasePlaySubscription(
  bridge: Required<PlayBillingBridge>,
  offer: PlayOffer,
  accountId: string,
): Promise<PlayPurchaseResult> {
  const res = await call<{ ok: true; purchaseToken: string; productId: string }>(
    (id) => bridge.purchase(offer.productId, offer.offerToken, accountId, id),
    5 * 60_000,
  );
  return { purchaseToken: res.purchaseToken, productId: res.productId };
}

/** Owned (restorable) subscription purchases on this Google account. */
export async function queryPlayPurchases(bridge: PlayBillingBridge): Promise<PlayOwnedPurchase[]> {
  if (typeof bridge.queryPurchases !== 'function') return [];
  const res = await call<{ ok: true; purchases: PlayOwnedPurchase[] }>((id) => bridge.queryPurchases!(id), 20_000);
  return Array.isArray(res.purchases) ? res.purchases : [];
}

/** Hand a purchase token to the server; returns true when Pro was granted. */
export async function verifyPlayPurchase(purchaseToken: string): Promise<boolean> {
  const res = await fetch('/api/play/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchaseToken }),
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return !!data?.entitled;
}
