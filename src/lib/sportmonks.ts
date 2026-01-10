// Sportmonks API Configuration
export const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
export const SPORTMONKS_BASE_URL = 'https://api.sportmonks.com/v3/football';

import { getCachedAnalysis, setCachedAnalysis } from './analysisCache';

// Top European Leagues with Season IDs (2024-25 Season) - 27 Lig Paketi
export const LEAGUES = {
  // England
  premier_league: { id: 8, seasonId: 23614, name: 'Premier League', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#3D195B' },
  championship: { id: 9, seasonId: 23783, name: 'Championship', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#1C2C5B' },
  fa_cup: { id: 24, seasonId: 23820, name: 'FA Cup', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#E90052' },
  league_cup: { id: 27, seasonId: 23821, name: 'League Cup', country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#00FF87' },

  // Spain
  la_liga: { id: 564, seasonId: 23686, name: 'La Liga', country: '🇪🇸', color: '#EE8707' },
  la_liga_2: { id: 501, seasonId: 23687, name: 'La Liga 2', country: '🇪🇸', color: '#1C2C5B' },
  copa_del_rey: { id: 567, seasonId: 23830, name: 'Copa del Rey', country: '🇪🇸', color: '#E30A17' },

  // Italy
  serie_a: { id: 384, seasonId: 23690, name: 'Serie A', country: '🇮🇹', color: '#024494' },
  serie_b: { id: 387, seasonId: 23691, name: 'Serie B', country: '🇮🇹', color: '#009246' },
  coppa_italia: { id: 390, seasonId: 23831, name: 'Coppa Italia', country: '🇮🇹', color: '#CE2B37' },

  // Germany
  bundesliga: { id: 82, seasonId: 23688, name: 'Bundesliga', country: '🇩🇪', color: '#D20515' },

  // France
  ligue_1: { id: 301, seasonId: 23684, name: 'Ligue 1', country: '🇫🇷', color: '#091C3E' },

  // Netherlands
  eredivisie: { id: 72, seasonId: 23680, name: 'Eredivisie', country: '🇳🇱', color: '#FF6B00' },

  // Portugal
  liga_portugal: { id: 462, seasonId: 23679, name: 'Liga Portugal', country: '🇵🇹', color: '#00A651' },
  primeira_liga: { id: 244, seasonId: 23678, name: 'Primeira Liga', country: '🇵🇹', color: '#006600' },

  // Belgium
  pro_league: { id: 208, seasonId: 23597, name: 'Pro League', country: '🇧🇪', color: '#000000' },
  jupiler_league: { id: 181, seasonId: 23596, name: 'Jupiler Pro League', country: '🇧🇪', color: '#FFD700' },

  // Turkey
  super_lig: { id: 600, seasonId: 24636, name: 'Süper Lig', country: '🇹🇷', color: '#E30A17' },
  super_lig_alt: { id: 570, seasonId: 24635, name: 'Süper Lig', country: '🇹🇷', color: '#E30A17' },
  turkish_cup: { id: 573, seasonId: 24640, name: 'Türkiye Kupası', country: '🇹🇷', color: '#C8102E' },

  // Other
  scotland_premiership: { id: 486, seasonId: 23700, name: 'Scottish Premiership', country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', color: '#1A237E' },
  ekstraklasa: { id: 453, seasonId: 23695, name: 'Ekstraklasa', country: '🇵🇱', color: '#DC143C' },
  allsvenskan: { id: 591, seasonId: 24630, name: 'Allsvenskan', country: '🇸🇪', color: '#006AA7' },
  superliga_dk: { id: 271, seasonId: 23660, name: 'Superliga', country: '🇩🇰', color: '#C60C30' },

  // European
  champions_league: { id: 1371, seasonId: 24200, name: 'Champions League', country: '🇪🇺', color: '#1D428A' },
} as const;

export type LeagueKey = keyof typeof LEAGUES;
export type League = typeof LEAGUES[LeagueKey];

// Type definitions for API responses
export interface TeamStats {
  id: number;
  name: string;
  form: string;
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  homeWon: number;
  homeDrawn: number;
  homeLost: number;
  homeGoalsFor: number;
  homeGoalsAgainst: number;
  awayWon: number;
  awayDrawn: number;
  awayLost: number;
  awayGoalsFor: number;
  awayGoalsAgainst: number;
  cleanSheets: number;
  failedToScore: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  last5: string[];
}

export interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away' | 'draw';
}

export interface MatchAnalysisData {
  homeTeam: TeamStats;
  awayTeam: TeamStats;
  h2h: H2HMatch[];
  leagueContext: {
    name: string;
    positionGap: number;
    pointsGap: number;
  };
  odds?: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    under25: number;
    bttsYes: number;
    bttsNo: number;
  };
}

// API Helper Functions with better error handling
export async function fetchFromSportmonks(endpoint: string, params: Record<string, string> = {}) {
  // L3 Cache Key
  const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;

  // Check L3 Cache first
  const cached = getCachedAnalysis(cacheKey, 'en', 'raw-sportmonks');
  if (cached) {
    return cached.data;
  }

  const url = new URL(`${SPORTMONKS_BASE_URL}${endpoint}`);
  url.searchParams.append('api_token', SPORTMONKS_API_KEY || '');

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 } // 1 hour cache
    });

    if (!response.ok) {
      console.error(`Sportmonks API Error: ${response.status} - ${endpoint}`);
      return { data: null, error: response.status };
    }

    const data = await response.json();

    // Save to L3 Cache
    if (data) {
      setCachedAnalysis(cacheKey, 'en', 'raw-sportmonks', data);
    }

    return data;
  } catch (error) {
    console.error(`Sportmonks fetch error: ${endpoint}`, error);
    return { data: null, error: 'FETCH_ERROR' };
  }
}

