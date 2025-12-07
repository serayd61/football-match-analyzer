// src/app/api/coupons/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET - Tek kupon detayı
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
    
    // Private kupon kontrolü
    if (!coupon.is_public && coupon.user_id !== session?.user?.id) {
      return NextResponse.json({ error: 'Bu kupona erişim yetkiniz yok' }, { status: 403 });
    }
    
    // Picks al
    const { data: picks } = await supabaseAdmin
      .from('coupon_picks')
      .select('*')
      .eq('coupon_id', couponId);
    
    // User bilgisini al
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, name, image')
      .eq('id', coupon.user_id)
      .single();
    
    return NextResponse.json({ 
      coupon: {
        ...coupon,
        picks: picks || [],
        user,
      }
    });
  } catch (error: any) {
    console.error('Get coupon error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Kupon sil
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
      .select('id, user_id, status')
      .eq('id', couponId)
      .single();
    
    if (!coupon) {
      return NextResponse.json({ error: 'Kupon bulunamadı' }, { status: 404 });
    }
    
    if (coupon.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Bu kuponu silme yetkiniz yok' }, { status: 403 });
    }
    
    if (coupon.status !== 'PENDING') {
      return NextResponse.json({ error: 'Sadece bekleyen kuponlar silinebilir' }, { status: 400 });
    }
    
    // Picks sil
    await supabaseAdmin
      .from('coupon_picks')
      .delete()
      .eq('coupon_id', couponId);
    
    // Kuponu sil
    await supabaseAdmin
      .from('coupons')
      .delete()
      .eq('id', couponId);
    
    return NextResponse.json({ success: true, message: 'Kupon silindi' });
  } catch (error: any) {
    console.error('Delete coupon error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Kupon güncelle
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
    const body = await request.json();
    const { isPublic } = body;
    
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('id, user_id')
      .eq('id', couponId)
      .single();
    
    if (!coupon) {
      return NextResponse.json({ error: 'Kupon bulunamadı' }, { status: 404 });
    }
    
    if (coupon.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Bu kuponu düzenleme yetkiniz yok' }, { status: 403 });
    }
    
    const { data: updated } = await supabaseAdmin
      .from('coupons')
      .update({ is_public: isPublic })
      .eq('id', couponId)
      .select()
      .single();
    
    return NextResponse.json({ success: true, coupon: u
