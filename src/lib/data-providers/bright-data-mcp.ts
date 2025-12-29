// ============================================================================
// BRIGHT DATA MCP PROVIDER
// MCP agent kullanarak Bright Data'dan veri çeker
// ============================================================================

import { DataProvider, FixtureData, TeamStats, MatchData, Injury, H2HData, OddsData, RefereeData, LineupData, XGData } from './types';

export class BrightDataMCPProvider implements DataProvider {
  name = 'Bright Data (Web Unlocker)';
  priority = 1; // Yüksek öncelik - Sportmonks'tan önce dene
  
  private apiKey: string;
  private mcpServerUrl: string;
  
  constructor() {
    // API key ve MCP server URL'ini environment'tan al
    this.apiKey = process.env.BRIGHT_DATA_API_KEY || '';
    
    // MCP server URL'i token ile birlikte
    if (this.apiKey) {
      this.mcpServerUrl = `https://mcp.brightdata.com/mcp?token=${this.apiKey}`;
    } else {
      this.mcpServerUrl = process.env.BRIGHT_DATA_MCP_SERVER_URL || '';
    }
    
    if (!this.apiKey && !this.mcpServerUrl) {
      console.warn('⚠️ BRIGHT_DATA_API_KEY or BRIGHT_DATA_MCP_SERVER_URL not set');
    } else {
      console.log('✅ Bright Data MCP Provider initialized');
      console.log(`   MCP Server: ${this.mcpServerUrl?.substring(0, 50)}...`);
    }
  }
  
  /**
   * MCP agent üzerinden Bright Data API'sini çağır
   * Bright Data MCP server'ına HTTP isteği gönderir
   * Timeout: 8 saniye (hızlı fallback için)
   */
  private async callMCPAgent(action: string, params: Record<string, any>): Promise<any> {
    if (!this.apiKey) {
      return null;
    }
    
    try {
      // Timeout controller - 8 saniye sonra iptal et
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Bright Data MCP server'a istek gönder
      // MCP protokolüne göre istek formatı
      const response = await fetch(this.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: action,
          params: {
            ...params,
            token: this.apiKey
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`❌ Bright Data MCP error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`   Error details: ${errorText.substring(0, 200)}`);
        return null;
      }
      
      const result = await response.json();
      
      // MCP JSON-RPC response formatı
      if (result.error) {
        console.error(`❌ Bright Data MCP error:`, result.error);
        // Session ID hatası varsa, direkt Bright Data API'yi dene
        if (result.error.message?.includes('session') || result.error.code === -32000) {
          console.log(`⚠️ MCP session error, will try direct Bright Data API`);
        }
        return null;
      }
      
      return result.result || result.data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('❌ Bright Data MCP timeout (8s) - falling back to Sportmonks');
      } else {
        console.error('❌ Bright Data MCP call error:', error.message);
      }
      return null;
    }
  }
  
  /**
   * Bright Data Web Unlocker API kullanarak web scraping yap
   * FlashScore, SofaScore gibi sitelerden veri çeker
   * Dashboard'da görünen zone: web_unlocker1
   * Timeout: 10 saniye
   */
  private async scrapeWithBrightData(
    url: string, 
    zone: string = 'web_unlocker1', 
    format: 'raw' | 'json' | 'html' = 'raw'
  ): Promise<any> {
    if (!this.apiKey) {
      return null;
    }
    
    try {
      // Timeout controller - 10 saniye sonra iptal et
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone, // web_unlocker1 (dashboard'da görünen)
          url,
          format, // raw, json, veya html
          method: 'GET',
          country: 'us'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Bright Data API error ${response.status}:`, errorText.substring(0, 200));
        return null;
      }
      
      // Format'a göre response'u parse et
      if (format === 'raw' || format === 'html') {
        const text = await response.text();
        return { html: text, url };
      } else {
        return await response.json();
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('❌ Bright Data scraping timeout (10s)');
      } else {
        console.error('❌ Bright Data scraping error:', error.message?.substring(0, 100));
      }
      return null;
    }
  }
  
