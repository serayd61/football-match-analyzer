export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const today = new Date().toISOString().split('T')[0];

    console.log('Fetching profile for user:', userId);

    // Günlük kullanım
    const { data: usage, error: usageError } = await supabaseAdmin
      .from('user_daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (usageError) console.error('Usage error:', usageError);

    // Son analizler
    const { data: recentAnalyses, error: recentError } = await supabaseAdmin
      .from('user_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(20);

    if (recentError) console.error('Recent analyses error:', recentError);
    console.log('Recent analyses:', recentAnalyses);

    // Favori analizler
    const { data: favorites, error: favError } = await supabaseAdmin
      .from('user_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('is_favorite', true)
      .order('viewed_at', { ascending: false });

    if (favError) console.error('Favorites error:', favError);
    console.log('Favorites:', favorites);

    // Toplam analiz sayısı
    const { count: totalAnalyses, error: countError } = await supabaseAdmin
      .from('user_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) console.error('Count error:', countError);

    return NextResponse.json({
      success: true,
      usage: {
        today: usage?.analysis_count || 0,
        limit: 50,
        couponsToday: usage?.coupon_count || 0,
      },
      stats: {
        totalAnalyses: totalAnalyses || 0,
        favoritesCount: favorites?.length || 0,
      },
      recentAnalyses: recentAnalyses || [],
      favorites: favorites || [],
    });

  } catch (error: any) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id: userId,
        ...body,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, profile: data });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
