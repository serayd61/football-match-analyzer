export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Erişim durumunu kontrol et
    const access = await checkUserAccess(session.user.email, ip);

    // Profil bilgilerini çek (subscription_id ve subscription_end için)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_id, subscription_end')
      .eq('email', session.user.email)
      .single();

    // Favorileri çek
    const { data: favorites } = await supabaseAdmin
      .from('favorites')
      .select('fixture_id')
      .eq('user_email', session.user.email);

    console.log('Profile access:', access.isPro ? 'PRO' : access.isTrial ? `TRIAL (${access.trialDaysLeft} days)` : 'EXPIRED');

    return NextResponse.json({
      email: session.user.email,
      name: session.user.name,
      ...access,
      subscriptionId: profile?.subscription_id || null,
      subscriptionEnd: profile?.subscription_end || null,
      favorites: favorites || [],
    });
  } catch (error: any) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
