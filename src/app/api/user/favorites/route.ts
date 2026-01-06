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
    console.log('Analysis data:', { hasAnalysis: !!analysis, hasGenius: !!geniusAnalysis });

    // Unified analysis'den maç bilgilerini çek (opsiyonel - fallback için)
    const { data: unifiedAnalysis } = await supabaseAdmin
      .from('unified_analysis')
      .select('home_team, away_team, league, match_date, analysis, match_result_prediction, over_under_prediction, btts_prediction, best_bet_market, best_bet_selection, best_bet_confidence, overall_confidence')
      .eq('fixture_id', fixtureId)
      .maybeSingle();

    if (isFavorite) {
      // Önce mevcut kaydı kontrol et
      const { data: existing } = await supabaseAdmin
        .from('favorites')
        .select('id')
        .eq('user_email', session.user.email)
        .eq('fixture_id', fixtureId)
        .maybeSingle();

      // Analysis objesinden veri çek (öncelikli)
      const homeTeam = analysis?.homeTeam || unifiedAnalysis?.home_team || '';
      const awayTeam = analysis?.awayTeam || unifiedAnalysis?.away_team || '';
      const league = analysis?.league || unifiedAnalysis?.league || '';
      const matchDate = analysis?.matchDate || unifiedAnalysis?.match_date || new Date().toISOString();
      
      // Predictions - analysis objesinden çek
      const matchResultPred = analysis?.matchResult?.prediction || unifiedAnalysis?.match_result_prediction || null;
      const overUnderPred = analysis?.overUnder?.prediction || unifiedAnalysis?.over_under_prediction || null;
      const bttsPred = analysis?.btts?.prediction || unifiedAnalysis?.btts_prediction || null;
      const bestBetMarket = analysis?.bestBet?.market || unifiedAnalysis?.best_bet_market || null;
      const bestBetSelection = analysis?.bestBet?.selection || unifiedAnalysis?.best_bet_selection || null;
      const bestBetConfidence = analysis?.bestBet?.confidence || unifiedAnalysis?.best_bet_confidence || null;
      const overallConf = analysis?.overallConfidence || unifiedAnalysis?.overall_confidence || null;

      // Validation - home_team ve away_team boş olamaz
      if (!homeTeam || !awayTeam) {
        console.error('Missing required fields:', { homeTeam, awayTeam, fixtureId, analysis });
        return NextResponse.json({ 
          error: 'Maç bilgileri eksik. Lütfen önce analiz yapın.',
          details: { homeTeam, awayTeam }
        }, { status: 400 });
      }

      const favoriteData = {
        user_email: session.user.email,
        fixture_id: fixtureId,
        home_team: homeTeam,
        away_team: awayTeam,
        league: league || null,
        match_date: matchDate,
        analysis_data: analysis || unifiedAnalysis?.analysis || null,
        genius_analysis: geniusAnalysis || null,
        match_result_prediction: matchResultPred,
        over_under_prediction: overUnderPred,
        btts_prediction: bttsPred,
        best_bet_market: bestBetMarket,
        best_bet_selection: bestBetSelection,
        best_bet_confidence: bestBetConfidence ? Math.round(bestBetConfidence) : null,
        overall_confidence: overallConf ? Math.round(overallConf) : null,
        updated_at: new Date().toISOString(),
      };

      console.log('Favorite data to save:', { 
        user_email: favoriteData.user_email,
        fixture_id: favoriteData.fixture_id,
        home_team: favoriteData.home_team,
        away_team: favoriteData.away_team,
        has_analysis: !!favoriteData.analysis_data,
        has_genius: !!favoriteData.genius_analysis
      });

      let error;
      let result;
      if (existing) {
        // Güncelle
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('favorites')
          .update(favoriteData)
          .eq('id', existing.id)
          .select();
        error = updateError;
        result = updateData;
        console.log('Update result:', { existing: !!existing, updateData, updateError });
      } else {
        // Yeni ekle
        const { data: insertData, error: insertError } = await supabaseAdmin
          .from('favorites')
          .insert(favoriteData)
          .select();
        error = insertError;
        result = insertData;
        console.log('Insert result:', { insertData, insertError });
      }

      if (error) {
        console.error('Add favorite error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        return NextResponse.json({ 
          error: error.message || 'Favoriye eklenirken hata oluştu',
          details: error.details,
          code: error.code
        }, { status: 500 });
      }

      console.log('✅ Favorite added/updated:', { 
        email: session.user.email, 
        fixtureId,
        result: result?.length || 0,
        existing: !!existing
      });
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
