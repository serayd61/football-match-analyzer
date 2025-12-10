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

    // profiles tablosundan subscription_id al
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_id')
      .eq('email', session.user.email)
      .single();

    if (!profile?.subscription_id) {
      return NextResponse.json({ error: 'Abonelik bulunamadı' }, { status: 404 });
    }

    // Subscription'dan customer ID al
    const subscription = await stripe.subscriptions.retrieve(profile.subscription_id);
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.customer as string,
      return_url: `${process.env.NEXTAUTH_URL}/profile`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'Portal açılamadı' }, { status: 500 });
  }
}
