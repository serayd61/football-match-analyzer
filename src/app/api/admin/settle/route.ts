// ============================================================================
// ADMIN API - SETTLE PREDICTIONS ENDPOINT
// ============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { settleMatchResult } from '@/lib/admin/service';
import { SettlePredictionRequest } from '@/lib/admin/types';

// POST - Settle a match result
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SettlePredictionRequest = await request.json();

    // Validate required fields
    if (body.fixtureId === undefined || body.homeScore === undefined || body.awayScore === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: fixtureId, homeScore, awayScore' },
        { status: 400 }
      );
    }

    const result = await settleMatchResult(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settle prediction error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

