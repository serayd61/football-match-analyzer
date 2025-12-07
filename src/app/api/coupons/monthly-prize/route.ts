// src/app/api/coupons/monthly-prize/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST - Aylık ödül dağıtımı (Her ayın 1'inde çalışır)
export async function POST(request: NextRequest) {
  try {
    // API key kontrolü
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json().catch(() => ({}));
    
    // Hangi ayın ödülünü dağıtacağız
    const now = new Date();
    const targetYear = body.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const targetMonth = body.month || (now.getMonth() === 0 ? 12 : now.getMonth());
    
    console.log(`🏆 Processing monthly prize for ${targetYear}-${targetMonth}`);
    
    // O ayın liderlik tablosunu al
    const topUsers = await prisma.monthlyLeaderboard.findMany({
      where: {
        year: targetYear,
        month: targetMonth,
        totalPoints: { gt: 0 },
        prizeGiven: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { totalPoints: 'desc' },
      take: 3, // İlk 3
    });
    
    if (topUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible winners for this month',
      });
    }
    
    const winner = topUsers[0];
    
    // Kazananı işaretle
    await prisma.monthlyLeaderboard.update({
      where: { id: winner.id },
      data: {
        isWinner: true,
        prizeGiven: true,
        rank: 1,
      },
    });
    
    // Diğer sıralamaları güncelle
    for (let i = 1; i < topUsers.length; i++) {
      await prisma.monthlyLeaderboard.update({
        where: { id: topUsers[i].id },
        data: { rank: i + 1 },
      });
    }
    
    // Kazanana 1 aylık Pro üyelik ver
    const prizeEndDate = new Date();
    prizeEndDate.setMonth(prizeEndDate.getMonth() + 1);
    
    await prisma.user.update({
      where: { id: winner.userId },
      data: {
        subscriptionStatus: 'active',
        subscriptionEnd: prizeEndDate,
        // Ödül kaydı için özel alan eklenebilir
      },
    });
    
    // Bildirim/email gönder (opsiyonel)
    // await sendPrizeNotification(winner.user);
    
    console.log(`🎉 Winner: ${winner.user.name} with ${winner.totalPoints} points`);
    console.log(`   Prize: 1 month Pro subscription until ${prizeEndDate.toISOString()}`);
    
    // Sonuçları döndür
    return NextResponse.json({
      success: true,
      year: targetYear,
      month: targetMonth,
      winner: {
        userId: winner.userId,
        userName: winner.user.name,
        email: winner.user.email,
        totalPoints: winner.totalPoints,
        totalCoupons: winner.totalCoupons,
        wonCoupons: winner.wonCoupons,
        winRate: winner.winRate,
      },
      runnerUps: topUsers.slice(1).map((u, i) => ({
        rank: i + 2,
        userName: u.user.name,
        totalPoints: u.totalPoints,
      })),
      prizeEndDate,
    });
  } catch (error: any) {
    console.error('Monthly prize error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Geçmiş kazananları listele
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12');
    
    const winners = await prisma.monthlyLeaderboard.findMany({
      where: {
        isWinner: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
      take: limit,
    });
    
    const formattedWinners = winners.map(w => ({
      year: w.year,
      month: w.month,
      monthName: new Date(w.year, w.month - 1).toLocaleString('tr-TR', { month: 'long' }),
      userId: w.userId,
      userName: w.user.name,
      userImage: w.user.image,
      totalPoints: w.totalPoints,
      totalCoupons: w.totalCoupons,
      wonCoupons: w.wonCoupons,
      winRate: w.winRate,
    }));
    
    return NextResponse.json({
      winners: formattedWinners,
    });
  } catch (error: any) {
    console.error('Get winners error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

