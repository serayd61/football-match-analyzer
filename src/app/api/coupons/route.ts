// src/app/api/coupons/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { calculatePoints } from '@/types/coupon';

// GET - Kuponları listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    
    const filter = searchParams.get('filter') || 'public'; // public, my, user
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const where: any = {};
    
    // Filtre uygula
    if (filter === 'public') {
      where.isPublic = true;
    } else if (filter === 'my') {
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      where.userId = session.user.id;
    } else if (filter === 'user' && userId) {
      where.userId = userId;
      where.isPublic = true;
    }
    
    // Status filtresi
    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }
    
    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.coupon.count({ where }),
    ]);
    
    return NextResponse.json({
      coupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Get coupons error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Yeni kupon oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { picks, title, description, isPublic = true } = body;
    
    // Validasyonlar
    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: 'En az 1 bahis eklemelisiniz' }, { status: 400 });
    }
    
    if (picks.length > 10) {
      return NextResponse.json({ error: 'Maksimum 10 bahis ekleyebilirsiniz' }, { status: 400 });
    }
    
    // Aynı maça birden fazla aynı tip bahis kontrolü
    const pickKeys = picks.map((p: any) => `${p.fixtureId}-${p.betType}`);
    if (new Set(pickKeys).size !== pickKeys.length) {
      return NextResponse.json({ 
        error: 'Aynı maça aynı tipte birden fazla bahis ekleyemezsiniz' 
      }, { status: 400 });
    }
    
    // Geçmiş maç kontrolü
    const now = new Date();
    for (const pick of picks) {
      const matchDate = new Date(pick.matchDate);
      if (matchDate < now) {
        return NextResponse.json({ 
          error: `${pick.homeTeam} vs ${pick.awayTeam} maçı başlamış veya bitmiş` 
        }, { status: 400 });
      }
    }
    
    // Toplam oran hesapla
    const totalOdds = picks.reduce((acc: number, pick: any) => acc * pick.odds, 1);
    
    // Potansiyel puan hesapla
    const potentialPoints = calculatePoints(totalOdds, picks.length);
    
    // Kupon oluştur
    const coupon = await prisma.coupon.create({
      data: {
        userId: session.user.id,
        title: title || `${picks.length} Maçlık Kupon`,
        description,
        isPublic,
        totalOdds: Math.round(totalOdds * 100) / 100,
        picks: {
          create: picks.map((pick: any) => ({
            fixtureId: pick.fixtureId,
            homeTeam: pick.homeTeam,
            awayTeam: pick.awayTeam,
            league: pick.league,
            matchDate: new Date(pick.matchDate),
            betType: pick.betType,
            selection: pick.selection,
            odds: pick.odds,
          })),
        },
      },
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
      coupon,
      potentialPoints,
      message: 'Kupon başarıyla oluşturuldu!',
    });
  } catch (error: any) {
    console.error('Create coupon error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
