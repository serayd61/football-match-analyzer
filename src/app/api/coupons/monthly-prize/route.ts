// src/app/api/coupons/monthly-prize/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json().catch(() => ({}));
    
    const now = new Date();
    const targetYear = body.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const targetMonth = body.month || (now.getMonth() === 0 ? 12 : now.getMonth());
    
    const { data: topUsers, error } = await supabaseAdmin
      .from('monthly_leaderboard')
      .select('*')
      .eq('year', targetYear)
      .eq('month', targetMonth)
      .gt('total_points', 0)
      .eq('prize_given', false)
      .order('total_points', { ascending: false })
      .limit(3);
    
    if (error) throw error;
    
    if (!topUsers || topUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible winners' });
    }
    
    const winner = topUsers[0];
    
    // Get winner user info
    const { data: winnerUser } = await supabaseAdmin
      .from('users')
      .select('id, name, email, image')
      .eq('id', winner.user_id)
      .single();
    
    // Mark winner
    await supabaseAdmin
      .from('monthly_leaderboard')
      .update({ is_winner: true, prize_given: true, rank: 1 })
      .eq('id', winner.id);
    
    // Give 1 month Pro subscription
    const prizeEndDate = new Date();
    prizeEndDate.setMonth(prizeEndDate.getMonth() + 1);
    
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', winner.user_id)
      .single();
    
    if (existingSub) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'active',
          plan: 'pro',
          current_period_end: prizeEndDate.toISOString(),
        })
        .eq('user_id', winner.user_id);
    } else {
      await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: winner.user_id,
          status: 'active',
          plan: 'pro',
          current_period_start: new Date().toISOString(),
          current_period_end: prizeEndDate.toISOString(),
        });
    }
    
    return NextResponse.json({
      success: true,
      winner: {
        userId: winner.user_id,
        userName: winnerUser?.name,
        totalPoints: winner.total_points,
      },
      prizeEndDate: prizeEndDate.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { data: winners, error } = await supabaseAdmin
      .from('monthly_leaderboard')
      .select('*')
      .eq('is_winner', true)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12);
    
    if (error) throw error;
    
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    // Get user info for winners
    const userIds = (winners || []).map(w => w.user_id);
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name, image')
      .in('id', userIds);
    
    const usersMap = new Map((users || []).map(u => [u.id, u]));
    
    const formattedWinners = (winners || []).map(w => {
      const user = usersMap.get(w.user_id);
      return {
        year: w.year,
        month: w.month,
        monthName: months[w.month - 1],
        userId: w.user_id,
        userName: user?.name || 'Anonim',
        userImage: user?.image,
        totalPoints: w.total_points,
      };
    });
    
    return NextResponse.json({ winners: formattedWinners });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
