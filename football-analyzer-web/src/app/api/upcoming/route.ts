import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingMatches, CompetitionKey, COMPETITIONS } from '@/lib/football-api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const competition = (searchParams.get('competition') || 'premier_league') as CompetitionKey;

  if (!COMPETITIONS[competition]) {
    return NextResponse.json(
      { error: 'Invalid competition' },
      { status: 400 }
    );
  }

  try {
    const matches = await getUpcomingMatches(competition, process.env.FOOTBALL_DATA_API_KEY);
    return NextResponse.json({
      competition: COMPETITIONS[competition],
      matches,
    });
  } catch (error: any) {
    console.error('Upcoming API Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
