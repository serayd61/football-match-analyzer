// src/app/api/stats/route.ts
// Hem performans istatistikleri hem canlı maç istatistikleri

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const BASE_URL = 'https://api.sportmonks.com/v3/football';

// Cache için basit memory store
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 dakika

async function fetchWithCache(url: string, cacheKey: string) {
  const now = Date.now();
  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_DURATION) {
    return cache[cacheKey].data;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
  cache[cacheKey] = { data, timestamp: now };
  return data;
}

// ═══════════════════════════════════════════════════════════════════
// SPORTMONKS FONKSİYONLARI - Canlı maç istatistikleri
// ═══════════════════════════════════════════════════════════════════

async function getTodayMatches(date: string) {
  const leagueIds = '181,208,244,271,8,24,9,27,1371,301,82,387,384,390,72,444,453,462,486,501,570,567,564,573,591,600';
  const url = `${BASE_URL}/fixtures/date/${date}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;scores&filters=fixtureLeagues:${leagueIds}&per_page=50`;
  
  const data = await fetchWithCache(url, `matches_${date}`);
  return data.data || [];
}

async function getTeamStats(teamId: number) {
  try {
    const fixturesUrl = `${BASE_URL}/fixtures?api_token=${SPORTMONKS_API_KEY}&filters=teamId:${teamId};fixtureStatusName:FT&include=participants;scores;league&per_page=10&order=starting_at&sortOrder=desc`;
    const fixturesData = await fetchWithCache(fixturesUrl, `team_fixtures_${teamId}`);
    
    return {
      recentMatches: fixturesData.data || []
    };
  } catch (error) {
    console.error(`Team stats error for ${teamId}:`, error);
    return null;
  }
}

async function getHeadToHead(team1Id: number, team2Id: number) {
  try {
    const url = `${BASE_URL}/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores;league&per_page=10`;
    const data = await fetchWithCache(url, `h2h_${team1Id}_${team2Id}`);
    return data.data || [];
  } catch (error) {
    console.error('H2H error:', error);
    return [];
  }
}

function calculateForm(matches: any[], teamId?: number) {
  if (!matches || !teamId) {
    return { form: [], points: 0, goalsScored: 0, goalsConceded: 0 };
  }

  const form: string[] = [];
  let points = 0;
  let goalsScored = 0;
  let goalsConceded = 0;

  matches.slice(0, 5).forEach((match: any) => {
    const isHome = match.participants?.find((p: any) => p.meta?.location === 'home')?.id === teamId;
    const scores = match.scores || [];
    
    let homeScore = 0;
    let awayScore = 0;
    
    scores.forEach((s: any) => {
      if (s.description === 'CURRENT' || s.type_id === 1525) {
        if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
        if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
      }
    });

    const teamScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;

    goalsScored += teamScore;
    goalsConceded += opponentScore;

    if (teamScore > opponentScore) {
      form.push('W');
      points += 3;
    } else if (teamScore < opponentScore) {
      form.push('L');
    } else {
      form.push('D');
      points += 1;
    }
  });

  return { form, points, goalsScored, goalsConceded };
}

