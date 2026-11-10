// Google Play Billing — server side (2026-11-10).
//
// The Play app (android-app/, versionCode ≥ 5) sells the Pro subscription
// through Play Billing: the WebView bridge launches the native purchase flow
// and hands the resulting purchase token to POST /api/play/verify; later
// lifecycle changes (renewal, cancel, grace, revoke) arrive as Real-Time
// Developer Notifications on POST /api/play/rtdn. Both paths read the
// authoritative state from the Play Developer API (purchases.subscriptionsv2)
// and mirror it into the same `subscriptions` + `profiles.subscription_status`
// rows the Stripe webhook writes — one entitlement model, two providers.
//
// Env (all server-only, see docs/play-billing.md for the setup):
//   PLAY_PACKAGE_NAME          default pro.footballanalytics
//   PLAY_SERVICE_ACCOUNT_JSON  service-account key JSON (client_email + private_key)
//   PLAY_RTDN_SECRET           shared secret in the Pub/Sub push URL
//
// Pure functions (no I/O) live in play-shared.ts (unit-tested in
// tests/play-billing.test.ts) and are re-exported here.
import 'server-only';
import { createSign } from 'node:crypto';

export * from '@/lib/site/play-shared';

export const PLAY_PACKAGE = process.env.PLAY_PACKAGE_NAME || 'pro.footballanalytics';

// ---------------------------------------------------------------------------
// Play Developer API client (service account, no SDK dependency)
// ---------------------------------------------------------------------------

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

let cachedToken: { token: string; exp: number } | null = null;

function serviceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('PLAY_SERVICE_ACCOUNT_JSON missing');
  const parsed = JSON.parse(raw);
  if (!parsed.client_email || !parsed.private_key) throw new Error('service account JSON incomplete');
  return parsed;
}

export function playConfigured(): boolean {
  return !!process.env.PLAY_SERVICE_ACCOUNT_JSON;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** OAuth2 access token via a signed JWT (RS256) — cached until ~expiry. */
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = serviceAccount();
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${signer.sign(sa.private_key).toString('base64url')}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = { token: json.access_token, exp: now + (json.expires_in || 3600) };
  return cachedToken.token;
}

/** purchases.subscriptionsv2.get — the authoritative subscription state. */
export async function getPlaySubscription(purchaseToken: string): Promise<import('@/lib/site/play-shared').PlaySubscriptionV2> {
  const token = await accessToken();
  const url = `${API}/applications/${PLAY_PACKAGE}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) throw new Error(`subscriptionsv2.get failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * purchases.subscriptions.acknowledge (the v2 API has no acknowledge method).
 * Unacknowledged purchases are refunded by Play after 3 days, so the server
 * acknowledges right after it has granted the entitlement.
 */
export async function acknowledgePlayPurchase(productId: string, purchaseToken: string): Promise<void> {
  const token = await accessToken();
  const url = `${API}/applications/${PLAY_PACKAGE}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  });
  // 409/400 "already acknowledged" is fine — treat only transport-level errors as fatal.
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!/already/i.test(text)) throw new Error(`acknowledge failed: ${res.status} ${text}`);
  }
}
