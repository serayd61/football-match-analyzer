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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const leagueId = searchParams.get('league');

    console.log('========== MATCHES API DEBUG ==========');
    console.log('Date:', date);
    console.log('League filter:', leagueId || 'none');
    console.log('API Key exists:', !!SPORTMONKS_API_KEY);
    console.log('API Key prefix:', SPORTMONKS_API_KEY?.slice(0, 10) + '...');

    // Sportmonks API - fixtures by date
    const url = `https://api.sportmonks.com/v3/football/fixtures/date/${date}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;scores&per_page=100`;
    
    console.log('Fetching URL:', url.replace(SPORTMONKS_API_KEY || '', 'API_KEY_HIDDEN'));

    const response = await fetch(url);
    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response has data:', !!data.data);
    console.log('Total matches from API:', data.data?.length || 0);
    
    // Subscription info
    if (data.subscription) {
      console.log('Subscription plan:', data.subscription?.plans?.[0]?.plan);
      console.log('Subscription leagues:', data.subscription?.plans?.[0]?.leagues?.length || 'unknown');
    }

    // Rate limit info
    if (data.rate_limit) {
      console.log('Rate limit:', data.rate_limit);
    }

    // Error check
    if (data.error || data.message) {
      console.log('API Error:', data.error || data.message);
      return NextResponse.json({ 
        error: data.error || data.message,
        matches: [],
        total: 0,
        debug: {
          date,
          apiKeyExists: !!SPORTMONKS_API_KEY,
          responseStatus: response.status,
        }
      });
    }

    if (!data.data || data.data.length === 0) {
      console.log('No matches found for date:', date);
      return NextResponse.json({ 
        matches: [], 
        total: 0,
        date,
        message: 'No matches found for this date'
      });
    }

    // Log first 3 matches for debug
    console.log('Sample matches:');
    data.data.slice(0, 3).forEach((fixture: any, idx: number) => {
      const home = fixture.participants?.find((p: any) => p.meta?.location === 'home');
      const away = fixture.participants?.find((p: any) => p.meta?.location === 'away');
      console.log(`  ${idx + 1}. ${home?.name || 'Unknown'} vs ${away?.name || 'Unknown'} (${fixture.league?.name || 'Unknown League'})`);
    });

    // Log unique leagues
    const uniqueLeagues = Array.from(new Set(data.data.map((f: any) => f.league?.name).filter(Boolean)));
    console.log('Leagues found:', uniqueLeagues.length);
    console.log('Leagues:', uniqueLeagues.slice(0, 10).join(', '));

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
        round: fixture.round?.name,
      };
    });

    // Filter by league if specified
    if (leagueId) {
      matches = matches.filter((m: any) => m.leagueId === parseInt(leagueId));
      console.log('After league filter:', matches.length);
    }

    console.log('Final matches count:', matches.length);
    console.log('========================================');

    return NextResponse.json({
      matches,
      total: matches.length,
      date,
      leaguesAvailable: uniqueLeagues,
      debug: {
        apiResponseCount: data.data?.length || 0,
        processedCount: matches.length,
        subscription: data.subscription?.plans?.[0]?.plan || 'unknown',
      }
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
