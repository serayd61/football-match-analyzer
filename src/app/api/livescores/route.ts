import { NextResponse } from 'next/server';
import { getEnabledLeagueIds } from '@/lib/data-providers/api-football-provider';

export const dynamic = 'force-dynamic';

const FOOTBALL_API_HOST = 'api-football-v1.p.rapidapi.com';
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || '';

// API-Football durum kısaltmasını eski sayısal şemaya eşle (frontend canlı tespiti
// [2,3,4,6,7].includes(statusCode) mantığını kullanıyor).
function toStatusCode(short: string): number {
  switch (short) {
    case 'NS': return 1;            // Not started
    case '1H': return 2;            // First half (live)
    case 'HT': return 3;            // Half time (live)
    case '2H': return 4;            // Second half (live)
    case 'ET': case 'BT': return 6; // Extra/break time (live)
    case 'P': return 7;             // Penalty shootout (live)
    case 'FT': case 'AET': case 'PEN': return 5; // Finished
    default: return 1;
  }
}

export async function GET() {
  try {
    if (!FOOTBALL_API_KEY) {
      return NextResponse.json(
        { success: false, matches: [], count: 0, error: 'FOOTBALL_API_KEY not configured' },
        { status: 500 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    const res = await fetch(
      `https://${FOOTBALL_API_HOST}/v3/fixtures?date=${today}&timezone=UTC`,
      {
        headers: { 'X-RapidAPI-Key': FOOTBALL_API_KEY, 'X-RapidAPI-Host': FOOTBALL_API_HOST },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      throw new Error(`API-Football error: ${res.status}`);
    }

    const data = await res.json();
    const allowed = new Set(getEnabledLeagueIds());
    const matches = (Array.isArray(data?.response) ? data.response : [])
      .filter((m: any) => allowed.has(m.league?.id));

    const processedMatches = matches.map((m: any) => {
      const short = m.fixture?.status?.short || 'NS';
      return {
        id: m.fixture?.id,
        name: `${m.teams?.home?.name} vs ${m.teams?.away?.name}`,
        league: m.league?.name || 'Unknown',
        leagueId: m.league?.id,
        homeTeam: m.teams?.home?.name || 'TBD',
        awayTeam: m.teams?.away?.name || 'TBD',
        homeTeamLogo: m.teams?.home?.logo,
        awayTeamLogo: m.teams?.away?.logo,
        homeScore: m.goals?.home ?? null,
        awayScore: m.goals?.away ?? null,
        statusCode: toStatusCode(short),
        status: short,
        minute: m.fixture?.status?.elapsed ?? null,
        startTime: m.fixture?.date,
        venue: m.fixture?.venue?.name || '',
      };
    });

    // Sırala: Canlı önce, sonra saate göre
    const liveCodes = [2, 3, 4, 6, 7];
    processedMatches.sort((a: any, b: any) => {
      const aLive = liveCodes.includes(a.statusCode);
      const bLive = liveCodes.includes(b.statusCode);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    return NextResponse.json({
      success: true,
      matches: processedMatches,
      count: processedMatches.length,
      liveCount: processedMatches.filter((m: any) => liveCodes.includes(m.statusCode)).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Livescores error:', error);
    return NextResponse.json(
      { success: false, matches: [], count: 0, error: 'API error' },
      { status: 500 }
    );
  }
}
