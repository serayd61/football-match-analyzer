export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST: Favoriye ekle/kaldır
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fixtureId, analysis, geniusAnalysis, isFavorite } = await request.json();

    if (!fixtureId) {
      return NextResponse.json({ error: 'fixtureId gerekli' }, { status: 400 });
    }

    console.log('Toggle favorite:', { email: session.user.email, fixtureId, isFavorite });

    // Unified analysis'den maç bilgilerini çek
    const { data: unifiedAnalysis } = await supabaseAdmin
      .from('unified_analysis')
      .select('home_team, away_team, league, match_date, analysis, match_result_prediction, over_under_prediction, btts_prediction, best_bet_market, best_bet_selection, best_bet_confidence, overall_confidence')
      .eq('fixture_id', fixtureId)
      .maybeSingle();

    if (isFavorite) {
      // Favoriye ekle
      const favoriteData = {
        user_email: session.user.email,
        fixture_id: fixtureId,
        home_team: unifiedAnalysis?.home_team || analysis?.homeTeam || '',
        away_team: unifiedAnalysis?.away_team || analysis?.awayTeam || '',
        league: unifiedAnalysis?.league || analysis?.league || '',
        match_date: unifiedAnalysis?.match_date || analysis?.matchDate || new Date().toISOString(),
        analysis_data: analysis || unifiedAnalysis?.analysis || null,
        genius_analysis: geniusAnalysis || null,
        match_result_prediction: unifiedAnalysis?.match_result_prediction || null,
        over_under_prediction: unifiedAnalysis?.over_under_prediction || null,
        btts_prediction: unifiedAnalysis?.btts_prediction || null,
        best_bet_market: unifiedAnalysis?.best_bet_market || null,
        best_bet_selection: unifiedAnalysis?.best_bet_selection || null,
        best_bet_confidence: unifiedAnalysis?.best_bet_confidence || null,
        overall_confidence: unifiedAnalysis?.overall_confidence || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('favorites')
        .upsert(favoriteData, { onConflict: 'user_email,fixture_id' });

      if (error) {
        console.error('Add favorite error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('✅ Favorite added');
    } else {
      // Favorilerden kaldır
      const { error } = await supabaseAdmin
        .from('favorites')
        .delete()
        .eq('user_email', session.user.email)
        .eq('fixture_id', fixtureId);

      if (error) {
        console.error('Remove favorite error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('✅ Favorite removed');
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Favorite toggle error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Favorileri listele veya tek bir maçın favori durumunu kontrol et
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');

    if (fixtureId) {
      // Tek bir maçın favori durumunu kontrol et
      const { data: favorite, error } = await supabaseAdmin
        .from('favorites')
        .select('id')
        .eq('user_email', session.user.email)
        .eq('fixture_id', parseInt(fixtureId))
        .maybeSingle();

      if (error) {
        console.error('Check favorite error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, isFavorite: !!favorite });
    } else {
      // Tüm favorileri listele
      const { data: favorites, error } = await supabaseAdmin
        .from('favorites')
        .select('*')
        .eq('user_email', session.user.email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get favorites error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, favorites: favorites || [] });
    }

  } catch (error: any) {
    console.error('Get favorites error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
