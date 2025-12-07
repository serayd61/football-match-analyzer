// src/app/api/cron/settle-coupons/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Bu endpoint Vercel Cron veya external cron service tarafından çağrılır
// vercel.json'a ekle:
// {
//   "crons": [
//     {
//       "path": "/api/cron/settle-coupons",
//       "schedule": "0 * * * *"  // Her saat başı
//     }
//   ]
// }

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron secret kontrolü
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // Eğer secret varsa kontrol et
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Settlement endpoint'ini çağır
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/coupons/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret || ''}`,
      },
    });
    
    const data = await response.json();
    
    console.log(`🕐 Cron job completed: ${data.settledCoupons} coupons, ${data.updatedPicks} picks`);
    
    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// POST da destekle (manual trigger için)
export async function POST(request: NextRequest) {
  return GET(request);
}
