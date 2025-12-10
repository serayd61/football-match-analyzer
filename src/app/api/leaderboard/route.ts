// src/app/api/leaderboard/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Liderlik tablosu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Profiles tablosundan liderlik verilerini çek
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, total_points, winning_coupons, total_coupons, current_streak, best_streak')
      .gt('total_points', 0)
      .order('total_points', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    // Users tablosundan avatar bilgilerini al
    const emails = (profiles || []).map(p => p.email);
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('email, name, image')
      .in('email', emails);
    
    const usersMap = new Map((users || []).map(u => [u.email, u]));
    
    const leaderboard = (profiles || []).map((profile, index) => {
      const user = usersMap.get(profile.email);
      const winRate = profile.total_coupons > 0 
        ? Math.round((profile.winning_coupons / profile.total_coupons) * 100) 
        : 0;
      
      return {
        rank: index + 1,
        user_id: profile.id,
        user_name: user?.name || profile.name || 'Anonim',
        user_image: user?.image || null,
        total_points: profile.total_points || 0,
        total_coupons: profile.total_coupons || 0,
        won_coupons: profile.winning_coupons || 0,
        win_rate: winRate,
        current_streak: profile.current_streak || 0,
        best_streak: profile.best_streak || 0,
      };
    });
    
    return NextResponse.json({
      period: 'alltime',
      leaderboard,
    });
    
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
