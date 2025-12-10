// src/app/api/daily-coupons/settle/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET || 'tipster-league-secret-2024';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MatchResult {
  fixture_id: number;
  home_score: number;
  away_score: number;
  status: string;
  winner: '1' | 'X' | '2';
  total_goals: number;
  btts: boolean;
}

// Sportmonks'tan maç sonuçlarını çek
async function fetchMatchResults(fixtureIds: number[]): Promise<Map<number, MatchResult>> {
  const results = new Map<number, MatchResult>();
  
  if (!SPORTMONKS_API_KEY || fixtureIds.length === 0) {
    console.log('⚠️ No API key or no fixtures to check');
    return results;
  }

  for (const fixtureId of fixtureIds) {
    try {
      const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.data) {
        const fixture = data.data;
        
        const isFinished = fixture.state_id === 5 || 
                          fixture.state?.name === 'FT' || 
                          fixture.state?.short_name === 'FT';
        
        if (!isFinished) {
          console.log(`   ⏳ Fixture ${fixtureId}: Not finished yet (state: ${fixture.state_id})`);
          continue;
        }

        let homeScore = 0;
        let awayScore = 0;

        if (fixture.scores && Array.isArray(fixture.scores)) {
          const currentScores = fixture.scores.filter((s: any) => 
            s.description === 'CURRENT' || s.type_id === 1525
          );

          currentScores.forEach((s: any) => {
            const participant = s.score?.participant;
            const goals = s.score?.goals ?? 0;
            
            if (participant === 'home') {
              homeScore = goals;
            } else if (participant === 'away') {
              awayScore = goals;
            }
          });
        }

        let winner: '1' | 'X' | '2' = 'X';
        if (homeScore > awayScore) winner = '1';
        else if (awayScore > homeScore) winner = '2';

        const result: MatchResult = {
          fixture_id: fixtureId,
          home_score: homeScore,
          away_score: awayScore,
          status: 'finished',
          winner,
          total_goals: homeScore + awayScore,
          btts: homeScore > 0 && awayScore > 0,
        };

        results.set(fixtureId, result);
        console.log(`   ✅ Fixture ${fixtureId}: ${homeScore}-${awayScore} → Winner: ${winner}, Total: ${result.total_goals}, BTTS: ${result.btts}`);
      }
    } catch (error) {
      console.error(`   ❌ Error fetching fixture ${fixtureId}:`, error);
    }
  }

  return results;
}

