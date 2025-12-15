// src/app/api/matches/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

// Sportmonks Market IDs
const MARKET_IDS = {
  MATCH_WINNER: 1,        // 1X2
  OVER_UNDER_25: 18,      // Over/Under 2.5
  OVER_UNDER_15: 12,      // Over/Under 1.5
  OVER_UNDER_35: 19,      // Over/Under 3.5
  BTTS: 28,               // Both Teams to Score
  DOUBLE_CHANCE: 9,       // Double Chance (1X, X2, 12)
};

// Odds'ları parse et
function parseOdds(oddsData: any[]): any {
  const result: any = {
    home: null,
    draw: null,
    away: null,
    over15: null,
    under15: null,
    over25: null,
    under25: null,
    over35: null,
    under35: null,
    bttsYes: null,
    bttsNo: null,
    homeOrDraw: null,
    awayOrDraw: null,
    homeOrAway: null,
  };

  if (!oddsData || !Array.isArray(oddsData)) return result;

  oddsData.forEach((odd: any) => {
    const marketId = odd.market_id;
    const label = odd.label?.toLowerCase() || odd.name?.toLowerCase() || '';
    const value = parseFloat(odd.value) || null;

    // 1X2 Market
    if (marketId === MARKET_IDS.MATCH_WINNER) {
      if (label === 'home' || label === '1') result.home = value;
      else if (label === 'draw' || label === 'x') result.draw = value;
      else if (label === 'away' || label === '2') result.away = value;
    }
    
    // Over/Under 1.5
    else if (marketId === MARKET_IDS.OVER_UNDER_15) {
      if (label.includes('over')) result.over15 = value;
      else if (label.includes('under')) result.under15 = value;
    }
    
    // Over/Under 2.5
    else if (marketId === MARKET_IDS.OVER_UNDER_25) {
      if (label.includes('over')) result.over25 = value;
      else if (label.includes('under')) result.under25 = value;
    }
    
    // Over/Under 3.5
    else if (marketId === MARKET_IDS.OVER_UNDER_35) {
      if (label.includes('over')) result.over35 = value;
      else if (label.includes('under')) result.under35 = value;
    }
    
    // BTTS
    else if (marketId === MARKET_IDS.BTTS) {
      if (label === 'yes') result.bttsYes = value;
      else if (label === 'no') result.bttsNo = value;
    }
    
    // Double Chance
    else if (marketId === MARKET_IDS.DOUBLE_CHANCE) {
      if (label === '1x' || label === 'home/draw') result.homeOrDraw = value;
      else if (label === 'x2' || label === 'draw/away') result.awayOrDraw = value;
      else if (label === '12' || label === 'home/away') result.homeOrAway = value;
    }
  });

  return result;
}

// Eksik oranları hesapla (fallback)
function calculateMissingOdds(odds: any): any {
  // 1X2 varsa Double Chance hesapla
  if (odds.home && odds.draw && odds.away) {
    if (!odds.homeOrDraw) {
      odds.homeOrDraw = Math.round((1 / (1/odds.home + 1/odds.draw)) * 100) / 100;
    }
    if (!odds.awayOrDraw) {
      odds.awayOrDraw = Math.round((1 / (1/odds.draw + 1/odds.away)) * 100) / 100;
    }
    if (!odds.homeOrAway) {
      odds.homeOrAway = Math.round((1 / (1/odds.home + 1/odds.away)) * 100) / 100;
    }
  }
  
  return odds;
}

