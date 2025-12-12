// src/app/api/stats/route.ts
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

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`API error: ${response.status} for ${url}`);
      return { data: [] };
    }
    const data = await response.json();
    cache[cacheKey] = { data, timestamp: now };
    return data;
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    return { data: [] };
  }
}

// Bugünkü maçları getir
async function getTodayMatches(date: string) {
  const leagueIds = '181,208,244,271,8,24,9,27,1371,301,82,387,384,390,72,444,453,462,486,501,570,567,564,573,591,600';
  const url = `${BASE_URL}/fixtures/date/${date}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;scores&filters=fixtureLeagues:${leagueIds}&per_page=50`;
  
  const data = await fetchWithCache(url, `matches_${date}`);
  return data.data || [];
}

// Takım son maçları - DÜZELTİLDİ
// Takım son maçları - DÜZELTİLDİ (Doğru Endpoint)
async function getTeamRecentMatches(teamId: number) {
  try {
    // Tarih aralığı: Son 3 ay
    const endDate = new Date().toISOString().split('T')[0]; // Bugün
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 90 gün önce
    
    // Sportmonks v3 API - DOĞRU ENDPOINT
    const url = `${BASE_URL}/fixtures/between/${startDate}/${endDate}/${teamId}?api_token=${SPORTMONKS_API_KEY}&include=participants;scores;league&per_page=10`;
    
    console.log(`Fetching recent matches for team ${teamId}: ${startDate} to ${endDate}`);
    const data = await fetchWithCache(url, `team_recent_${teamId}_${endDate}`);
    
    // Sadece bitmiş maçları filtrele ve tarihe göre sırala (en yeni önce)
    const finishedMatches = (data.data || [])
      .filter((match: any) => {
        const hasScores = match.scores && match.scores.length > 0;
        const isPast = new Date(match.starting_at) < new Date();
        return hasScores && isPast;
      })
      .sort((a: any, b: any) => new Date(b.starting_at).getTime() - new Date(a.starting_at).getTime());
    
    console.log(`Found ${finishedMatches.length} finished matches for team ${teamId}`);
    return finishedMatches.slice(0, 5);
  } catch (error) {
    console.error(`Team recent matches error for ${teamId}:`, error);
    return [];
  }
}
// Head-to-head karşılaşmalar
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

// Skor çıkarma yardımcı fonksiyonu
function extractScores(match: any): { homeScore: number; awayScore: number } {
  let homeScore = 0;
  let awayScore = 0;

  if (match.scores && Array.isArray(match.scores)) {
    match.scores.forEach((s: any) => {
      // Farklı score tiplerini kontrol et
      if (s.description === 'CURRENT' || s.description === '2ND_HALF' || s.type_id === 1525) {
        if (s.score?.participant === 'home') homeScore = s.score?.goals || 0;
        if (s.score?.participant === 'away') awayScore = s.score?.goals || 0;
      }
    });
  }

  // Eğer hala 0-0 ise, scores içinde direkt değer ara
  if (homeScore === 0 && awayScore === 0 && match.scores) {
    const ftScore = match.scores.find((s: any) => s.description === 'CURRENT');
    if (ftScore) {
      homeScore = ftScore.score?.home || 0;
      awayScore = ftScore.score?.away || 0;
    }
  }

  return { homeScore, awayScore };
}

// Form hesaplama - DÜZELTİLDİ
function calculateForm(matches: any[], teamId?: number) {
  if (!matches || !teamId || matches.length === 0) {
    return { form: [], points: 0, goalsScored: 0, goalsConceded: 0 };
  }

  const form: string[] = [];
  let points = 0;
  let goalsScored = 0;
  let goalsConceded = 0;

  matches.slice(0, 5).forEach((match: any) => {
    const homeParticipant = match.participants?.find((p: any) => p.meta?.location === 'home');
    const awayParticipant = match.participants?.find((p: any) => p.meta?.location === 'away');
    
    // Team ID karşılaştırması - string veya number olabilir
    const isHome = String(homeParticipant?.id) === String(teamId);
    
    const { homeScore, awayScore } = extractScores(match);

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

// H2H işleme
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
    
    const { homeScore, awayScore } = extractScores(match);
    totalGoals += homeScore + awayScore;

    if (homeScore > awayScore) {
      if (String(home?.id) === String(team1Id)) team1Wins++;
      else team2Wins++;
    } else if (awayScore > homeScore) {
      if (String(away?.id) === String(team1Id)) team1Wins++;
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
      avgGoals: matches.length > 0 ? (totalGoals / matches.length).toFixed(1) : '0',
      totalMatches: matches.length
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE FONKSİYONLARI - Tahmin performansı
// ═══════════════════════════════════════════════════════════════════

async function getPerformanceStats() {
  try {
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
  } catch (error) {
    console.error('Performance stats error:', error);
    return {
      overall: { total: 0, matchResult: { correct: 0, total: 0, accuracy: 0 }, overUnder: { correct: 0, total: 0, accuracy: 0 }, btts: { correct: 0, total: 0, accuracy: 0 } },
      leaguePerformance: [],
    };
  }
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
      case 'overview': {
        const matches = await getTodayMatches(date);
        
        // Her maç için paralel olarak veri çek
        const matchesWithStats = await Promise.all(
          matches.slice(0, 15).map(async (match: any) => {
            const homeTeam = match.participants?.find((p: any) => p.meta?.location === 'home');
            const awayTeam = match.participants?.find((p: any) => p.meta?.location === 'away');
            
            // Paralel API çağrıları
            const [homeRecentMatches, awayRecentMatches, h2h] = await Promise.all([
              homeTeam?.id ? getTeamRecentMatches(homeTeam.id) : [],
              awayTeam?.id ? getTeamRecentMatches(awayTeam.id) : [],
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
                recentForm: calculateForm(homeRecentMatches, homeTeam?.id),
                recentMatches: homeRecentMatches
              },
              awayTeam: {
                id: awayTeam?.id,
                name: awayTeam?.name,
                logo: awayTeam?.image_path,
                recentForm: calculateForm(awayRecentMatches, awayTeam?.id),
                recentMatches: awayRecentMatches
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
        const recentMatches = await getTeamRecentMatches(parseInt(teamId));
        return NextResponse.json({ 
          success: true, 
          recentMatches,
          form: calculateForm(recentMatches, parseInt(teamId))
        });
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
