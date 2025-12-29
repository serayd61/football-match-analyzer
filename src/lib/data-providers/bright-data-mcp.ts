// ============================================================================
// BRIGHT DATA MCP PROVIDER
// MCP agent kullanarak Bright Data'dan veri çeker
// ============================================================================

import { DataProvider, FixtureData, TeamStats, MatchData, Injury, H2HData, OddsData, RefereeData, LineupData, XGData } from './types';

export class BrightDataMCPProvider implements DataProvider {
  name = 'Bright Data (MCP)';
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
   */
  private async callMCPAgent(action: string, params: Record<string, any>): Promise<any> {
    if (!this.apiKey) {
      return null;
    }
    
    try {
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
        })
      });
      
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
        return null;
      }
      
      return result.result || result.data;
    } catch (error: any) {
      console.error('❌ Bright Data MCP call error:', error.message);
      return null;
    }
  }
  
  /**
   * Bright Data Web Unlocker API kullanarak web scraping yap
   * FlashScore, SofaScore gibi sitelerden veri çeker
   */
  private async scrapeWithBrightData(url: string, zone: string = 'web_unlocker'): Promise<any> {
    try {
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone,
          url,
          format: 'json',
          method: 'GET',
          country: 'us'
        })
      });
      
      if (!response.ok) {
        console.error(`❌ Bright Data API error: ${response.status}`);
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Bright Data scraping error:', error);
      return null;
    }
  }
  
  async getFixture(fixtureId: number): Promise<FixtureData | null> {
    try {
      // Önce MCP agent üzerinden dene
      const mcpResult = await this.callMCPAgent('get_fixture', {
        fixtureId,
        sources: ['flashscore', 'sofa_score']
      });
      
      if (mcpResult?.data) {
        const data = mcpResult.data;
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
      
      // MCP başarısız olursa direkt Bright Data API'yi dene
      // FlashScore'dan maç verisi çek
      const flashScoreUrl = `https://www.flashscore.com/match/${fixtureId}/`;
      const scraped = await this.scrapeWithBrightData(flashScoreUrl);
      
      if (scraped) {
        // Scraped data'yı parse et ve döndür
        // Bu kısım FlashScore'un HTML yapısına göre implement edilecek
        return null; // TODO: Parse scraped HTML
      }
      
      return null;
    } catch (error) {
      console.error('❌ getFixture error:', error);
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
    // Bright Data ile takım istatistiklerini çek
    const result = await this.callMCPAgent('get_team_stats', {
      teamId,
      seasonId,
      sources: ['transfermarkt', 'fbref', 'whoscored']
    });
    
    if (!result?.data) return null;
    
    const stats = result.data;
    return {
      teamId: stats.id,
      teamName: stats.name,
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
    const result = await this.callMCPAgent('get_h2h', {
      homeTeamId,
      awayTeamId,
      sources: ['flashscore', 'transfermarkt']
    });
    
    if (!result?.data) return null;
    
    const h2h = result.data;
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
  }
  
  async getPreMatchOdds(fixtureId: number): Promise<OddsData | null> {
    const result = await this.callMCPAgent('get_odds', {
      fixtureId,
      sources: ['bet365', 'betfair', 'oddschecker']
    });
    
    if (!result?.data) return null;
    
    const odds = result.data;
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

