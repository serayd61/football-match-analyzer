export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const leagueId = searchParams.get('league');

    let url = `https://api.sportmonks.com/v3/football/fixtures/date/${date}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;scores&per_page=50`;

    if (leagueId) {
      url += `&filters=league_id:${leagueId}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!data.data) {
      return NextResponse.json({ matches: [], total: 0 });
    }

    const matches = data.data.map((fixture: any) => {
      const homeTeam = fixture.participants?.find((p: any) => p.meta?.location === 'home');
      const awayTeam = fixture.participants?.find((p: any) => p.meta?.location === 'away');

      return {
        id: fixture.id,
        homeTeam: homeTeam?.name || 'Unknown',
        awayTeam: awayTeam?.name || 'Unknown',
        homeTeamId: homeTeam?.id,
        awayTeamId: awayTeam?.id,
        league: fixture.league?.name || 'Unknown League',
        leagueId: fixture.league?.id,
        venue: fixture.venue?.name,
        date: fixture.starting_at,
        status: fixture.state?.state || 'NS',
      };
    });

    return NextResponse.json({
      matches,
      total: matches.length,
      date,
    });

  } catch (error: any) {
    console.error('Matches fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
