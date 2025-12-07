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
    
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        picks: {
          orderBy: { matchDate: 'asc' },
        },
      },
    });
    
    if (!coupon) {
      return NextResponse.json({ error: 'Kupon bulunamadı' }, { status: 404 });
    }
    
    // Private kupon kontrolü
    if (!coupon.isPublic && coupon.userId !== session?.user?.id) {
      return NextResponse.json({ error: 'Bu kupona erişim yetkiniz yok' }, { status: 403 });
    }
    
    return NextResponse.json({ coupon });
  } catch (error: any) {
    console.error('Get coupon error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Kupon sil (sadece sahibi ve pending ise)
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
    
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });
    
    if (!coupon) {
      return NextResponse.json({ error: 'Kupon bulunamadı' }, { status: 404 });
    }
    
    if (coupon.userId !== session.user.id) {
      return NextResponse.json({ error: 'Bu kuponu silme yetkiniz yok' }, { status: 403 });
    }
    
    if (coupon.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Sadece bekleyen kuponlar silinebilir' 
      }, { status: 400 });
    }
    
    await prisma.coupon.delete({
      where: { id: couponId },
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Kupon silindi' 
    });
  } catch (error: any) {
    console.error('Delete coupon error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Kupon güncelle (visibility toggle)
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
    
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });
    
    if (!coupon) {
      return NextResponse.json({ error: 'Kupon bulunamadı' }, { status: 404 });
    }
    
    if (coupon.userId !== session.user.id) {
      return NextResponse.json({ error: 'Bu kuponu düzenleme yetkiniz yok' }, { status: 403 });
    }
    
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: { isPublic },
      include: {
        picks: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });
    
    return NextResponse.json({ 
      success: true, 
      coupon: updatedCoupon 
    });
  } catch (error: any) {
    console.error('Update coupon error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

