// ============================================================================
// MATCH RESULTS - MULTI-PROVIDER SYSTEM
// Birden fazla kaynaktan maç sonuçlarını çeker
// ============================================================================

export interface MatchResult {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  htHomeScore?: number;
  htAwayScore?: number;
  status: 'FT' | 'AET' | 'PEN' | 'LIVE' | 'NS' | 'CANC' | 'PST';
  corners?: number;
  yellowCards?: number;
  redCards?: number;
  source: string;
}

// Takım adlarını normalize et (Türkçe karakterler, kısaltmalar vs)
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[ıİ]/g, 'i')
    .replace(/\s*(sk|fk|fc|sc|jk|as|ac|cf|cd|ud|sd|afc|bk|if|ff|bsc|vfb|tsv|sv|ssv|fsv)\s*$/i, '')
    .replace(/[-_.']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Takım adı eşleşmesi kontrol et
export function matchTeamNames(dbName: string, apiName: string): boolean {
  const normalizedDb = normalizeTeamName(dbName);
  const normalizedApi = normalizeTeamName(apiName);
  
  // Tam eşleşme
  if (normalizedDb === normalizedApi) return true;
  
  // Birinin diğerini içermesi
  if (normalizedDb.includes(normalizedApi) || normalizedApi.includes(normalizedDb)) return true;
  
  // İlk kelimenin eşleşmesi (örn: "Galatasaray" vs "Galatasaray SK")
  const dbFirst = normalizedDb.split(' ')[0];
  const apiFirst = normalizedApi.split(' ')[0];
  if (dbFirst.length >= 4 && dbFirst === apiFirst) return true;
  
  return false;
}

export interface MatchResultProvider {
  name: string;
  priority: number;
  fetchResult: (fixtureId: number, homeTeam: string, awayTeam: string, matchDate: string) => Promise<MatchResult | null>;
}

// ============================================================================
// PROVIDER 1: API-FOOTBALL (RapidAPI) - En hızlı kaynak
// ============================================================================

export class APIFootballProvider implements MatchResultProvider {
  name = 'API-Football';
  priority = 3; // Yedek - rate limit sorunları var
  
  private apiKey = process.env.RAPIDAPI_KEY;
  private baseUrl = 'https://api-football-v1.p.rapidapi.com/v3';

  async fetchResult(fixtureId: number, homeTeam: string, awayTeam: string, matchDate: string): Promise<MatchResult | null> {
    if (!this.apiKey) {
      console.log(`[${this.name}] API key not configured`);
      return null;
    }

    try {
      // API-Football farklı fixture ID kullanıyor, takım adına göre arayalım
      const date = matchDate.split('T')[0];
      const url = `${this.baseUrl}/fixtures?date=${date}&status=FT-AET-PEN`;
      
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
      });

      if (!response.ok) {
        console.log(`[${this.name}] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const fixtures = data.response || [];

      // Takım adlarını normalize et (Türkçe karakterler, kısaltmalar vs)
      const normalizeTeamName = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/[şŞ]/g, 's')
          .replace(/[çÇ]/g, 'c')
          .replace(/[ğĞ]/g, 'g')
          .replace(/[üÜ]/g, 'u')
          .replace(/[öÖ]/g, 'o')
          .replace(/[ıİ]/g, 'i')
          .replace(/\s*(sk|fk|fc|sc|jk|as|ac|cf|cd|ud|sd|afc|bk|if|ff|bsc|vfb|tsv|sv|ssv|fsv)\s*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const searchHome = normalizeTeamName(homeTeam);
      const searchAway = normalizeTeamName(awayTeam);

      // Takım adlarına göre maçı bul
      const match = fixtures.find((f: any) => {
        const home = normalizeTeamName(f.teams?.home?.name || '');
        const away = normalizeTeamName(f.teams?.away?.name || '');
        
        const homeMatch = home.includes(searchHome) || searchHome.includes(home) || 
                          home.split(' ')[0] === searchHome.split(' ')[0];
        const awayMatch = away.includes(searchAway) || searchAway.includes(away) ||
                          away.split(' ')[0] === searchAway.split(' ')[0];
        
        return homeMatch && awayMatch;
      });

      if (!match) {
        console.log(`[${this.name}] Match not found for ${homeTeam} vs ${awayTeam}`);
        return null;
      }

      return {
        fixtureId,
        homeScore: match.goals?.home ?? 0,
        awayScore: match.goals?.away ?? 0,
        htHomeScore: match.score?.halftime?.home,
        htAwayScore: match.score?.halftime?.away,
        status: this.mapStatus(match.fixture?.status?.short),
        source: this.name,
      };
    } catch (error: any) {
      console.error(`[${this.name}] Error:`, error.message);
      return null;
    }
  }

  private mapStatus(status: string): MatchResult['status'] {
    const statusMap: { [key: string]: MatchResult['status'] } = {
      'FT': 'FT',
      'AET': 'AET',
      'PEN': 'PEN',
      '1H': 'LIVE',
      '2H': 'LIVE',
      'HT': 'LIVE',
      'ET': 'LIVE',
      'NS': 'NS',
      'CANC': 'CANC',
      'PST': 'PST',
    };
    return statusMap[status] || 'NS';
  }
}

// ============================================================================
// PROVIDER 2: FOOTBALL-DATA.ORG - Ücretsiz ve hızlı
// ============================================================================

export class FootballDataProvider implements MatchResultProvider {
  name = 'Football-Data.org';
  priority = 1; // En yüksek öncelik - ücretsiz ve güvenilir
  
  private apiKey = process.env.FOOTBALL_DATA_API_KEY;
  private baseUrl = 'https://api.football-data.org/v4';

  async fetchResult(fixtureId: number, homeTeam: string, awayTeam: string, matchDate: string): Promise<MatchResult | null> {
    if (!this.apiKey) {
      console.log(`[${this.name}] API key not configured - Key exists: ${!!process.env.FOOTBALL_DATA_API_KEY}`);
      return null;
    }

    try {
      const date = matchDate.split('T')[0];
      const url = `${this.baseUrl}/matches?dateFrom=${date}&dateTo=${date}&status=FINISHED`;
      
      console.log(`[${this.name}] Fetching: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'X-Auth-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[${this.name}] API error: ${response.status} - ${errorText.substring(0, 200)}`);
        return null;
      }

      const data = await response.json();
      const matches = data.matches || [];
      
      console.log(`[${this.name}] Found ${matches.length} finished matches on ${date}`);

      // Normalize team names for better matching
      const normalizeForMatch = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/[áàäâã]/g, 'a')
          .replace(/[éèëê]/g, 'e')
          .replace(/[íìïî]/g, 'i')
          .replace(/[óòöôõ]/g, 'o')
          .replace(/[úùüû]/g, 'u')
          .replace(/[ñ]/g, 'n')
          .replace(/[şŞ]/g, 's')
          .replace(/[çÇ]/g, 'c')
          .replace(/[ğĞ]/g, 'g')
          .replace(/\s*(fc|sc|cf|cd|ud|sd|afc|bk|if|ff|fk|sk|jk|as|ac)\s*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const searchHome = normalizeForMatch(homeTeam);
      const searchAway = normalizeForMatch(awayTeam);

      // Takım adlarına göre maçı bul
      const match = matches.find((m: any) => {
        const home = normalizeForMatch(m.homeTeam?.name || m.homeTeam?.shortName || '');
        const away = normalizeForMatch(m.awayTeam?.name || m.awayTeam?.shortName || '');
        
        const homeMatch = home.includes(searchHome) || searchHome.includes(home) ||
                          home.split(' ')[0] === searchHome.split(' ')[0];
        const awayMatch = away.includes(searchAway) || searchAway.includes(away) ||
                          away.split(' ')[0] === searchAway.split(' ')[0];
        
        if (homeMatch && awayMatch) {
          console.log(`[${this.name}] Match found: ${m.homeTeam?.name} vs ${m.awayTeam?.name}`);
        }
        
        return homeMatch && awayMatch;
      });

      if (!match) {
        console.log(`[${this.name}] Match not found for ${homeTeam} vs ${awayTeam}`);
        // Log available matches for debugging
        if (matches.length > 0 && matches.length < 20) {
          console.log(`[${this.name}] Available matches:`, matches.map((m: any) => `${m.homeTeam?.name} vs ${m.awayTeam?.name}`).join(', '));
        }
        return null;
      }

      console.log(`[${this.name}] Score: ${match.score?.fullTime?.home}-${match.score?.fullTime?.away}`);

      return {
        fixtureId,
        homeScore: match.score?.fullTime?.home ?? 0,
        awayScore: match.score?.fullTime?.away ?? 0,
        htHomeScore: match.score?.halfTime?.home,
        htAwayScore: match.score?.halfTime?.away,
        status: match.status === 'FINISHED' ? 'FT' : 'NS',
        source: this.name,
      };
    } catch (error: any) {
      console.error(`[${this.name}] Error:`, error.message);
      return null;
    }
  }
}

// ============================================================================
// PROVIDER 3: LIVESCORE API - Anında sonuçlar
// ============================================================================

export class LiveScoreProvider implements MatchResultProvider {
  name = 'LiveScore API';
  priority = 3;
  
  private apiKey = process.env.LIVESCORE_API_KEY;
  private apiSecret = process.env.LIVESCORE_API_SECRET;
  private baseUrl = 'https://livescore-api.com/api-client';

  async fetchResult(fixtureId: number, homeTeam: string, awayTeam: string, matchDate: string): Promise<MatchResult | null> {
    if (!this.apiKey || !this.apiSecret) {
      console.log(`[${this.name}] API key not configured`);
      return null;
    }

    try {
      const date = matchDate.split('T')[0];
      const url = `${this.baseUrl}/scores/history.json?key=${this.apiKey}&secret=${this.apiSecret}&from=${date}&to=${date}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`[${this.name}] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const matches = data.data?.match || [];

      // Takım adlarına göre maçı bul
      const match = matches.find((m: any) => {
        const home = m.home_name?.toLowerCase() || '';
        const away = m.away_name?.toLowerCase() || '';
        return (
          (home.includes(homeTeam.toLowerCase()) || homeTeam.toLowerCase().includes(home)) &&
          (away.includes(awayTeam.toLowerCase()) || awayTeam.toLowerCase().includes(away))
        );
      });

      if (!match) {
        console.log(`[${this.name}] Match not found for ${homeTeam} vs ${awayTeam}`);
        return null;
      }

      return {
        fixtureId,
        homeScore: parseInt(match.score?.split(' - ')[0]) || 0,
        awayScore: parseInt(match.score?.split(' - ')[1]) || 0,
        htHomeScore: parseInt(match.ht_score?.split(' - ')[0]),
        htAwayScore: parseInt(match.ht_score?.split(' - ')[1]),
        status: 'FT',
        source: this.name,
      };
    } catch (error: any) {
      console.error(`[${this.name}] Error:`, error.message);
      return null;
    }
  }
}

// ============================================================================
// PROVIDER 4: SPORTMONKS - Mevcut provider (yedek)
// ============================================================================

export class SportMonksProvider implements MatchResultProvider {
  name = 'SportMonks';
  priority = 2; // Yüksek öncelik - en güvenilir kaynak
  
  private apiKey = process.env.SPORTMONKS_API_KEY;
  private baseUrl = 'https://api.sportmonks.com/v3/football';

  async fetchResult(fixtureId: number, homeTeam: string, awayTeam: string, matchDate: string): Promise<MatchResult | null> {
    if (!this.apiKey) {
      console.log(`[${this.name}] API key not configured`);
      return null;
    }

    try {
      // FIXED: state include eklendi!
      const url = `${this.baseUrl}/fixtures/${fixtureId}?api_token=${this.apiKey}&include=state;scores;statistics`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.log(`[${this.name}] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const fixture = data.data;

      if (!fixture) {
        console.log(`[${this.name}] No fixture data returned`);
        return null;
      }

      // Check if match is finished - multiple ways to check
      const stateInfo = fixture.state;
      const stateName = stateInfo?.state || stateInfo?.developer_name || fixture.state_id;
      
      console.log(`[${this.name}] Fixture ${fixtureId} state:`, JSON.stringify(stateInfo));
      
      // State IDs: 5 = FT, 11 = AET, 12 = PEN (check SportMonks docs)
      const finishedStates = ['FT', 'AET', 'PEN', 'FINISHED', 'ended'];
      const finishedStateIds = [5, 11, 12]; // Common finished state IDs
      
      const isFinished = 
        finishedStates.includes(stateName) || 
        finishedStateIds.includes(fixture.state_id) ||
        stateInfo?.short_name === 'FT';
      
      if (!isFinished) {
        console.log(`[${this.name}] Match not finished yet. State: ${stateName}, State ID: ${fixture.state_id}`);
        return null;
      }

      // Get scores - try multiple formats
      const scores = fixture.scores || [];
      let homeScore = 0;
      let awayScore = 0;
      let htHomeScore: number | undefined;
      let htAwayScore: number | undefined;

      console.log(`[${this.name}] Scores data:`, JSON.stringify(scores));

      // Method 1: Look for CURRENT scores
      for (const score of scores) {
        if (score.description === 'CURRENT' || score.description === 'FULLTIME') {
          if (score.score?.participant === 'home') homeScore = score.score?.goals || 0;
          if (score.score?.participant === 'away') awayScore = score.score?.goals || 0;
          // Alternative format
          if (score.participant === 'home') homeScore = score.goals || score.score?.goals || 0;
          if (score.participant === 'away') awayScore = score.goals || score.score?.goals || 0;
        }
        if (score.description === '1ST_HALF' || score.description === 'HT') {
          if (score.score?.participant === 'home') htHomeScore = score.score?.goals;
          if (score.score?.participant === 'away') htAwayScore = score.score?.goals;
          if (score.participant === 'home') htHomeScore = score.goals || score.score?.goals;
          if (score.participant === 'away') htAwayScore = score.goals || score.score?.goals;
        }
      }

      // Method 2: Direct participant lookup
      if (homeScore === 0 && awayScore === 0) {
        for (const score of scores) {
          if ((score.participant === 'home' || score.type_id === 1525) && 
              (score.description === 'CURRENT' || score.description === '2ND_HALF' || !score.description)) {
            homeScore = score.goals || 0;
          }
          if ((score.participant === 'away' || score.type_id === 1526) && 
              (score.description === 'CURRENT' || score.description === '2ND_HALF' || !score.description)) {
            awayScore = score.goals || 0;
          }
        }
      }

      // Method 3: Check for aggregate/final scores
      if (homeScore === 0 && awayScore === 0) {
        const homeScoreObj = scores.find((s: any) => s.participant === 'home' && s.description?.includes('CURRENT'));
        const awayScoreObj = scores.find((s: any) => s.participant === 'away' && s.description?.includes('CURRENT'));
        if (homeScoreObj) homeScore = homeScoreObj.goals || 0;
        if (awayScoreObj) awayScore = awayScoreObj.goals || 0;
      }

      console.log(`[${this.name}] Extracted scores: ${homeScore}-${awayScore}`);

      // Get statistics
      let corners: number | undefined;
      let yellowCards: number | undefined;
      let redCards: number | undefined;

      const statistics = fixture.statistics || [];
      for (const stat of statistics) {
        if (stat.type?.code === 'corners') corners = (corners || 0) + (stat.data?.value || 0);
        if (stat.type?.code === 'yellowcards') yellowCards = (yellowCards || 0) + (stat.data?.value || 0);
        if (stat.type?.code === 'redcards') redCards = (redCards || 0) + (stat.data?.value || 0);
      }

      return {
        fixtureId,
        homeScore,
        awayScore,
        htHomeScore,
        htAwayScore,
        status: 'FT',
        corners,
        yellowCards,
        redCards,
        source: this.name,
      };
    } catch (error: any) {
      console.error(`[${this.name}] Error:`, error.message);
      return null;
    }
  }
}

// ============================================================================
// PROVIDER 5: THE ODDS API - Ücretsiz tier var
// ============================================================================

export class TheOddsAPIProvider implements MatchResultProvider {
  name = 'The Odds API';
  priority = 5;
  
  private apiKey = process.env.ODDS_API_KEY;
  private baseUrl = 'https://api.the-odds-api.com/v4';

  async fetchResult(fixtureId: number, homeTeam: string, awayTeam: string, matchDate: string): Promise<MatchResult | null> {
    if (!this.apiKey) {
      console.log(`[${this.name}] API key not configured`);
      return null;
    }

    try {
      const url = `${this.baseUrl}/sports/soccer/scores?apiKey=${this.apiKey}&daysFrom=1`;
      
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`[${this.name}] API error: ${response.status}`);
        return null;
      }

      const matches = await response.json();

      // Takım adlarına göre maçı bul
      const match = matches.find((m: any) => {
        const home = m.home_team?.toLowerCase() || '';
        const away = m.away_team?.toLowerCase() || '';
        return (
          (home.includes(homeTeam.toLowerCase()) || homeTeam.toLowerCase().includes(home)) &&
          (away.includes(awayTeam.toLowerCase()) || awayTeam.toLowerCase().includes(away))
        ) && m.completed;
      });

      if (!match || !match.scores) {
        console.log(`[${this.name}] Match not found for ${homeTeam} vs ${awayTeam}`);
        return null;
      }

      const homeScoreData = match.scores.find((s: any) => s.name === match.home_team);
      const awayScoreData = match.scores.find((s: any) => s.name === match.away_team);

      return {
        fixtureId,
        homeScore: parseInt(homeScoreData?.score) || 0,
        awayScore: parseInt(awayScoreData?.score) || 0,
        status: 'FT',
        source: this.name,
      };
    } catch (error: any) {
      console.error(`[${this.name}] Error:`, error.message);
      return null;
    }
  }
}

// ============================================================================
// MULTI-PROVIDER MANAGER
// ============================================================================

export class MatchResultManager {
  private providers: MatchResultProvider[];

  constructor() {
    // Provider'ları öncelik sırasına göre ekle
    this.providers = [
      new APIFootballProvider(),
      new FootballDataProvider(),
      new LiveScoreProvider(),
      new SportMonksProvider(),
      new TheOddsAPIProvider(),
    ].sort((a, b) => a.priority - b.priority);
  }

  async fetchResult(
    fixtureId: number, 
    homeTeam: string, 
    awayTeam: string, 
    matchDate: string
  ): Promise<MatchResult | null> {
    console.log(`\n🔍 Fetching result for: ${homeTeam} vs ${awayTeam}`);

    for (const provider of this.providers) {
      console.log(`   Trying ${provider.name}...`);
      
      try {
        const result = await provider.fetchResult(fixtureId, homeTeam, awayTeam, matchDate);
        
        if (result && result.status === 'FT') {
          console.log(`   ✅ Found via ${provider.name}: ${result.homeScore}-${result.awayScore}`);
          return result;
        }
      } catch (error) {
        console.log(`   ❌ ${provider.name} failed`);
        continue;
      }
    }

    console.log(`   ⏳ No result found from any provider`);
    return null;
  }

  getAvailableProviders(): string[] {
    return this.providers
      .filter(p => {
        // Her provider'ın API key'ini kontrol et
        if (p.name === 'API-Football') return !!process.env.RAPIDAPI_KEY;
        if (p.name === 'Football-Data.org') return !!process.env.FOOTBALL_DATA_API_KEY;
        if (p.name === 'LiveScore API') return !!process.env.LIVESCORE_API_KEY;
        if (p.name === 'SportMonks') return !!process.env.SPORTMONKS_API_KEY;
        if (p.name === 'The Odds API') return !!process.env.ODDS_API_KEY;
        return false;
      })
      .map(p => p.name);
  }
}

// Singleton instance
export const matchResultManager = new MatchResultManager();

