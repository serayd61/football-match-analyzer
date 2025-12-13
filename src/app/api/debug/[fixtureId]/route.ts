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
  
  // Önce fixture'dan team ID'leri al
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
  
  // Her takım için son maçları al
  const homeMatchesData = await fetchAPI(`/fixtures?filters=teamIds:${homeTeamId}&include=scores;participants&per_page=5&order=starting_at&sort=desc`);
  const awayMatchesData = await fetchAPI(`/fixtures?filters=teamIds:${awayTeamId}&include=scores;participants&per_page=5&order=starting_at&sort=desc`);
  
  // Raw data döndür
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
      raw: homeMatchesData?.data?.slice(0, 2).map((m: any) => ({
        id: m.id,
        name: m.name,
        starting_at: m.starting_at,
        state_id: m.state_id,
        participants: m.participants?.map((p: any) => ({
          id: p.id,
          name: p.name,
          location: p.meta?.location
        })),
        scores: m.scores
      }))
    },
    awayMatches: {
      count: awayMatchesData?.data?.length || 0,
      raw: awayMatchesData?.data?.slice(0, 2).map((m: any) => ({
        id: m.id,
        name: m.name,
        starting_at: m.starting_at,
        state_id: m.state_id,
        participants: m.participants?.map((p: any) => ({
          id: p.id,
          name: p.name,
          location: p.meta?.location
        })),
        scores: m.scores
      }))
    }
  });
}