// Get league standings with detailed stats
export async function getStandings(leagueId: number, seasonId?: number) {
  const sid = seasonId || Object.values(LEAGUES).find(l => l.id === leagueId)?.seasonId;

  if (!sid) {
    return fetchFromSportmonks(`/standings/live/leagues/${leagueId}`, {
      include: 'participant;details'
    });
  }

  return fetchFromSportmonks(`/standings/seasons/${sid}`, {
    include: 'participant;details'
  });
}

// Get team's recent fixtures (last N matches)
export async function getTeamRecentMatches(teamId: number, limit: number = 10) {
  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 90); // Last 90 days

  const dateFrom = pastDate.toISOString().split('T')[0];
  const dateTo = today.toISOString().split('T')[0];

  return fetchFromSportmonks(`/fixtures/between/${dateFrom}/${dateTo}/${teamId}`, {
    include: 'participants;scores;league',
    per_page: String(limit)
  });
}

// Get upcoming fixtures
export async function getFixtures(leagueId: number, dateFrom: string, dateTo: string) {
  return fetchFromSportmonks(`/fixtures/between/${dateFrom}/${dateTo}`, {
    filters: `leagues:${leagueId}`,
    include: 'participants;league;venue;scores',
    per_page: '50'
  });
}

// Get all fixtures for multiple leagues
export async function getAllFixtures(dateFrom: string, dateTo: string, leagueIds?: number[]) {
  const ids = leagueIds || Object.values(LEAGUES).map(l => l.id);

  return fetchFromSportmonks(`/fixtures/between/${dateFrom}/${dateTo}`, {
    filters: `leagues:${ids.join(',')}`,
    include: 'participants;league;venue;odds',
    per_page: '100'
  });
}

// Get team statistics with season context
export async function getTeamStats(teamId: number, seasonId?: number) {
  const includeFields = seasonId
    ? 'statistics;venue;coaches'
    : 'statistics;venue;coaches';

  return fetchFromSportmonks(`/teams/${teamId}`, {
    include: includeFields
  });
}

// Get team's season statistics
export async function getTeamSeasonStats(teamId: number, seasonId: number) {
  return fetchFromSportmonks(`/statistics/seasons/teams/${teamId}`, {
    filters: `seasons:${seasonId}`
  });
}

// Get head to head with more details
export async function getHeadToHead(teamId1: number, teamId2: number, limit: number = 10) {
  return fetchFromSportmonks(`/fixtures/head-to-head/${teamId1}/${teamId2}`, {
    include: 'participants;scores;league;venue',
    per_page: String(limit)
  });
}

// Get fixture odds
export async function getFixtureOdds(fixtureId: number) {
  return fetchFromSportmonks(`/odds/fixtures/${fixtureId}`, {
    include: 'market;bookmaker'
  });
}