  async getFixture(fixtureId: number): Promise<FixtureData | null> {
    try {
      console.log(`🔍 Bright Data: Fetching fixture ${fixtureId} from FlashScore/SofaScore...`);
      
      // ⚠️ MCP session hatası var, şimdilik direkt Bright Data API'yi kullanmayı atlayalım
      // Çünkü HTML parsing gerekiyor ve bu zaman alıyor
      // Şimdilik Sportmonks fallback'e güveniyoruz
      
      // MCP agent üzerinden dene (FlashScore ve SofaScore öncelikli)
      // Timeout: 8 saniye (hızlı fallback için)
      const mcpResult = await this.callMCPAgent('get_fixture', {
        fixtureId,
        sources: ['flashscore', 'sofa_score'],
        priority: 'flashscore'
      });
      
      if (mcpResult?.data) {
        const data = mcpResult.data;
        console.log(`✅ Bright Data MCP: Fixture data received from ${data.source || 'MCP'}`);
        return {
          fixtureId: data.id || fixtureId,
          homeTeam: { id: data.homeTeam?.id || 0, name: data.homeTeam?.name || '' },
          awayTeam: { id: data.awayTeam?.id || 0, name: data.awayTeam?.name || '' },
          league: { id: data.league?.id || 0, name: data.league?.name || '' },
          date: data.date || new Date().toISOString(),
          status: data.status || 'scheduled',
          score: data.score,
          venue: data.venue
        };
      }
      
      // MCP başarısız - direkt Bright Data Web Unlocker API'yi kullan
      console.log(`⚠️ MCP failed, trying direct Bright Data Web Unlocker API...`);
      
      // FlashScore'dan dene
      const flashScoreUrl = `https://www.flashscore.com/match/${fixtureId}/`;
      const flashScoreData = await this.scrapeWithBrightData(flashScoreUrl, 'web_unlocker1', 'raw');
      
      if (flashScoreData?.html) {
        console.log(`✅ Bright Data: Scraped HTML from FlashScore (${flashScoreData.html.length} bytes)`);
        // TODO: HTML parsing implementasyonu gerekli
        // Şimdilik basit bir response döndür
        // Gerçek implementasyon için Cheerio veya benzeri HTML parser gerekli
        return {
          fixtureId,
          homeTeam: { id: 0, name: 'FlashScore - Parse Required' },
          awayTeam: { id: 0, name: 'FlashScore - Parse Required' },
          league: { id: 0, name: 'FlashScore - Parse Required' },
          date: new Date().toISOString(),
          status: 'scheduled',
          score: undefined,
          venue: undefined
        };
      }
      
      // SofaScore'dan dene
      const sofaScoreUrl = `https://www.sofascore.com/match/${fixtureId}`;
      const sofaScoreData = await this.scrapeWithBrightData(sofaScoreUrl, 'web_unlocker1', 'raw');
      
      if (sofaScoreData?.html) {
        console.log(`✅ Bright Data: Scraped HTML from SofaScore (${sofaScoreData.html.length} bytes)`);
        // TODO: HTML parsing implementasyonu gerekli
        return {
          fixtureId,
          homeTeam: { id: 0, name: 'SofaScore - Parse Required' },
          awayTeam: { id: 0, name: 'SofaScore - Parse Required' },
          league: { id: 0, name: 'SofaScore - Parse Required' },
          date: new Date().toISOString(),
          status: 'scheduled',
          score: undefined,
          venue: undefined
        };
      }
      
      console.log(`⚠️ Bright Data: Failed to scrape from FlashScore and SofaScore - will use Sportmonks fallback`);
      return null;
    } catch (error: any) {
      console.error('❌ getFixture error:', error.message?.substring(0, 100));
      return null;
    }
  }
  
