// src/app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Liderlik tablosu
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const period = searchParams.get('period') || 'monthly'; // monthly, alltime
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (period === 'monthly') {
      // Aylık liderlik tablosu
      const leaderboard = await prisma.monthlyLeaderboard.findMany({
        where: {
          year,
          month,
          totalPoints: { gt: 0 },
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
        orderBy: { totalPoints: 'desc' },
        take: limit,
      });
      
      // Rank ekle
      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));
      
      return NextResponse.json({
        period: 'monthly',
        year,
        month,
        leaderboard: rankedLeaderboard,
      });
    } else {
      // All-time liderlik tablosu
      const users = await prisma.user.findMany({
        where: {
          totalPoints: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          image: true,
          totalPoints: true,
          _count: {
            select: { coupons: true },
          },
        },
        orderBy: { totalPoints: 'desc' },
        take: limit,
      });
      
      // Kazanma oranını hesapla
      const leaderboardWithStats = await Promise.all(
        users.map(async (user, index) => {
          const stats = await prisma.coupon.aggregate({
            where: { userId: user.id },
            _count: { id: true },
          });
          
          const wonCount = await prisma.coupon.count({
            where: { userId: user.id, status: 'WON' },
          });
          
          return {
            rank: index + 1,
            userId: user.id,
            userName: user.name,
            userImage: user.image,
            totalPoints: user.totalPoints || 0,
            totalCoupons: stats._count.id,
            wonCoupons: wonCount,
            winRate: stats._count.id > 0 
              ? Math.round((wonCount / stats._count.id) * 100) 
              : 0,
          };
        })
      );
      
      return NextResponse.json({
        period: 'alltime',
        leaderboard: leaderboardWithStats,
      });
    }
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
