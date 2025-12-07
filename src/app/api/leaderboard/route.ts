// src/app/api/leaderboard/route.ts
export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Liderlik tablosu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const period = searchParams.get('period') || 'monthly';
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (period === 'monthly') {
      const { data: leaderboard, error } = await supabaseAdmin
        .from('monthly_leaderboard')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .gt('total_points', 0)
        .order('total_points', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      // User bilgilerini al
      const userIds = (leaderboard || []).map(e => e.user_id);
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, name, image')
        .in('id', userIds);
      
      const usersMap = new Map((users || []).map(u => [u.id, u]));
      
      const rankedLeaderboard = (leaderboard || []).map((entry, index) => {
        const user = usersMap.get(entry.user_id);
        return {
          rank: index + 1,
          user_id: entry.user_id,
          user_name: user?.name || 'Anonim',
          user_image: user?.image,
          total_points: entry.total_points,
          total_coupons: entry.total_coupons,
          won_coupons: entry.won_coupons,
          win_rate: entry.win_rate,
        };
      });
      
      return NextResponse.json({
        period: 'monthly',
        year,
        month,
        leaderboard: rankedLeaderboard,
      });
    } else {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, name, image, total_points')
        .gt('total_points', 0)
        .order('total_points', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      const leaderboard = (users || []).map((user, index) => ({
        rank: index + 1,
        user_id: user.id,
        user_name: user.name || 'Anonim',
        user_image: user.image,
        total_points: user.total_points || 0,
        total_coupons: 0,
        won_coupons: 0,
        win_rate: 0,
      }));
      
      return NextResponse.json({
        period: 'alltime',
        leaderboard,
      });
    }
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
