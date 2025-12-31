// ============================================================================
// API: Get Analyses from Performance Tracking
// GET /api/performance/get-analyses
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAnalyses } from '@/lib/performance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/performance/get-analyses called');
    
    const { searchParams } = new URL(request.url);
    
    const settled = searchParams.get('settled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const league = searchParams.get('league');
    
    const options: any = {};
    
    if (settled !== null) {
      options.settled = settled === 'true';
    }
    
    if (limit) {
      options.limit = parseInt(limit, 10);
    }
    
    if (offset) {
      options.offset = parseInt(offset, 10);
    }
    
    if (league) {
      options.league = league;
    }
    
    console.log('   Options:', JSON.stringify(options));
    
    const result = await getAnalyses(options);
    
    console.log(`   Result: ${result.data?.length || 0} records, error: ${result.error || 'none'}`);
    
    if (result.error) {
      console.error('❌ getAnalyses error:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
      limit: options.limit || 50,
      offset: options.offset || 0
    });
    
  } catch (error: any) {
    console.error('❌ Get analyses API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

