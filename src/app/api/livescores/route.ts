import { NextResponse } from 'next/server';
import { getMatchesByDate, FFMatch } from '@/lib/data-sources/free-football';

export const dynamic = 'force-dynamic';

// FFMatch durumunu eski sayısal şemaya eşle (frontend canlı tespiti [2,3,4,6,7]).
function toStatusCode(m: FFMatch): number {
  if (m.cancelled) return 0;
  if (m.finished) return 5;     // finished
  if (m.started) return 4;      // live (in-play)
  return 1;                     // not started
}

export async function GET() {
  try {
    const today = new Date();
    const matches = await getMatchesByDate(today);

    const processedMatches = matches.map((m: FFMatch) => ({
      id: m.id,
      name: `${m.homeName} vs ${m.awayName}`,
      league: m.leagueName || 'Unknown',
      leagueId: m.leagueId,
      leagueLogo: m.leagueLogo,
      homeTeam: m.homeName || 'TBD',
      awayTeam: m.awayName || 'TBD',
      homeTeamLogo: m.homeLogo,
      awayTeamLogo: m.awayLogo,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      statusCode: toStatusCode(m),
      minute: null,
      startTime: m.utcTime,
      venue: '',
    }));

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
