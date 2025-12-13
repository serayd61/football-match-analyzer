// src/app/api/update-coupon-results/route.ts
// Kupon sonuçlarını otomatik günceller

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// Maç sonucunu kontrol et - SADECE SELECTION'A GÖRE
function checkPickResult(
  selection: string,
  homeScore: number,
  awayScore: number
): 'WON' | 'LOST' | 'PENDING' {
  const totalGoals = homeScore + awayScore;
  const value = (selection || '').toUpperCase().trim();

  // MATCH_RESULT - 1X2 (tüm varyasyonlar)
  if (value === '1' || value === 'HOME' || value === 'HOME WIN' || value.includes('HOME')) {
    return homeScore > awayScore ? 'WON' : 'LOST';
  }
  if (value === '2' || value === 'AWAY' || value === 'AWAY WIN' || value.includes('AWAY')) {
    return awayScore > homeScore ? 'WON' : 'LOST';
  }
  if (value === 'X' || value === 'DRAW' || value.includes('DRAW') || value.includes('BERABERE')) {
    return homeScore === awayScore ? 'WON' : 'LOST';
  }

  // BTTS - Karşılıklı Gol (tüm varyasyonlar)
  if (value === 'YES' || value === 'VAR' || value === 'EVET' || value === 'BTTS YES' || value.includes('BTTS') && value.includes('YES')) {
    return (homeScore > 0 && awayScore > 0) ? 'WON' : 'LOST';
  }
  if (value === 'NO' || value === 'YOK' || value === 'HAYIR' || value === 'BTTS NO' || value.includes('BTTS') && value.includes('NO')) {
    return !(homeScore > 0 && awayScore > 0) ? 'WON' : 'LOST';
  }

  // OVER/UNDER (tüm varyasyonlar)
  if (value.includes('OVER') || value.includes('ÜST') || value.includes('UST')) {
    const match = value.match(/[\d.]+/);
    const line = match ? parseFloat(match[0]) : 2.5;
    return totalGoals > line ? 'WON' : 'LOST';
  }
  if (value.includes('UNDER') || value.includes('ALT')) {
    const match = value.match(/[\d.]+/);
    const line = match ? parseFloat(match[0]) : 2.5;
    return totalGoals < line ? 'WON' : 'LOST';
  }

  // Hiçbiri eşleşmezse log yaz ve PENDING dön
  console.log(`⚠️ Tanınmayan selection: "${selection}"`);
  return 'PENDING';
}

