// ============================================================================
// SURVIVAL AGENT API - Test & Debug endpoint
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { predict } from '@/lib/survival-agent';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league') || 'Premier League';
    const home = searchParams.get('home') || '';
    const away = searchParams.get('away') || '';
    const homeOdds = searchParams.get('homeOdds') ? parseFloat(searchParams.get('homeOdds')!) : undefined;

    if (!home || !away) {
      return NextResponse.json({ error: 'home and away parameters required' }, { status: 400 });
    }

    const prediction = await predict({
      league,
      homeTeam: home,
      awayTeam: away,
      homeOdds,
    });

    return NextResponse.json({
      success: true,
      agent: 'SURVIVAL_AGENT',
      input: { league, home, away, homeOdds },
      prediction,
    });
  } catch (error: any) {
    console.error('❌ Survival Agent API error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
