// ============================================================================
// SPORTMONKS DATA MODULE
// Gerçek istatistiksel veriler - AI'a beslenmek için
// ============================================================================

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamStats {
  teamId: number;
  teamName: string;
  // Form
  recentForm: string; // "WDLWW" gibi
  formPoints: number; // Son 5 maçtan alınan puan
  // Goals
  goalsScored: number;
  goalsConceded: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  // Home/Away specific
  homeWins: number;
  homeDraws: number;
  homeLosses: number;
  awayWins: number;
  awayDraws: number;
  awayLosses: number;
  // BTTS & O/U stats
  bttsPercentage: number;
  over25Percentage: number;
  under25Percentage: number;
  // Clean sheets
  cleanSheets: number;
  failedToScore: number;
}

export interface HeadToHead {
  totalMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  avgGoals: number;
  bttsPercentage: number;
  over25Percentage: number;
  recentMatches: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
  }>;
}

export interface Injury {
  playerName: string;
  reason: string;
  expectedReturn?: string;
  isOut: boolean;
}

export interface MatchContext {
  homeTeam: TeamStats;
  awayTeam: TeamStats;
  h2h: HeadToHead;
  homeInjuries: Injury[];
  awayInjuries: Injury[];
}

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchSportmonks(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${SPORTMONKS_API}${endpoint}`);
  url.searchParams.append('api_token', SPORTMONKS_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  try {
    const res = await fetch(url.toString(), { 
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    if (!res.ok) {
      console.error(`Sportmonks API error ${res.status}: ${endpoint}`);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    console.error(`Sportmonks fetch error: ${endpoint}`, error);
    return null;
  }
}

// ============================================================================
// TEAM STATISTICS
// ============================================================================

export async function getTeamStats(teamId: number, seasonId?: number): Promise<TeamStats | null> {
  try {
    // Get team details with statistics and last 15 matches
    const teamData = await fetchSportmonks(`/teams/${teamId}`, {
      include: 'statistics.details;latest.participants;latest.scores',
      'filters[latestLimit]': 15  // Get last 15 matches for form calculation
    });

    if (!teamData?.data) return null;

    const team = teamData.data;
    const stats = team.statistics || [];
    
    // Find current season stats
    const seasonStats = stats[0]?.details || [];
    
    // Extract stats
    const getStatValue = (typeId: number): number => {
      const stat = seasonStats.find((s: any) => s.type_id === typeId);
      return stat?.value?.all || stat?.value?.home || stat?.value?.away || 0;
    };

    // Get recent matches for form (last 10 matches for better accuracy)
    const recentMatches = team.latest || [];
    const form = recentMatches.slice(0, 10).map((match: any) => {
      const isHome = match.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;
      
      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;
      
      if (teamScore > opponentScore) return 'W';
      if (teamScore < opponentScore) return 'L';
      return 'D';
    }).join('');

    // Calculate form points
    const formPoints = form.split('').reduce((acc: number, result: string) => {
      if (result === 'W') return acc + 3;
      if (result === 'D') return acc + 1;
      return acc;
    }, 0);

    // Goals stats
    const goalsScored = getStatValue(52) || getStatValue(88) || 0;
    const goalsConceded = getStatValue(53) || getStatValue(89) || 0;
    const matchesPlayed = getStatValue(129) || recentMatches.length || 10; // Default 10 to avoid division issues

    // Calculate averages with NaN protection
    const avgGoalsScored = matchesPlayed > 0 ? Math.round((goalsScored / matchesPlayed) * 100) / 100 : 1.2;
    const avgGoalsConceded = matchesPlayed > 0 ? Math.round((goalsConceded / matchesPlayed) * 100) / 100 : 1.0;

    return {
      teamId,
      teamName: team.name || 'Unknown',
      recentForm: form || 'DDDDD',
      formPoints: formPoints || 5,
      goalsScored: goalsScored || 12,
      goalsConceded: goalsConceded || 10,
      avgGoalsScored: isNaN(avgGoalsScored) ? 1.2 : avgGoalsScored,
      avgGoalsConceded: isNaN(avgGoalsConceded) ? 1.0 : avgGoalsConceded,
      homeWins: getStatValue(130),
      homeDraws: getStatValue(131),
      homeLosses: getStatValue(132),
      awayWins: getStatValue(133),
      awayDraws: getStatValue(134),
      awayLosses: getStatValue(135),
      bttsPercentage: getStatValue(99) || 0,
      over25Percentage: getStatValue(100) || 0,
      under25Percentage: getStatValue(101) || 0,
      cleanSheets: getStatValue(56),
      failedToScore: getStatValue(57)
    };
  } catch (error) {
    console.error('getTeamStats error:', error);
    return null;
  }
}

// ============================================================================
// HEAD TO HEAD
// ============================================================================

export async function getHeadToHead(team1Id: number, team2Id: number): Promise<HeadToHead | null> {
  try {
    // Fetch more H2H matches for better historical analysis
    const h2hData = await fetchSportmonks(`/fixtures/head-to-head/${team1Id}/${team2Id}`, {
      include: 'participants;scores',
      per_page: 15  // Get last 15 H2H matches
    });

    if (!h2hData?.data || h2hData.data.length === 0) {
      return {
        totalMatches: 0,
        team1Wins: 0,
        team2Wins: 0,
        draws: 0,
        avgGoals: 0,
        bttsPercentage: 0,
        over25Percentage: 0,
        recentMatches: []
      };
    }

    const matches = h2hData.data;
    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;
    let totalGoals = 0;
    let bttsCount = 0;
    let over25Count = 0;

    const recentMatches = matches.slice(0, 10).map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      
      // Get scores
      let homeScore = 0;
      let awayScore = 0;
      
      if (match.scores) {
        const currentScore = match.scores.find((s: any) => s.description === 'CURRENT');
        if (currentScore) {
          homeScore = match.scores.find((s: any) => s.score?.participant === 'home')?.score?.goals || 0;
          awayScore = match.scores.find((s: any) => s.score?.participant === 'away')?.score?.goals || 0;
        }
      }

      // Calculate stats
      const matchGoals = homeScore + awayScore;
      totalGoals += matchGoals;
      
      if (homeScore > 0 && awayScore > 0) bttsCount++;
      if (matchGoals > 2.5) over25Count++;

      // Determine winner
      const homeTeamId = home?.id;
      if (homeScore > awayScore) {
        if (homeTeamId === team1Id) team1Wins++;
        else team2Wins++;
      } else if (awayScore > homeScore) {
        if (homeTeamId === team1Id) team2Wins++;
        else team1Wins++;
      } else {
        draws++;
      }

      return {
        date: match.starting_at || '',
        homeTeam: home?.name || 'Unknown',
        awayTeam: away?.name || 'Unknown',
        homeScore,
        awayScore
      };
    });

    const totalMatches = matches.length;

    return {
      totalMatches,
      team1Wins,
      team2Wins,
      draws,
      avgGoals: totalMatches > 0 ? Math.round((totalGoals / Math.min(totalMatches, 10)) * 10) / 10 : 0,
      bttsPercentage: totalMatches > 0 ? Math.round((bttsCount / Math.min(totalMatches, 10)) * 100) : 0,
      over25Percentage: totalMatches > 0 ? Math.round((over25Count / Math.min(totalMatches, 10)) * 100) : 0,
      recentMatches
    };
  } catch (error) {
    console.error('getHeadToHead error:', error);
    return null;
  }
}

// ============================================================================
// INJURIES / SIDELINED PLAYERS
// ============================================================================

export async function getTeamInjuries(teamId: number): Promise<Injury[]> {
  try {
    const data = await fetchSportmonks(`/sidelined/teams/${teamId}`, {
      include: 'player;type'
    });

    if (!data?.data) return [];

    // Filter only current injuries
    const now = new Date();
    return data.data
      .filter((injury: any) => {
        if (!injury.end_date) return true; // No end date = still injured
        return new Date(injury.end_date) > now;
      })
      .map((injury: any) => ({
        playerName: injury.player?.display_name || injury.player?.name || 'Unknown',
        reason: injury.type?.name || injury.description || 'Injury',
        expectedReturn: injury.end_date || undefined,
        isOut: !injury.end_date || new Date(injury.end_date) > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }));
  } catch (error) {
    console.error('getTeamInjuries error:', error);
    return [];
  }
}

// ============================================================================
// TEAM FORM (Last 5-10 matches with details)
// ============================================================================

export async function getTeamRecentMatches(teamId: number, limit: number = 5): Promise<any[]> {
  try {
    const data = await fetchSportmonks(`/fixtures`, {
      'filter[participant_id]': teamId.toString(),
      'filter[status]': 'FT',
      include: 'participants;scores',
      per_page: limit.toString(),
      order: 'starting_at',
      sort: 'desc'
    });

    if (!data?.data) return [];

    return data.data.map((match: any) => {
      const home = match.participants?.find((p: any) => p.meta?.location === 'home');
      const away = match.participants?.find((p: any) => p.meta?.location === 'away');
      
      let homeScore = 0;
      let awayScore = 0;
      
      if (match.scores) {
        homeScore = match.scores.find((s: any) => s.score?.participant === 'home')?.score?.goals || 0;
        awayScore = match.scores.find((s: any) => s.score?.participant === 'away')?.score?.goals || 0;
      }

      const isHome = home?.id === teamId;
      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;
      
      return {
        date: match.starting_at,
        opponent: isHome ? away?.name : home?.name,
        isHome,
        teamScore,
        opponentScore,
        result: teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'D',
        totalGoals: homeScore + awayScore,
        btts: homeScore > 0 && awayScore > 0
      };
    });
  } catch (error) {
    console.error('getTeamRecentMatches error:', error);
    return [];
  }
}

// ============================================================================
// COMPLETE MATCH CONTEXT
// ============================================================================

export async function getCompleteMatchContext(
  homeTeamId: number, 
  awayTeamId: number
): Promise<MatchContext | null> {
  try {
    console.log(`📊 Fetching complete match context for ${homeTeamId} vs ${awayTeamId}`);
    
    const [homeStats, awayStats, h2h, homeInjuries, awayInjuries] = await Promise.all([
      getTeamStats(homeTeamId),
      getTeamStats(awayTeamId),
      getHeadToHead(homeTeamId, awayTeamId),
      getTeamInjuries(homeTeamId),
      getTeamInjuries(awayTeamId)
    ]);

    if (!homeStats || !awayStats) {
      console.error('Failed to get team stats');
      return null;
    }

    console.log(`✅ Match context loaded: ${homeStats.teamName} vs ${awayStats.teamName}`);

    return {
      homeTeam: homeStats,
      awayTeam: awayStats,
      h2h: h2h || {
        totalMatches: 0,
        team1Wins: 0,
        team2Wins: 0,
        draws: 0,
        avgGoals: 0,
        bttsPercentage: 0,
        over25Percentage: 0,
        recentMatches: []
      },
      homeInjuries,
      awayInjuries
    };
  } catch (error) {
    console.error('getCompleteMatchContext error:', error);
    return null;
  }
}

