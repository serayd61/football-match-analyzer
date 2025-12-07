// src/app/api/coupons/settle/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkPickResult, calculatePoints } from '@/types/coupon';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

// POST - Kuponları sonuçlandır (Cron job veya manual trigger)
export async function POST(request: NextRequest) {
  try {
    // API key kontrolü (güvenlik için)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🎫 Starting coupon settlement...');
    
    // Pending kuponları al (maç tarihi geçmiş olanlar)
    const pendingCoupons = await prisma.coupon.findMany({
      where: {
        status: 'PENDING',
        picks: {
          some: {
            matchDate: { lt: new Date() },
            result: 'PENDING',
          },
        },
      },
      include: {
        picks: true,
      },
    });
    
    console.log(`📋 Found ${pendingCoupons.length} pending coupons to check`);
    
    let settledCount = 0;
    let updatedPicks = 0;
    
    for (const coupon of pendingCoupons) {
      let allSettled = true;
      let allWon = true;
      let anyLost = false;
      
      for (const pick of coupon.picks) {
        // Zaten sonuçlanmış pick'leri atla
        if (pick.result !== 'PENDING') {
          if (pick.result === 'LOST') anyLost = true;
          if (pick.result !== 'WON') allWon = false;
          continue;
        }
        
        // Maç henüz başlamamışsa atla
        if (new Date(pick.matchDate) > new Date()) {
          allSettled = false;
          continue;
        }
        
        // Sportmonks'tan maç sonucunu çek
        try {
          const fixtureRes = await fetch(
            `${BASE_URL}/fixtures/${pick.fixtureId}?api_token=${SPORTMONKS_API_KEY}&include=scores`
          );
          
          if (!fixtureRes.ok) {
            console.error(`Failed to fetch fixture ${pick.fixtureId}`);
            allSettled = false;
            continue;
          }
          
          const fixtureData = await fixtureRes.json();
          const fixture = fixtureData.data;
          
          // Maç bitmiş mi kontrol et (state_id: 5 = Finished)
          if (fixture.state_id !== 5) {
            allSettled = false;
            continue;
          }
          
          // Skorları çıkar
          const scores = fixture.scores || [];
          const currentScores = scores.filter(
            (s: any) => s.description === 'CURRENT' || s.type_id === 1525
          );
          
          let homeScore = 0;
          let awayScore = 0;
          
          currentScores.forEach((s: any) => {
            const participant = s.score?.participant;
            const goals = s.score?.goals ?? 0;
            
            if (participant === 'home') {
              homeScore = goals;
            } else if (participant === 'away') {
              awayScore = goals;
            }
          });
          
          // Pick sonucunu belirle
          const result = checkPickResult(pick as any, homeScore, awayScore);
          
          // Pick'i güncelle
          await prisma.couponPick.update({
            where: { id: pick.id },
            data: {
              result,
              homeScore,
              awayScore,
            },
          });
          
          updatedPicks++;
          console.log(`   ✅ ${pick.homeTeam} vs ${pick.awayTeam}: ${homeScore}-${awayScore} → ${result}`);
          
          if (result === 'LOST') {
            anyLost = true;
            allWon = false;
          } else if (result !== 'WON') {
            allWon = false;
          }
          
        } catch (error) {
          console.error(`Error checking fixture ${pick.fixtureId}:`, error);
          allSettled = false;
        }
      }
      
      // Kupon durumunu güncelle
      if (allSettled) {
        const newStatus = anyLost ? 'LOST' : (allWon ? 'WON' : 'PARTIAL');
        const pointsEarned = newStatus === 'WON' 
          ? calculatePoints(coupon.totalOdds, coupon.picks.length)
          : 0;
        
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: {
            status: newStatus,
            pointsEarned,
            settledAt: new Date(),
          },
        });
        
        // Kazandıysa kullanıcı puanını güncelle
        if (newStatus === 'WON' && pointsEarned > 0) {
          // Toplam puan güncelle
          await prisma.user.update({
            where: { id: coupon.userId },
            data: {
              totalPoints: { increment: pointsEarned },
            },
          });
          
          // Aylık liderlik tablosunu güncelle
          const now = new Date();
          await prisma.monthlyLeaderboard.upsert({
            where: {
              userId_year_month: {
                userId: coupon.userId,
                year: now.getFullYear(),
                month: now.getMonth() + 1,
              },
            },
            update: {
              totalPoints: { increment: pointsEarned },
              totalCoupons: { increment: 1 },
              wonCoupons: { increment: 1 },
            },
            create: {
              userId: coupon.userId,
              year: now.getFullYear(),
              month: now.getMonth() + 1,
              totalPoints: pointsEarned,
              totalCoupons: 1,
              wonCoupons: 1,
            },
          });
          
          console.log(`   🎉 Coupon WON! User earned ${pointsEarned} points`);
        } else if (newStatus === 'LOST') {
          // Kaybedilen kupon için de istatistik güncelle
          const now = new Date();
          await prisma.monthlyLeaderboard.upsert({
            where: {
              userId_year_month: {
                userId: coupon.userId,
                year: now.getFullYear(),
                month: now.getMonth() + 1,
              },
            },
            update: {
              totalCoupons: { increment: 1 },
              lostCoupons: { increment: 1 },
            },
            create: {
              userId: coupon.userId,
              year: now.getFullYear(),
              month: now.getMonth() + 1,
              totalCoupons: 1,
              lostCoupons: 1,
            },
          });
        }
        
        settledCount++;
        console.log(`   📊 Coupon ${coupon.id}: ${newStatus}`);
      }
    }
    
    // Win rate güncelle
    await updateWinRates();
    
    console.log(`✅ Settlement complete: ${settledCount} coupons, ${updatedPicks} picks`);
    
    return NextResponse.json({
      success: true,
      settledCoupons: settledCount,
      updatedPicks,
    });
  } catch (error: any) {
    console.error('Settlement error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Win rate hesapla ve güncelle
async function updateWinRates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  const leaderboardEntries = await prisma.monthlyLeaderboard.findMany({
    where: { year, month },
  });
  
  for (const entry of leaderboardEntries) {
    if (entry.totalCoupons > 0) {
      const winRate = (entry.wonCoupons / entry.totalCoupons) * 100;
      await prisma.monthlyLeaderboard.update({
        where: { id: entry.id },
        data: { winRate: Math.round(winRate * 10) / 10 },
      });
    }
  }
}

