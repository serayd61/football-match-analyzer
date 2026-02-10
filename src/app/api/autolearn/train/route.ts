// ============================================================================
// POST /api/autolearn/train
// Tum settled maclardan model olusturur (ilk egitim + yeniden egitim)
// ============================================================================

import { NextResponse } from 'next/server';
import { trainModel } from '@/lib/autolearn/model';

export const maxDuration = 60; // Vercel timeout: 60 saniye

export async function POST() {
  try {
    console.log('🧠 AutoLearn: Training API called');

    const result = await trainModel();

    return NextResponse.json({
      success: true,
      data: result,
      message: `Model egitildi! ${result.totalPatterns} pattern ogrendi, ${result.matchesProcessed} mac islendi.`
    });
  } catch (error: any) {
    console.error('❌ AutoLearn Train Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Training failed',
      details: error.toString()
    }, { status: 500 });
  }
}

// GET: Model durumunu kontrol et
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/autolearn/train',
    method: 'POST',
    description: 'Tum settled maclardan AutoLearn modelini egitir',
    usage: 'POST istegi gonderin, parametre gerektirmez'
  });
}
