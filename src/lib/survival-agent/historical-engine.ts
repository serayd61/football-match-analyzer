// ============================================================================
// SURVIVAL AGENT - Historical Engine
// Settled maçlardan lig profili, takım hafızası, odds & form pattern çıkarır
// Sıfır AI çağrısı - tamamen Supabase query + lokal hesaplama
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ============================================================================
// TYPES
// ============================================================================

export interface SettledMatch {
  id: string;
  fixture_id: number;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  match_result_prediction: string;
  match_result_confidence: number;
  over_under_prediction: string;
  over_under_confidence: number;
  btts_prediction: string;
  btts_confidence: number;
  actual_home_score: number;
  actual_away_score: number;
  actual_total_goals: number;
  actual_match_result: string; // '1' | 'X' | '2'
  actual_btts: boolean;
  match_result_correct: boolean;
  over_under_correct: boolean;
  btts_correct: boolean;
  overall_confidence: number;
  agreement: number;
  analysis: any; // Full JSONB
}

export interface LeagueProfile {
  league: string;
  totalMatches: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  overPct: number;
  underPct: number;
  bttsYesPct: number;
  bttsNoPct: number;
  avgGoals: number;
  avgHomeGoals: number;
  avgAwayGoals: number;
}

export interface TeamMemory {
  team: string;
  totalMatches: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  overPct: number;
  bttsYesPct: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  h2hMatches: SettledMatch[];
  h2hHomeWinPct: number;
  h2hDrawPct: number;
  h2hAwayWinPct: number;
  h2hOverPct: number;
}

export interface OddsPattern {
  oddsRange: string; // e.g. "1.50-1.80"
  totalMatches: number;
  actualWinPct: number;
  actualDrawPct: number;
  actualLossPct: number;
  overPct: number;
  bttsYesPct: number;
}

export interface FormPattern {
  formRange: string;
  totalMatches: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  overPct: number;
  bttsYesPct: number;
}

export interface HistoricalData {
  allMatches: SettledMatch[];
  leagueProfile: LeagueProfile | null;
  homeTeamMemory: TeamMemory | null;
  awayTeamMemory: TeamMemory | null;
  h2hMatches: SettledMatch[];
}

// ============================================================================
// DATA FETCHING
// ============================================================================

