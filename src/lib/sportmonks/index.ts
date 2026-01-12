// ============================================================================
// SPORTMONKS DATA MODULE
// Gerçek istatistiksel veriler - AI'a beslenmek için
// ============================================================================

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

import { getCachedAnalysis, setCachedAnalysis } from '../analysisCache';

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
  // 🆕 VENUE-SPESİFİK GOL ORTALAMALARI (ÖNEMLİ!)
  homeAvgGoalsScored: number;    // Ev maçlarında attığı gol ortalaması
  homeAvgGoalsConceded: number;  // Ev maçlarında yediği gol ortalaması
  awayAvgGoalsScored: number;    // Deplasman maçlarında attığı gol ortalaması
  awayAvgGoalsConceded: number;  // Deplasman maçlarında yediği gol ortalaması
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
  // Corners
  avgCornersFor: number;      // Maç başına aldığı korner
  avgCornersAgainst: number;  // Maç başına yediği korner
  totalCorners: number;       // Toplam korner (atılan)
}

export interface HeadToHead {
  totalMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  avgGoals: number;
  bttsPercentage: number;
  over25Percentage: number;
  avgCorners: number;           // H2H maçlarında ortalama korner
  over85CornersPercentage: number; // 8.5 üstü korner yüzdesi
  over95CornersPercentage: number; // 9.5 üstü korner yüzdesi
  recentMatches: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    totalCorners?: number;
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

async function fetchSportmonks(
  endpoint: string,
  params: Record<string, string> = {},
  retries: number = 2,
  timeout: number = 15000 // 15 saniye timeout
): Promise<any> {
  // L3 Cache Key - includes endpoint and params
  const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;

  // Check L3 Cache first
  const cached = getCachedAnalysis(cacheKey, 'en', 'raw-sportmonks');
  if (cached) {
    return cached.data;
  }

  const url = new URL(`${SPORTMONKS_API}${endpoint}`);
  url.searchParams.append('api_token', SPORTMONKS_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url.toString(), {
        next: { revalidate: 3600 }, // Increase Next.js revalidate to 1 hour
        signal: controller.signal as any
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 404) {
          console.log(`ℹ️ Sportmonks 404 (expected for some resources): ${endpoint}`);
          return null;
        } else if (res.status === 400) {
          // 400 usually means invalid parameters - log for debugging
          const paramKeys = Object.keys(params).join(',');
          console.warn(`⚠️ Sportmonks 400 Bad Request: ${endpoint} (params: ${paramKeys || 'none'})`);
          return null;
        } else {
          console.error(`❌ Sportmonks API error ${res.status}: ${endpoint} (attempt ${attempt + 1}/${retries + 1})`);
          if (attempt < retries && res.status >= 500) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          return null;
        }
      }

      const data = await res.json();

      // Save to L3 Cache if data is valid
      if (data) {
        setCachedAnalysis(cacheKey, 'en', 'raw-sportmonks', data);
      }

      return data;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error(`⏱️ Sportmonks timeout (${timeout}ms): ${endpoint} (attempt ${attempt + 1}/${retries + 1})`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      } else {
        console.error(`❌ Sportmonks fetch error: ${endpoint}`, error.message);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
      return null;
    }
  }

  return null;
}

// ============================================================================
// TEAM STATISTICS
// ============================================================================