function processH2H(matches: any[], team1Id?: number, team2Id?: number) {
  if (!matches || matches.length === 0) {
    return { matches: [], stats: { team1Wins: 0, team2Wins: 0, draws: 0, totalGoals: 0, avgGoals: '0', totalMatches: 0 } };
  }

  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  let totalGoals = 0;

  const processedMatches = matches.map((match: any) => {
    const home = match.participants?.find((p: any) => p.meta?.location === 'home');
    const away = match.participants?.find((p: any) => p.meta?.location === 'away');
    
    let homeScore = 0;
    let awayScore = 0;
    
    (match.scores || []).forEach((s: any) => {
      if (s.description === 'CURRENT' || s.type_id === 1525) {
        if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
        if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
      }
    });

    totalGoals += homeScore + awayScore;

    if (homeScore > awayScore) {
      if (home?.id === team1Id) team1Wins++;
      else team2Wins++;
    } else if (awayScore > homeScore) {
      if (away?.id === team1Id) team1Wins++;
      else team2Wins++;
    } else {
      draws++;
    }

    return {
      date: match.starting_at,
      homeTeam: home?.name,
      awayTeam: away?.name,
      homeScore,
      awayScore,
      league: match.league?.name
    };
  });

  return {
    matches: processedMatches,
    stats: {
      team1Wins,
      team2Wins,
      draws,
      totalGoals,
      avgGoals: (totalGoals / matches.length).toFixed(1),
      totalMatches: matches.length
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE FONKSİYONLARI - Tahmin performansı
// ═══════════════════════════════════════════════════════════════════

async function getPerformanceStats() {
  const supabase = getSupabaseAdmin();

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('match_finished', true);

  if (error || !predictions || predictions.length === 0) {
    return {
      overall: {
        total: 0,
        matchResult: { correct: 0, total: 0, accuracy: 0 },
        overUnder: { correct: 0, total: 0, accuracy: 0 },
        btts: { correct: 0, total: 0, accuracy: 0 },
      },
      leaguePerformance: [],
      message: 'No finished predictions yet',
    };
  }

  const total = predictions.length;

  const matchResultPredictions = predictions.filter(p => p.final_match_result_correct !== null);
  const matchResultCorrect = matchResultPredictions.filter(p => p.final_match_result_correct === true).length;

  const overUnderPredictions = predictions.filter(p => p.final_over_under_correct !== null);
  const overUnderCorrect = overUnderPredictions.filter(p => p.final_over_under_correct === true).length;

  const bttsPredictions = predictions.filter(p => p.final_btts_correct !== null);
  const bttsCorrect = bttsPredictions.filter(p => p.final_btts_correct === true).length;

  // Lig bazlı performans
  const leagueStats: Record<string, { total: number; overUnder: number; matchResult: number; btts: number }> = {};
  predictions.forEach(p => {
    const league = p.league || 'Unknown';
    if (!leagueStats[league]) {
      leagueStats[league] = { total: 0, overUnder: 0, matchResult: 0, btts: 0 };
    }
    leagueStats[league].total++;
    if (p.final_over_under_correct === true) leagueStats[league].overUnder++;
    if (p.final_match_result_correct === true) leagueStats[league].matchResult++;
    if (p.final_btts_correct === true) leagueStats[league].btts++;
  });

  const leaguePerformance = Object.entries(leagueStats)
    .map(([league, stats]) => ({
      league,
      total: stats.total,
      overUnderAccuracy: stats.total > 0 ? Math.round((stats.overUnder / stats.total) * 100) : 0,
      matchResultAccuracy: stats.total > 0 ? Math.round((stats.matchResult / stats.total) * 100) : 0,
      bttsAccuracy: stats.total > 0 ? Math.round((stats.btts / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const calcAccuracy = (correct: number, total: number) => 
    total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    overall: {
      total,
      matchResult: {
        correct: matchResultCorrect,
        total: matchResultPredictions.length,
        accuracy: calcAccuracy(matchResultCorrect, matchResultPredictions.length),
      },
      overUnder: {
        correct: overUnderCorrect,
        total: overUnderPredictions.length,
        accuracy: calcAccuracy(overUnderCorrect, overUnderPredictions.length),
      },
      btts: {
        correct: bttsCorrect,
        total: bttsPredictions.length,
        accuracy: calcAccuracy(bttsCorrect, bttsPredictions.length),
      },
    },
    leaguePerformance,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ANA ROUTE
// ═══════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const teamId = searchParams.get('teamId');
    const team1Id = searchParams.get('team1Id');
    const team2Id = searchParams.get('team2Id');

    switch (type) {
      // ═══════════════════════════════════════════════════
      // CANLI MAÇ İSTATİSTİKLERİ
      // ═══════════════════════════════════════════════════
      case 'overview': {
        const matches = await getTodayMatches(date);
        
        const matchesWithStats = await Promise.all(
          matches.slice(0, 15).map(async (match: any) => {
            const homeTeam = match.participants?.find((p: any) => p.meta?.location === 'home');
            const awayTeam = match.participants?.find((p: any) => p.meta?.location === 'away');
            
            const [homeStats, awayStats, h2h] = await Promise.all([
              homeTeam?.id ? getTeamStats(homeTeam.id) : null,
              awayTeam?.id ? getTeamStats(awayTeam.id) : null,
              homeTeam?.id && awayTeam?.id ? getHeadToHead(homeTeam.id, awayTeam.id) : []
            ]);

            return {
              fixture: {
                id: match.id,
                startTime: match.starting_at,
                venue: match.venue?.name,
                league: match.league?.name,
                leagueId: match.league?.id,
                leagueLogo: match.league?.image_path
              },
              homeTeam: {
                id: homeTeam?.id,
                name: homeTeam?.name,
                logo: homeTeam?.image_path,
                recentForm: calculateForm(homeStats?.recentMatches, homeTeam?.id),
                recentMatches: homeStats?.recentMatches?.slice(0, 5)
              },
              awayTeam: {
                id: awayTeam?.id,
                name: awayTeam?.name,
                logo: awayTeam?.image_path,
                recentForm: calculateForm(awayStats?.recentMatches, awayTeam?.id),
                recentMatches: awayStats?.recentMatches?.slice(0, 5)
              },
              h2h: processH2H(h2h, homeTeam?.id, awayTeam?.id)
            };
          })
        );

        return NextResponse.json({
          success: true,
          date,
          matches: matchesWithStats,
          totalMatches: matches.length
        });
      }

      case 'team': {
        if (!teamId) {
          return NextResponse.json({ error: 'teamId required' }, { status: 400 });
        }
        const stats = await getTeamStats(parseInt(teamId));
        return NextResponse.json({ success: true, ...stats });
      }

      case 'h2h': {
        if (!team1Id || !team2Id) {
          return NextResponse.json({ error: 'team1Id and team2Id required' }, { status: 400 });
        }
        const h2h = await getHeadToHead(parseInt(team1Id), parseInt(team2Id));
        return NextResponse.json({ 
          success: true, 
          h2h: processH2H(h2h, parseInt(team1Id), parseInt(team2Id)) 
        });
      }

      // ═══════════════════════════════════════════════════
      // TAHMİN PERFORMANSI (ESKİ FONKSİYON)
      // ═══════════════════════════════════════════════════
      case 'performance':
      case 'overall': {
        const performanceData = await getPerformanceStats();
        return NextResponse.json({
          success: true,
          data: performanceData,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid type. Use: overview, team, h2h, performance' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
