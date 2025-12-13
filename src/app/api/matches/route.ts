export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const specificDate = searchParams.get('date');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    console.log('========== MATCHES API ==========');
    console.log('Date:', specificDate || `${todayStr} to ${nextWeekStr}`);

    let allMatches: any[] = [];

    if (SPORTMONKS_API_KEY) {
      try {
        let page = 1;
        let hasMore = true;
        
        while (hasMore && page <= 5) { // Max 5 sayfa (500 maç)
          let url: string;
          
          if (specificDate) {
            url = `https://api.sportmonks.com/v3/football/fixtures/date/${specificDate}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;scores&per_page=100&page=${page}`;
          } else {
            url = `https://api.sportmonks.com/v3/football/fixtures/between/${todayStr}/${nextWeekStr}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;scores&per_page=150&page=${page}`;
          }

          const response = await fetch(url);
          const data = await response.json();

          if (data.data && data.data.length > 0) {
            const sportmonksMatches = data.data.map((fixture: any) => {
              const homeTeam = fixture.participants?.find((p: any) => p.meta?.location === 'home');
              const awayTeam = fixture.participants?.find((p: any) => p.meta?.location === 'away');
              
              return {
                id: fixture.id,
                source: 'sportmonks',
                homeTeam: homeTeam?.name || 'Unknown',
                awayTeam: awayTeam?.name || 'Unknown',
                homeTeamId: homeTeam?.id,
                awayTeamId: awayTeam?.id,
                league: fixture.league?.name || 'Unknown League',
                leagueId: fixture.league?.id,
                date: fixture.starting_at,
                status: fixture.state?.state || 'NS',
              };
            });
            
            allMatches = [...allMatches, ...sportmonksMatches];
            console.log(`✅ Sportmonks Page ${page}: ${sportmonksMatches.length} matches`);
            
            // Check if there are more pages
            if (data.pagination && data.pagination.has_more) {
              page++;
            } else {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
        
        console.log(`✅ Sportmonks Total: ${allMatches.length} matches`);
        
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
