import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Kullanıcı profilini getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const today = new Date().toISOString().split('T')[0];

    // Profil bilgileri
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Günlük kullanım
    const { data: usage } = await supabaseAdmin
      .from('user_daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    // Son analizler
    const { data: recentAnalyses } = await supabaseAdmin
      .from('user_analyses')
      .select(`
        *,
        analyses (
          fixture_id,
          home_team,
          away_team,
          league,
          match_date,
          analysis_data
        )
      `)
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(20);

    // Favori analizler
    const { data: favorites } = await supabaseAdmin
      .from('user_analyses')
      .select(`
        *,
        analyses (
          fixture_id,
          home_team,
          away_team,
          league,
          analysis_data
        )
      `)
      .eq('user_id', userId)
      .eq('is_favorite', true)
      .order('viewed_at', { ascending: false });

    // Toplam analiz sayısı
    const { count: totalAnalyses } = await supabaseAdmin
      .from('user_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      profile: profile || {},
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

// Profil güncelle
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
