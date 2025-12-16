// ============================================================================
// ADMIN API - PREDICTIONS CRUD ENDPOINT
// ============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { savePrediction, getPredictions } from '@/lib/admin/service';
import { SavePredictionRequest } from '@/lib/admin/types';

// GET - List predictions
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') as 'pending' | 'settled' | 'all' | undefined;
    const analysisType = searchParams.get('analysisType') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const result = await getPredictions({
      page,
      limit,
      status: status || 'all',
      analysisType,
      fromDate,
      toDate,
    });

    return NextResponse.json({
      success: true,
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error: any) {
    console.error('Get predictions error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Save new prediction
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SavePredictionRequest = await request.json();

    // Validate required fields
    if (!body.fixtureId || !body.homeTeam || !body.awayTeam) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Add user ID from session (cast to any for extended session)
    body.userId = (session.user as any)?.id || undefined;

    const result = await savePrediction(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.id,
    });
  } catch (error: any) {
    console.error('Save prediction error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

