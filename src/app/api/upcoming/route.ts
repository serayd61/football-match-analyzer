import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

const LEAGUES: Record<string, number> = {
  premier_league: 8,
  la_liga: 564,
  serie_a: 384,
  bundesliga: 82,
  ligue_1: 301,
  eredivisie: 72,
  championship: 9,
  liga_portugal: 462,
  super_lig: 600,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const competition = searchParams.get('competition') || 'premier_league';
  
  const leagueId = LEAGUES[competition];
  
  if (!leagueId) {
    return NextResponse.json({ error: 'Geçersiz lig' }, { status: 400 });
  }
  
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 14);
    
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];
    
    const url = `https://api.sportmonks.com/v3/football/fixtures/between/${dateFrom}/${dateTo}?api_token=${SPORTMONKS_API_KEY}&filters=leagues:${leagueId}&include=participants;league&per_page=50`;
    
    console.log('Fetching:', url.replace(SPORTMONKS_API_KEY!, 'HIDDEN'));
    
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    
    if (data.message) {
      throw new Error(data.message);
    }
    
    // Filter matches by league_id to be sure
    const filteredData = (data.data || []).filter((match: any) => match.league_id === leagueId);
    
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
        competition: match.league?.name || '',
      };
    });
    
    return NextResponse.json({
      success: true,
      competition,
      leagueId,
      matchCount: matches.length,
      matches: matches.sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    });
    
  } catch (error: any) {
    console.error('Upcoming API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
