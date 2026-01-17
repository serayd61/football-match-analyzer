// ============================================================================
// LEAGUE STATISTICS API
// Analiz edilen liglerin puan tablosu, takım istatistikleri, son maçlar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

// Lig ID eşleştirme
const LEAGUE_IDS: Record<string, number> = {
  'Premier League': 8,
  'La Liga': 564,
  'Bundesliga': 82,
  'Serie A': 384,
  'Ligue 1': 301,
  'Süper Lig': 600,
  'Eredivisie': 72,
  'Champions League': 2,
};

/**
 * Sportmonks'tan puan tablosu çek
 */
async function fetchStandings(leagueId: number, seasonId?: number): Promise<any[]> {
  if (!SPORTMONKS_KEY) {
    return [];
  }

  try {
    let url = `${SPORTMONKS_API}/standings/livescores/season/${seasonId || 'latest'}`;
    if (!seasonId) {
      // League ID ile standings al
      url = `${SPORTMONKS_API}/standings/seasons/latest?filters=standingsLeagues:${leagueId}`;
    }

    const response = await fetch(
      `${url}&api_token=${SPORTMONKS_KEY}&include=participant`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 } // 1 saat cache
      }
    );

    if (!response.ok) {
      console.error(`❌ Standings API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error: any) {
    console.error('❌ Standings fetch error:', error.message);
    return [];
  }
}

/**
 * Takımın son 10 maçını çek
 */
async function fetchTeamRecentMatches(teamId: number, limit: number = 10): Promise<any[]> {
  if (!SPORTMONKS_KEY) {
    return [];
  }

  try {
    const response = await fetch(
      `${SPORTMONKS_API}/teams/${teamId}/fixtures?api_token=${SPORTMONKS_KEY}&include=participants;scores&per_page=${limit}&filters=fixturesStatus:3`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 1800 } // 30 dakika cache
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error: any) {
    console.error('❌ Team matches fetch error:', error.message);
    return [];
  }
}

/**
 * Analiz edilen ligleri getir (unified_analysis'tan)
 */
async function getAnalyzedLeagues(): Promise<string[]> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('unified_analysis')
      .select('league')
      .not('league', 'is', null);

    if (error) {
      console.error('❌ Error fetching leagues:', error);
      return [];
    }

    const leagues = Array.from(new Set(data.map((d: any) => d.league).filter(Boolean)));
    return leagues.sort();
  } catch (error: any) {
    console.error('❌ Error getting analyzed leagues:', error.message);
    return [];
  }
}

/**
 * Lig için takım istatistiklerini hesapla (unified_analysis'tan)
 */
async function getLeagueTeamStats(league: string): Promise<Record<string, any>> {
  try {
    const supabase = getSupabase();
    
    // Son 30 gün içindeki analizleri al
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('unified_analysis')
      .select('home_team, away_team, actual_home_score, actual_away_score, match_date')
      .eq('league', league)
      .gte('match_date', thirtyDaysAgo.toISOString().split('T')[0])
      .not('actual_home_score', 'is', null);

    if (error) {
      console.error('❌ Error fetching league stats:', error);
      return {};
    }

    // Takım bazında istatistikleri hesapla
    const teamStats: Record<string, {
      matches: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      points: number;
      recentMatches: Array<{
        date: string;
        opponent: string;
        score: string;
        result: 'W' | 'D' | 'L';
      }>;
    }> = {};

    data?.forEach((match: any) => {
      const homeTeam = match.home_team;
      const awayTeam = match.away_team;
      const homeScore = match.actual_home_score || 0;
      const awayScore = match.actual_away_score || 0;

      // Home team stats
      if (!teamStats[homeTeam]) {
        teamStats[homeTeam] = {
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
          recentMatches: []
        };
      }

      teamStats[homeTeam].matches++;
      teamStats[homeTeam].goalsFor += homeScore;
      teamStats[homeTeam].goalsAgainst += awayScore;

      if (homeScore > awayScore) {
        teamStats[homeTeam].wins++;
        teamStats[homeTeam].points += 3;
        teamStats[homeTeam].recentMatches.push({
          date: match.match_date,
          opponent: awayTeam,
          score: `${homeScore}-${awayScore}`,
          result: 'W'
        });
      } else if (homeScore < awayScore) {
        teamStats[homeTeam].losses++;
        teamStats[homeTeam].recentMatches.push({
          date: match.match_date,
          opponent: awayTeam,
          score: `${homeScore}-${awayScore}`,
          result: 'L'
        });
      } else {
        teamStats[homeTeam].draws++;
        teamStats[homeTeam].points += 1;
        teamStats[homeTeam].recentMatches.push({
          date: match.match_date,
          opponent: awayTeam,
          score: `${homeScore}-${awayScore}`,
          result: 'D'
        });
      }

      // Away team stats
      if (!teamStats[awayTeam]) {
        teamStats[awayTeam] = {
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
          recentMatches: []
        };
      }

      teamStats[awayTeam].matches++;
      teamStats[awayTeam].goalsFor += awayScore;
      teamStats[awayTeam].goalsAgainst += homeScore;

      if (awayScore > homeScore) {
        teamStats[awayTeam].wins++;
        teamStats[awayTeam].points += 3;
        teamStats[awayTeam].recentMatches.push({
          date: match.match_date,
          opponent: homeTeam,
          score: `${awayScore}-${homeScore}`,
          result: 'W'
        });
      } else if (awayScore < homeScore) {
        teamStats[awayTeam].losses++;
        teamStats[awayTeam].recentMatches.push({
          date: match.match_date,
          opponent: homeTeam,
          score: `${awayScore}-${homeScore}`,
          result: 'L'
        });
      } else {
        teamStats[awayTeam].draws++;
        teamStats[awayTeam].points += 1;
        teamStats[awayTeam].recentMatches.push({
          date: match.match_date,
          opponent: homeTeam,
          score: `${awayScore}-${homeScore}`,
          result: 'D'
        });
      }
    });

    // Son 10 maçı sırala (en yeni önce)
    Object.keys(teamStats).forEach(team => {
      teamStats[team].recentMatches = teamStats[team].recentMatches
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
    });

    return teamStats;
  } catch (error: any) {
    console.error('❌ Error calculating team stats:', error.message);
    return {};
  }
}

/**
 * GET /api/league-stats
 * 
 * Query params:
 * - league: Lig adı (opsiyonel, yoksa tüm ligler)
 * - includeStandings: Sportmonks'tan puan tablosu çek (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get('league') || '';
    const includeStandings = searchParams.get('includeStandings') === 'true';

    // Analiz edilen ligleri getir
    const analyzedLeagues = await getAnalyzedLeagues();

    if (league) {
      // Tek lig için detaylı istatistikler
      const teamStats = await getLeagueTeamStats(league);
      
      let standings: any[] = [];
      if (includeStandings && SPORTMONKS_KEY) {
        const leagueId = LEAGUE_IDS[league];
        if (leagueId) {
          standings = await fetchStandings(leagueId);
        }
      }

      return NextResponse.json({
        success: true,
        league,
        teamStats,
        standings: standings.length > 0 ? standings : null,
        analyzedLeagues
      });
    } else {
      // Tüm ligler için özet
      const leaguesData: Record<string, any> = {};

      for (const lig of analyzedLeagues) {
        const teamStats = await getLeagueTeamStats(lig);
        const teamCount = Object.keys(teamStats).length;
        const totalMatches = Object.values(teamStats).reduce((sum: number, stats: any) => sum + stats.matches, 0) / 2; // Her maç 2 takım için sayılıyor

        leaguesData[lig] = {
          teamCount,
          totalMatches: Math.round(totalMatches),
          teams: Object.keys(teamStats).slice(0, 5) // İlk 5 takım
        };
      }

      return NextResponse.json({
        success: true,
        leagues: leaguesData,
        analyzedLeagues
      });
    }
  } catch (error: any) {
    console.error('❌ League stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
