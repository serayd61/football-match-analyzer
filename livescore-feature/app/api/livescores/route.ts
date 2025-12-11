import { NextResponse } from 'next/server';

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY || 'LVhKgzwe2bZEyzoPQa5Sgz9oFpr9wN8Nvu4lpOJU65iwvOdKRoQ3shhvUPF5';

// Takip edilen ligler (27 lig)
const TRACKED_LEAGUES = [
  181, 208, 244, 271, 8, 24, 9, 27, 1371, 301, 82, 387, 384, 390, 
  72, 444, 453, 462, 486, 501, 570, 567, 564, 573, 591, 600
];

interface SportmonksMatch {
  id: number;
  name: string;
  starting_at: string;
  state_id: number;
  venue_id: number;
  league_id: number;
  league?: {
    id: number;
    name: string;
  };
  venue?: {
    name: string;
  };
  participants?: Array<{
    id: number;
    name: string;
    meta?: {
      location: string;
    };
  }>;
  scores?: Array<{
    participant_id: number;
    score: {
      goals: number;
    };
  }>;
  periods?: Array<{
    minutes: number;
    ticking: boolean;
  }>;
  events?: Array<{
    id: number;
    type_id: number;
    minute: number;
    player_name?: string;
    participant_id: number;
    info?: string;
    type?: {
      name: string;
    };
  }>;
}

// State ID'leri (Sportmonks)
const STATE_MAPPING: { [key: number]: number } = {
  1: 1,   // Not Started
  2: 2,   // 1st Half
  3: 3,   // Half Time
  4: 4,   // 2nd Half
  5: 5,   // Finished
  6: 6,   // Extra Time
  7: 7,   // Penalties
  14: 14, // Postponed
  17: 2,  // Playing (generic)
  21: 5,  // FT after extra time
  22: 5,  // FT after penalties
};

export async function GET() {
  try {
    // Bugünün maçlarını al (livescores yerine fixtures/date kullanabiliriz daha güvenilir)
    const today = new Date().toISOString().split('T')[0];
    
    // Önce canlı maçları dene
    let matches: SportmonksMatch[] = [];
    
    // Livescores endpoint'i dene
    const livescoreUrl = `https://api.sportmonks.com/v3/football/livescores?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;scores;events.type;periods&filters=fixtureLeagues:${TRACKED_LEAGUES.join(',')}`;
    
    const livescoreRes = await fetch(livescoreUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 30 }
    });

    if (livescoreRes.ok) {
      const livescoreData = await livescoreRes.json();
      matches = livescoreData.data || [];
    }

    // Eğer livescore boşsa, bugünün fixture'larını al
    if (matches.length === 0) {
      const fixturesUrl = `https://api.sportmonks.com/v3/football/fixtures/date/${today}?api_token=${SPORTMONKS_API_KEY}&include=participants;league;venue;scores;events.type;periods&filters=fixtureLeagues:${TRACKED_LEAGUES.join(',')}&per_page=100`;
      
      const fixturesRes = await fetch(fixturesUrl, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      });

      if (fixturesRes.ok) {
        const fixturesData = await fixturesRes.json();
        matches = fixturesData.data || [];
      }
    }

    // Maçları işle
    const processedMatches = matches.map((match: SportmonksMatch) => {
      const home = match.participants?.find(p => p.meta?.location === 'home');
      const away = match.participants?.find(p => p.meta?.location === 'away');
      
      const homeScore = match.scores?.find(s => s.participant_id === home?.id)?.score?.goals ?? null;
      const awayScore = match.scores?.find(s => s.participant_id === away?.id)?.score?.goals ?? null;

      // Dakikayı hesapla
      let minute: number | null = null;
      const currentPeriod = match.periods?.find(p => p.ticking);
      if (currentPeriod) {
        minute = currentPeriod.minutes;
      }

      // Eventleri işle
      const events = (match.events || []).map(event => ({
        id: event.id,
        type: event.type?.name || 'unknown',
        minute: event.minute,
        player: event.player_name || '',
        team: event.participant_id === home?.id ? 'home' : 'away',
        description: event.info || event.type?.name || ''
      })).sort((a, b) => b.minute - a.minute);

      return {
        id: match.id,
        name: match.name,
        league: match.league?.name || 'Unknown League',
        leagueId: match.league_id,
        homeTeam: home?.name || 'TBD',
        awayTeam: away?.name || 'TBD',
        homeScore,
        awayScore,
        status: getStatusLabel(match.state_id),
        statusCode: STATE_MAPPING[match.state_id] || match.state_id,
        minute,
        startTime: match.starting_at,
        events: events.slice(0, 10),
        venue: match.venue?.name || ''
      };
    });

    // Canlı maçları önce, sonra başlama saatine göre sırala
    processedMatches.sort((a, b) => {
      // Canlı maçlar önce
      const aLive = [2, 3, 4, 6, 7].includes(a.statusCode);
      const bLive = [2, 3, 4, 6, 7].includes(b.statusCode);
      
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      
      // Sonra başlama saatine göre
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    return NextResponse.json({
      success: true,
      matches: processedMatches,
      count: processedMatches.length,
      liveCount: processedMatches.filter(m => [2, 3, 4, 6, 7].includes(m.statusCode)).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Livescores API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Veriler alınamadı',
        matches: [],
        count: 0 
      },
      { status: 500 }
    );
  }
}

function getStatusLabel(stateId: number): string {
  const labels: { [key: number]: string } = {
    1: 'Başlamadı',
    2: '1. Yarı',
    3: 'Devre Arası',
    4: '2. Yarı',
    5: 'Bitti',
    6: 'Uzatma',
    7: 'Penaltılar',
    14: 'Ertelendi',
    17: 'Oynanıyor',
    21: 'Bitti (U.S.)',
    22: 'Bitti (Pen.)',
  };
  return labels[stateId] || 'Bilinmiyor';
}