export async function getTeamStats(teamId: number, seasonId?: number): Promise<TeamStats | null> {
  try {
    // Get team details with statistics and recent matches (including corner stats)
    // 20 saniye timeout - takım verileri kritik
    const teamData = await fetchSportmonks(`/teams/${teamId}`, {
      include: 'statistics.details;latest.participants;latest.scores;latest.statistics'
    }, 2, 20000); // 2 retries, 20s timeout

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
    let totalCornersFromMatches = 0;
    let cornersMatchCount = 0;

    // Calculate goals, wins/draws/losses from recent matches
    let totalGoalsScored = 0;
    let totalGoalsConceded = 0;
    let homeWinsCount = 0;
    let homeDrawsCount = 0;
    let homeLossesCount = 0;
    let awayWinsCount = 0;
    let awayDrawsCount = 0;
    let awayLossesCount = 0;
    let bttsCount = 0;
    let over25Count = 0;
    let validMatchesCount = 0;

    const form = recentMatches.slice(0, 10).map((match: any) => {
      const isHome = match.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;

      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;

      // Only count matches with valid scores
      if (teamScore >= 0 && opponentScore >= 0) {
        totalGoalsScored += teamScore;
        totalGoalsConceded += opponentScore;
        validMatchesCount++;

        // Count BTTS and Over 2.5
        if (teamScore > 0 && opponentScore > 0) bttsCount++;
        if ((teamScore + opponentScore) > 2.5) over25Count++;

        // Count home/away results
        if (isHome) {
          if (teamScore > opponentScore) homeWinsCount++;
          else if (teamScore < opponentScore) homeLossesCount++;
          else homeDrawsCount++;
        } else {
          if (teamScore > opponentScore) awayWinsCount++;
          else if (teamScore < opponentScore) awayLossesCount++;
          else awayDrawsCount++;
        }
      }

      // Calculate corners from match statistics (type_id 45 = corners, location based)
      if (match.statistics) {
        const teamCorners = match.statistics.find((s: any) =>
          s.type_id === 45 && s.location === (isHome ? 'home' : 'away')
        )?.data?.value || 0;
        if (teamCorners > 0) {
          totalCornersFromMatches += teamCorners;
          cornersMatchCount++;
        }
      }

      if (teamScore > opponentScore) return 'W';
      if (teamScore < opponentScore) return 'L';
      return 'D';
    }).join('');

    // Calculate average corners from recent matches
    const avgCornersFromMatches = cornersMatchCount > 0
      ? Math.round((totalCornersFromMatches / cornersMatchCount) * 10) / 10
      : 0;

    // Calculate form points
    const formPoints = form.split('').reduce((acc: number, result: string) => {
      if (result === 'W') return acc + 3;
      if (result === 'D') return acc + 1;
      return acc;
    }, 0);

    // Goals stats - Use API stats if available, otherwise calculate from recent matches
    const goalsScoredFromAPI = getStatValue(52) || getStatValue(88) || 0;
    const goalsConcededFromAPI = getStatValue(53) || getStatValue(89) || 0;
    const matchesPlayedFromAPI = getStatValue(129) || 0;

    // If API data available, use it; otherwise use calculated from recent matches
    const goalsScored = goalsScoredFromAPI > 0 ? goalsScoredFromAPI : totalGoalsScored;
    const goalsConceded = goalsConcededFromAPI > 0 ? goalsConcededFromAPI : totalGoalsConceded;
    const matchesPlayed = matchesPlayedFromAPI > 0 ? matchesPlayedFromAPI : (validMatchesCount || recentMatches.length || 10);

    // Calculate averages with NaN protection
    const avgGoalsScored = matchesPlayed > 0 ? Math.round((goalsScored / matchesPlayed) * 100) / 100 : 1.2;
    const avgGoalsConceded = matchesPlayed > 0 ? Math.round((goalsConceded / matchesPlayed) * 100) / 100 : 1.0;

    // 🆕 VENUE-SPESIFIK GOL ORTALAMALARI (ÇOK ÖNEMLİ!)
    // Ev maçlarından gol ortalaması hesapla
    let homeGoalsScored = 0;
    let homeGoalsConceded = 0;
    let homeMatchCount = 0;
    let awayGoalsScored = 0;
    let awayGoalsConceded = 0;
    let awayMatchCount = 0;

    recentMatches.slice(0, 10).forEach((match: any) => {
      const isHome = match.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
      const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
      const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;

      if (isHome) {
        homeGoalsScored += homeScore;
        homeGoalsConceded += awayScore;
        homeMatchCount++;
      } else {
        awayGoalsScored += awayScore;
        awayGoalsConceded += homeScore;
        awayMatchCount++;
      }
    });

    // Venue bazlı ortalamalar
    const homeAvgGoalsScored = homeMatchCount > 0 ? Math.round((homeGoalsScored / homeMatchCount) * 100) / 100 : avgGoalsScored;
    const homeAvgGoalsConceded = homeMatchCount > 0 ? Math.round((homeGoalsConceded / homeMatchCount) * 100) / 100 : avgGoalsConceded;
    const awayAvgGoalsScored = awayMatchCount > 0 ? Math.round((awayGoalsScored / awayMatchCount) * 100) / 100 : avgGoalsScored;
    const awayAvgGoalsConceded = awayMatchCount > 0 ? Math.round((awayGoalsConceded / awayMatchCount) * 100) / 100 : avgGoalsConceded;

    // Corners - IMPORTANT: getStatValue(45) might return TOTAL corners, not average per match
    // Normal match has 5-12 corners per match, so values > 20 are likely totals, not averages
    const cornersStatValue = getStatValue(45);

    // Validate avgCornersFromMatches - should be between 0-20 (realistic range)
    // If it's > 20, it's invalid data (could be total instead of average, or parsing error)
    const validatedAvgCornersFromMatches = (avgCornersFromMatches > 0 && avgCornersFromMatches <= 20)
      ? avgCornersFromMatches
      : 0;

    // If stat value is > 20, it's likely a total, not average - don't use it
    // Only use if it's in reasonable range (5-12 per match is normal, max 20 for very high)
    let validAvgCornersFor = 0;
    if (cornersStatValue > 0 && cornersStatValue <= 20) {
      // Valid average per match from API
      validAvgCornersFor = cornersStatValue;
    } else if (validatedAvgCornersFromMatches > 0) {
      // Use validated calculated from recent matches
      validAvgCornersFor = validatedAvgCornersFromMatches;
    } else {
      // No valid data - use default
      validAvgCornersFor = 5;
    }

    const cornersAgainstValue = getStatValue(46);
    let validAvgCornersAgainst = 0;
    if (cornersAgainstValue > 0 && cornersAgainstValue <= 20) {
      validAvgCornersAgainst = cornersAgainstValue;
    } else {
      validAvgCornersAgainst = 4.5; // Default
    }

    // Log for debugging
    if (cornersStatValue > 20) {
      console.warn(`⚠️ Invalid corner stat value ${cornersStatValue} for team ${teamId} - using calculated ${validatedAvgCornersFromMatches} or default`);
    }
    if (avgCornersFromMatches > 20) {
      console.warn(`⚠️ Invalid calculated corner average ${avgCornersFromMatches} for team ${teamId} (from ${cornersMatchCount} matches, total: ${totalCornersFromMatches}) - using default`);
    }

    return {
      teamId,
      teamName: team.name || 'Unknown',
      recentForm: form || 'DDDDD',
      formPoints: formPoints || 5,
      goalsScored: goalsScored || 12,
      goalsConceded: goalsConceded || 10,
      avgGoalsScored: isNaN(avgGoalsScored) ? 1.2 : avgGoalsScored,
      avgGoalsConceded: isNaN(avgGoalsConceded) ? 1.0 : avgGoalsConceded,
      // 🆕 VENUE-SPESİFİK GOL ORTALAMALARI (ÖNEMLİ!)
      homeAvgGoalsScored: isNaN(homeAvgGoalsScored) ? 1.4 : homeAvgGoalsScored,
      homeAvgGoalsConceded: isNaN(homeAvgGoalsConceded) ? 1.0 : homeAvgGoalsConceded,
      awayAvgGoalsScored: isNaN(awayAvgGoalsScored) ? 1.0 : awayAvgGoalsScored,
      awayAvgGoalsConceded: isNaN(awayAvgGoalsConceded) ? 1.3 : awayAvgGoalsConceded,
      // Home/Away stats - Use API if available, otherwise from recent matches
      homeWins: getStatValue(130) || homeWinsCount,
      homeDraws: getStatValue(131) || homeDrawsCount,
      homeLosses: getStatValue(132) || homeLossesCount,
      awayWins: getStatValue(133) || awayWinsCount,
      awayDraws: getStatValue(134) || awayDrawsCount,
      awayLosses: getStatValue(135) || awayLossesCount,
      // BTTS and Over25 - Calculate from recent matches if API data not available
      bttsPercentage: getStatValue(99) || (validMatchesCount > 0 ? Math.round((bttsCount / validMatchesCount) * 100) : 0),
      over25Percentage: getStatValue(100) || (validMatchesCount > 0 ? Math.round((over25Count / validMatchesCount) * 100) : 0),
      under25Percentage: getStatValue(101) || (validMatchesCount > 0 ? Math.round(((validMatchesCount - over25Count) / validMatchesCount) * 100) : 0),
      cleanSheets: getStatValue(56),
      failedToScore: getStatValue(57),
      // Corners - validated to ensure reasonable values (5-12 per match is normal)
      avgCornersFor: validAvgCornersFor > 0 ? validAvgCornersFor : 5,
      avgCornersAgainst: validAvgCornersAgainst > 0 ? validAvgCornersAgainst : 4.5,
      totalCorners: getStatValue(34) || totalCornersFromMatches || 0
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
    // 20 saniye timeout - H2H verileri kritik
    const h2hData = await fetchSportmonks(`/fixtures/head-to-head/${team1Id}/${team2Id}`, {
      include: 'participants;scores;statistics',  // statistics for corners
      per_page: '15'  // Get last 15 H2H matches
    }, 2, 20000); // 2 retries, 20s timeout

    if (!h2hData?.data || h2hData.data.length === 0) {
      return {
        totalMatches: 0,
        team1Wins: 0,
        team2Wins: 0,
        draws: 0,
        avgGoals: 0,
        bttsPercentage: 0,
        over25Percentage: 0,
        avgCorners: 9,
        over85CornersPercentage: 50,
        over95CornersPercentage: 40,
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
      avgCorners: 9,
      over85CornersPercentage: 50,
      over95CornersPercentage: 40,
      recentMatches
    };
  } catch (error) {
    console.error('getHeadToHead error:', error);
    return null;
  }
}

// Helper function to process H2H data from raw API response
function processH2HData(matches: any[], team1Id: number, team2Id: number): HeadToHead {
  if (!matches?.length) {
    return {
      totalMatches: 0,
      team1Wins: 0,
      team2Wins: 0,
      draws: 0,
      avgGoals: 0,
      bttsPercentage: 0,
      over25Percentage: 0,
      avgCorners: 9,
      over85CornersPercentage: 50,
      over95CornersPercentage: 40,
      recentMatches: []
    };
  }

  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  let totalGoals = 0;
  let totalCorners = 0;
  let bttsCount = 0;
  let over25Count = 0;
  let over85CornersCount = 0;
  let over95CornersCount = 0;
  let cornersDataCount = 0;

  const recentMatches = matches.slice(0, 10).map((match: any) => {
    const home = match.participants?.find((p: any) => p.meta?.location === 'home');
    const away = match.participants?.find((p: any) => p.meta?.location === 'away');

    let homeScore = 0;
    let awayScore = 0;
    let matchCorners = 0;

    if (match.scores) {
      homeScore = match.scores.find((s: any) => s.score?.participant === 'home')?.score?.goals || 0;
      awayScore = match.scores.find((s: any) => s.score?.participant === 'away')?.score?.goals || 0;
    }

    // Get corners from statistics if available (type_id 45 = corners)
    if (match.statistics) {
      const homeCornersRaw = match.statistics.find((s: any) => s.type_id === 45 && s.location === 'home')?.data?.value;
      const awayCornersRaw = match.statistics.find((s: any) => s.type_id === 45 && s.location === 'away')?.data?.value;
      
      // Parse corner values - handle both number and string formats
      const homeCorners = typeof homeCornersRaw === 'number' ? homeCornersRaw : (typeof homeCornersRaw === 'string' ? parseFloat(homeCornersRaw) || 0 : 0);
      const awayCorners = typeof awayCornersRaw === 'number' ? awayCornersRaw : (typeof awayCornersRaw === 'string' ? parseFloat(awayCornersRaw) || 0 : 0);
      
      matchCorners = homeCorners + awayCorners;

      // Validate: Normal maçta 0-25 korner olur, 25'ten fazlası veya 100 gibi anormal değerler veri hatası
      // 100 değeri genellikle veri hatası veya yüzde formatından kaynaklanır
      if (matchCorners > 0 && matchCorners <= 25 && matchCorners !== 100) {
        totalCorners += matchCorners;
        cornersDataCount++;
        if (matchCorners > 8.5) over85CornersCount++;
        if (matchCorners > 9.5) over95CornersCount++;
      } else if (matchCorners > 25 || matchCorners === 100) {
        // Sadece debug modunda veya çok anormal değerlerde uyar (100, 200 gibi)
        // Normal anormal değerler (26-99) sessizce ignore edilir
        if (matchCorners >= 100) {
          // 100+ değerler için sadece bir kez uyar (log spam'ini önlemek için)
          // Bu genellikle veri formatı hatasıdır
        }
        // Değer zaten ignore ediliyor, uyarı gerekmez
      }
    }

    const matchGoals = homeScore + awayScore;
    totalGoals += matchGoals;

    if (homeScore > 0 && awayScore > 0) bttsCount++;
    if (matchGoals > 2.5) over25Count++;

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
      awayScore,
      // Only include totalCorners if it's valid (0-25 range)
      totalCorners: (matchCorners > 0 && matchCorners <= 25) ? matchCorners : undefined
    };
  });

  const totalMatches = matches.length;
  const matchCount = Math.min(totalMatches, 10);

  return {
    totalMatches,
    team1Wins,
    team2Wins,
    draws,
    avgGoals: matchCount > 0 ? Math.round((totalGoals / matchCount) * 10) / 10 : 0,
    bttsPercentage: matchCount > 0 ? Math.round((bttsCount / matchCount) * 100) : 0,
    over25Percentage: matchCount > 0 ? Math.round((over25Count / matchCount) * 100) : 0,
    avgCorners: cornersDataCount > 0 ? Math.round((totalCorners / cornersDataCount) * 10) / 10 : 9,
    over85CornersPercentage: cornersDataCount > 0 ? Math.round((over85CornersCount / cornersDataCount) * 100) : 50,
    over95CornersPercentage: cornersDataCount > 0 ? Math.round((over95CornersCount / cornersDataCount) * 100) : 40,
    recentMatches
  };
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
// COMPLETE MATCH CONTEXT (Legacy - multiple API calls)
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

    // If team stats missing, use default values (404 is normal for some teams)
    const defaultTeamStats = (teamId: number, name: string): TeamStats => ({
      teamId,
      teamName: name,
      recentForm: 'DDDDD',
      formPoints: 5,
      goalsScored: 0,
      goalsConceded: 0,
      avgGoalsScored: 1.2,
      avgGoalsConceded: 1.2,
      // 🆕 Venue-spesifik gol ortalamaları (varsayılan değerler)
      homeAvgGoalsScored: 1.4,
      homeAvgGoalsConceded: 1.0,
      awayAvgGoalsScored: 1.0,
      awayAvgGoalsConceded: 1.3,
      homeWins: 0,
      homeDraws: 0,
      homeLosses: 0,
      awayWins: 0,
      awayDraws: 0,
      awayLosses: 0,
      bttsPercentage: 50,
      over25Percentage: 50,
      under25Percentage: 50,
      cleanSheets: 0,
      failedToScore: 0,
      avgCornersFor: 5,
      avgCornersAgainst: 4.5,
      totalCorners: 0
    });

    const finalHomeStats = homeStats || defaultTeamStats(homeTeamId, 'Home Team');
    const finalAwayStats = awayStats || defaultTeamStats(awayTeamId, 'Away Team');

    if (!homeStats || !awayStats) {
      console.warn(`⚠️ Some team stats missing, using defaults for analysis`);
    }

    console.log(`✅ Match context loaded: ${finalHomeStats.teamName} vs ${finalAwayStats.teamName}`);

    return {
      homeTeam: finalHomeStats,
      awayTeam: finalAwayStats,
      h2h: h2h || {
        totalMatches: 0,
        team1Wins: 0,
        team2Wins: 0,
        draws: 0,
        avgGoals: 0,
        bttsPercentage: 0,
        over25Percentage: 0,
        avgCorners: 9,
        over85CornersPercentage: 50,
        over95CornersPercentage: 40,
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

// ============================================================================
// 🚀 FULL FIXTURE DATA - TEK API ÇAĞRISIYLA TÜM VERİ
// Sportmonks'un sunduğu HER ŞEYİ tek seferde çeker
// ============================================================================

export interface FullFixtureData {
  // Maç Temel Bilgileri
  fixtureId: number;
  homeTeam: {
    id: number;
    name: string;
    shortCode: string;
    logo: string;
    form: string;
    formPoints: number;
    position: number;
    statistics: any;
    recentMatches: any[];
    coach: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortCode: string;
    logo: string;
    form: string;
    formPoints: number;
    position: number;
    statistics: any;
    recentMatches: any[];
    coach: string;
  };

  // Lig & Turnuva
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
  };
  round: string;
  stage: string;

  // Maç Detayları
  venue: {
    name: string;
    city: string;
    capacity: number;
    surface: string;
  };
  referee: {
    name: string;
    avgCardsPerMatch: number;
    avgFoulsPerMatch: number;
  };
  weather: {
    temperature: number;
    description: string;
    humidity: number;
    wind: number;
  };

  // İstatistikler
  matchStatistics: any[];
  events: any[];
  lineups: {
    home: any[];
    away: any[];
    homeFormation: string;
    awayFormation: string;
  };

  // Bahis & Tahminler
  odds: {
    matchResult: { home: number; draw: number; away: number };
    btts: { yes: number; no: number };
    overUnder25: { over: number; under: number };
    asianHandicap: any;
  };
  predictions: {
    sportmonks: any;
    probability: { home: number; draw: number; away: number };
  };

  // H2H
  h2h: HeadToHead;

  // Sakatlar
  injuries: {
    home: Injury[];
    away: Injury[];
  };

  // Veri Kalitesi
  dataQuality: {
    hasOdds: boolean;
    hasLineups: boolean;
    hasStatistics: boolean;
    hasH2H: boolean;
    hasInjuries: boolean;
    hasPredictions: boolean;
    hasWeather: boolean;
    score: number; // 0-100
  };

  // Raw Data (AI için)
  rawData: any;
}

export async function getFullFixtureData(fixtureId: number): Promise<FullFixtureData | null> {
  console.log(`\n🚀 ========== getFullFixtureData START ==========`);
  console.log(`📍 Fixture ID: ${fixtureId}`);

  try {
    console.log(`🔄 Step 1: Fetching fixture base data...`);

    // Sportmonks API - Sadece temel include'lar (çok fazla include API'yi kırabiliyor)
    const fixtureData = await fetchSportmonks(`/fixtures/${fixtureId}`, {
      include: 'participants;scores;league;venue;state'
    });

    if (!fixtureData?.data) {
      console.error('❌ No fixture data returned for fixture', fixtureId);
      return null;
    }

    console.log(`✅ Fixture base data received`);

    const fixture = fixtureData.data;

    // Takımları ayır
    const homeParticipant = fixture.participants?.find((p: any) => p.meta?.location === 'home');
    const awayParticipant = fixture.participants?.find((p: any) => p.meta?.location === 'away');

    if (!homeParticipant || !awayParticipant) {
      console.error('❌ Could not identify teams from participants');
      return null;
    }

    console.log(`✅ Teams identified: ${homeParticipant.name} vs ${awayParticipant.name}`);

    // Takım detaylarını ayrı çek (paralel)
    const homeTeamId = homeParticipant.id;
    const awayTeamId = awayParticipant.id;

    console.log(`🔄 Fetching team details for ${homeTeamId} and ${awayTeamId}...`);

    // 20 saniye timeout - kritik veriler için daha uzun süre
    // Use same include format as getTeamStats for consistency
    const [homeTeamRes, awayTeamRes, h2hData] = await Promise.all([
      fetchSportmonks(`/teams/${homeTeamId}`, {
        include: 'statistics.details;latest.participants;latest.scores;latest.statistics;coach'  // Same as getTeamStats
      }, 2, 20000), // 2 retries, 20s timeout
      fetchSportmonks(`/teams/${awayTeamId}`, {
        include: 'statistics.details;latest.participants;latest.scores;latest.statistics;coach'  // Same as getTeamStats
      }, 2, 20000), // 2 retries, 20s timeout
      fetchSportmonks(`/fixtures/head-to-head/${homeTeamId}/${awayTeamId}`, {
        include: 'participants;scores;statistics',  // statistics for corners
        per_page: '10'
      }, 2, 20000) // 2 retries, 20s timeout
    ]);

    // Extract data from response objects
    console.log(`🔍 homeTeamRes exists: ${!!homeTeamRes}, has data: ${!!homeTeamRes?.data}`);
    console.log(`🔍 awayTeamRes exists: ${!!awayTeamRes}, has data: ${!!awayTeamRes?.data}`);
    console.log(`🔍 h2hData exists: ${!!h2hData}, has data: ${!!h2hData?.data}`);

    const homeTeam = homeTeamRes?.data || homeParticipant;
    const awayTeam = awayTeamRes?.data || awayParticipant;

    console.log(`✅ Step 2: Team details loaded: ${homeTeam?.name || 'Unknown'} vs ${awayTeam?.name || 'Unknown'}`);

    // Form hesapla
    const calculateForm = (latestMatches: any[], teamId: number) => {
      if (!latestMatches?.length) return { form: 'DDDDD', points: 5 };

      let form = '';
      let points = 0;

      latestMatches.slice(0, 10).forEach((match: any) => {
        const isHome = match.participants?.find((p: any) => p.id === teamId)?.meta?.location === 'home';
        const homeScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals || 0;
        const awayScore = match.scores?.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals || 0;

        const teamScore = isHome ? homeScore : awayScore;
        const oppScore = isHome ? awayScore : homeScore;

        if (teamScore > oppScore) { form += 'W'; points += 3; }
        else if (teamScore < oppScore) { form += 'L'; }
        else { form += 'D'; points += 1; }
      });

      return { form: form || 'DDDDD', points: points || 5 };
    };

    console.log(`🔍 Step 3: Calculating form...`);
    console.log(`   homeTeam.latest exists: ${!!homeTeam?.latest}, count: ${homeTeam?.latest?.length || 0}`);
    console.log(`   awayTeam.latest exists: ${!!awayTeam?.latest}, count: ${awayTeam?.latest?.length || 0}`);

    const homeForm = calculateForm(homeTeam?.latest || [], homeTeam?.id || homeTeamId);
    const awayForm = calculateForm(awayTeam?.latest || [], awayTeam?.id || awayTeamId);

    console.log(`✅ Step 3: Form calculated - Home: ${homeForm.form}, Away: ${awayForm.form}`);

    // Get detailed team stats using getTeamStats for consistency
    // This ensures same calculation logic as getCompleteMatchContext
    console.log(`🔍 Step 3.5: Getting detailed team stats...`);
    const [homeTeamStats, awayTeamStats] = await Promise.all([
      getTeamStats(homeTeamId),
      getTeamStats(awayTeamId)
    ]);

    // Use stats from getTeamStats if available, otherwise use calculated form
    const finalHomeForm = homeTeamStats ? {
      form: homeTeamStats.recentForm,
      points: homeTeamStats.formPoints
    } : homeForm;

    const finalAwayForm = awayTeamStats ? {
      form: awayTeamStats.recentForm,
      points: awayTeamStats.formPoints
    } : awayForm;

    console.log(`✅ Step 3.5: Team stats loaded - Home: ${finalHomeForm.form} (${finalHomeForm.points}), Away: ${finalAwayForm.form} (${finalAwayForm.points})`);

    // H2H verilerini işle
    console.log(`🔍 Step 4: Processing H2H data...`);
    const h2h = processH2HData(h2hData?.data || [], homeTeamId, awayTeamId);
    console.log(`✅ Step 4: H2H processed - ${h2h.totalMatches} matches`);

    // Sakatları işle
    const processInjuries = (sidelined: any[]): Injury[] => {
      if (!sidelined?.length) return [];
      const now = new Date();
      return sidelined
        .filter((inj: any) => !inj.end_date || new Date(inj.end_date) > now)
        .slice(0, 10)
        .map((inj: any) => ({
          playerName: inj.player?.display_name || inj.player?.name || 'Unknown',
          reason: inj.type?.name || 'Injury',
          expectedReturn: inj.end_date,
          isOut: !inj.end_date || new Date(inj.end_date) > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }));
    };

    // Bahis oranlarını işle
    const processOdds = (odds: any[]) => {
      const defaultOdds = {
        matchResult: { home: 0, draw: 0, away: 0 },
        btts: { yes: 0, no: 0 },
        overUnder25: { over: 0, under: 0 },
        asianHandicap: null
      };

      if (!odds?.length) return defaultOdds;

      // En popüler bookmaker'ı bul (Bet365, 1xBet, etc.)
      const preferredBookmakers = [2, 8, 1, 6]; // Bet365, 1xBet, etc.

      odds.forEach((odd: any) => {
        const marketId = odd.market_id;
        const value = parseFloat(odd.value) || 0;

        // 1X2 Market
        if (marketId === 1) {
          if (odd.label === 'Home' || odd.label === '1') defaultOdds.matchResult.home = value;
          if (odd.label === 'Draw' || odd.label === 'X') defaultOdds.matchResult.draw = value;
          if (odd.label === 'Away' || odd.label === '2') defaultOdds.matchResult.away = value;
        }
        // BTTS Market
        if (marketId === 28) {
          if (odd.label === 'Yes') defaultOdds.btts.yes = value;
          if (odd.label === 'No') defaultOdds.btts.no = value;
        }
        // Over/Under 2.5 Market
        if (marketId === 2 && odd.total === '2.5') {
          if (odd.label === 'Over') defaultOdds.overUnder25.over = value;
          if (odd.label === 'Under') defaultOdds.overUnder25.under = value;
        }
      });

      return defaultOdds;
    };

    // Lineups işle
    const processLineups = (lineups: any[]) => {
      const result = {
        home: [] as any[],
        away: [] as any[],
        homeFormation: '',
        awayFormation: ''
      };

      if (!lineups?.length) return result;

      lineups.forEach((lineup: any) => {
        const player = {
          name: lineup.player?.display_name || lineup.player?.name || 'Unknown',
          position: lineup.position || lineup.details?.find((d: any) => d.type_id === 1)?.value || 'Unknown',
          number: lineup.jersey_number || 0,
          isCaptain: lineup.captain || false
        };

        if (lineup.team_id === homeTeam.id) {
          result.home.push(player);
          if (lineup.formation) result.homeFormation = lineup.formation;
        } else {
          result.away.push(player);
          if (lineup.formation) result.awayFormation = lineup.formation;
        }
      });

      return result;
    };

    // Veri kalitesi hesapla
    const dataQuality = {
      hasOdds: !!fixture.odds?.length,
      hasLineups: !!fixture.lineups?.length,
      hasStatistics: !!fixture.statistics?.length || !!homeTeam.statistics?.length,
      hasH2H: !!(h2h && h2h.totalMatches > 0),
      hasInjuries: !!(homeTeam.sidelined?.length || awayTeam.sidelined?.length),
      hasPredictions: !!fixture.predictions?.length,
      hasWeather: !!fixture.weatherReport,
      score: 0
    };

    // Kalite skoru hesapla (100 üzerinden)
    const qualityScore = [
      dataQuality.hasOdds ? 15 : 0,
      dataQuality.hasLineups ? 20 : 0,
      dataQuality.hasStatistics ? 25 : 0,
      dataQuality.hasH2H ? 20 : 0,
      dataQuality.hasInjuries ? 10 : 0,
      dataQuality.hasPredictions ? 5 : 0,
      dataQuality.hasWeather ? 5 : 0
    ].reduce((a, b) => a + b, 0);

    dataQuality.score = qualityScore;

    const result: FullFixtureData = {
      fixtureId,
      homeTeam: {
        id: homeTeam.id,
        name: homeTeam.name || 'Unknown',
        shortCode: homeTeam.short_code || '',
        logo: homeTeam.image_path || '',
        form: finalHomeForm.form,
        formPoints: finalHomeForm.points,
        position: homeParticipant.meta?.position || 0,
        statistics: homeTeam.statistics || [],
        recentMatches: homeTeam.latest?.slice(0, 10) || [],
        coach: homeTeam.coach?.name || homeTeam.coaches?.[0]?.name || 'Unknown'
      },
      awayTeam: {
        id: awayTeam.id,
        name: awayTeam.name || 'Unknown',
        shortCode: awayTeam.short_code || '',
        logo: awayTeam.image_path || '',
        form: finalAwayForm.form,
        formPoints: finalAwayForm.points,
        position: awayParticipant.meta?.position || 0,
        statistics: awayTeam.statistics || [],
        recentMatches: awayTeam.latest?.slice(0, 10) || [],
        coach: awayTeam.coach?.name || awayTeam.coaches?.[0]?.name || 'Unknown'
      },
      league: {
        id: fixture.league?.id || 0,
        name: fixture.league?.name || 'Unknown',
        country: fixture.league?.country?.name || '',
        logo: fixture.league?.image_path || ''
      },
      round: fixture.round?.name || '',
      stage: fixture.stage?.name || '',
      venue: {
        name: fixture.venue?.name || 'Unknown',
        city: fixture.venue?.city?.name || fixture.venue?.city || '',
        capacity: fixture.venue?.capacity || 0,
        surface: fixture.venue?.surface || 'grass'
      },
      referee: {
        name: fixture.referee?.name || 'Unknown',
        avgCardsPerMatch: fixture.referee?.statistics?.cards_per_match || 0,
        avgFoulsPerMatch: fixture.referee?.statistics?.fouls_per_match || 0
      },
      weather: {
        temperature: fixture.weatherReport?.temperature?.temp || 0,
        description: fixture.weatherReport?.description || '',
        humidity: fixture.weatherReport?.humidity || 0,
        wind: fixture.weatherReport?.wind?.speed || 0
      },
      matchStatistics: fixture.statistics || [],
      events: fixture.events || [],
      lineups: processLineups(fixture.lineups),
      odds: processOdds(fixture.odds),
      predictions: {
        sportmonks: fixture.predictions?.[0] || null,
        probability: {
          home: fixture.predictions?.[0]?.predictions?.home || 0,
          draw: fixture.predictions?.[0]?.predictions?.draw || 0,
          away: fixture.predictions?.[0]?.predictions?.away || 0
        }
      },
      h2h: h2h || {
        totalMatches: 0,
        team1Wins: 0,
        team2Wins: 0,
        draws: 0,
        avgGoals: 0,
        bttsPercentage: 0,
        over25Percentage: 0,
        avgCorners: 9,
        over85CornersPercentage: 50,
        over95CornersPercentage: 40,
        recentMatches: []
      },
      injuries: {
        home: processInjuries(homeTeam.sidelined),
        away: processInjuries(awayTeam.sidelined)
      },
      dataQuality,
      rawData: fixture
    };

    console.log(`✅ Step FINAL: Full fixture data assembled!`);
    console.log(`   📊 Quality: ${dataQuality.score}/100`);
    console.log(`   📊 Stats: ${dataQuality.hasStatistics}, H2H: ${dataQuality.hasH2H}, Odds: ${dataQuality.hasOdds}`);
    console.log(`   👥 Lineups: ${dataQuality.hasLineups}, 🏥 Injuries: ${dataQuality.hasInjuries}`);
    console.log(`   🏠 Home: ${result.homeTeam.name}, Form: ${result.homeTeam.form}`);
    console.log(`   ✈️ Away: ${result.awayTeam.name}, Form: ${result.awayTeam.form}`);

    return result;

  } catch (error: any) {
    console.error(`\n❌ ========== getFullFixtureData FAILED ==========`);
    console.error(`📍 Fixture ID: ${fixtureId}`);
    console.error(`❌ Error: ${error?.message || error}`);
    console.error(`📋 Stack: ${error?.stack || 'No stack'}`);
    return null;
  }
}

