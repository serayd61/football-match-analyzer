import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = 'LVhKgzwe2bZEyzoPQa5Sgz9oFpr9wN8Nvu4lpOJU65iwvOdKRoQ3shhvUPF5';

const TRACKED_LEAGUES = [
  181, 208, 244, 271, 8, 24, 9, 27, 1371, 301, 82, 387, 384, 390, 
  72, 444, 453, 462, 486, 501, 570, 567, 564, 573, 591, 600
];

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Bugünün maçlarını al
    const url = `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;scores;events.type;state&filters=fixtureLeagues:${TRACKED_LEAGUES.join(',')}&per_page=100`;
    
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error('Sportmonks API error');
    }

    const data = await res.json();
    const matches = data.data || [];

    const processedMatches = matches.map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      
      const homeScore = match.scores?.find((s: any) => s.participant_id === home?.id)?.score?.goals ?? null;
      const awayScore = match.scores?.find((s: any) => s.participant_id === away?.id)?.score?.goals ?? null;

      const stateId = match.state_id || 1;
      
      return {
        id: match.id,
        name: match.name,
        league: match.league?.name || 'Unknown',
        leagueId: match.league_id,
        homeTeam: home?.name || 'TBD',
        awayTeam: away?.name || 'TBD',
        homeScore,
        awayScore,
        statusCode: stateId,
        minute: match.minute || null,
        startTime: match.starting_at,
        venue: match.venue?.name || ''
      };
    });

    // Sırala: Canlı önce, sonra saate göre
    processedMatches.sort((a: any, b: any) => {
      const aLive = [2, 3, 4, 6, 7].includes(a.statusCode);
      const bLive = [2, 3, 4, 6, 7].includes(b.statusCode);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    return NextResponse.json({
      success: true,
      matches: processedMatches,
      count: processedMatches.length,
      liveCount: processedMatches.filter((m: any) => [2, 3, 4, 6, 7].includes(m.statusCode)).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Livescores error:', error);
    return NextResponse.json({
      success: false,
      matches: [],
      count: 0,
      error: 'API error'
    }, { status: 500 });
  }
}
