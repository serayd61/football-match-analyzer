export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createCheckoutSession, PLANS } from '@/lib/stripe';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 });
    }

    // Tek plan: aylık Pro (2026-10-13'ten beri haftalık yok). Stripe trial yok;
    // 7 ücretsiz gün kayıtta kartsız verilir (lib/site/access.ts).
    const plan = PLANS.PRO;
    if (!plan.stripePriceId) {
      console.error('[create-checkout] STRIPE_PRICE_ID missing (env not set)');
      return NextResponse.json({ error: 'Bu plan şu an kullanılamıyor' }, { status: 503 });
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
    });

    return NextResponse.json({ success: true, url: checkoutSession.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Ödeme başlatılamadı', details: error.message }, { status: 500 });
  }
}
