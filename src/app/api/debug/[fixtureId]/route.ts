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
  
  // /schedules/teams endpoint'ini test et
  const homeSchedule = await fetchAPI(`/schedules/teams/${homeTeamId}?include=scores;participants`);
  const awaySchedule = await fetchAPI(`/schedules/teams/${awayTeamId}?include=scores;participants`);
  
  return Response.json({
    fixture: {
      id: fixtureId,
      homeTeam: homeTeam?.name,
      homeTeamId,
      awayTeam: awayTeam?.name,
      awayTeamId,
    },
    homeSchedule: {
      count: homeSchedule?.data?.length || 0,
      sample: homeSchedule?.data?.slice(0, 3).map((m: any) => ({
        id: m.id,
        name: m.name,
        date: m.starting_at,
        state_id: m.state_id,
        hasScores: m.scores?.length > 0,
        hasParticipants: m.participants?.length > 0,
        participants: m.participants?.map((p: any) => ({ id: p.id, name: p.name }))
      }))
    },
    awaySchedule: {
      count: awaySchedule?.data?.length || 0,
      sample: awaySchedule?.data?.slice(0, 3).map((m: any) => ({
        id: m.id,
        name: m.name,
        date: m.starting_at,
        state_id: m.state_id,
        hasScores: m.scores?.length > 0,
        hasParticipants: m.participants?.length > 0,
        participants: m.participants?.map((p: any) => ({ id: p.id, name: p.name }))
      }))
    },
    rawHomeFirst: homeSchedule?.data?.[0],
  });
}
