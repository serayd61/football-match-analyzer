// ============================================================================
// ADMIN: CACHE TEMİZLEME API
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { clearMatchCache, clearAllAnalysisCache } from '@/lib/cache/redis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId, clearAll } = body;
    
    // Tüm cache'i temizle
    if (clearAll === true) {
      const result = await clearAllAnalysisCache();
      return NextResponse.json({
        success: true,
        message: `Tüm analiz cache'leri temizlendi`,
        cleared: result.cleared
      });
    }
    
    // Belirli bir maç için cache temizle
    if (fixtureId) {
      const result = await clearMatchCache(Number(fixtureId));
      return NextResponse.json({
        success: true,
        message: `Fixture ${fixtureId} cache'i temizlendi`,
        cleared: result.cleared
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'fixtureId veya clearAll parametresi gerekli',
      usage: {
        clearSingleMatch: { fixtureId: 12345 },
        clearAllAnalysis: { clearAll: true }
      }
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('Cache clear error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/clear-cache',
    methods: ['POST'],
    usage: {
      clearSingleMatch: {
        method: 'POST',
        body: { fixtureId: 12345 },
        description: 'Belirli bir maç için cache temizler'
      },
      clearAllAnalysis: {
        method: 'POST',
        body: { clearAll: true },
        description: 'Tüm analiz cache\'lerini temizler'
      }
    }
  });
}
