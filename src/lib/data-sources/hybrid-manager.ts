// ============================================================================
// HYBRID DATA MANAGER - TypeScript Implementation
// SoccerData + Sportmonks API birlikte çalıştırma
// ============================================================================

import { MatchData } from '../heurist/types';

export interface HybridDataConfig {
  sportmonksToken?: string;
  preferSoccerData?: boolean; // Tarihsel veri için SoccerData öncelikli
  preferSportmonks?: boolean; // Canlı veri için Sportmonks öncelikli
}

export interface HybridFixture {
  fixtureId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  venue?: string;
  source: 'soccerdata' | 'sportmonks' | 'hybrid';
}

export interface HybridTeamStats {
  teamName: string;
  goals: number;
  goalsAgainst: number;
  xg?: number;
  xga?: number;
  wins: number;
  draws: number;
  losses: number;
  source: 'soccerdata' | 'sportmonks';
}

export interface HybridXGData {
  fixtureId: number;
  homeXG: number;
  awayXG: number;
  homeScore?: number;
  awayScore?: number;
  source: 'soccerdata' | 'sportmonks';
}

export interface HybridEloRating {
  teamName: string;
  elo: number;
  date: string;
  source: 'soccerdata';
}

/**
 * Hibrit Veri Yöneticisi
 * 
 * Strateji:
 * - Canlı veri → Sportmonks (zorunlu)
 * - Tarihsel veri → Sportmonks (mevcut sistem) + SoccerData (gelecekte)
 * - xG → Sportmonks (mevcut) + SoccerData (gelecekte)
 * - Şut koordinatları → SoccerData (gelecekte, Python script ile)
 * - Elo ratings → SoccerData (gelecekte, Python script ile)
 */
export class HybridDataManager {
  private sportmonksToken: string;
  private preferSoccerData: boolean;
  private preferSportmonks: boolean;

  constructor(config: HybridDataConfig = {}) {
    this.sportmonksToken = config.sportmonksToken || process.env.SPORTMONKS_API_KEY || '';
    this.preferSoccerData = config.preferSoccerData ?? true;
    this.preferSportmonks = config.preferSportmonks ?? false;
  }

