// ============================================================================
// CLAUDE DATA COLLECTOR AGENT
// Claude API + MCP kullanarak Sportmonks'tan en üst düzey verileri toplar
// Tüm agent'lar için veri hazırlar
// ============================================================================

import { MatchData } from '../types';

export interface CollectedData {
  fixtureData?: any;
  homeTeamStats?: any;
  awayTeamStats?: any;
  h2hData?: any;
  oddsData?: any;
  contextData?: any;
  summary?: string;
  dataQuality?: number;
}

// Direct Sportmonks imports - MCP server yerine doğrudan çağrı (daha güvenilir)
import { getFullFixtureData, getTeamStats, getHeadToHead } from '@/lib/sportmonks/index';

// MCP Tool Definitions
const MCP_TOOLS = [
  {
    name: 'football_data',
    description: 'Get comprehensive match data including team stats, form, H2H, odds, lineups, injuries. Use this first to get the full picture.',
    input_schema: {
      type: 'object',
      properties: {
        fixtureId: { 
          type: 'number', 
          description: 'The fixture/match ID (required)' 
        },
        homeTeamId: { 
          type: 'number', 
          description: 'Home team ID (optional, helps with data quality)' 
        },
        awayTeamId: { 
          type: 'number', 
          description: 'Away team ID (optional, helps with data quality)' 
        },
      },
      required: ['fixtureId'],
    },
  },
  {
    name: 'team_stats',
    description: 'Get detailed team statistics including venue-specific goal averages (homeAvgGoalsScored, awayAvgGoalsScored), form, BTTS, Over/Under percentages. CRITICAL for accurate predictions.',
    input_schema: {
      type: 'object',
      properties: {
        teamId: { 
          type: 'number', 
          description: 'Team ID (required)' 
        },
        seasonId: { 
          type: 'number', 
          description: 'Season ID (optional, defaults to current season)' 
        },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'head_to_head',
    description: 'Get head-to-head history between two teams with detailed match results, scores, and statistics. Important for understanding team matchups.',
    input_schema: {
      type: 'object',
      properties: {
        homeTeamId: { 
          type: 'number', 
          description: 'Home team ID (required)' 
        },
        awayTeamId: { 
          type: 'number', 
          description: 'Away team ID (required)' 
        },
        limit: { 
          type: 'number', 
          description: 'Number of matches to retrieve (default: 10, max: 20)' 
        },
      },
      required: ['homeTeamId', 'awayTeamId'],
    },
  },
  {
    name: 'odds_data',
    description: 'Get betting odds and market analysis for a match. Includes 1X2, Over/Under, BTTS, Asian Handicap odds.',
    input_schema: {
      type: 'object',
      properties: {
        fixtureId: { 
          type: 'number', 
          description: 'The fixture/match ID (required)' 
        },
      },
      required: ['fixtureId'],
    },
  },
  {
    name: 'match_context',
    description: 'Get match context including weather, referee stats, venue information, lineups, injuries. Important for complete analysis.',
    input_schema: {
      type: 'object',
      properties: {
        fixtureId: { 
          type: 'number', 
          description: 'The fixture/match ID (required)' 
        },
      },
      required: ['fixtureId'],
    },
  },
];

/**
 * Data Collector Agent
 * Sportmonks'tan paralel olarak tüm verileri toplar
 * Artık Claude API kullanmıyor - doğrudan Sportmonks fonksiyonlarını çağırır (daha hızlı ve güvenilir)
 */
export async function runClaudeDataCollector(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<CollectedData | null> {

  try {
    console.log('🔍 Claude Data Collector: Starting intelligent data collection...');
    console.log(`   📍 Fixture: ${matchData.homeTeam} vs ${matchData.awayTeam} (ID: ${matchData.fixtureId})`);

    // 🆕 DIRECT TOOL EXECUTION - Claude'a bağımlı olmadan tüm verileri paralel topla
    // Bu yaklaşım daha hızlı ve güvenilir
    const collectedData: CollectedData = {
      dataQuality: 0,
    };
    let toolCallCount = 0;
    const toolResults: string[] = [];

    // Paralel olarak tüm verileri topla
    console.log('   🔧 Executing all tools in parallel...');
    
    const toolPromises = [
      // 1. Football Data (fixture details)
      executeMCPTool('football_data', { fixtureId: matchData.fixtureId })
        .then(result => {
          collectedData.fixtureData = result?.data;
          toolCallCount++;
          toolResults.push('fixtureData');
          console.log('   ✅ football_data: Complete');
          return result;
        })
        .catch(err => {
          console.log(`   ⚠️ football_data failed: ${err.message}`);
          return null;
        }),
      
      // 2. Home Team Stats
      matchData.homeTeamId ? executeMCPTool('team_stats', { teamId: matchData.homeTeamId })
        .then(result => {
          collectedData.homeTeamStats = result?.data;
          toolCallCount++;
          toolResults.push('homeTeamStats');
          console.log('   ✅ team_stats (home): Complete');
          return result;
        })
        .catch(err => {
          console.log(`   ⚠️ team_stats (home) failed: ${err.message}`);
          return null;
        }) : Promise.resolve(null),
      
      // 3. Away Team Stats
      matchData.awayTeamId ? executeMCPTool('team_stats', { teamId: matchData.awayTeamId })
        .then(result => {
          collectedData.awayTeamStats = result?.data;
          toolCallCount++;
          toolResults.push('awayTeamStats');
          console.log('   ✅ team_stats (away): Complete');
          return result;
        })
        .catch(err => {
          console.log(`   ⚠️ team_stats (away) failed: ${err.message}`);
          return null;
        }) : Promise.resolve(null),
      
      // 4. Head to Head
      (matchData.homeTeamId && matchData.awayTeamId) ? executeMCPTool('head_to_head', { 
        homeTeamId: matchData.homeTeamId, 
        awayTeamId: matchData.awayTeamId 
      })
        .then(result => {
          collectedData.h2hData = result?.data;
          toolCallCount++;
          toolResults.push('h2hData');
          console.log('   ✅ head_to_head: Complete');
          return result;
        })
        .catch(err => {
          console.log(`   ⚠️ head_to_head failed: ${err.message}`);
          return null;
        }) : Promise.resolve(null),
      
      // 5. Odds Data
      executeMCPTool('odds_data', { fixtureId: matchData.fixtureId })
        .then(result => {
          collectedData.oddsData = result?.data;
          toolCallCount++;
          toolResults.push('oddsData');
          console.log('   ✅ odds_data: Complete');
          return result;
        })
        .catch(err => {
          console.log(`   ⚠️ odds_data failed: ${err.message}`);
          return null;
        }),
    ];

    // 10 saniye timeout ile tüm tool'ları bekle
    await Promise.race([
      Promise.all(toolPromises),
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);

    // Veri kalitesini hesapla
    collectedData.dataQuality = Math.min(100, toolCallCount * 20);
    
    // Özet oluştur
    collectedData.summary = `${toolCallCount} tool çalıştırıldı. Toplanan: ${toolResults.join(', ')}`;

    console.log(`   ✅ Claude Data Collector: Complete`);
    console.log(`   📊 Data Quality: ${collectedData.dataQuality}/100`);
    console.log(`   📝 Summary: ${collectedData.summary}`);

    return collectedData;
  } catch (error: any) {
    console.error('❌ Claude Data Collector error:', error.message);
    return null;
  }
}

/**
 * Direct Tool Execution (bypass MCP - daha güvenilir)
 * MCP server yerine doğrudan Sportmonks fonksiyonlarını çağırır
 */
async function executeMCPTool(toolName: string, args: any): Promise<any> {
  try {
    console.log(`   🔧 Direct execution: ${toolName}`);
    
    switch (toolName) {
      case 'football_data':
        if (!args.fixtureId) throw new Error('fixtureId required');
        const fixtureData = await getFullFixtureData(args.fixtureId);
        return {
          success: true,
          data: fixtureData,
          summary: `Match data for fixture ${args.fixtureId}`,
        };

      case 'team_stats':
        if (!args.teamId) throw new Error('teamId required');
        const teamStats = await getTeamStats(args.teamId, args.seasonId);
        return {
          success: true,
          data: teamStats,
          summary: `Stats for team ${args.teamId}`,
        };

      case 'head_to_head':
        if (!args.homeTeamId || !args.awayTeamId) throw new Error('homeTeamId and awayTeamId required');
        const h2h = await getHeadToHead(args.homeTeamId, args.awayTeamId);
        return {
          success: true,
          data: h2h,
          summary: `H2H: ${args.homeTeamId} vs ${args.awayTeamId}`,
        };

      case 'odds_data':
        if (!args.fixtureId) throw new Error('fixtureId required');
        const fullDataForOdds = await getFullFixtureData(args.fixtureId);
        return {
          success: true,
          data: {
            odds: fullDataForOdds?.odds || null,
          },
          summary: `Odds for fixture ${args.fixtureId}`,
        };

      case 'match_context':
        if (!args.fixtureId) throw new Error('fixtureId required');
        const contextData = await getFullFixtureData(args.fixtureId);
        return {
          success: true,
          data: {
            weather: contextData?.weather || null,
            referee: contextData?.referee || null,
            venue: contextData?.venue || null,
            lineups: contextData?.lineups || null,
          },
          summary: `Context for fixture ${args.fixtureId}`,
        };

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error: any) {
    console.error(`❌ Tool execution error (${toolName}):`, error.message);
    throw error;
  }
}
