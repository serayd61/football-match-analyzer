// src/app/api/users/[id]/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Kullanıcı istatistikleri
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    
    // Kullanıcı bilgisi
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        totalPoints: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }
    
    // Kupon istatistikleri
    const couponStats = await prisma.coupon.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });
    
    const totalCoupons = couponStats.reduce((acc, s) => acc + s._count.id, 0);
    const wonCoupons = couponStats.find(s => s.status === 'WON')?._count.id || 0;
    const lostCoupons = couponStats.find(s => s.status === 'LOST')?._count.id || 0;
    const pendingCoupons = couponStats.find(s => s.status === 'PENDING')?._count.id || 0;
    
    // Toplam kazanılan puan
    const pointsResult = await prisma.coupon.aggregate({
      where: { userId, status: 'WON' },
      _sum: { pointsEarned: true },
    });
    
    // Bu ayki sıralama
    const now = new Date();
    const monthlyRank = await prisma.monthlyLeaderboard.findUnique({
      where: {
        userId_year_month: {
          userId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      },
    });
    
    // All-time sıralama hesapla
    const higherRanked = await prisma.user.count({
      where: {
        totalPoints: { gt: user.totalPoints || 0 },
      },
    });
    const allTimeRank = higherRanked + 1;
    
    // En son kuponlar
    const recentCoupons = await prisma.coupon.findMany({
      where: { userId, isPublic: true },
      include: {
        picks: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    // Kazanılan ödüller
    const prizes = await prisma.monthlyLeaderboard.findMany({
      where: { userId, isWinner: true },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    
    return NextResponse.json({
      user: {
        ...user,
        totalPoints: user.totalPoints || 0,
      },
      stats: {
        totalCoupons,
        wonCoupons,
        lostCoupons,
        pendingCoupons,
        winRate: totalCoupons > 0 ? Math.round((wonCoupons / (totalCoupons - pendingCoupons || 1)) * 100) : 0,
        totalPointsEarned: pointsResult._sum.pointsEarned || 0,
      },
      rankings: {
        allTime: allTimeRank,
        monthly: monthlyRank ? {
          rank: monthlyRank.rank,
          points: monthlyRank.totalPoints,
        } : null,
      },
      recentCoupons,
      prizes: prizes.map(p => ({
        year: p.year,
        month: p.month,
        points: p.totalPoints,
      })),
    });
  } catch (error: any) {
    console.error('Get user stats error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
