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
      'filters[latestLimit]': '15'  // Get last 15 matches for form calculation
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
      per_page: '15'  // Get last 15 H2H matches
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
      recentMatches: []
    };
  }

  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  let totalGoals = 0;
  let bttsCount = 0;
  let over25Count = 0;

  const recentMatches = matches.slice(0, 10).map((match: any) => {
    const home = match.participants?.find((p: any) => p.meta?.location === 'home');
    const away = match.participants?.find((p: any) => p.meta?.location === 'away');
    
    let homeScore = 0;
    let awayScore = 0;
    
    if (match.scores) {
      homeScore = match.scores.find((s: any) => s.score?.participant === 'home')?.score?.goals || 0;
      awayScore = match.scores.find((s: any) => s.score?.participant === 'away')?.score?.goals || 0;
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
      awayScore
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
    
    // Sportmonks API - Temel include'lar (nested olanlar sorun çıkarabilir)
    const fixtureData = await fetchSportmonks(`/fixtures/${fixtureId}`, {
      include: [
        // Temel bilgiler
        'participants',
        'scores',
        'league',
        'round',
        'stage',
        'venue',
        'referee',
        'weatherReport',
        // Kadro ve olaylar
        'lineups',
        'events',
        'statistics',
        // Bahis ve tahmin
        'odds',
        'predictions'
      ].join(';')
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
    
    const [homeTeamRes, awayTeamRes, h2hData] = await Promise.all([
      fetchSportmonks(`/teams/${homeTeamId}`, {
        include: 'statistics;latest;coach'  // Removed sidelined, coaches->coach
      }),
      fetchSportmonks(`/teams/${awayTeamId}`, {
        include: 'statistics;latest;coach'  // Removed sidelined, coaches->coach
      }),
      fetchSportmonks(`/fixtures/head-to-head/${homeTeamId}/${awayTeamId}`, {
        include: 'participants;scores',
        per_page: '10'
      })
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
        form: homeForm.form,
        formPoints: homeForm.points,
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
        form: awayForm.form,
        formPoints: awayForm.points,
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