// Get pre-match odds for a fixture
export async function getPreMatchOdds(fixtureId: number) {
  return fetchFromSportmonks(`/odds/pre-match/fixtures/${fixtureId}`, {
    include: 'market;bookmaker'
  });
}

// Get predictions (if available in plan)
export async function getPredictions(fixtureId: number) {
  return fetchFromSportmonks(`/predictions/probabilities/fixtures/${fixtureId}`);
}

// ============================================
// INJURIES & SQUAD DATA (Perplexity alternatifi)
// ============================================

// Get team's sidelined/injured players
export async function getTeamSidelined(teamId: number) {
  return fetchFromSportmonks(`/sidelined/teams/${teamId}`, {
    include: 'player;type'
  });
}

// Get player's injury history
export async function getPlayerSidelined(playerId: number) {
  return fetchFromSportmonks(`/sidelined/players/${playerId}`, {
    include: 'team;type'
  });
}

// Get team's full squad with sidelined status
export async function getTeamSquad(teamId: number, seasonId?: number) {
  const params: Record<string, string> = {
    include: 'player.sidelined;position'
  };
  if (seasonId) {
    params.filters = `seasons:${seasonId}`;
  }
  return fetchFromSportmonks(`/teams/${teamId}/squad`, params);
}

// Get fixture with lineups, formations and sidelined players
export async function getFixtureWithLineups(fixtureId: number) {
  return fetchFromSportmonks(`/fixtures/${fixtureId}`, {
    include: 'lineups.player;formations;sidelined.player;sidelined.type;coaches'
  });
}

// Get match news/events
export async function getFixtureNews(fixtureId: number) {
  return fetchFromSportmonks(`/fixtures/${fixtureId}`, {
    include: 'events;comments;highlights'
  });
}

// ============================================
// INJURY PARSING HELPERS
// ============================================

export interface SidelinedPlayer {
  playerId: number;
  playerName: string;
  teamId: number;
  reason: string; // injury type
  startDate: string;
  endDate?: string;
  isActive: boolean;
}

export function parseSidelinedData(sidelinedData: any): SidelinedPlayer[] {
  if (!sidelinedData?.data) return [];

  return sidelinedData.data.map((s: any) => ({
    playerId: s.player_id,
    playerName: s.player?.display_name || s.player?.name || 'Unknown',
    teamId: s.team_id,
    reason: s.type?.name || s.description || 'Unknown',
    startDate: s.start_date,
    endDate: s.end_date,
    isActive: !s.end_date || new Date(s.end_date) > new Date()
  })).filter((p: SidelinedPlayer) => p.isActive);
}

// Get comprehensive match context including injuries
export async function getMatchContextWithInjuries(
  homeTeamId: number,
  awayTeamId: number,
  fixtureId?: number
) {
  const [homeSidelined, awaySidelined, fixtureData] = await Promise.all([
    getTeamSidelined(homeTeamId),
    getTeamSidelined(awayTeamId),
    fixtureId ? getFixtureWithLineups(fixtureId) : Promise.resolve(null)
  ]);

  const homeInjuries = parseSidelinedData(homeSidelined);
  const awayInjuries = parseSidelinedData(awaySidelined);

  // Parse lineups if available
  let homeLineup: string[] = [];
  let awayLineup: string[] = [];
  let homeFormation = '';
  let awayFormation = '';

  if (fixtureData?.data) {
    const lineups = fixtureData.data.lineups || [];
    const formations = fixtureData.data.formations || [];

    homeLineup = lineups
      .filter((l: any) => l.team_id === homeTeamId && l.type_id === 11) // 11 = starting XI
      .map((l: any) => l.player?.display_name || 'Unknown');

    awayLineup = lineups
      .filter((l: any) => l.team_id === awayTeamId && l.type_id === 11)
      .map((l: any) => l.player?.display_name || 'Unknown');

    homeFormation = formations.find((f: any) => f.participant_id === homeTeamId)?.formation || '';
    awayFormation = formations.find((f: any) => f.participant_id === awayTeamId)?.formation || '';
  }

  return {
    homeInjuries,
    awayInjuries,
    homeLineup,
    awayLineup,
    homeFormation,
    awayFormation,
    totalHomeMissing: homeInjuries.length,
    totalAwayMissing: awayInjuries.length
  };
}

