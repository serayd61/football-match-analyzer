// ============================================================================
// API: League Standings with Home/Away Stats
// SportMonks'tan lig puan tablosu ve home/away istatistiklerini çeker
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getStandings, parseStandingsForTeam, LEAGUES } from '@/lib/sportmonks';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = parseInt(searchParams.get('leagueId') || '0');
    const leagueName = searchParams.get('leagueName') || '';

    if (!leagueId && !leagueName) {
      return NextResponse.json({ error: 'leagueId or leagueName required' }, { status: 400 });
    }

    // Find league by ID or name
    let league;
    if (leagueId) {
      league = Object.values(LEAGUES).find(l => l.id === leagueId);
    } else {
      league = Object.values(LEAGUES).find(l => 
        l.name.toLowerCase().includes(leagueName.toLowerCase())
      );
    }

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Fetch standings from SportMonks
    const standingsRes = await getStandings(league.id, league.seasonId);

    if (!standingsRes?.data) {
      return NextResponse.json({ error: 'No standings data' }, { status: 404 });
    }

    // Parse standings data
    const standings = Array.isArray(standingsRes.data)
      ? standingsRes.data
      : standingsRes.data.standings || [];

    // Flatten if nested
    const flatStandings = standings.flatMap((item: any) => {
      if (item.standings) return item.standings;
      if (item.details) return [item];
      return [item];
    });

    // Parse each team's stats
    const teams = flatStandings.map((item: any) => {
      const details = item.details || [];
      const getDetail = (typeId: number) => details.find((d: any) => d.type_id === typeId)?.value || 0;

      return {
        position: item.position || 0,
        teamId: item.participant_id || item.team_id || 0,
        teamName: item.participant?.name || 'Unknown',
        teamLogo: item.participant?.image_path || null,
        
        // Overall stats
        points: item.points || 0,
        played: getDetail(129) || item.games_played || 0,
        won: getDetail(130) || 0,
        drawn: getDetail(131) || 0,
        lost: getDetail(132) || 0,
        goalsFor: getDetail(133) || 0,
        goalsAgainst: getDetail(134) || 0,
        goalDifference: getDetail(179) || 0,
        
        // Home stats
        homePlayed: getDetail(140) || 0,
        homeWon: getDetail(141) || 0,
        homeDrawn: getDetail(142) || 0,
        homeLost: getDetail(143) || 0,
        homePoints: (getDetail(141) * 3) + getDetail(142),
        homeGoalsFor: getDetail(144) || 0,
        homeGoalsAgainst: getDetail(145) || 0,
        homeGoalDifference: (getDetail(144) || 0) - (getDetail(145) || 0),
        
        // Away stats
        awayPlayed: getDetail(146) || 0,
        awayWon: getDetail(147) || 0,
        awayDrawn: getDetail(148) || 0,
        awayLost: getDetail(149) || 0,
        awayPoints: (getDetail(147) * 3) + getDetail(148),
        awayGoalsFor: getDetail(150) || 0,
        awayGoalsAgainst: getDetail(151) || 0,
        awayGoalDifference: (getDetail(150) || 0) - (getDetail(151) || 0),
      };
    }).filter(t => t.teamId > 0).sort((a, b) => a.position - b.position);

    return NextResponse.json({
      success: true,
      league: {
        id: league.id,
        name: league.name,
        country: league.country,
        seasonId: league.seasonId
      },
      standings: teams,
      totalTeams: teams.length
    });

  } catch (error: any) {
    console.error('League standings API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch standings' },
      { status: 500 }
    );
  }
}

