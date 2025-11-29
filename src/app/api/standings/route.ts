import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

const LEAGUES: Record<string, { id: number; seasonId: number; name: string; country: string }> = {
  premier_league: { id: 8, seasonId: 23614, name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  la_liga: { id: 564, seasonId: 23686, name: 'La Liga', country: '🇪🇸' },
  serie_a: { id: 384, seasonId: 23668, name: 'Serie A', country: '🇮🇹' },
  bundesliga: { id: 82, seasonId: 23632, name: 'Bundesliga', country: '🇩🇪' },
  ligue_1: { id: 301, seasonId: 23650, name: 'Ligue 1', country: '🇫🇷' },
  eredivisie: { id: 72, seasonId: 23596, name: 'Eredivisie', country: '🇳🇱' },
  championship: { id: 9, seasonId: 23615, name: 'Championship', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  liga_portugal: { id: 462, seasonId: 23670, name: 'Liga Portugal', country: '🇵🇹' },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const competition = searchParams.get('competition') || 'premier_league';
  
  const league = LEAGUES[competition];
  
  if (!league) {
    return NextResponse.json({ error: 'Geçersiz lig' }, { status: 400 });
  }
  
  try {
    // Fetch standings from Sportmonks
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/standings/seasons/${league.seasonId}?api_token=${SPORTMONKS_API_KEY}&include=participant`,
      { next: { revalidate: 300 } }
    );
    
    const data = await response.json();
    
    if (data.message) {
      throw new Error(data.message);
    }
    
    const standings = (data.data || []).map((item: any) => ({
      position: item.position,
      teamId: item.participant?.id || item.team_id,
      teamName: item.participant?.name || 'TBA',
      teamCrest: item.participant?.image_path || '',
      played: item.details?.find((d: any) => d.type_id === 129)?.value || 0,
      won: item.details?.find((d: any) => d.type_id === 130)?.value || 0,
      draw: item.details?.find((d: any) => d.type_id === 131)?.value || 0,
      lost: item.details?.find((d: any) => d.type_id === 132)?.value || 0,
      goalsFor: item.details?.find((d: any) => d.type_id === 133)?.value || 0,
      goalsAgainst: item.details?.find((d: any) => d.type_id === 134)?.value || 0,
      goalDiff: item.details?.find((d: any) => d.type_id === 179)?.value || 0,
      points: item.points || 0,
      form: item.result || ''
    }));
    
    return NextResponse.json({
      success: true,
      competition: league,
      standings: standings.sort((a: any, b: any) => a.position - b.position)
    });
    
  } catch (error: any) {
    console.error('Standings API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
