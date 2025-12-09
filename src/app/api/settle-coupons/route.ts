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
  prediction: string,
  homeScore: number,
  awayScore: number
): 'won' | 'lost' {
  const totalGoals = homeScore + awayScore;
  const matchResult = determineMatchResult(homeScore, awayScore);
  const bothScored = homeScore > 0 && awayScore > 0;

  switch (betType) {
    case 'match_result':
      // 1, X, 2, 1X, X2, 12
      if (prediction === '1X') return (matchResult === '1' || matchResult === 'X') ? 'won' : 'lost';
      if (prediction === 'X2') return (matchResult === 'X' || matchResult === '2') ? 'won' : 'lost';
      if (prediction === '12') return (matchResult === '1' || matchResult === '2') ? 'won' : 'lost';
      return matchResult === prediction ? 'won' : 'lost';

    case 'over_under':
      if (prediction === 'Over') return totalGoals > 2.5 ? 'won' : 'lost';
      if (prediction === 'Under') return totalGoals < 2.5 ? 'won' : 'lost';
      return 'lost';

    case 'btts':
      if (prediction === 'Yes') return bothScored ? 'won' : 'lost';
      if (prediction === 'No') return !bothScored ? 'won' : 'lost';
      return 'lost';

    default:
      return 'lost';
  }
}

export async function POST(request: NextRequest) {
  try {
    // API key kontrolü (n8n'den çağrılacak)
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.CRON_SECRET || 'your-secret-key';
    
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting coupon settlement...');

    // 1. Bekleyen maçları bul (son 2 gün)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: pendingMatches, error: fetchError } = await supabaseAdmin
      .from('coupon_matches')
      .select('*')
      .eq('status', 'pending')
      .lt('match_date', new Date().toISOString())
      .gt('match_date', twoDaysAgo.toISOString());

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingMatches || pendingMatches.length === 0) {
      return NextResponse.json({ message: 'No pending matches to settle', settled: 0 });
    }

    console.log(`📋 Found ${pendingMatches.length} pending matches`);

    // 2. Unique fixture ID'leri al
    const fixtureIds = [...new Set(pendingMatches.map(m => m.fixture_id))];
    
    // 3. Sportmonks'tan sonuçları çek
    const settledMatches: any[] = [];
    
    for (const fixtureId of fixtureIds) {
      try {
        const response = await fetch(
          `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores`
        );
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const fixture = data.data;
        
        // Maç bitti mi kontrol et
        if (!fixture || fixture.state?.short !== 'FT') continue;
        
        // Skorları al
        const scores = fixture.scores || [];
        const homeScore = scores.find((s: any) => s.participant === 'home' && s.description === 'CURRENT')?.score || 0;
        const awayScore = scores.find((s: any) => s.participant === 'away' && s.description === 'CURRENT')?.score || 0;
        
        // Bu fixture'a ait tüm kupon maçlarını güncelle
        const matchesToUpdate = pendingMatches.filter(m => m.fixture_id === fixtureId);
        
        for (const match of matchesToUpdate) {
          const status = checkPrediction(match.bet_type, match.prediction, homeScore, awayScore);
          
          await supabaseAdmin
            .from('coupon_matches')
            .update({
              home_score: homeScore,
              away_score: awayScore,
              actual_result: determineMatchResult(homeScore, awayScore),
              status: status,
              settled_at: new Date().toISOString()
            })
            .eq('id', match.id);
          
          settledMatches.push({
            fixture_id: fixtureId,
            match: `${match.home_team} vs ${match.away_team}`,
            score: `${homeScore}-${awayScore}`,
            prediction: match.prediction,
            status
          });
        }
        
        // match_results cache'e kaydet
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

    console.log(`✅ Settled ${settledMatches.length} matches`);

    // 4. Kuponları güncelle
    const couponIds = [...new Set(pendingMatches.map(m => m.coupon_id))];
    let couponsWon = 0;
    let couponsLost = 0;

    for (const couponId of couponIds) {
      // Bu kuponun tüm maçlarını al
      const { data: couponMatches } = await supabaseAdmin
        .from('coupon_matches')
        .select('status')
        .eq('coupon_id', couponId);

      if (!couponMatches) continue;

      const allSettled = couponMatches.every(m => m.status !== 'pending');
      if (!allSettled) continue; // Hala bekleyen maç var

      const allWon = couponMatches.every(m => m.status === 'won');
      const anyLost = couponMatches.some(m => m.status === 'lost');

      let couponStatus = 'pending';
      if (allWon) {
        couponStatus = 'won';
        couponsWon++;
      } else if (anyLost) {
        couponStatus = 'lost';
        couponsLost++;
      }

      // Kuponu güncelle
      const { data: coupon } = await supabaseAdmin
        .from('coupons')
        .select('user_id, total_odds')
        .eq('id', couponId)
        .single();

      if (coupon && couponStatus !== 'pending') {
        // Puan hesapla (sadece kazananlara)
        const pointsEarned = couponStatus === 'won' ? Math.round((coupon.total_odds || 1) * 10) : 0;

        await supabaseAdmin
          .from('coupons')
          .update({
            status: couponStatus,
            points_earned: pointsEarned,
            settled_at: new Date().toISOString()
          })
          .eq('id', couponId);

        // Kullanıcı puanını güncelle
        if (couponStatus === 'won' && coupon.user_id) {
          await supabaseAdmin.rpc('increment_user_points', {
            p_user_id: coupon.user_id,
            p_points: pointsEarned
          });
        }
      }
    }

    // 5. Liderlik tablosunu güncelle
    await updateLeaderboard();

    return NextResponse.json({
      success: true,
      settled: settledMatches.length,
      couponsWon,
      couponsLost,
      details: settledMatches
    });

  } catch (error: any) {
    console.error('Settlement error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Liderlik tablosunu güncelle
async function updateLeaderboard() {
  try {
    await supabaseAdmin.rpc('update_leaderboard');
  } catch (err) {
    console.error('Leaderboard update error:', err);
  }
}

// GET endpoint - manuel test için
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST with Bearer token to settle coupons',
    endpoint: '/api/settle-coupons'
  });
}
