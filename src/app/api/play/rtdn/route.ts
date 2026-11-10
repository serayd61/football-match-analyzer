// Google Play Billing — Real-Time Developer Notifications (2026-11-10).
//
// Cloud Pub/Sub push endpoint (docs/play-billing.md §RTDN): Play publishes a
// message for every subscription lifecycle event (purchase, renewal, cancel,
// grace, hold, revoke, expiry); the push subscription POSTs it here with the
// shared secret in the URL. The handler re-reads the authoritative state from
// the Play Developer API and mirrors it into subscriptions/profiles.
//
// Response codes drive Pub/Sub retries: 200 = done (also for messages we can
// not act on — retrying would not help), 503 = transient failure, retry later.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { dbFresh } from '@/lib/site/db';
import { getPlaySubscription, parseRtdn, playConfigured } from '@/lib/site/play';
import { applyPlayState } from '@/lib/site/play-sync';

export async function POST(request: NextRequest) {
  const secret = process.env.PLAY_RTDN_SECRET;
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    /* parseRtdn handles it */
  }
  const msg = parseRtdn(body);

  try {
    switch (msg.kind) {
      case 'test':
        console.log('[play/rtdn] test notification ok');
        return NextResponse.json({ ok: true, kind: 'test' });

      case 'ignored':
        console.warn('[play/rtdn] ignored:', msg.reason);
        return NextResponse.json({ ok: true, kind: 'ignored' });

      case 'voided': {
        // Refund/void of a subscription: drop the entitlement for the row
        // holding this token (no subscriptionsv2 state needed).
        const db = dbFresh();
        const row = await db
          .from('subscriptions')
          .select('user_id')
          .eq('play_purchase_token', msg.purchaseToken)
          .maybeSingle();
        if (row.data?.user_id) {
          await db
            .from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('user_id', row.data.user_id);
          const user = await db.from('users').select('email').eq('id', row.data.user_id).maybeSingle();
          if (user.data?.email) {
            await db.from('profiles').update({ subscription_status: 'free' }).ilike('email', user.data.email);
          }
          console.log('[play/rtdn] voided -> canceled', row.data.user_id);
        } else {
          console.warn('[play/rtdn] voided: token not found');
        }
        return NextResponse.json({ ok: true, kind: 'voided' });
      }

      case 'subscription': {
        if (!playConfigured()) {
          console.error('[play/rtdn] PLAY_SERVICE_ACCOUNT_JSON not set');
          return NextResponse.json({ error: 'not configured' }, { status: 503 });
        }
        const sub = await getPlaySubscription(msg.purchaseToken);
        const result = await applyPlayState(dbFresh(), msg.purchaseToken, sub);
        if (!result.ok) {
          // No user to attribute to (purchase never verified, no account id):
          // a retry would find the same nothing — log and acknowledge.
          console.warn('[play/rtdn]', msg.typeName, 'unattributed:', result.reason);
          return NextResponse.json({ ok: true, kind: 'unattributed' });
        }
        console.log('[play/rtdn]', msg.typeName, { userId: result.userId, status: result.status, entitled: result.entitled });
        return NextResponse.json({ ok: true, kind: msg.typeName });
      }
    }
  } catch (error: any) {
    // Transient (Play API / DB hiccup): let Pub/Sub redeliver.
    console.error('[play/rtdn] error:', error?.message);
    return NextResponse.json({ error: 'retry' }, { status: 503 });
  }
}
