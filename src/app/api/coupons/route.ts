// src/app/api/coupons/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePoints } from '@/types/coupon';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id || (session?.user as any)?.sub;
    const { searchParams } = new URL(request.url);
    
    const filter = searchParams.get('filter') || 'public';
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    let query = supabaseAdmin
      .from('coupons')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (filter === 'public') {
      query = query.eq('is_public', true);
    } else if (filter === 'my') {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      query = query.eq('user_id', userId);
    }
    
    if (status && status !== 'all') {
      query = query.eq('status', status.toUpperCase());
    }
    
    const { data: coupons, count, error } = await query;
    
    if (error) throw error;
    
    // Get picks and users for each coupon
    const couponsWithDetails = await Promise.all(
      (coupons || []).map(async (coupon) => {
        const { data: picks } = await supabaseAdmin
          .from('coupon_picks')
          .select('*')
          .eq('coupon_id', coupon.id);
        
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id, name, image')
          .eq('id', coupon.user_id)
          .single();
        
        return { ...coupon, picks: picks || [], user };
      })
    );
    
    return NextResponse.json({
      coupons: couponsWithDetails,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Debug log
    console.log('Session data:', JSON.stringify(session, null, 2));
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 });
    }
    
    // Try multiple ID sources
    let userId = (session.user as any)?.id || 
                 (session.user as any)?.sub;
    
    // If still no ID, try to find user by email
    if (!userId && session.user.email) {
      const { data: userByEmail } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single();
      
      if (userByEmail) {
        userId = userByEmail.id;
      }
    }
    
    console.log('User ID resolved:', userId);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - No user ID found' }, { status: 401 });
    }
    
    const body = await request.json();
    const { picks, title, description, isPublic = true } = body;
    
    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: 'En az 1 bahis eklemelisiniz' }, { status: 400 });
    }
    
    if (picks.length > 10) {
      return NextResponse.json({ error: 'Maksimum 10 bahis' }, { status: 400 });
    }
    
    const totalOdds = picks.reduce((acc: number, pick: any) => acc * pick.odds, 1);
    const potentialPoints = calculatePoints(totalOdds, picks.length);
    
    const { data: coupon, error: couponError } = await supabaseAdmin
      .from('coupons')
      .insert({
        user_id: userId,
        title: title || `${picks.length} Maçlık Kupon`,
        description,
        is_public: isPublic,
        total_odds: Math.round(totalOdds * 100) / 100,
        status: 'PENDING',
        points_earned: 0,
      })
      .select()
      .single();
    
    if (couponError) {
      console.error('Coupon insert error:', couponError);
      throw couponError;
    }
    
    const picksToInsert = picks.map((pick: any) => ({
      coupon_id: coupon.id,
      fixture_id: pick.fixtureId,
      home_team: pick.homeTeam,
      away_team: pick.awayTeam,
      league: pick.league || '',
      match_date: pick.matchDate,
      bet_type: pick.betType,
      selection: pick.selection,
      odds: pick.odds,
      result: 'PENDING',
    }));
    
    const { data: insertedPicks, error: picksError } = await supabaseAdmin
      .from('coupon_picks')
      .insert(picksToInsert)
      .select();
    
    if (picksError) {
      console.error('Picks insert error:', picksError);
      throw picksError;
    }
    
    return NextResponse.json({
      success: true,
      coupon: { ...coupon, picks: insertedPicks },
      potentialPoints,
    });
  } catch (error: any) {
    console.error('POST /api/coupons error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
