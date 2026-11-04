export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createCheckoutSession, PLANS, type PlanId } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Sign in required', code: 'auth' }, { status: 401 });
    }

    // Plan: aylık Pro (varsayılan) veya yıllık (2026-11-04). Stripe trial yok;
    // 7 ücretsiz gün kayıtta kartsız verilir (lib/site/access.ts).
    let requested: unknown = 'PRO';
    try {
      requested = (await request.json())?.plan ?? 'PRO';
    } catch {
      /* gövdesiz istek = aylık */
    }
    const planId: PlanId = requested === 'PRO_YEARLY' ? 'PRO_YEARLY' : 'PRO';
    const plan = PLANS[planId];
    if (!plan.stripePriceId) {
      console.error(`[create-checkout] price id missing for ${planId} (env not set)`);
      return NextResponse.json({ error: 'This plan is not available right now', code: 'unavailable' }, { status: 503 });
    }

    const userId = (session.user as any).id;
    const userEmail = session.user.email;
    const baseUrl = process.env.NEXTAUTH_URL || 'https://footballanalytics.pro';

    const checkoutSession = await createCheckoutSession({
      userId,
      userEmail,
      priceId: plan.stripePriceId,
      successUrl: `${baseUrl}/dashboard?payment=success`,
      cancelUrl: `${baseUrl}/pricing?payment=cancelled`,
      trialDays: plan.trialDays,
      allowPromotionCodes: plan.allowPromotionCodes,
    });

    return NextResponse.json({ success: true, url: checkoutSession.url, plan: planId });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Could not start checkout', code: 'checkout', details: error.message }, { status: 500 });
  }
}
