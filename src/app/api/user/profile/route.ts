export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkUserAccess } from '@/lib/accessControl';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Supabase credentials not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

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

    // Favorileri çek
    const { data: favorites } = await getSupabase()
      .from('favorites')
      .select('fixture_id')
      .eq('user_email', session.user.email);

    console.log('Profile access:', access.isPro ? 'PRO' : access.isTrial ? `TRIAL (${access.trialDaysLeft} days)` : 'EXPIRED');

    return NextResponse.json({
      email: session.user.email,
      name: session.user.name,
      ...access,
      favorites: favorites || [],
    });

  } catch (error: any) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
