// Football Data API Wrapper
// https://api.football-data.org/v4

const BASE_URL = 'https://api.football-data.org/v4';

export const COMPETITIONS = {
  premier_league: { code: 'PL', name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  la_liga: { code: 'PD', name: 'La Liga', country: '🇪🇸' },
  serie_a: { code: 'SA', name: 'Serie A', country: '🇮🇹' },
  bundesliga: { code: 'BL1', name: 'Bundesliga', country: '🇩🇪' },
  ligue_1: { code: 'FL1', name: 'Ligue 1', country: '🇫🇷' },
  champions_league: { code: 'CL', name: 'Champions League', country: '🇪🇺' },
} as const;

export type CompetitionKey = keyof typeof COMPETITIONS;

interface ApiOptions {
  apiKey?: string;
}

async function fetchApi(endpoint: string, options: ApiOptions = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (options.apiKey) {
    headers['X-Auth-Token'] = options.apiKey;
  }

  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    headers,
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

export async function getStandings(competition: CompetitionKey, apiKey?: string) {
  const comp = COMPETITIONS[competition];
  const data = await fetchApi(`competitions/${comp.code}/standings`, { apiKey });
  
  if (!data.standings || !data.standings[0]) {
    return [];
  }

  return data.standings[0].table.map((team: any) => ({
    position: team.position,
    teamId: team.team.id,
    teamName: team.team.name,
    teamCrest: team.team.crest,
    played: team.playedGames,
    won: team.won,
    draw: team.draw,
    lost: team.lost,
    goalsFor: team.goalsFor,
    goalsAgainst: team.goalsAgainst,
    goalDiff: team.goalDifference,
    points: team.points,
    form: team.form || '',
  }));
}

export async function getUpcomingMatches(competition: CompetitionKey, apiKey?: string) {
  const comp = COMPETITIONS[competition];
  const data = await fetchApi(`competitions/${comp.code}/matches?status=SCHEDULED`, { apiKey });
  
  if (!data.matches) {
    return [];
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return data.matches
    .filter((match: any) => {
      const matchDate = new Date(match.utcDate);
      return matchDate >= now && matchDate <= weekFromNow;
    })
    .slice(0, 10)
    .map((match: any) => ({
      id: match.id,
      homeTeam: match.homeTeam.name,
      homeTeamId: match.homeTeam.id,
      homeCrest: match.homeTeam.crest,
      awayTeam: match.awayTeam.name,
      awayTeamId: match.awayTeam.id,
      awayCrest: match.awayTeam.crest,
      date: match.utcDate,
      matchday: match.matchday,
      competition: comp.name,
    }));
}

export async function getTeamMatches(teamId: number, status: 'FINISHED' | 'SCHEDULED' = 'FINISHED', limit: number = 5, apiKey?: string) {
  const data = await fetchApi(`teams/${teamId}/matches?status=${status}&limit=${limit}`, { apiKey });
  
  if (!data.matches) {
    return [];
  }

  return data.matches.map((match: any) => {
    const isHome = match.homeTeam.id === teamId;
    const homeScore = match.score?.fullTime?.home ?? 0;
    const awayScore = match.score?.fullTime?.away ?? 0;
    
    const goalsFor = isHome ? homeScore : awayScore;
    const goalsAgainst = isHome ? awayScore : homeScore;
    
    let result = 'D';
    if (goalsFor > goalsAgainst) result = 'W';
    else if (goalsFor < goalsAgainst) result = 'L';

    return {
      id: match.id,
      date: match.utcDate,
      opponent: isHome ? match.awayTeam.name : match.homeTeam.name,
      opponentCrest: isHome ? match.awayTeam.crest : match.homeTeam.crest,
      venue: isHome ? 'H' : 'A',
      goalsFor,
      goalsAgainst,
      result,
      competition: match.competition.name,
    };
  });
}

export async function getTeamForm(teamId: number, apiKey?: string) {
  const matches = await getTeamMatches(teamId, 'FINISHED', 5, apiKey);
  
  const stats = {
    teamId,
    matches,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsScored: 0,
    goalsConceded: 0,
    formString: '',
  };

  matches.forEach((match: any) => {
    stats.goalsScored += match.goalsFor;
    stats.goalsConceded += match.goalsAgainst;
    stats.formString += match.result;
    
    if (match.result === 'W') stats.wins++;
    else if (match.result === 'D') stats.draws++;
    else stats.losses++;
  });

  return {
    ...stats,
    avgScored: matches.length > 0 ? (stats.goalsScored / matches.length).toFixed(2) : '0',
    avgConceded: matches.length > 0 ? (stats.goalsConceded / matches.length).toFixed(2) : '0',
    points: stats.wins * 3 + stats.draws,
  };
}

export interface MatchAnalysisData {
  homeTeam: {
    id: number;
    name: string;
    form: Awaited<ReturnType<typeof getTeamForm>>;
  };
  awayTeam: {
    id: number;
    name: string;
    form: Awaited<ReturnType<typeof getTeamForm>>;
  };
  competition: string;
  matchDate?: string;
}

export async function prepareMatchAnalysis(
  homeTeamId: number,
  homeTeamName: string,
  awayTeamId: number,
  awayTeamName: string,
  competition: string,
  matchDate?: string,
  apiKey?: string
): Promise<MatchAnalysisData> {
  const [homeForm, awayForm] = await Promise.all([
    getTeamForm(homeTeamId, apiKey),
    getTeamForm(awayTeamId, apiKey),
  ]);

  return {
    homeTeam: {
      id: homeTeamId,
      name: homeTeamName,
      form: homeForm,
    },
    awayTeam: {
      id: awayTeamId,
      name: awayTeamName,
      form: awayForm,
    },
    competition,
    matchDate,
  };
}
