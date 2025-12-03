export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runFullAnalysis } from '@/lib/heurist/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fixtureId, homeTeam, awayTeam, homeTeamId, awayTeamId, language = 'en' } = body;

    if (!fixtureId) {
      return NextResponse.json({ error: 'Fixture ID required' }, { status: 400 });
    }

    console.log('AGENT ANALYSIS REQUEST');
    console.log('Match:', homeTeam, 'vs', awayTeam);
    console.log('Language:', language);

    const result = await runFullAnalysis({
      fixtureId,
      homeTeam,
      awayTeam,
      homeTeamId,
      awayTeamId,
      league: '',
      date: '',
    }, language as 'tr' | 'en' | 'de');

    console.log('Agent Analysis Complete');
    console.log('Scout:', result.reports.scout ? 'OK' : 'FAIL');
    console.log('Stats:', result.reports.stats ? 'OK' : 'FAIL');
    console.log('Odds:', result.reports.odds ? 'OK' : 'FAIL');
    console.log('Strategy:', result.reports.strategy ? 'OK' : 'FAIL');
    console.log('Consensus:', result.reports.consensus ? 'OK' : 'FAIL');

    return NextResponse.json({
      success: result.success,
      reports: result.reports,
      timing: result.timing,
      errors: result.errors,
    });

  } catch (error: any) {
    console.error('Agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