// Gerçekçi mock odds (API'den gelmezse)
function generateRealisticOdds(): any {
  const homeStrength = Math.random();
  const home = homeStrength > 0.6 ? 1.4 + Math.random() * 0.8 : 
               homeStrength > 0.3 ? 2.0 + Math.random() * 1.0 : 
               2.8 + Math.random() * 2.0;
  const draw = 3.0 + Math.random() * 0.8;
  const away = homeStrength < 0.4 ? 1.5 + Math.random() * 0.8 : 
               homeStrength < 0.7 ? 2.2 + Math.random() * 1.2 : 
               3.2 + Math.random() * 2.5;
  
  const odds = {
    home: Math.round(home * 100) / 100,
    draw: Math.round(draw * 100) / 100,
    away: Math.round(away * 100) / 100,
    over15: Math.round((1.25 + Math.random() * 0.25) * 100) / 100,
    under15: Math.round((3.5 + Math.random() * 1.0) * 100) / 100,
    over25: Math.round((1.75 + Math.random() * 0.35) * 100) / 100,
    under25: Math.round((1.95 + Math.random() * 0.30) * 100) / 100,
    over35: Math.round((2.5 + Math.random() * 0.8) * 100) / 100,
    under35: Math.round((1.45 + Math.random() * 0.25) * 100) / 100,
    bttsYes: Math.round((1.7 + Math.random() * 0.35) * 100) / 100,
    bttsNo: Math.round((2.0 + Math.random() * 0.35) * 100) / 100,
    homeOrDraw: 0,
    awayOrDraw: 0,
    homeOrAway: 0,
  };
  
  return calculateMissingOdds(odds);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const specificDate = searchParams.get('date');
    const includeOdds = searchParams.get('includeOdds') === 'true';
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    console.log('========== MATCHES API ==========');
    console.log('Date:', specificDate || `${todayStr} to ${nextWeekStr}`);
    console.log('Include Odds:', includeOdds);

    let allMatches: any[] = [];

    if (SPORTMONKS_API_KEY) {
      try {
        let page = 1;
        let hasMore = true;
        
        while (hasMore && page <= 5) {
          // ✅ odds eklendi
          const includeParams = 'participants;league;scores' + (includeOdds ? ';odds' : '');
          
          let url: string;
          if (specificDate) {
            url = `https://api.sportmonks.com/v3/football/fixtures/date/${specificDate}?api_token=${SPORTMONKS_API_KEY}&include=${includeParams}&per_page=100&page=${page}`;
          } else {
            url = `https://api.sportmonks.com/v3/football/fixtures/between/${todayStr}/${nextWeekStr}?api_token=${SPORTMONKS_API_KEY}&include=${includeParams}&per_page=150&page=${page}`;
          }

          console.log(`Fetching page ${page}...`);
          const response = await fetch(url);
          const data = await response.json();

          if (data.data && data.data.length > 0) {
            const sportmonksMatches = data.data.map((fixture: any) => {
              const homeTeam = fixture.participants?.find((p: any) => p.meta?.location === 'home');
              const awayTeam = fixture.participants?.find((p: any) => p.meta?.location === 'away');
              
              // Odds parse
              let odds = null;
              if (includeOdds && fixture.odds && fixture.odds.length > 0) {
                odds = parseOdds(fixture.odds);
                odds = calculateMissingOdds(odds);
                
                // Eğer ana oranlar boşsa mock kullan
                if (!odds.home || !odds.draw || !odds.away) {
                  odds = generateRealisticOdds();
                }
              } else if (includeOdds) {
                // Odds yoksa mock üret
                odds = generateRealisticOdds();
              }
              
              return {
                id: fixture.id,
                source: 'sportmonks',
                homeTeam: homeTeam?.name || 'Unknown',
                awayTeam: awayTeam?.name || 'Unknown',
                homeTeamId: homeTeam?.id,
                awayTeamId: awayTeam?.id,
                homeTeamLogo: homeTeam?.image_path || null,
                awayTeamLogo: awayTeam?.image_path || null,
                league: fixture.league?.name || 'Unknown League',
                leagueId: fixture.league?.id,
                leagueLogo: fixture.league?.image_path || null,
                date: fixture.starting_at,
                status: fixture.state?.state || 'NS',
                odds: odds,
              };
            });
            
            allMatches = [...allMatches, ...sportmonksMatches];
            console.log(`✅ Page ${page}: ${sportmonksMatches.length} matches`);
            
            if (data.pagination && data.pagination.has_more) {
              page++;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
        
        console.log(`✅ Total: ${allMatches.length} matches`);
        
      } catch (error) {
        console.error('Sportmonks error:', error);
      }
    }

    // Tarihe göre sırala
    allMatches.sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateA - dateB;
    });

    // Benzersiz ligler
    const leagues = Array.from(new Set(allMatches.map((m: any) => m.league)));

    console.log(`📊 Total matches: ${allMatches.length}`);
    console.log(`📊 Total leagues: ${leagues.length}`);
    console.log('=================================');

    return NextResponse.json({
      matches: allMatches,
      total: allMatches.length,
      dateRange: { from: todayStr, to: nextWeekStr },
      leagues,
      dataSources: ['Sportmonks'],
    });

  } catch (error: any) {
    console.error('Matches fetch error:', error);
    return NextResponse.json({ error: error.message, matches: [], total: 0 }, { status: 500 });
  }
}