// ============================================
// DATA PROCESSING HELPERS
// ============================================

// Parse standings data to get team position info
export function parseStandingsForTeam(standingsData: any, teamId: number): Partial<TeamStats> | null {
  if (!standingsData?.data) return null;

  // Standings can be in different formats
  const standings = Array.isArray(standingsData.data)
    ? standingsData.data
    : standingsData.data.standings || [];

  // Flatten if nested (groups/rounds)
  const flatStandings = standings.flatMap((item: any) => {
    if (item.standings) return item.standings;
    if (item.details) return [item];
    return [item];
  });

  const teamStanding = flatStandings.find((s: any) =>
    s.participant_id === teamId || s.team_id === teamId
  );

  if (!teamStanding) return null;

  const details = teamStanding.details || [];
  const getDetail = (typeId: number) => details.find((d: any) => d.type_id === typeId)?.value || 0;

  return {
    position: teamStanding.position || 0,
    points: teamStanding.points || 0,
    played: getDetail(129) || teamStanding.games_played || 0,
    won: getDetail(130) || 0,
    drawn: getDetail(131) || 0,
    lost: getDetail(132) || 0,
    goalsFor: getDetail(133) || 0,
    goalsAgainst: getDetail(134) || 0,
    goalDifference: getDetail(179) || 0,
    homeWon: getDetail(141) || 0,
    homeDrawn: getDetail(142) || 0,
    homeLost: getDetail(143) || 0,
    homeGoalsFor: getDetail(144) || 0,
    homeGoalsAgainst: getDetail(145) || 0,
    awayWon: getDetail(147) || 0,
    awayDrawn: getDetail(148) || 0,
    awayLost: getDetail(149) || 0,
    awayGoalsFor: getDetail(150) || 0,
    awayGoalsAgainst: getDetail(151) || 0,
  };
}

// Calculate form from recent matches (W/D/L string)
export function calculateForm(matches: any[], teamId: number, limit: number = 5): string[] {
  if (!matches || !Array.isArray(matches)) return [];

  return matches
    .slice(0, limit)
    .map((match: any) => {
      const participants = match.participants || [];
      const homeTeam = participants.find((p: any) => p.meta?.location === 'home');
      const awayTeam = participants.find((p: any) => p.meta?.location === 'away');

      const scores = match.scores || [];
      const homeScore = scores.find((s: any) =>
        s.description === 'CURRENT' && s.score?.participant === 'home'
      )?.score?.goals || 0;
      const awayScore = scores.find((s: any) =>
        s.description === 'CURRENT' && s.score?.participant === 'away'
      )?.score?.goals || 0;

      const isHome = homeTeam?.id === teamId;
      const teamScore = isHome ? homeScore : awayScore;
      const oppScore = isHome ? awayScore : homeScore;

      if (teamScore > oppScore) return 'W';
      if (teamScore < oppScore) return 'L';
      return 'D';
    });
}

// Parse H2H data
export function parseH2HData(h2hData: any, homeTeamId: number, awayTeamId: number): H2HMatch[] {
  if (!h2hData?.data) return [];

  return h2hData.data.map((match: any) => {
    const participants = match.participants || [];
    const home = participants.find((p: any) => p.meta?.location === 'home');
    const away = participants.find((p: any) => p.meta?.location === 'away');

    const scores = match.scores || [];
    const homeScore = scores.find((s: any) =>
      s.description === 'CURRENT' && s.score?.participant === 'home'
    )?.score?.goals || 0;
    const awayScore = scores.find((s: any) =>
      s.description === 'CURRENT' && s.score?.participant === 'away'
    )?.score?.goals || 0;

    let winner: 'home' | 'away' | 'draw' = 'draw';
    if (homeScore > awayScore) winner = 'home';
    else if (awayScore > homeScore) winner = 'away';

    return {
      date: match.starting_at || '',
      homeTeam: home?.name || 'Unknown',
      awayTeam: away?.name || 'Unknown',
      homeScore,
      awayScore,
      winner
    };
  });
}