// Sportmonks'tan maç sonucu çek
async function getMatchResult(fixtureId: number): Promise<{
  finished: boolean;
  homeScore: number;
  awayScore: number;
} | null> {
  try {
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores`
    );

    if (!response.ok) return null;

    const data = await response.json();
    const fixture = data.data;

    if (!fixture) return null;

    const finished = fixture.state_id === 5;

    let homeScore = 0;
    let awayScore = 0;

    if (fixture.scores && Array.isArray(fixture.scores)) {
      fixture.scores.forEach((s: any) => {
        if (s.description === 'CURRENT' || s.type_id === 1525) {
          if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
          if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
        }
      });
    }

    return { finished, homeScore, awayScore };
  } catch (error) {
    console.error(`Error fetching fixture ${fixtureId}:`, error);
    return null;
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = getSupabaseAdmin();

    console.log('🎫 KUPON SONUÇ GÜNCELLEMESİ BAŞLADI');

    // 1. PENDING kuponları al
    const { data: pendingCoupons, error: couponError } = await supabase
      .from('coupons')
      .select('id, title, total_odds, status')
      .eq('status', 'PENDING');

    if (couponError) {
      return NextResponse.json({ error: couponError.message }, { status: 500 });
    }

    if (!pendingCoupons || pendingCoupons.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Bekleyen kupon yok',
        totalPicksUpdated: 0,
        couponsWon: 0,
        couponsLost: 0,
      });
    }

    console.log(`📋 ${pendingCoupons.length} bekleyen kupon bulundu`);

    let totalPicksUpdated = 0;
    let couponsWon = 0;
    let couponsLost = 0;
    let couponsStillPending = 0;
    const details: any[] = [];

    // 2. Her kupon için pick'leri kontrol et
    for (const coupon of pendingCoupons) {
      console.log(`\n🎫 Kupon: ${coupon.title}`);

      const { data: picks, error: picksError } = await supabase
        .from('coupon_picks')
        .select('*')
        .eq('coupon_id', coupon.id);

      if (picksError || !picks || picks.length === 0) {
        console.log(`   ⚠️ Pick bulunamadı`);
        continue;
      }

      let allWon = true;
      let anyLost = false;
      let anyPending = false;
      const pickResults: any[] = [];

      // 3. Her pick için sonuç kontrol et
      for (const pick of picks) {
        // Zaten sonuçlanmış pick'leri atla
        if (pick.result === 'WON' || pick.result === 'LOST') {
          if (pick.result === 'LOST') {
            anyLost = true;
            allWon = false;
          }
          pickResults.push({
            match: `${pick.home_team} vs ${pick.away_team}`,
            selection: pick.selection,
            status: pick.result,
            cached: true,
          });
          continue;
        }

        // Maç tarihi kontrolü (en az 2 saat geçmiş olmalı)
        const matchDate = new Date(pick.match_date);
        const now = new Date();
        if ((now.getTime() - matchDate.getTime()) < (2 * 60 * 60 * 1000)) {
          anyPending = true;
          allWon = false;
          pickResults.push({
            match: `${pick.home_team} vs ${pick.away_team}`,
            selection: pick.selection,
            status: 'PENDING',
            reason: 'Maç henüz bitmedi',
          });
          continue;
        }

        // Sportmonks'tan sonuç çek
        const result = await getMatchResult(pick.fixture_id);

        if (!result) {
          anyPending = true;
          allWon = false;
          pickResults.push({
            match: `${pick.home_team} vs ${pick.away_team}`,
            selection: pick.selection,
            status: 'PENDING',
            reason: 'API hatası',
          });
          continue;
        }

        if (!result.finished) {
          anyPending = true;
          allWon = false;
          pickResults.push({
            match: `${pick.home_team} vs ${pick.away_team}`,
            selection: pick.selection,
            status: 'PENDING',
            reason: 'Maç devam ediyor',
          });
          continue;
        }

        // Pick sonucunu hesapla
        const pickStatus = checkPickResult(
          pick.selection || '',
          result.homeScore,
          result.awayScore
        );

        // Pick'i güncelle
        const { error: updatePickError } = await supabase
          .from('coupon_picks')
          .update({
            result: pickStatus,
            home_score: result.homeScore,
            away_score: result.awayScore,
          })
          .eq('id', pick.id);

        if (!updatePickError) {
          totalPicksUpdated++;
        }

        if (pickStatus === 'LOST') {
          anyLost = true;
          allWon = false;
        } else if (pickStatus === 'PENDING') {
          anyPending = true;
          allWon = false;
        }

        pickResults.push({
          match: `${pick.home_team} vs ${pick.away_team}`,
          score: `${result.homeScore}-${result.awayScore}`,
          selection: pick.selection,
          status: pickStatus,
        });

        console.log(`   ${pickStatus === 'WON' ? '✅' : pickStatus === 'LOST' ? '❌' : '⏳'} ${pick.home_team} vs ${pick.away_team}: ${result.homeScore}-${result.awayScore} | ${pick.selection} → ${pickStatus}`);
      }

      // 4. Kupon durumunu güncelle
      let couponStatus = 'PENDING';
      if (anyLost) {
        couponStatus = 'LOST';
        couponsLost++;
      } else if (allWon && !anyPending) {
        couponStatus = 'WON';
        couponsWon++;
      } else {
        couponsStillPending++;
      }

      if (couponStatus !== 'PENDING') {
        await supabase
          .from('coupons')
          .update({ status: couponStatus })
          .eq('id', coupon.id);

        console.log(`   🎫 Kupon: ${couponStatus}`);
      }

      details.push({
        couponId: coupon.id,
        title: coupon.title,
        status: couponStatus,
        picks: pickResults,
      });
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      totalPicksUpdated,
      couponsWon,
      couponsLost,
      couponsStillPending,
      details,
      duration: `${duration}ms`,
    });

  } catch (error: any) {
    console.error('❌ Kupon güncelleme hatası:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: pending } = await supabase
      .from('coupons')
      .select('id, title, status, total_odds')
      .eq('status', 'PENDING');

    const { data: won } = await supabase
      .from('coupons')
      .select('id')
      .eq('status', 'WON');

    const { data: lost } = await supabase
      .from('coupons')
      .select('id')
      .eq('status', 'LOST');

    return NextResponse.json({
      message: 'Kupon Sonuç Güncelleme API',
      stats: {
        pending: pending?.length || 0,
        won: won?.length || 0,
        lost: lost?.length || 0,
      },
      pendingCoupons: pending?.slice(0, 10) || [],
      usage: 'PUT /api/update-coupon-results to update coupon results',
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