  /**
   * Maç verileri al (hibrit)
   * Önce SoccerData'yı dener, başarısız olursa Sportmonks'a fallback yapar
   */
  async getFixtures(
    league: string,
    season: string,
    date?: string
  ): Promise<HybridFixture[]> {
    // Önce Python servisinden SoccerData'yı dene
    if (this.preferSoccerData) {
      try {
        const pythonServiceUrl = process.env.PYTHON_DATA_SERVICE_URL || 'http://localhost:5000';
        const response = await fetch(
          `${pythonServiceUrl}/api/fixtures/${league}/${season}?prefer=soccerdata`,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000) // 10 saniye timeout
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.length > 0) {
            console.log(`✅ SoccerData: ${data.count} fixtures found for ${league}`);
            return data.data.map((f: any) => ({
              fixtureId: f.fixtureId || 0,
              date: f.date,
              homeTeam: f.homeTeam,
              awayTeam: f.awayTeam,
              homeScore: f.homeScore,
              awayScore: f.awayScore,
              venue: f.venue,
              source: 'soccerdata' as const
            }));
          }
        }
      } catch (error: any) {
        // Python servisi çalışmıyor veya erişilemiyor
        console.log(`⚠️ SoccerData service not available: ${error.message}, falling back to Sportmonks`);
      }
    }

    // Fallback: Sportmonks
    return this.getFixturesFromSportmonks(league, date);
  }

  /**
   * Sportmonks'tan maç verileri al
   */
  private async getFixturesFromSportmonks(
    league: string,
    date?: string
  ): Promise<HybridFixture[]> {
    if (!this.sportmonksToken) {
      console.warn('⚠️ Sportmonks token yok, fixtures alınamıyor');
      return [];
    }

    try {
      const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
      let url = `${SPORTMONKS_API}/fixtures`;
      
      const params = new URLSearchParams({
        api_token: this.sportmonksToken,
        include: 'participants;scores;venue;league',
        per_page: '100'
      });

      // Lig ID'si ekle (eğer biliniyorsa)
      const leagueId = this.getLeagueId(league);
      if (leagueId) {
        params.append('filters', `fixtureLeagues:${leagueId}`);
      }

      // Tarih filtresi
      if (date) {
        url = `${SPORTMONKS_API}/fixtures/date/${date}`;
      }

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 } // 5 dakika cache
      });

      if (!response.ok) {
        console.error(`❌ Sportmonks API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const fixtures: HybridFixture[] = [];

      for (const match of data.data || []) {
        const participants = match.participants || [];
        fixtures.push({
          fixtureId: match.id,
          date: match.starting_at,
          homeTeam: participants[0]?.name || '',
          awayTeam: participants[1]?.name || '',
          homeScore: match.scores?.localteam_score,
          awayScore: match.scores?.visitorteam_score,
          venue: match.venue?.name,
          source: 'sportmonks'
        });
      }

      return fixtures;
    } catch (error: any) {
      console.error('❌ Sportmonks fixtures hatası:', error.message);
      return [];
    }
  }

  /**
   * Canlı skorlar - SADECE Sportmonks
   */
  async getLiveScores(): Promise<HybridFixture[]> {
    if (!this.sportmonksToken) {
      console.warn('⚠️ Canlı skorlar için Sportmonks token gerekli!');
      return [];
    }

    try {
      const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
      const response = await fetch(
        `${SPORTMONKS_API}/livescores/inplay?api_token=${this.sportmonksToken}&include=participants;scores;events`,
        {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 30 } // 30 saniye cache (canlı veri)
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const matches: HybridFixture[] = [];

      for (const match of data.data || []) {
        const participants = match.participants || [];
        matches.push({
          fixtureId: match.id,
          date: match.starting_at,
          homeTeam: participants[0]?.name || '',
          awayTeam: participants[1]?.name || '',
          homeScore: match.scores?.localteam_score || 0,
          awayScore: match.scores?.visitorteam_score || 0,
          source: 'sportmonks'
        });
      }

      return matches;
    } catch (error: any) {
      console.error('❌ Live scores hatası:', error.message);
      return [];
    }
  }

  /**
   * Takım istatistikleri
   * Şu an sadece Sportmonks kullanıyoruz
   */
  async getTeamStats(
    league: string,
    season: string,
    teamName: string
  ): Promise<HybridTeamStats | null> {
    // Mevcut Sportmonks implementasyonunu kullan
    // Gelecekte SoccerData fallback eklenebilir
    return null; // Placeholder
  }

  /**
   * xG verileri
   * Şu an sadece Sportmonks kullanıyoruz
   */
  async getXGData(
    fixtureId: number
  ): Promise<HybridXGData | null> {
    if (!this.sportmonksToken) {
      return null;
    }

    try {
      const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
      const response = await fetch(
        `${SPORTMONKS_API}/fixtures/${fixtureId}?api_token=${this.sportmonksToken}&include=xGFixture`,
        {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 300 }
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const fixture = data.data;

      if (fixture?.expected) {
        return {
          fixtureId,
          homeXG: fixture.expected.localteam_xg || 0,
          awayXG: fixture.expected.visitorteam_xg || 0,
          homeScore: fixture.scores?.localteam_score,
          awayScore: fixture.scores?.visitorteam_score,
          source: 'sportmonks'
        };
      }

      return null;
    } catch (error: any) {
      console.error('❌ xG data hatası:', error.message);
      return null;
    }
  }

  /**
   * Elo ratings - SADECE SoccerData (Python script ile)
   */
  async getEloRatings(): Promise<HybridEloRating[]> {
    try {
      const pythonServiceUrl = process.env.PYTHON_DATA_SERVICE_URL || 'http://localhost:5000';
      const response = await fetch(
        `${pythonServiceUrl}/api/elo`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          console.log(`✅ SoccerData Elo ratings: ${data.count} teams`);
          return data.data.map((e: any) => ({
            teamName: e.team_name || e.teamName || '',
            elo: e.elo || 1500,
            date: e.date || new Date().toISOString(),
            source: 'soccerdata' as const
          }));
        }
      }
    } catch (error: any) {
      console.log(`⚠️ SoccerData Elo service not available: ${error.message}`);
    }

    return [];
  }

  /**
   * Şut koordinatları - SADECE SoccerData (Python script ile)
   */
  async getShotMapData(
    league: string,
    season: string,
    fixtureId?: number
  ): Promise<any[]> {
    try {
      const pythonServiceUrl = process.env.PYTHON_DATA_SERVICE_URL || 'http://localhost:5000';
      const response = await fetch(
        `${pythonServiceUrl}/api/shots/${league}/${season}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000) // 15 saniye (şut verisi büyük olabilir)
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          let shots = data.data;
          
          // Fixture ID varsa filtrele
          if (fixtureId) {
            shots = shots.filter((s: any) => 
              s.fixture_id === fixtureId || s.fixtureId === fixtureId
            );
          }

          console.log(`✅ SoccerData shot map: ${shots.length} shots for ${league}`);
          return shots;
        }
      }
    } catch (error: any) {
      console.log(`⚠️ SoccerData shot map service not available: ${error.message}`);
    }

    return [];
  }

  /**
   * Lig ID eşleştirme
   */
  private getLeagueId(league: string): number | null {
    const LEAGUE_IDS: Record<string, number> = {
      'premier-league': 8,
      'la-liga': 564,
      'bundesliga': 82,
      'serie-a': 384,
      'ligue-1': 301,
      'super-lig': 600,
      'eredivisie': 72,
      'champions-league': 2,
    };

    return LEAGUE_IDS[league.toLowerCase()] || null;
  }

  /**
   * Maç analizi (hibrit - tüm kaynaklardan)
   */
  async getMatchAnalysis(
    league: string,
    season: string,
    homeTeam: string,
    awayTeam: string,
    fixtureId?: number
  ): Promise<{
    homeTeam: string;
    awayTeam: string;
    league: string;
    season: string;
    dataSources: string[];
    fixtures?: HybridFixture[];
    xgData?: HybridXGData | null;
    eloRatings?: HybridEloRating[];
    liveData?: HybridFixture | null;
  }> {
    const analysis = {
      homeTeam,
      awayTeam,
      league,
      season,
      dataSources: [] as string[]
    };

    // 1. Maç verileri
    const fixtures = await this.getFixtures(league, season);
    if (fixtures.length > 0) {
      analysis.dataSources.push('sportmonks');
    }

    // 2. xG verileri (fixture ID varsa)
    if (fixtureId) {
      const xgData = await this.getXGData(fixtureId);
      if (xgData) {
        analysis.dataSources.push('sportmonks_xg');
      }
    }

    // 3. Canlı veriler
    const liveScores = await this.getLiveScores();
    const liveMatch = liveScores.find(
      m => m.homeTeam.toLowerCase().includes(homeTeam.toLowerCase()) &&
           m.awayTeam.toLowerCase().includes(awayTeam.toLowerCase())
    );
    if (liveMatch) {
      analysis.dataSources.push('sportmonks_live');
    }

    return {
      ...analysis,
      fixtures: fixtures.slice(0, 10), // Son 10 maç
      xgData: fixtureId ? await this.getXGData(fixtureId) : null,
      liveData: liveMatch || null
    };
  }
}

// Singleton instance
let hybridManagerInstance: HybridDataManager | null = null;

export function getHybridDataManager(config?: HybridDataConfig): HybridDataManager {
  if (!hybridManagerInstance) {
    hybridManagerInstance = new HybridDataManager(config);
  }
  return hybridManagerInstance;
}
