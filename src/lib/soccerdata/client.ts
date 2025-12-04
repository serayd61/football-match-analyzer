const SOCCERDATA_API_URL = 'https://api.soccerdataapi.com';
const SOCCERDATA_AUTH_TOKEN = process.env.SOCCERDATA_API_KEY || 'ebee6a00e482013f0981dbf9a37ae19f51f188ac';

export interface SoccerDataMatch {
  id: number;
  stage: { id: number; name: string };
  date: string;
  time: string;
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  stadium?: { id: number; name: string; city: string };
  status: string;
  minute: number;
  winner: string;
  goals: {
    home_ht_goals: number;
    away_ht_goals: number;
    home_ft_goals: number;
    away_ft_goals: number;
  };
  odds?: {
    match_winner: { home: number; draw: number; away: number };
    over_under: { total: number; over: number; under: number };
    handicap: { market: number; home: number; away: number };
  };
  lineups?: any;
  events?: any[];
}

export class SoccerDataClient {
  private baseUrl = SOCCERDATA_API_URL;
  private authToken = SOCCERDATA_AUTH_TOKEN;

  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
    try {
      const queryParams = new URLSearchParams({
        auth_token: this.authToken,
        ...params,
      });

      const url = `${this.baseUrl}${endpoint}?${queryParams}`;
      console.log(`📡 SoccerDataAPI: ${endpoint}`);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip',
        },
      });

      if (!response.ok) {
        console.error('SoccerDataAPI error:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.detail) {
        console.error('SoccerDataAPI error:', data.detail);
        return null;
      }

      return data as T;
    } catch (error) {
      console.error('SoccerDataAPI fetch error:', error);
      return null;
    }
  }

  // Ülkeleri getir
  async getCountries() {
    return this.fetch<{ results: any[] }>('/country/');
  }

  // Ligleri getir
  async getLeagues(countryId?: number) {
    const params: Record<string, string> = {};
    if (countryId) params.country_id = countryId.toString();
    return this.fetch<{ results: any[] }>('/league/', params);
  }

  // Sezonları getir
  async getSeasons(leagueId: number) {
    return this.fetch<{ results: any[] }>('/season/', { league_id: leagueId.toString() });
  }

  // Puan durumu
  async getStandings(leagueId: number, season?: string) {
    const params: Record<string, string> = { league_id: leagueId.toString() };
    if (season) params.season = season;
    return this.fetch<any>('/standing/', params);
  }

  // Tarihe göre maçlar
  async getMatchesByDate(date: string) {
    // date format: DD/MM/YYYY
    return this.fetch<any[]>('/matches/', { date });
  }

  // Lige göre maçlar
  async getMatchesByLeague(leagueId: number, season?: string) {
    const params: Record<string, string> = { league_id: leagueId.toString() };
    if (season) params.season = season;
    return this.fetch<any[]>('/matches/', params);
  }

  // Tek maç detayı
  async getMatch(matchId: number) {
    return this.fetch<SoccerDataMatch>('/match/', { match_id: matchId.toString() });
  }

  // Canlı skorlar
  async getLiveScores() {
    return this.fetch<any[]>('/livescores/');
  }

  // Kafa kafaya
  async getHeadToHead(team1Id: number, team2Id: number) {
    return this.fetch<any>('/head-to-head/', {
      team_1_id: team1Id.toString(),
      team_2_id: team2Id.toString(),
    });
  }

  // Takım bilgisi
  async getTeam(teamId: number) {
    return this.fetch<any>('/team/', { team_id: teamId.toString() });
  }

  // Transferler
  async getTransfers(teamId: number) {
    return this.fetch<any>('/transfers/', { team_id: teamId.toString() });
  }

  // Maç önizleme
  async getMatchPreview(matchId: number) {
    return this.fetch<any>('/match-preview/', { match_id: matchId.toString() });
  }

  // Yaklaşan maç önizlemeleri
  async getUpcomingPreviews() {
    return this.fetch<any[]>('/match-previews-upcoming/');
  }
}

export const soccerDataClient = new SoccerDataClient();