// Parse odds data
export function parseOddsData(oddsData: any): MatchAnalysisData['odds'] | null {
  if (!oddsData?.data || oddsData.data.length === 0) return null;

  const odds: MatchAnalysisData['odds'] = {
    home: 0,
    draw: 0,
    away: 0,
    over25: 0,
    under25: 0,
    bttsYes: 0,
    bttsNo: 0
  };

  // Market IDs: 1 = 1X2, 2 = Over/Under, 3 = BTTS
  for (const odd of oddsData.data) {
    const marketId = odd.market_id;
    const label = odd.label?.toLowerCase() || '';
    const value = parseFloat(odd.value) || 0;

    // 1X2 Market
    if (marketId === 1) {
      if (label === '1' || label === 'home') odds.home = value;
      else if (label === 'x' || label === 'draw') odds.draw = value;
      else if (label === '2' || label === 'away') odds.away = value;
    }
    // Over/Under 2.5
    else if (marketId === 2 || marketId === 12) {
      if (label.includes('over') && label.includes('2.5')) odds.over25 = value;
      else if (label.includes('under') && label.includes('2.5')) odds.under25 = value;
    }
    // BTTS
    else if (marketId === 3) {
      if (label === 'yes') odds.bttsYes = value;
      else if (label === 'no') odds.bttsNo = value;
    }
  }

  return odds;
}

// ============================================
// COMPREHENSIVE MATCH ANALYSIS DATA FETCHER
// ============================================

