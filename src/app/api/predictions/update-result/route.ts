// src/app/api/predictions/update-result/route.ts
// Maç sonuçlarını güncelleme API endpoint'i
// n8n workflow'u tarafından çağrılır

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { updatePredictionResult } from '@/lib/predictions';

// API Key kontrolü (basit güvenlik)
const API_SECRET = process.env.PREDICTIONS_API_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    // API Key kontrolü
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    
    if (apiKey !== API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fixtureId, homeScore, awayScore } = body;

    if (!fixtureId || homeScore === undefined || awayScore === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: fixtureId, homeScore, awayScore' 
      }, { status: 400 });
    }

    const result = await updatePredictionResult(fixtureId, homeScore, awayScore);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Result updated for fixture ${fixtureId}: ${homeScore}-${awayScore}` 
    });

  } catch (error: any) {
    console.error('❌ Update result error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Toplu güncelleme endpoint'i
export async function PUT(request: NextRequest) {
  try {
    // API Key kontrolü
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    
    if (apiKey !== API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { results } = body; // Array of { fixtureId, homeScore, awayScore }

    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ 
        error: 'Missing results array' 
      }, { status: 400 });
    }

    const updateResults = await Promise.all(
      results.map(async (r: any) => {
        const result = await updatePredictionResult(r.fixtureId, r.homeScore, r.awayScore);
        return { fixtureId: r.fixtureId, ...result };
      })
    );

    const successful = updateResults.filter(r => r.success).length;
    const failed = updateResults.filter(r => !r.success).length;

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${successful} results, ${failed} failed`,
      details: updateResults
    });

  } catch (error: any) {
    console.error('❌ Bulk update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
