export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createCheckoutSession, PLANS } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 });
    }

    // Plan seçimi: 'PRO' (aylık, 7 gün trial) | 'PRO_WEEKLY' (haftalık, trial yok)
    let planKey: 'PRO' | 'PRO_WEEKLY' = 'PRO';
    try {
      const body = await request.json();
      if (body?.plan === 'PRO_WEEKLY') planKey = 'PRO_WEEKLY';
    } catch {
      // body yok/boş → aylık varsayılan (eski istemciler böyle çağırır)
    }
    const plan = PLANS[planKey];

    if (!plan.stripePriceId) {
      // STRIPE_PRICE_ID_WEEKLY env'i henüz ayarlanmadıysa haftalık satılamaz;
      // sessizce aylığa düşürmek yanlış tutar tahsil eder — açık hata dön.
      console.error(`[create-checkout] ${planKey} price id missing (env not set)`);
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
