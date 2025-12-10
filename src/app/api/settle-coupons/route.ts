export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// Maç sonucunu belirle
function determineMatchResult(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return '1';
  if (awayScore > homeScore) return '2';
  return 'X';
}

// Tahmin doğru mu kontrol et
function checkPrediction(
  betType: string,
  selection: string,
  homeScore: number,
  awayScore: number
): 'WON' | 'LOST' {
  const totalGoals = homeScore + awayScore;
  const matchResult = determineMatchResult(homeScore, awayScore);
  const bothScored = homeScore > 0 && awayScore > 0;

  const sel = selection.toUpperCase();
  const type = betType.toLowerCase();

  // Match Result (1X2)
  if (type.includes('result') || type.includes('winner') || type === '1x2') {
    if (sel === '1' || sel === 'HOME') return matchResult === '1' ? 'WON' : 'LOST';
    if (sel === '2' || sel === 'AWAY') return matchResult === '2' ? 'WON' : 'LOST';
    if (sel === 'X' || sel === 'DRAW') return matchResult === 'X' ? 'WON' : 'LOST';
    if (sel === '1X') return (matchResult === '1' || matchResult === 'X') ? 'WON' : 'LOST';
    if (sel === 'X2') return (matchResult === 'X' || matchResult === '2') ? 'WON' : 'LOST';
    if (sel === '12') return (matchResult === '1' || matchResult === '2') ? 'WON' : 'LOST';
  }

  // Over/Under
  if (type.includes('over') || type.includes('under') || type.includes('goal')) {
    if (sel.includes('OVER') || sel === 'OVER 2.5' || sel === 'Ü2.5' || sel === 'OVER') {
      return totalGoals > 2.5 ? 'WON' : 'LOST';
    }
    if (sel.includes('UNDER') || sel === 'UNDER 2.5' || sel === 'A2.5' || sel === 'UNDER') {
      return totalGoals < 2.5 ? 'WON' : 'LOST';
    }
  }

  // BTTS (Both Teams To Score)
  if (type.includes('btts') || type.includes('both')) {
    if (sel === 'YES' || sel === 'VAR' || sel === 'EVET') return bothScored ? 'WON' : 'LOST';
    if (sel === 'NO' || sel === 'YOK' || sel === 'HAYIR') return !bothScored ? 'WON' : 'LOST';
  }

  return 'LOST';
}