  async getFixturesByDate(date: string, leagueId?: number): Promise<FixtureData[]> {
    const result = await this.callMCPAgent('get_fixtures_by_date', {
      date,
      leagueId,
      sources: ['flashscore', 'sofa_score']
    });
    
    if (!result?.data) return [];
    
    return result.data.map((f: any) => ({
      fixtureId: f.id,
      homeTeam: { id: f.homeTeam.id, name: f.homeTeam.name },
      awayTeam: { id: f.awayTeam.id, name: f.awayTeam.name },
      league: { id: f.league.id, name: f.league.name },
      date: f.date,
      status: f.status,
      score: f.score,
      venue: f.venue
    }));
  }
  
  async getTeamStats(teamId: number, seasonId?: number): Promise<TeamStats | null> {
    try {
      console.log(`🔍 Bright Data: Fetching team stats ${teamId} from FlashScore/SofaScore...`);
      
      // FlashScore ve SofaScore'dan takım istatistiklerini çek
      // Timeout: 8 saniye
      const result = await this.callMCPAgent('get_team_stats', {
        teamId,
        seasonId,
        sources: ['flashscore', 'sofa_score', 'transfermarkt'],
        priority: 'flashscore'
      });
      
      if (!result?.data) {
        console.log(`⚠️ Bright Data MCP: No team stats from MCP - will use Sportmonks fallback`);
        return null;
      }
      
      const stats = result.data;
      console.log(`✅ Bright Data MCP: Team stats received from ${stats.source || 'MCP'}`);
      
      return {
        teamId: stats.id || teamId,
        teamName: stats.name || '',
        recentForm: stats.form || 'DDDDD',
        formPoints: stats.points || 0,
        goalsScored: stats.goalsScored || 0,
        goalsConceded: stats.goalsConceded || 0,
        avgGoalsScored: stats.avgGoalsScored || 1.2,
        avgGoalsConceded: stats.avgGoalsConceded || 1.2,
        homeWins: stats.homeWins || 0,
        homeDraws: stats.homeDraws || 0,
        homeLosses: stats.homeLosses || 0,
        awayWins: stats.awayWins || 0,
        awayDraws: stats.awayDraws || 0,
        awayLosses: stats.awayLosses || 0,
        bttsPercentage: stats.bttsPercentage || 50,
        over25Percentage: stats.over25Percentage || 50,
        under25Percentage: stats.under25Percentage || 50,
        cleanSheets: stats.cleanSheets || 0,
        failedToScore: stats.failedToScore || 0
      };
    } catch (error: any) {
      console.error('❌ getTeamStats error:', error.message?.substring(0, 100));
      return null;
    }
  }
  
  async getTeamRecentMatches(teamId: number, limit: number = 10): Promise<MatchData[]> {
    const result = await this.callMCPAgent('get_team_matches', {
      teamId,
      limit,
      sources: ['flashscore', 'transfermarkt']
    });
    
    if (!result?.data) return [];
    
    return result.data.map((m: any) => ({
      date: m.date,
      opponent: m.opponent,
      isHome: m.isHome,
      teamScore: m.teamScore,
      opponentScore: m.opponentScore,
      result: m.result,
      totalGoals: m.teamScore + m.opponentScore,
      btts: m.teamScore > 0 && m.opponentScore > 0
    }));
  }
  
  async getTeamInjuries(teamId: number): Promise<Injury[]> {
    const result = await this.callMCPAgent('get_team_injuries', {
      teamId,
      sources: ['transfermarkt', 'premierinjuries']
    });
    
    if (!result?.data) return [];
    
    return result.data.map((i: any) => ({
      playerName: i.playerName,
      reason: i.reason,
      expectedReturn: i.expectedReturn
    }));
  }
  