let cachedMatches: SettledMatch[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

export async function fetchSettledMatches(): Promise<SettledMatch[]> {
  // Cache kontrolü
  if (cachedMatches && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedMatches;
  }

  const supabase = getSupabase();

  const { data, error } = await (supabase
    .from('unified_analysis') as any)
    .select(`
      id, fixture_id, home_team, away_team, league, match_date,
      match_result_prediction, match_result_confidence,
      over_under_prediction, over_under_confidence,
      btts_prediction, btts_confidence,
      actual_home_score, actual_away_score, actual_total_goals,
      actual_match_result, actual_btts,
      match_result_correct, over_under_correct, btts_correct,
      overall_confidence, agreement, analysis
    `)
    .eq('is_settled', true)
    .not('actual_match_result', 'is', null)
    .order('match_date', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('❌ Survival Agent: Failed to fetch settled matches:', error.message);
    return cachedMatches || [];
  }

  cachedMatches = (data || []) as SettledMatch[];
  cacheTimestamp = Date.now();

  console.log(`🔫 Survival Agent: ${cachedMatches.length} settled match loaded`);
  return cachedMatches;
}

// ============================================================================
// LEAGUE PROFILE
// ============================================================================

export function buildLeagueProfile(matches: SettledMatch[], league: string): LeagueProfile | null {
  const leagueMatches = matches.filter(m => m.league === league);
  if (leagueMatches.length === 0) return null;

  const total = leagueMatches.length;
  const homeWins = leagueMatches.filter(m => m.actual_match_result === '1').length;
  const draws = leagueMatches.filter(m => m.actual_match_result === 'X').length;
  const awayWins = leagueMatches.filter(m => m.actual_match_result === '2').length;
  const overs = leagueMatches.filter(m => m.actual_total_goals > 2.5).length;
  const bttsYes = leagueMatches.filter(m => m.actual_btts === true).length;

  const totalGoals = leagueMatches.reduce((sum, m) => sum + (m.actual_total_goals || 0), 0);
  const homeGoals = leagueMatches.reduce((sum, m) => sum + (m.actual_home_score || 0), 0);
  const awayGoals = leagueMatches.reduce((sum, m) => sum + (m.actual_away_score || 0), 0);

  return {
    league,
    totalMatches: total,
    homeWinPct: round((homeWins / total) * 100),
    drawPct: round((draws / total) * 100),
    awayWinPct: round((awayWins / total) * 100),
    overPct: round((overs / total) * 100),
    underPct: round(((total - overs) / total) * 100),
    bttsYesPct: round((bttsYes / total) * 100),
    bttsNoPct: round(((total - bttsYes) / total) * 100),
    avgGoals: round(totalGoals / total, 2),
    avgHomeGoals: round(homeGoals / total, 2),
    avgAwayGoals: round(awayGoals / total, 2),
  };
}

// ============================================================================
// TEAM MEMORY
// ============================================================================

export function buildTeamMemory(
  matches: SettledMatch[],
  teamName: string,
  opponentName: string
): TeamMemory | null {
  // Takımın oynadığı tüm maçlar
  const teamMatches = matches.filter(
    m => m.home_team === teamName || m.away_team === teamName
  );
  if (teamMatches.length === 0) return null;

  const total = teamMatches.length;

  // Ev/Deplasman ayrımı
  const homeMatches = teamMatches.filter(m => m.home_team === teamName);
  const awayMatches = teamMatches.filter(m => m.away_team === teamName);

  const homeWins = homeMatches.filter(m => m.actual_match_result === '1').length +
                   awayMatches.filter(m => m.actual_match_result === '2').length;
  const draws = teamMatches.filter(m => m.actual_match_result === 'X').length;
  const losses = total - homeWins - draws;

  const overs = teamMatches.filter(m => m.actual_total_goals > 2.5).length;
  const bttsYes = teamMatches.filter(m => m.actual_btts === true).length;

  // Gol istatistikleri
  let goalsScored = 0;
  let goalsConceded = 0;
  for (const m of teamMatches) {
    if (m.home_team === teamName) {
      goalsScored += m.actual_home_score || 0;
      goalsConceded += m.actual_away_score || 0;
    } else {
      goalsScored += m.actual_away_score || 0;
      goalsConceded += m.actual_home_score || 0;
    }
  }

  // H2H
  const h2h = matches.filter(
    m => (m.home_team === teamName && m.away_team === opponentName) ||
         (m.home_team === opponentName && m.away_team === teamName)
  );

  const h2hTotal = h2h.length;
  let h2hWins = 0, h2hDraws = 0, h2hLosses = 0, h2hOvers = 0;

  for (const m of h2h) {
    if (m.actual_match_result === 'X') { h2hDraws++; }
    else if (
      (m.home_team === teamName && m.actual_match_result === '1') ||
      (m.away_team === teamName && m.actual_match_result === '2')
    ) { h2hWins++; }
    else { h2hLosses++; }
    if (m.actual_total_goals > 2.5) h2hOvers++;
  }

  return {
    team: teamName,
    totalMatches: total,
    homeWinPct: round((homeWins / total) * 100),
    drawPct: round((draws / total) * 100),
    awayWinPct: round((losses / total) * 100),
    overPct: round((overs / total) * 100),
    bttsYesPct: round((bttsYes / total) * 100),
    avgGoalsScored: round(goalsScored / total, 2),
    avgGoalsConceded: round(goalsConceded / total, 2),
    h2hMatches: h2h,
    h2hHomeWinPct: h2hTotal > 0 ? round((h2hWins / h2hTotal) * 100) : 0,
    h2hDrawPct: h2hTotal > 0 ? round((h2hDraws / h2hTotal) * 100) : 0,
    h2hAwayWinPct: h2hTotal > 0 ? round((h2hLosses / h2hTotal) * 100) : 0,
    h2hOverPct: h2hTotal > 0 ? round((h2hOvers / h2hTotal) * 100) : 0,
  };
}

// ============================================================================
// FULL HISTORICAL DATA
// ============================================================================

export async function getHistoricalData(
  league: string,
  homeTeam: string,
  awayTeam: string
): Promise<HistoricalData> {
  const allMatches = await fetchSettledMatches();

  const leagueProfile = buildLeagueProfile(allMatches, league);
  const homeTeamMemory = buildTeamMemory(allMatches, homeTeam, awayTeam);
  const awayTeamMemory = buildTeamMemory(allMatches, awayTeam, homeTeam);

  const h2hMatches = allMatches.filter(
    m => (m.home_team === homeTeam && m.away_team === awayTeam) ||
         (m.home_team === awayTeam && m.away_team === homeTeam)
  );

  return {
    allMatches,
    leagueProfile,
    homeTeamMemory,
    awayTeamMemory,
    h2hMatches,
  };
}

// ============================================================================
// UTILS
// ============================================================================

function round(val: number, decimals = 1): number {
  const mult = Math.pow(10, decimals);
  return Math.round(val * mult) / mult;
}
