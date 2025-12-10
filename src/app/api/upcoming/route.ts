import { NextResponse } from 'next/server';
import { LEAGUES, type LeagueKey, getFixtures } from '@/lib/sportmonks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const competition = searchParams.get('competition') || 'premier_league';

  // Validate league
  const leagueKey = competition as LeagueKey;
  const league = LEAGUES[leagueKey];

  if (!league) {
    return NextResponse.json({
      error: 'Geçersiz lig',
      availableLeagues: Object.keys(LEAGUES)
    }, { status: 400 });
  }

  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 21);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];

    // Use the centralized sportmonks library
    const data = await getFixtures(league.id, dateFrom, dateTo);

    if (data.error) {
      throw new Error(`API Error: ${data.error}`);
    }

    // Filter and format matches
    const filteredData = (data.data || []).filter((match: any) => match.league_id === league.id);

    const matches = filteredData.map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');

      return {
        id: match.id,
        homeTeam: home?.name || 'TBA',
        homeTeamId: home?.id || 0,
        homeCrest: home?.image_path || '',
        awayTeam: away?.name || 'TBA',
        awayTeamId: away?.id || 0,
        awayCrest: away?.image_path || '',
        date: match.starting_at,
        matchday: match.round_id || 0,
        competition: league.name,
        leagueId: league.id,
        venue: match.venue?.name || ''
      };
    });

    // Sort by date
    const sortedMatches = matches.sort((a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      success: true,
      competition: leagueKey,
      league: {
        id: league.id,
        name: league.name,
        country: league.country,
        color: league.color,
        seasonId: league.seasonId
      },
      matchCount: sortedMatches.length,
      dateRange: {
        from: dateFrom,
        to: dateTo
      },
      matches: sortedMatches
    });

  } catch (error: any) {
    console.error('Upcoming API Error:', error);
    return NextResponse.json({
      error: error.message || 'Bir hata oluştu',
      competition
    }, { status: 500 });
  }
}