  async getHeadToHead(homeTeamId: number, awayTeamId: number): Promise<H2HData | null> {
    try {
      console.log(`🔍 Bright Data: Fetching H2H ${homeTeamId} vs ${awayTeamId} from FlashScore...`);
      
      // FlashScore'dan H2H verilerini çek
      // Timeout: 8 saniye
      const result = await this.callMCPAgent('get_h2h', {
        homeTeamId,
        awayTeamId,
        sources: ['flashscore', 'sofa_score'],
        priority: 'flashscore'
      });
      
      if (!result?.data) {
        console.log(`⚠️ Bright Data MCP: No H2H data from MCP - will use Sportmonks fallback`);
        return null;
      }
      
      const h2h = result.data;
      console.log(`✅ Bright Data MCP: H2H data received from ${h2h.source || 'MCP'}`);
      
      return {
        totalMatches: h2h.totalMatches || 0,
        homeWins: h2h.homeWins || 0,
        awayWins: h2h.awayWins || 0,
        draws: h2h.draws || 0,
        avgGoals: h2h.avgGoals || 0,
        over25Percentage: h2h.over25Percentage || 50,
        bttsPercentage: h2h.bttsPercentage || 50,
        recentMatches: h2h.recentMatches || []
      };
    } catch (error: any) {
      console.error('❌ getHeadToHead error:', error.message?.substring(0, 100));
      return null;
    }
  }
  
  async getPreMatchOdds(fixtureId: number): Promise<OddsData | null> {
    try {
      console.log(`🔍 Bright Data: Fetching odds ${fixtureId} from SofaScore...`);
      
      // SofaScore'dan odds verilerini çek (FlashScore'da odds yok)
      // Timeout: 8 saniye
      const result = await this.callMCPAgent('get_odds', {
        fixtureId,
        sources: ['sofa_score', 'bet365', 'betfair'],
        priority: 'sofa_score'
      });
      
      if (!result?.data) {
        console.log(`⚠️ Bright Data MCP: No odds data from MCP - will use Sportmonks fallback`);
        return null;
      }
      
      const odds = result.data;
      console.log(`✅ Bright Data MCP: Odds data received from ${odds.source || 'MCP'}`);
      
      return {
        matchWinner: {
          home: odds.matchWinner?.home || 2.0,
          draw: odds.matchWinner?.draw || 3.0,
          away: odds.matchWinner?.away || 2.5
        },
        overUnder25: {
          over: odds.overUnder25?.over || 1.9,
          under: odds.overUnder25?.under || 1.9
        },
        btts: {
          yes: odds.btts?.yes || 1.8,
          no: odds.btts?.no || 2.0
        }
      };
    } catch (error: any) {
      console.error('❌ getPreMatchOdds error:', error.message?.substring(0, 100));
      return null;
    }
  }
  
  async getReferee(fixtureId: number): Promise<RefereeData | null> {
    const result = await this.callMCPAgent('get_referee', {
      fixtureId,
      sources: ['transfermarkt', 'worldfootball']
    });
    
    if (!result?.data) return null;
    
    const ref = result.data;
    return {
      name: ref.name || 'Unknown',
      avgYellowCards: ref.avgYellowCards || 4.2,
      avgRedCards: ref.avgRedCards || 0.2,
      avgPenalties: ref.avgPenalties || 0.3,
      homeBias: ref.homeBias || 'neutral'
    };
  }
  
  async getLineup(fixtureId: number): Promise<LineupData | null> {
    const result = await this.callMCPAgent('get_lineup', {
      fixtureId,
      sources: ['flashscore', 'sofa_score']
    });
    
    if (!result?.data) return null;
    
    const lineup = result.data;
    return {
      home: {
        formation: lineup.home?.formation || '4-3-3',
        players: lineup.home?.players || []
      },
      away: {
        formation: lineup.away?.formation || '4-4-2',
        players: lineup.away?.players || []
      }
    };
  }
  
  async getTeamXG(teamId: number): Promise<XGData | null> {
    const result = await this.callMCPAgent('get_xg', {
      teamId,
      sources: ['fbref', 'understat']
    });
    
    if (!result?.data) return null;
    
    const xg = result.data;
    return {
      avgXGFor: xg.avgXGFor || 1.2,
      avgXGAgainst: xg.avgXGAgainst || 1.2,
      matchHistory: xg.matchHistory || []
    };
  }
}