// Bahis sonucunu değerlendir
function evaluateBet(match: any, result: MatchResult): { won: boolean; reason: string } {
  const betType = match.bet_type;
  const selection = match.selection?.toString().toUpperCase();

  if (betType === 'MATCH_RESULT') {
    if (selection === '1') {
      return { 
        won: result.winner === '1', 
        reason: `MS 1 → Sonuç: ${result.home_score}-${result.away_score} (${result.winner === '1' ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
    if (selection === '2') {
      return { 
        won: result.winner === '2', 
        reason: `MS 2 → Sonuç: ${result.home_score}-${result.away_score} (${result.winner === '2' ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
    if (selection === 'X') {
      return { 
        won: result.winner === 'X', 
        reason: `MS X → Sonuç: ${result.home_score}-${result.away_score} (${result.winner === 'X' ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
    if (selection === '1X') {
      return { 
        won: result.winner === '1' || result.winner === 'X', 
        reason: `MS 1X → Sonuç: ${result.home_score}-${result.away_score} (${result.winner !== '2' ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
    if (selection === 'X2') {
      return { 
        won: result.winner === 'X' || result.winner === '2', 
        reason: `MS X2 → Sonuç: ${result.home_score}-${result.away_score} (${result.winner !== '1' ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
    if (selection === '12') {
      return { 
        won: result.winner === '1' || result.winner === '2', 
        reason: `MS 12 → Sonuç: ${result.home_score}-${result.away_score} (${result.winner !== 'X' ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
  }

  if (betType === 'OVER_UNDER') {
    const isOver = selection?.includes('OVER') || selection?.includes('ÜST');
    const threshold = 2.5;
    
    if (isOver) {
      return { 
        won: result.total_goals > threshold, 
        reason: `Üst 2.5 → Toplam gol: ${result.total_goals} (${result.total_goals > threshold ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    } else {
      return { 
        won: result.total_goals < threshold, 
        reason: `Alt 2.5 → Toplam gol: ${result.total_goals} (${result.total_goals < threshold ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
  }

  if (betType === 'BTTS') {
    const isBttsYes = selection?.includes('YES') || selection?.includes('VAR') || selection?.includes('EVET');
    
    if (isBttsYes) {
      return { 
        won: result.btts, 
        reason: `KG Var → ${result.home_score}-${result.away_score} (${result.btts ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    } else {
      return { 
        won: !result.btts, 
        reason: `KG Yok → ${result.home_score}-${result.away_score} (${!result.btts ? 'KAZANDI ✅' : 'KAYBETTİ ❌'})` 
      };
    }
  }

  return { won: false, reason: 'Bilinmeyen bahis türü' };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n🎯 ═══════════════════════════════════════════════════');
    console.log('🎯 DAILY COUPON SETTLEMENT');
    console.log('🎯 ═══════════════════════════════════════════════════\n');

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: pendingCoupons, error: fetchError } = await supabase
      .from('daily_coupons')
      .select('*')
      .eq('status', 'pending')
      .gte('date', threeDaysAgo.toISOString().split('T')[0]);

    if (fetchError) {
      console.error('❌ Error fetching coupons:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingCoupons || pendingCoupons.length === 0) {
      console.log('ℹ️ No pending coupons to settle');
      return NextResponse.json({ 
        success: true, 
        message: 'No pending coupons',
        settled: 0 
      });
    }

    console.log(`📋 Found ${pendingCoupons.length} pending coupon(s)\n`);

    const settledCoupons: any[] = [];

    for (const coupon of pendingCoupons) {
      console.log(`\n📦 Processing: ${coupon.coupon_type} coupon (${coupon.date})`);
      
      const matches = coupon.matches || [];
      if (matches.length === 0) {
        console.log('   ⚠️ No matches in coupon, skipping');
        continue;
      }

      const fixtureIds = matches.map((m: any) => m.fixture_id).filter(Boolean);
      console.log(`   🔍 Checking ${fixtureIds.length} fixtures: ${fixtureIds.join(', ')}`);

      const results = await fetchMatchResults(fixtureIds);
      console.log(`   📊 Got results for ${results.size}/${fixtureIds.length} fixtures`);

      if (results.size < fixtureIds.length) {
        console.log(`   ⏳ Not all matches finished yet (${results.size}/${fixtureIds.length})`);
        continue;
      }

      let allWon = true;
      let wonCount = 0;
      const evaluations: any[] = [];

      for (const match of matches) {
        const result = results.get(match.fixture_id);
        if (!result) {
          console.log(`   ⚠️ No result for fixture ${match.fixture_id}`);
          allWon = false;
          continue;
        }

        const evaluation = evaluateBet(match, result);
        evaluations.push({
          match: `${match.home_team} vs ${match.away_team}`,
          fixture_id: match.fixture_id,
          bet: `${match.bet_type} - ${match.selection}`,
          result: `${result.home_score}-${result.away_score}`,
          won: evaluation.won,
          reason: evaluation.reason,
        });

        if (evaluation.won) {
          wonCount++;
        } else {
          allWon = false;
        }

        console.log(`   ${evaluation.won ? '✅' : '❌'} ${match.home_team} vs ${match.away_team}: ${evaluation.reason}`);
      }

      let newStatus = 'lost';
      if (allWon) {
        newStatus = 'won';
      } else if (wonCount > 0) {
        newStatus = 'partial';
      }

      console.log(`\n   📊 Result: ${wonCount}/${matches.length} won → Status: ${newStatus.toUpperCase()}`);

      const { error: updateError } = await supabase
        .from('daily_coupons')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', coupon.id);

      if (updateError) {
        console.error(`   ❌ Error updating coupon: ${updateError.message}`);
      } else {
        console.log(`   ✅ Coupon updated to: ${newStatus}`);
        settledCoupons.push({
          id: coupon.id,
          type: coupon.coupon_type,
          date: coupon.date,
          status: newStatus,
          wonCount,
          totalMatches: matches.length,
          totalOdds: coupon.total_odds,
          evaluations,
        });
      }
    }

    console.log('\n🎯 ═══════════════════════════════════════════════════');
    console.log(`🎯 SETTLEMENT COMPLETE: ${settledCoupons.length} coupon(s) settled`);
    console.log('🎯 ═══════════════════════════════════════════════════\n');

    return NextResponse.json({
      success: true,
      settled: settledCoupons.length,
      coupons: settledCoupons,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Settlement error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: coupons, error } = await supabase
      .from('daily_coupons')
      .select('*')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats = {
      total: coupons?.length || 0,
      won: coupons?.filter(c => c.status === 'won').length || 0,
      lost: coupons?.filter(c => c.status === 'lost').length || 0,
      partial: coupons?.filter(c => c.status === 'partial').length || 0,
      pending: coupons?.filter(c => c.status === 'pending').length || 0,
    };

    return NextResponse.json({
      success: true,
      stats,
      coupons: coupons?.map(c => ({
        id: c.id,
        date: c.date,
        type: c.coupon_type,
        status: c.status,
        totalOdds: c.total_odds,
        confidence: c.confidence,
        matchCount: c.matches?.length || 0,
      })),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
