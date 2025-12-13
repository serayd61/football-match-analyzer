// src/app/api/debug/[fixtureId]/route.ts

const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_KEY || process.env.SPORTMONKS_API_TOKEN;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

async function fetchAPI(endpoint: string): Promise<any> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${endpoint}${separator}api_token=${SPORTMONKS_TOKEN}`;
  const response = await fetch(url);
  return response.json();
}

export async function GET(
  request: Request,
  { params }: { params: { fixtureId: string } }
) {
  const fixtureId = parseInt(params.fixtureId);
  
  const fixtureData = await fetchAPI(`/fixtures/${fixtureId}?include=participants`);
  const fixture = fixtureData?.data;
  
  if (!fixture) {
    return Response.json({ error: 'Fixture not found' });
  }
  
  const participants = fixture.participants || [];
  const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
  const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
  
  const homeTeamId = homeTeam?.id;
  const awayTeamId = awayTeam?.id;
  
  // DOĞRU ENDPOINT: /teams/{teamId}/fixtures
  const homeMatchesData = await fetchAPI(`/teams/${homeTeamId}/fixtures?include=scores;participants&per_page=5`);
  const awayMatchesData = await fetchAPI(`/teams/${awayTeamId}/fixtures?include=scores;participants&per_page=5`);
  
  return Response.json({
    fixture: {
      id: fixtureId,
      homeTeam: homeTeam?.name,
      homeTeamId,
      awayTeam: awayTeam?.name,
      awayTeamId,
    },
    homeMatches: {
      count: homeMatchesData?.data?.length || 0,
      raw: homeMatchesData?.data?.slice(0, 3).map((m: any) => ({
        id: m.id,
        name: m.name,
        starting_at: m.starting_at,
        state_id: m.state_id,
        participants: m.participants?.map((p: any) => ({
          id: p.id,
          name: p.name,
          location: p.meta?.location
        }))
      }))
    },
    awayMatches: {
      count: awayMatchesData?.data?.length || 0,
      raw: awayMatchesData?.data?.slice(0, 3).map((m: any) => ({
        id: m.id,
        name: m.name,
        starting_at: m.starting_at,
        state_id: m.state_id,
        participants: m.participants?.map((p: any) => ({
          id: p.id,
          name: p.name,
          location: p.meta?.location
        }))
      }))
    }
  });
}
