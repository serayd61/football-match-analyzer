export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { fixtureId, isFavorite } = await request.json();

    console.log('Toggle favorite:', { userId, fixtureId, isFavorite });

    // Önce kayıt var mı kontrol et
    const { data: existing } = await supabaseAdmin
      .from('user_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('fixture_id', fixtureId)
      .maybeSingle();

    if (existing) {
      // Güncelle
      const { error } = await supabaseAdmin
        .from('user_analyses')
        .update({ is_favorite: isFavorite })
        .eq('user_id', userId)
        .eq('fixture_id', fixtureId);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }
    } else {
      // Yeni kayıt oluştur
      const { error } = await supabaseAdmin
        .from('user_analyses')
        .insert({
          user_id: userId,
          fixture_id: fixtureId,
          is_favorite: isFavorite,
          viewed_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Favorite toggle error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
