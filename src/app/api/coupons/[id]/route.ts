// src/app/api/coupons/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const couponId = params.id;
    
    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('id', couponId)
      .single();
    
    if (error || !coupon) {
      return NextResponse.json({ error: 'Kupon bulunamadı' }, { status: 404 });
    }
    
    if (!coupon.is_public && coupon.user_id !== session?.user?.id) {
      return NextResponse.json({ error: 'Erişim yok' }, { status: 403 });
    }
    
    const { data: picks } = await supabaseAdmin
      .from('coupon_picks')
      .select('*')
      .eq('coupon_id', couponId);
    
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, image')
      .eq('id', coupon.user_id)
      .single();
    
    return NextResponse.json({ 
      coupon: { ...coupon, picks: picks || [], user }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const couponId = params.id;
    
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('user_id, status')
      .eq('id', couponId)
      .single();
    
    if (!coupon) {
      return NextResponse.json({ error: 'Kupon bulunamadı' }, { status: 404 });
    }
    
    if (coupon.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Yetki yok' }, { status: 403 });
    }
    
    if (coupon.status !== 'PENDING') {
      return NextResponse.json({ error: 'Sadece bekleyen kuponlar silinebilir' }, { status: 400 });
    }
    
    await supabaseAdmin.from('coupon_picks').delete().eq('coupon_id', couponId);
    await supabaseAdmin.from('coupons').delete().eq('id', couponId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const couponId = params.id;
    const { isPublic } = await request.json();
    
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('user_id')
      .eq('id', couponId)
      .single();
    
    if (!coupon || coupon.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Yetki yok' }, { status: 403 });
    }
    
    const { data: updated } = await supabaseAdmin
      .from('coupons')
      .update({ is_public: isPublic })
      .eq('id', couponId)
      .select()
      .single();
    
    return NextResponse.json({ success: true, coupon: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
