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
    futureDate.setDate(today.getDate() + 14); // 2 hafta ileri
    
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = futureDate.toISOString().split('T')[0];
    
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=fixturesBetween:${dateFrom},${dateTo};leagues:${leagueId}&include=participants;league;venue&per_page=25`,
      { next: { revalidate: 300 } }
    );
    
    const data = await response.json();
    
    if (data.message) {
      throw new Error(data.message);
    }
    
    const matches = (data.data || []).map((match: any) => {
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
        venue: match.venue?.name || ''
      };
    });
    
    return NextResponse.json({
      success: true,
      competition,
      matches: matches.sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    });
    
  } catch (error: any) {
    console.error('Upcoming API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
