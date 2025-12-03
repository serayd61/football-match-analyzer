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
    const leagueId = searchParams.get('league');

    // Bugünün tarihi
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 7 gün sonrası
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    console.log('========== MATCHES API ==========');
    console.log('Mode:', specificDate ? 'Single Date' : '7-Day Range');
    console.log('Date range:', todayStr, 'to', nextWeekStr);

    let url: string;
    
    if (specificDate) {
      // Tek gün
      url = `https://api.sportmonks.com/v3/football/fixtures/date/${specificDate}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;scores&per_page=100`;
    } else {
      // 7 günlük aralık
      url = `https://api.sportmonks.com/v3/football/fixtures/between/${todayStr}/${nextWeekStr}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;scores&per_page=150`;
    }

    console.log('Fetching matches...');

    const response = await fetch(url);
    const data = await response.json();

    console.log('API Response status:', response.status);
    console.log('Total matches from API:', data.data?.length || 0);

    if (data.error || data.message) {
      console.log('API Error:', data.error || data.message);
      return NextResponse.json({ 
        error: data.error || data.message,
        matches: [],
        total: 0
      });
    }

    if (!data.data || data.data.length === 0) {
      console.log('No matches found');
      return NextResponse.json({ 
        matches: [], 
        total: 0,
        message: 'No matches found'
      });
    }

    // Process matches
    let matches = data.data.map((fixture: any) => {
      const homeTeam = fixture.participants?.find((p: any) => p.meta?.location === 'home');
      const awayTeam = fixture.participants?.find((p: any) => p.meta?.location === 'away');

      return {
        id: fixture.id,
        homeTeam: homeTeam?.name || 'Unknown',
        awayTeam: awayTeam?.name || 'Unknown',
        homeTeamId: homeTeam?.id,
        awayTeamId: awayTeam?.id,
        league: fixture.league?.name || 'Unknown League',
        leagueId: fixture.league?.id,
        leagueLogo: fixture.league?.image_path,
        venue: fixture.venue?.name,
        date: fixture.starting_at,
        status: fixture.state?.state || 'NS',
      };
    });

    // Filter by league if specified
    if (leagueId) {
      matches = matches.filter((m: any) => m.leagueId === parseInt(leagueId));
    }

    // Sort by date
    matches.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get unique leagues
    const uniqueLeagues = Array.from(new Set(matches.map((m: any) => m.league)));

    console.log('Processed matches:', matches.length);
    console.log('Leagues:', uniqueLeagues.length);
    console.log('=================================');

    return NextResponse.json({
      matches,
      total: matches.length,
      dateRange: {
        from: todayStr,
        to: nextWeekStr
      },
      leagues: uniqueLeagues,
    });

  } catch (error: any) {
    console.error('Matches fetch error:', error);
    return NextResponse.json({ 
      error: error.message,
      matches: [],
      total: 0 
    }, { status: 500 });
  }
}
