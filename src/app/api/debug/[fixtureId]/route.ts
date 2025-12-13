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
  
  // Fixture bilgisi
  const fixtureData = await fetchAPI(`/fixtures/${fixtureId}?include=participants`);
  const fixture = fixtureData?.data;
  
  const participants = fixture?.participants || [];
  const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
  const awayTeam = participants.find((p: any) => p.meta?.location === 'away');
  const homeTeamId = homeTeam?.id;
  
  // Farklı endpoint'leri test et
  const test1 = await fetchAPI(`/schedules/teams/${homeTeamId}`);
  const test2 = await fetchAPI(`/teams/${homeTeamId}/fixtures`);
  const test3 = await fetchAPI(`/fixtures?filters=participantIds:${homeTeamId}&per_page=5`);
  const test4 = await fetchAPI(`/teams/${homeTeamId}?include=latest`);
  
  return Response.json({
    homeTeamId,
    homeTeamName: homeTeam?.name,
    test1_schedules: {
      hasData: !!test1?.data,
      count: test1?.data?.length || 0,
      error: test1?.message || test1?.error,
      firstItem: test1?.data?.[0]?.name
    },
    test2_teamFixtures: {
      hasData: !!test2?.data,
      count: test2?.data?.length || 0,
      error: test2?.message || test2?.error,
      firstItem: test2?.data?.[0]?.name
    },
    test3_fixturesFilter: {
      hasData: !!test3?.data,
      count: test3?.data?.length || 0,
      error: test3?.message || test3?.error,
      firstItem: test3?.data?.[0]?.name
    },
    test4_teamLatest: {
      hasData: !!test4?.data,
      latestResults: test4?.data?.latest?.length || 0,
      error: test4?.message || test4?.error,
    },
    rawTest1: test1,
  });
}