export async function POST(request: NextRequest) {
  try {
    // API key kontrolü
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.CRON_SECRET || 'tipster-league-secret-2024';
    
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting coupon settlement...');

    // 1. Bekleyen maçları bul (son 3 gün, maç tarihi geçmiş olanlar)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: pendingPicks, error: fetchError } = await supabaseAdmin
      .from('coupon_picks')
      .select(`
        *,
        coupons!inner(id, user_id, total_odds, status)
      `)
      .eq('result', 'PENDING')
      .lt('match_date', new Date().toISOString())
      .gt('match_date', threeDaysAgo.toISOString());

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingPicks || pendingPicks.length === 0) {
      console.log('No pending picks to settle');
      return NextResponse.json({ message: 'No pending matches to settle', settled: 0 });
    }

    console.log(`📋 Found ${pendingPicks.length} pending picks`);

    // 2. Unique fixture ID'leri al
    const fixtureIds = Array.from(new Set(pendingPicks.map(p => p.fixture_id)));
    console.log(`🎯 Unique fixtures: ${fixtureIds.length}`);
    
    // 3. Sportmonks'tan sonuçları çek
    const settledPicks: any[] = [];
    const fixtureResults: Map<number, { homeScore: number; awayScore: number }> = new Map();
    
    for (const fixtureId of fixtureIds) {
      try {
        const response = await fetch(
          `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores`
        );
        
        if (!response.ok) {
          console.log(`❌ Failed to fetch fixture ${fixtureId}`);
          continue;
        }
        
        const data = await response.json();
        const fixture = data.data;
        
        // Maç bitti mi kontrol et (FT = Full Time)
        const state = fixture?.state?.short || fixture?.state_id;
        if (!fixture || (state !== 'FT' && state !== 5)) {
          console.log(`⏳ Fixture ${fixtureId} not finished yet (state: ${state})`);
          continue;
        }
        
        // Skorları al
        const scores = fixture.scores || [];
        let homeScore = 0;
        let awayScore = 0;
        
        // CURRENT veya 2ND_HALF skorunu bul
        for (const score of scores) {
          if (score.description === 'CURRENT' || score.description === '2ND_HALF') {
            if (score.score?.participant === 'home' || score.participant === 'home') {
              homeScore = score.score?.goals ?? score.goals ?? 0;
            }
            if (score.score?.participant === 'away' || score.participant === 'away') {
              awayScore = score.score?.goals ?? score.goals ?? 0;
            }
          }
        }
        
        // Alternatif skor alma yöntemi
        if (homeScore === 0 && awayScore === 0) {
          const homeScoreObj = scores.find((s: any) => 
            (s.participant === 'home' || s.score?.participant === 'home') && 
            (s.description === 'CURRENT' || s.description === '2ND_HALF')
          );
          const awayScoreObj = scores.find((s: any) => 
            (s.participant === 'away' || s.score?.participant === 'away') && 
            (s.description === 'CURRENT' || s.description === '2ND_HALF')
          );
          
          homeScore = homeScoreObj?.goals ?? homeScoreObj?.score?.goals ?? 0;
          awayScore = awayScoreObj?.goals ?? awayScoreObj?.score?.goals ?? 0;
        }
        
        console.log(`✅ Fixture ${fixtureId}: ${homeScore}-${awayScore}`);
        fixtureResults.set(fixtureId, { homeScore, awayScore });
        
        // match_results tablosuna kaydet
        await supabaseAdmin
          .from('match_results')
          .upsert({
            fixture_id: fixtureId,
            home_team: fixture.name?.split(' vs ')[0] || '',
            away_team: fixture.name?.split(' vs ')[1] || '',
            home_score: homeScore,
            away_score: awayScore,
            match_date: fixture.starting_at,
            status: 'FT',
            updated_at: new Date().toISOString()
          });
          
      } catch (err) {
        console.error(`Error fetching fixture ${fixtureId}:`, err);
      }
    }

    // 4. Her pick'i güncelle
    for (const pick of pendingPicks) {
      const result = fixtureResults.get(pick.fixture_id);
      if (!result) continue;
      
      const pickResult = checkPrediction(
        pick.bet_type,
        pick.selection,
        result.homeScore,
        result.awayScore
      );
      
      await supabaseAdmin
        .from('coupon_picks')
        .update({
          result: pickResult,
          home_score: result.homeScore,
          away_score: result.awayScore,
        })
        .eq('id', pick.id);
      
      settledPicks.push({
        fixture_id: pick.fixture_id,
        match: `${pick.home_team} vs ${pick.away_team}`,
        score: `${result.homeScore}-${result.awayScore}`,
        selection: pick.selection,
        result: pickResult
      });
    }

    console.log(`✅ Settled ${settledPicks.length} picks`);

    // 5. Kuponları güncelle
    const couponIds = Array.from(new Set(pendingPicks.map(p => p.coupon_id)));
    let couponsWon = 0;
    let couponsLost = 0;

    for (const couponId of couponIds) {
      // Bu kuponun tüm pick'lerini al
      const { data: couponPicks } = await supabaseAdmin
        .from('coupon_picks')
        .select('result')
        .eq('coupon_id', couponId);

      if (!couponPicks) continue;

      const allSettled = couponPicks.every(p => p.result !== 'PENDING');
      if (!allSettled) continue; // Hala bekleyen maç var

      const allWon = couponPicks.every(p => p.result === 'WON');
      const anyLost = couponPicks.some(p => p.result === 'LOST');

      let couponStatus = 'PENDING';
      if (allWon) {
        couponStatus = 'WON';
        couponsWon++;
      } else if (anyLost) {
        couponStatus = 'LOST';
        couponsLost++;
      }

      if (couponStatus !== 'PENDING') {
        // Kuponu güncelle
        const { data: coupon } = await supabaseAdmin
          .from('coupons')
          .select('user_id, total_odds')
          .eq('id', couponId)
          .single();

        if (coupon) {
          // Puan hesapla (sadece kazananlara)
          const pointsEarned = couponStatus === 'WON' ? Math.round((coupon.total_odds || 1) * 10) : 0;

          await supabaseAdmin
            .from('coupons')
            .update({
              status: couponStatus,
              points_earned: pointsEarned,
              settled_at: new Date().toISOString()
            })
            .eq('id', couponId);

          // Kullanıcı puanını güncelle - users tablosundan email bul
          if (couponStatus === 'WON' && coupon.user_id) {
            const { data: user } = await supabaseAdmin
              .from('users')
              .select('email')
              .eq('id', coupon.user_id)
              .single();

            if (user?.email) {
              const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('total_points, winning_coupons, total_coupons, current_streak, best_streak')
                .eq('email', user.email)
                .single();

              if (profile) {
                const newStreak = (profile.current_streak || 0) + 1;
                await supabaseAdmin
                  .from('profiles')
                  .update({
                    total_points: (profile.total_points || 0) + pointsEarned,
                    winning_coupons: (profile.winning_coupons || 0) + 1,
                    total_coupons: (profile.total_coupons || 0) + 1,
                    current_streak: newStreak,
                    best_streak: Math.max(profile.best_streak || 0, newStreak),
                    updated_at: new Date().toISOString()
                  })
                  .eq('email', user.email);
                
                console.log(`🏆 Updated points for ${user.email}: +${pointsEarned}`);
              }
            }
          } else if (couponStatus === 'LOST' && coupon.user_id) {
            // Kaybedince streak sıfırla
            const { data: user } = await supabaseAdmin
              .from('users')
              .select('email')
              .eq('id', coupon.user_id)
              .single();

            if (user?.email) {
              const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('total_coupons')
                .eq('email', user.email)
                .single();

              if (profile) {
                await supabaseAdmin
                  .from('profiles')
                  .update({
                    total_coupons: (profile.total_coupons || 0) + 1,
                    current_streak: 0,
                    updated_at: new Date().toISOString()
                  })
                  .eq('email', user.email);
                
                console.log(`❌ Reset streak for ${user.email}`);
              }
            }
          }
        }
      }
    }

    console.log(`🏆 Coupons - Won: ${couponsWon}, Lost: ${couponsLost}`);

    return NextResponse.json({
      success: true,
      settled: settledPicks.length,
      couponsWon,
      couponsLost,
      details: settledPicks
    });

  } catch (error: any) {
    console.error('❌ Settlement error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint - durum kontrolü için
export async function GET(request: NextRequest) {
  try {
    const { data: pendingCoupons } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('status', 'PENDING');

    const { data: pendingPicks } = await supabaseAdmin
      .from('coupon_picks')
      .select('id')
      .eq('result', 'PENDING');

    return NextResponse.json({ 
      message: 'Coupon settlement API',
      pendingCoupons: pendingCoupons?.length || 0,
      pendingPicks: pendingPicks?.length || 0,
      endpoint: 'POST /api/settle-coupons with Bearer token'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
