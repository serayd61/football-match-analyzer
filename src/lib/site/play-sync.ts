// Google Play Billing — DB sync (2026-11-10).
//
// Mirrors a Play subscription state into the same rows the Stripe webhook
// writes: `subscriptions` (keyed by user_id, now with provider/play_* columns,
// migration 20261110010000_play_billing.sql) and `profiles.subscription_status`
// (what checkUserAccess reads). Used by /api/play/verify (purchase, with a
// signed-in user) and /api/play/rtdn (lifecycle, user resolved from the token).
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  acknowledgePlayPurchase,
  isKnownPlayProduct,
  playEntitlement,
  type PlaySubscriptionV2,
} from '@/lib/site/play';

export type PlaySyncResult =
  | { ok: true; userId: string; status: string; entitled: boolean; acknowledged: boolean }
  | { ok: false; reason: 'no-user' | 'token-bound-elsewhere'; boundUserId?: string };

/** Find the user a purchase token belongs to (token → linked token → obfuscated account id). */
export async function resolvePlayUser(
  db: SupabaseClient,
  purchaseToken: string,
  sub: PlaySubscriptionV2,
): Promise<{ userId: string | null; viaLinkedToken: boolean }> {
  const byToken = await db
    .from('subscriptions')
    .select('user_id')
    .eq('play_purchase_token', purchaseToken)
    .maybeSingle();
  if (byToken.data?.user_id) return { userId: byToken.data.user_id, viaLinkedToken: false };

  // Upgrade / resubscribe: Play issues a new token and points back at the old
  // one via linkedPurchaseToken — the old row's owner is the same user.
  if (sub.linkedPurchaseToken) {
    const byLinked = await db
      .from('subscriptions')
      .select('user_id')
      .eq('play_purchase_token', sub.linkedPurchaseToken)
      .maybeSingle();
    if (byLinked.data?.user_id) return { userId: byLinked.data.user_id, viaLinkedToken: true };
  }

  // The bridge passes the app user id as obfuscatedExternalAccountId at
  // purchase time, so even a purchase that never reached /api/play/verify
  // (app killed mid-flow) can be attributed from the RTDN alone.
  const obfuscated = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (obfuscated) {
    const byId = await db.from('users').select('id').eq('id', obfuscated).maybeSingle();
    if (byId.data?.id) return { userId: byId.data.id, viaLinkedToken: false };
  }

  return { userId: null, viaLinkedToken: false };
}

/**
 * Write the subscription + profile rows for a verified Play state and
 * acknowledge the purchase when needed. `explicitUserId` comes from the
 * signed-in /api/play/verify call; RTDN passes null and resolves via the token.
 */
export async function applyPlayState(
  db: SupabaseClient,
  purchaseToken: string,
  sub: PlaySubscriptionV2,
  explicitUserId: string | null = null,
): Promise<PlaySyncResult> {
  const ent = playEntitlement(sub);
  const resolved = await resolvePlayUser(db, purchaseToken, sub);

  // A token already bound to a different account must not be re-bound by a
  // second signed-in user (token replay).
  if (explicitUserId && resolved.userId && resolved.userId !== explicitUserId) {
    return { ok: false, reason: 'token-bound-elsewhere', boundUserId: resolved.userId };
  }

  const userId = explicitUserId || resolved.userId;
  if (!userId) return { ok: false, reason: 'no-user' };

  const payload: Record<string, unknown> = {
    provider: 'play',
    play_purchase_token: purchaseToken,
    play_product_id: ent.productId,
    status: ent.status,
    current_period_end: ent.periodEnd,
    cancel_at_period_end: ent.cancelAtPeriodEnd,
    updated_at: new Date().toISOString(),
  };

  const upd = await db.from('subscriptions').update(payload).eq('user_id', userId).select('id');
  if (upd.error) throw new Error(`subscriptions update failed: ${upd.error.message}`);
  if (!upd.data || upd.data.length === 0) {
    const ins = await db.from('subscriptions').insert({ user_id: userId, ...payload });
    if (ins.error) throw new Error(`subscriptions insert failed: ${ins.error.message}`);
  }

  // profiles.subscription_status is keyed by email (see stripe/webhook).
  const user = await db.from('users').select('email').eq('id', userId).maybeSingle();
  const email = user.data?.email as string | undefined;
  if (email) {
    const prof = await db.from('profiles').update({ subscription_status: ent.profileStatus }).ilike('email', email).select('email');
    if (!prof.error && (!prof.data || prof.data.length === 0)) {
      await db.from('profiles').insert({ email, subscription_status: ent.profileStatus });
    }
  } else {
    console.warn('[play-sync] no email for user', userId);
  }

  // Server-side acknowledge (unacknowledged purchases auto-refund after 3 days).
  let acknowledged = ent.acknowledged;
  if (!ent.acknowledged && ent.entitled && ent.productId && isKnownPlayProduct(ent.productId)) {
    try {
      await acknowledgePlayPurchase(ent.productId, purchaseToken);
      acknowledged = true;
    } catch (e: any) {
      // RTDN SUBSCRIPTION_PURCHASED retries will acknowledge later.
      console.error('[play-sync] acknowledge failed', e?.message);
    }
  }

  return { ok: true, userId, status: ent.status, entitled: ent.entitled, acknowledged };
}
