// src/app/api/cron/monthly-prize/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Bu endpoint her ayın 1'inde çalışır
// vercel.json'a ekle:
// {
//   "crons": [
//     {
//       "path": "/api/cron/monthly-prize",
//       "schedule": "0 0 1 * *"  // Her ayın 1'i gece yarısı
//     }
//   ]
// }

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron secret kontrolü
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Monthly prize endpoint'ini çağır
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/coupons/monthly-prize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret || ''}`,
      },
    });
    
    const data = await response.json();
    
    if (data.winner) {
      console.log(`🏆 Monthly prize awarded to: ${data.winner.userName}`);
      console.log(`   Points: ${data.winner.totalPoints}`);
      console.log(`   Prize end date: ${data.prizeEndDate}`);
    }
    
    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Monthly prize cron error:', error);
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
