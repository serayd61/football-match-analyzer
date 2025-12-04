export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { soccerDataClient } from '@/lib/soccerdata/client';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const specificDate = searchParams.get('date');
    const source = searchParams.get('source') || 'all'; // 'sportmonks', 'soccerdata', 'all'

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    console.log('========== MATCHES API ==========');
    console.log('Date:', specificDate || `${todayStr} to ${nextWeekStr}`);
    console.log('Source:', source);

    let allMatches: any[] = [];
    const dataSources: string[] = [];

    // ========== SPORTMONKS ==========
    if ((source === 'all' || source === 'sportmonks') && SPORTMONKS_API_KEY) {
      try {
        let url: string;
        if (specificDate) {
          url = `https://api.sportmonks.com/v3/football/fixtures/date/${specificDate}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;scores&per_page=100`;
        } else {
          url = `https://api.sportmonks.com/v3/football/fixtures/between/${todayStr}/${nextWeekStr}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;scores&per_page=150`;
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

          allMatches.push(...sportmonksMatches);
          dataSources.push('Sportmonks');
          console.log(`✅ Sportmonks: ${sportmonksMatches.length} matches`);
        }
      } catch (error) {
        console.error('Sportmonks error:', error);
      }
    }

    // ========== SOCCERDATA API ==========
    if (source === 'all' || source === 'soccerdata') {
      try {
        // Canlı skorları çek (bugünün maçları)
        const liveData = await soccerDataClient.getLiveScores();
        
        if (liveData && Array.isArray(liveData)) {
          liveData.forEach((league: any) => {
            if (league.matches) {
              league.matches.forEach((match: any) => {
                allMatches.push({
                  id: match.id,
                  source: 'soccerdata',
                  homeTeam: match.teams?.home?.name || 'Unknown',
                  awayTeam: match.teams?.away?.name || 'Unknown',
                  homeTeamId: match.teams?.home?.id,
                  awayTeamId: match.teams?.away?.id,
                  league: league.league_name || 'Unknown League',
                  leagueId: league.league_id,
                  date: `${match.date} ${match.time}`,
                  status: match.status,
                  odds: match.odds,
                  hasLineups: !!match.lineups,
                  hasPreview: match.match_preview?.has_preview,
                });
              });
            }
          });
          dataSources.push('SoccerDataAPI');
          console.log(`✅ SoccerDataAPI: ${allMatches.filter(m => m.source === 'soccerdata').length} matches`);
        }

        // Yaklaşan önizlemeler
        const upcomingPreviews = await soccerDataClient.getUpcomingPreviews();
        if (upcomingPreviews && Array.isArray(upcomingPreviews)) {
          upcomingPreviews.forEach((league: any) => {
            if (league.match_previews) {
              league.match_previews.forEach((preview: any) => {
                // Eğer bu maç zaten eklenmemişse ekle
                const exists = allMatches.find(m => 
                  m.homeTeam === preview.teams?.home?.name && 
                  m.awayTeam === preview.teams?.away?.name
                );
                
                if (!exists) {
                  allMatches.push({
                    id: preview.id,
                    source: 'soccerdata',
                    homeTeam: preview.teams?.home?.name || 'Unknown',
                    awayTeam: preview.teams?.away?.name || 'Unknown',
                    homeTeamId: preview.teams?.home?.id,
                    awayTeamId: preview.teams?.away?.id,
                    league: league.league_name || 'Unknown League',
                    leagueId: league.league_id,
                    date: `${preview.date} ${preview.time}`,
                    status: 'upcoming',
                    hasPreview: true,
                    previewWordCount: preview.word_count,
                  });
                }
              });
            }
          });
        }
      } catch (error) {
        console.error('SoccerDataAPI error:', error);
      }
    }

    // Duplicate'leri kaldır (aynı takımlar aynı tarih)
    const uniqueMatches = allMatches.reduce((acc: any[], match) => {
      const key = `${match.homeTeam}-${match.awayTeam}-${match.date?.split('T')[0] || match.date?.split(' ')[0]}`;
      if (!acc.find(m => `${m.homeTeam}-${m.awayTeam}-${m.date?.split('T')[0] || m.date?.split(' ')[0]}` === key)) {
        acc.push(match);
      }
      return acc;
    }, []);

    // Tarihe göre sırala
    uniqueMatches.sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateA - dateB;
    });

    // Benzersiz ligler
    const leagues = Array.from(new Set(uniqueMatches.map((m: any) => m.league)));

    console.log(`📊 Total unique matches: ${uniqueMatches.length}`);
    console.log(`📡 Data sources: ${dataSources.join(', ')}`);
    console.log('=================================');

    return NextResponse.json({
      matches: uniqueMatches,
      total: uniqueMatches.length,
      dateRange: { from: todayStr, to: nextWeekStr },
      leagues,
      dataSources,
    });

  } catch (error: any) {
    console.error('Matches fetch error:', error);
    return NextResponse.json({ error: error.message, matches: [], total: 0 }, { status: 500 });
  }
}
