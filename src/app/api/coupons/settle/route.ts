// src/app/api/coupons/settle/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPickResult, calculatePoints } from '@/types/coupon';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get pending coupons
    const { data: pendingCoupons, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('status', 'PENDING');
    
    if (error) throw error;
    
    let settledCount = 0;
    let updatedPicks = 0;
    
    for (const coupon of pendingCoupons || []) {
      // Get picks for this coupon
      const { data: picks } = await supabaseAdmin
        .from('coupon_picks')
        .select('*')
        .eq('coupon_id', coupon.id);
      
      if (!picks || picks.length === 0) continue;
      
      // Check if any picks need settling
      const pendingPicks = picks.filter(
        p => p.result === 'PENDING' && new Date(p.match_date) < new Date()
      );
      
      if (pendingPicks.length === 0) continue;
      
      let allSettled = true;
      let allWon = true;
      let anyLost = false;
      
      for (const pick of picks) {
        if (pick.result !== 'PENDING') {
          if (pick.result === 'LOST') anyLost = true;
          if (pick.result !== 'WON') allWon = false;
          continue;
        }
        
        if (new Date(pick.match_date) > new Date()) {
          allSettled = false;
          continue;
        }
        
        // Fetch from Sportmonks
        try {
          const res = await fetch(
            `https://api.sportmonks.com/v3/football/fixtures/${pick.fixture_id}?api_token=${SPORTMONKS_API_KEY}&include=scores`
          );
          
          if (!res.ok) {
            allSettled = false;
            continue;
          }
          
          const data = await res.json();
          const fixture = data.data;
          
          if (fixture.state_id !== 5) {
            allSettled = false;
            continue;
          }
          
          const scores = fixture.scores || [];
          let homeScore = 0;
          let awayScore = 0;
          
          scores.forEach((s: any) => {
            if (s.description === 'CURRENT' || s.type_id === 1525) {
              if (s.score?.participant === 'home') homeScore = s.score?.goals ?? 0;
              if (s.score?.participant === 'away') awayScore = s.score?.goals ?? 0;
            }
          });
          
          const result = checkPickResult(pick.bet_type, pick.selection, homeScore, awayScore);
          
          await supabaseAdmin
            .from('coupon_picks')
            .update({ result, home_score: homeScore, away_score: awayScore })
            .eq('id', pick.id);
          
          updatedPicks++;
          
          if (result === 'LOST') { anyLost = true; allWon = false; }
          else if (result !== 'WON') { allWon = false; }
          
        } catch (e) {
          allSettled = false;
        }
      }
      
      // Update coupon status if all settled
      if (allSettled) {
        const newStatus = anyLost ? 'LOST' : (allWon ? 'WON' : 'PARTIAL');
        const pointsEarned = newStatus === 'WON' ? calculatePoints(coupon.total_odds, picks.length) : 0;
        
        await supabaseAdmin
          .from('coupons')
          .update({ status: newStatus, points_earned: pointsEarned, settled_at: new Date().toISOString() })
          .eq('id', coupon.id);
        
        // Update user points if won
        if (newStatus === 'WON' && pointsEarned > 0) {
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('total_points')
            .eq('id', coupon.user_id)
            .single();
          
          await supabaseAdmin
            .from('users')
            .update({ total_points: (user?.total_points || 0) + pointsEarned })
            .eq('id', coupon.user_id);
          
          // Update monthly leaderboard
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          
          const { data: existing } = await supabaseAdmin
            .from('monthly_leaderboard')
            .select('*')
            .eq('user_id', coupon.user_id)
            .eq('year', year)
            .eq('month', month)
            .single();
          
          if (existing) {
            await supabaseAdmin
              .from('monthly_leaderboard')
              .update({
                total_points: existing.total_points + pointsEarned,
                total_coupons: existing.total_coupons + 1,
                won_coupons: existing.won_coupons + 1,
              })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin
              .from('monthly_leaderboard')
              .insert({
                user_id: coupon.user_id,
                year,
                month,
                total_points: pointsEarned,
                total_coupons: 1,
                won_coupons: 1,
              });
          }
        }
        
        settledCount++;
      }
    }
    
    return NextResponse.json({ success: true, settledCoupons: settledCount, updatedPicks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
