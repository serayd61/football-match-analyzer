// Google Play Billing — purchase verification (2026-11-10).
//
// The Play app's billing bridge calls this right after a successful purchase:
// POST { purchaseToken } with the user's normal session cookie. The server
// reads the authoritative state from the Play Developer API, binds the token
// to the signed-in user, mirrors the entitlement into subscriptions/profiles
// and acknowledges the purchase (see src/lib/site/play-sync.ts).
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dbFresh } from '@/lib/site/db';
import { getPlaySubscription, playConfigured } from '@/lib/site/play';
import { applyPlayState } from '@/lib/site/play-sync';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required', code: 'auth' }, { status: 401 });
    }
    if (!playConfigured()) {
      console.error('[play/verify] PLAY_SERVICE_ACCOUNT_JSON not set');
      return NextResponse.json({ error: 'Play Billing is not available right now', code: 'unavailable' }, { status: 503 });
    }

    let purchaseToken: unknown;
    try {
      purchaseToken = (await request.json())?.purchaseToken;
    } catch {
      /* fall through to the validation below */
    }
    if (typeof purchaseToken !== 'string' || purchaseToken.length < 10 || purchaseToken.length > 4096) {
      return NextResponse.json({ error: 'purchaseToken required', code: 'bad-request' }, { status: 400 });
    }

    const sub = await getPlaySubscription(purchaseToken);

    // The bridge passes the buyer's user id as obfuscatedExternalAccountId; if
    // Play says the purchase belongs to someone else, refuse to bind it.
    const obfuscated = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (obfuscated && obfuscated !== userId) {
      console.warn('[play/verify] account mismatch', { userId, obfuscated });
      return NextResponse.json({ error: 'Purchase belongs to a different account', code: 'mismatch' }, { status: 403 });
    }

    const result = await applyPlayState(dbFresh(), purchaseToken, sub, userId);
    if (!result.ok) {
      const status = result.reason === 'token-bound-elsewhere' ? 409 : 422;
      return NextResponse.json({ error: result.reason, code: result.reason }, { status });
    }

    console.log('[play/verify]', { userId, status: result.status, entitled: result.entitled, acknowledged: result.acknowledged });
    return NextResponse.json({ success: true, entitled: result.entitled, status: result.status });
  } catch (error: any) {
    console.error('[play/verify] error:', error?.message);
    return NextResponse.json({ error: 'Verification failed', code: 'error' }, { status: 500 });
  }
}
