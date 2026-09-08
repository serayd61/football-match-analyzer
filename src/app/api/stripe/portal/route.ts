import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 });
    }

    // Dönüş yolu (yeni site: /<locale>/account). Yalnız site-içi yol kabul edilir.
    let returnPath = '/profile';
    try {
      const body = await request.json();
      if (typeof body?.returnPath === 'string' && /^\/[a-z]{2}\/[a-z-]+$/.test(body.returnPath)) returnPath = body.returnPath;
    } catch { /* gövde yok: eski istemci */ }

    // Müşteri: önce subscriptions.stripe_customer_id (webhook'un yazdığı),
    // yoksa profiles.subscription_id üzerinden Stripe'tan çözülür.
    let customerId: string | null = null;
    const { data: user } = await supabaseAdmin.from('users').select('id').ilike('email', session.user.email).maybeSingle();
    if (user?.id) {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id, stripe_subscription_id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      customerId = sub?.stripe_customer_id || null;
      if (!customerId && sub?.stripe_subscription_id) {
        const s = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        customerId = s.customer as string;
      }
    }
    if (!customerId) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('subscription_id').ilike('email', session.user.email).maybeSingle();
      if (profile?.subscription_id) {
        const s = await stripe.subscriptions.retrieve(profile.subscription_id);
        customerId = s.customer as string;
      }
    }
    if (!customerId) {
      return NextResponse.json({ error: 'Abonelik bulunamadı' }, { status: 404 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXTAUTH_URL || 'https://footballanalytics.pro'}${returnPath}`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'Portal açılamadı' }, { status: 500 });
  }
}