export async function getComprehensiveMatchData(
  homeTeamId: number,
  awayTeamId: number,
  leagueId: number,
  fixtureId?: number
): Promise<MatchAnalysisData | null> {
  try {
    // Find season ID for the league
    const league = Object.values(LEAGUES).find(l => l.id === leagueId);
    const seasonId = league?.seasonId;

    // Fetch all data in parallel
    const [
      standingsRes,
      homeRecentRes,
      awayRecentRes,
      h2hRes,
      oddsRes
    ] = await Promise.all([
      seasonId ? getStandings(leagueId, seasonId) : getStandings(leagueId),
      getTeamRecentMatches(homeTeamId, 10),
      getTeamRecentMatches(awayTeamId, 10),
      getHeadToHead(homeTeamId, awayTeamId, 10),
      fixtureId ? getPreMatchOdds(fixtureId) : Promise.resolve({ data: null })
    ]);

    // Parse home team stats
    const homeStandingStats = parseStandingsForTeam(standingsRes, homeTeamId);
    const homeForm = calculateForm(homeRecentRes?.data || [], homeTeamId, 5);
    const homeMatches = homeRecentRes?.data || [];

    // Parse away team stats
    const awayStandingStats = parseStandingsForTeam(standingsRes, awayTeamId);
    const awayForm = calculateForm(awayRecentRes?.data || [], awayTeamId, 5);
    const awayMatches = awayRecentRes?.data || [];

    // Calculate additional stats
    const calcAvgGoals = (matches: any[], teamId: number, isScored: boolean) => {
      if (!matches.length) return 0;
      let total = 0;
      matches.forEach((m: any) => {
        const home = m.participants?.find((p: any) => p.meta?.location === 'home');
        const scores = m.scores || [];
        const homeScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const awayScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
        const isHome = home?.id === teamId;
        total += isScored ? (isHome ? homeScore : awayScore) : (isHome ? awayScore : homeScore);
      });
      return Number((total / matches.length).toFixed(2));
    };

    // Count clean sheets and failed to score
    const countCleanSheets = (matches: any[], teamId: number) => {
      return matches.filter((m: any) => {
        const home = m.participants?.find((p: any) => p.meta?.location === 'home');
        const scores = m.scores || [];
        const homeScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const awayScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
        const isHome = home?.id === teamId;
        return isHome ? awayScore === 0 : homeScore === 0;
      }).length;
    };

    const countFailedToScore = (matches: any[], teamId: number) => {
      return matches.filter((m: any) => {
        const home = m.participants?.find((p: any) => p.meta?.location === 'home');
        const scores = m.scores || [];
        const homeScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const awayScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
        const isHome = home?.id === teamId;
        return isHome ? homeScore === 0 : awayScore === 0;
      }).length;
    };

    // Build team stats objects
    const homeTeam: TeamStats = {
      id: homeTeamId,
      name: homeMatches[0]?.participants?.find((p: any) => p.id === homeTeamId)?.name || 'Home Team',
      form: homeForm.join(''),
      last5: homeForm,
      position: homeStandingStats?.position || 0,
      points: homeStandingStats?.points || 0,
      played: homeStandingStats?.played || 0,
      won: homeStandingStats?.won || 0,
      drawn: homeStandingStats?.drawn || 0,
      lost: homeStandingStats?.lost || 0,
      goalsFor: homeStandingStats?.goalsFor || 0,
      goalsAgainst: homeStandingStats?.goalsAgainst || 0,
      goalDifference: homeStandingStats?.goalDifference || 0,
      homeWon: homeStandingStats?.homeWon || 0,
      homeDrawn: homeStandingStats?.homeDrawn || 0,
      homeLost: homeStandingStats?.homeLost || 0,
      homeGoalsFor: homeStandingStats?.homeGoalsFor || 0,
      homeGoalsAgainst: homeStandingStats?.homeGoalsAgainst || 0,
      awayWon: homeStandingStats?.awayWon || 0,
      awayDrawn: homeStandingStats?.awayDrawn || 0,
      awayLost: homeStandingStats?.awayLost || 0,
      awayGoalsFor: homeStandingStats?.awayGoalsFor || 0,
      awayGoalsAgainst: homeStandingStats?.awayGoalsAgainst || 0,
      cleanSheets: countCleanSheets(homeMatches.slice(0, 10), homeTeamId),
      failedToScore: countFailedToScore(homeMatches.slice(0, 10), homeTeamId),
      avgGoalsScored: calcAvgGoals(homeMatches.slice(0, 10), homeTeamId, true),
      avgGoalsConceded: calcAvgGoals(homeMatches.slice(0, 10), homeTeamId, false)
    };

    const awayTeam: TeamStats = {
      id: awayTeamId,
      name: awayMatches[0]?.participants?.find((p: any) => p.id === awayTeamId)?.name || 'Away Team',
      form: awayForm.join(''),
      last5: awayForm,
      position: awayStandingStats?.position || 0,
      points: awayStandingStats?.points || 0,
      played: awayStandingStats?.played || 0,
      won: awayStandingStats?.won || 0,
      drawn: awayStandingStats?.drawn || 0,
      lost: awayStandingStats?.lost || 0,
      goalsFor: awayStandingStats?.goalsFor || 0,
      goalsAgainst: awayStandingStats?.goalsAgainst || 0,
      goalDifference: awayStandingStats?.goalDifference || 0,
      homeWon: awayStandingStats?.homeWon || 0,
      homeDrawn: awayStandingStats?.homeDrawn || 0,
      homeLost: awayStandingStats?.homeLost || 0,
      homeGoalsFor: awayStandingStats?.homeGoalsFor || 0,
      homeGoalsAgainst: awayStandingStats?.homeGoalsAgainst || 0,
      awayWon: awayStandingStats?.awayWon || 0,
      awayDrawn: awayStandingStats?.awayDrawn || 0,
      awayLost: awayStandingStats?.awayLost || 0,
      awayGoalsFor: awayStandingStats?.awayGoalsFor || 0,
      awayGoalsAgainst: awayStandingStats?.awayGoalsAgainst || 0,
      cleanSheets: countCleanSheets(awayMatches.slice(0, 10), awayTeamId),
      failedToScore: countFailedToScore(awayMatches.slice(0, 10), awayTeamId),
      avgGoalsScored: calcAvgGoals(awayMatches.slice(0, 10), awayTeamId, true),
      avgGoalsConceded: calcAvgGoals(awayMatches.slice(0, 10), awayTeamId, false)
    };

    // Parse H2H
    const h2h = parseH2HData(h2hRes, homeTeamId, awayTeamId);

    // Parse odds
    const odds = parseOddsData(oddsRes);

    return {
      homeTeam,
      awayTeam,
      h2h,
      leagueContext: {
        name: league?.name || 'Unknown League',
        positionGap: Math.abs(homeTeam.position - awayTeam.position),
        pointsGap: Math.abs(homeTeam.points - awayTeam.points)
      },
      odds: odds || undefined
    };

  } catch (error) {
    console.error('Error fetching comprehensive match data:', error);
    return null;
  }
}
