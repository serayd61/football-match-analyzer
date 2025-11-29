// Sportmonks API Configuration
export const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
export const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';

// Top European Leagues (Euro Plan)
export const LEAGUES = {
  premier_league: { id: 8, name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#3D195B' },
  la_liga: { id: 564, name: 'La Liga', country: '🇪🇸', color: '#EE8707' },
  serie_a: { id: 384, name: 'Serie A', country: '🇮🇹', color: '#024494' },
  bundesliga: { id: 82, name: 'Bundesliga', country: '🇩🇪', color: '#D20515' },
  ligue_1: { id: 301, name: 'Ligue 1', country: '🇫🇷', color: '#091C3E' },
  eredivisie: { id: 72, name: 'Eredivisie', country: '🇳🇱', color: '#FF6B00' },
  championship: { id: 9, name: 'Championship', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#1C2C5B' },
  liga_portugal: { id: 462, name: 'Liga Portugal', country: '🇵🇹', color: '#00A651' },
  pro_league: { id: 208, name: 'Pro League', country: '🇧🇪', color: '#000000' },
  superliga: { id: 271, name: 'Superliga', country: '🇩🇰', color: '#C8102E' },
};

export type LeagueKey = keyof typeof LEAGUES;

// API Helper Functions
export async function fetchFromSportmonks(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${SPORTMONKS_BASE_URL}${endpoint}`);
  url.searchParams.append('api_token', SPORTMONKS_API_KEY || '');
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  const response = await fetch(url.toString(), {
    next: { revalidate: 300 } // 5 min cache
  });
  
  if (!response.ok) {
    throw new Error(`Sportmonks API Error: ${response.status}`);
  }
  
  return response.json();
}

// Get league standings
export async function getStandings(leagueId: number, seasonId?: number) {
  const endpoint = seasonId 
    ? `/standings/seasons/${seasonId}`
    : `/standings/live/leagues/${leagueId}`;
  
  return fetchFromSportmonks(endpoint, {
    include: 'participant'
  });
}

// Get upcoming fixtures
export async function getFixtures(leagueId: number, dateFrom: string, dateTo: string) {
  return fetchFromSportmonks('/fixtures', {
    'filters': `fixturesBetween:${dateFrom},${dateTo};leagues:${leagueId}`,
    'include': 'participants;league;venue;scores',
    'per_page': '25'
  });
}

// Get all fixtures for multiple leagues
export async function getAllFixtures(dateFrom: string, dateTo: string) {
  const leagueIds = Object.values(LEAGUES).map(l => l.id).join(',');
  
  return fetchFromSportmonks('/fixtures', {
    'filters': `fixturesBetween:${dateFrom},${dateTo};leagues:${leagueIds}`,
    'include': 'participants;league;venue',
    'per_page': '100'
  });
}

// Get team statistics
export async function getTeamStats(teamId: number) {
  return fetchFromSportmonks(`/teams/${teamId}`, {
    'include': 'statistics;players;coaches;venue'
  });
}

// Get head to head
export async function getHeadToHead(teamId1: number, teamId2: number) {
  return fetchFromSportmonks('/fixtures/head-to-head', {
    'filters': `teams:${teamId1},${teamId2}`,
    'include': 'participants;scores',
    'per_page': '10'
  });
}

// Get predictions (if available in plan)
export async function getPredictions(fixtureId: number) {
  return fetchFromSportmonks(`/predictions/probabilities/fixtures/${fixtureId}`);
}

// Get odds
export async function getOdds(fixtureId: number) {
  return fetchFromSportmonks(`/odds/fixtures/${fixtureId}`, {
    'include': 'market;bookmaker'
  });
}
