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
 * Claude Data Collector Agent
 * Claude API'nin tool calling özelliğini kullanarak Sportmonks'tan akıllı veri toplama
 */
export async function runClaudeDataCollector(
  matchData: MatchData,
  language: 'tr' | 'en' | 'de' = 'en'
): Promise<CollectedData | null> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!anthropicApiKey) {
    console.warn('⚠️ ANTHROPIC_API_KEY not found, skipping Claude Data Collector');
    return null;
  }

  try {
    console.log('🔍 Claude Data Collector: Starting intelligent data collection...');
    console.log(`   📍 Fixture: ${matchData.homeTeam} vs ${matchData.awayTeam} (ID: ${matchData.fixtureId})`);

    const systemPrompt = `Sen bir FUTBOL VERİ TOPLAMA UZMANISIN. Görevin Sportmonks API'sinden en detaylı ve kritik verileri toplamak.

ÖNEMLİ VERİLER:
1. Venue-Spesifik Gol Ortalamaları: homeAvgGoalsScored, awayAvgGoalsScored
2. Son 10 Maç İstatistikleri: Form, gol ortalamaları, BTTS, Over/Under yüzdeleri
3. H2H Detayları: Son karşılaşmaların skorları
4. Bahis Oranları: 1X2, Over/Under, BTTS

STRATEJİ:
- Önce football_data ile genel resmi al
- Her iki takım için team_stats çağır
- H2H verilerini al
- Odds ve context için de çağrı yap`;

    const userPrompt = `Fixture ${matchData.fixtureId} için kapsamlı veri toplama yapacağım.

Maç Bilgileri:
- Ev Sahibi: ${matchData.homeTeam} (ID: ${matchData.homeTeamId})
- Deplasman: ${matchData.awayTeam} (ID: ${matchData.awayTeamId})
- Fixture ID: ${matchData.fixtureId}
- Lig: ${matchData.league || 'N/A'}

Mevcut Veriler (Eksik olabilir):
- Home Form: ${matchData.homeForm?.form || 'N/A'}
- Away Form: ${matchData.awayForm?.form || 'N/A'}
- H2H: ${matchData.h2h?.totalMatches || 0} maç

GÖREV:
1. MCP tool'larını kullanarak Sportmonks'tan EN DETAYLI verileri topla
2. Özellikle venue-spesifik gol ortalamalarını al
3. Her iki takım için team_stats çağır
4. H2H maçlarının detaylı skorlarını al

Tool'ları sırayla kullan.`;

    // Claude API call with tools
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        tools: MCP_TOOLS,
        tool_choice: { type: 'auto' },
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Claude API error: ${response.status}`, errorText);
      return null;
    }

    const message = await response.json();

    console.log(`✅ Claude Data Collector: Initial response received`);
    console.log(`   📊 Tool calls detected: ${message.content?.filter((c: any) => c.type === 'tool_use')?.length || 0}`);

    // Tool call'ları execute et
    const collectedData: CollectedData = {
      dataQuality: 0,
    };
    let toolCallCount = 0;
    const toolResults: any[] = [];

    for (const content of message.content || []) {
      if (content.type === 'tool_use') {
        toolCallCount++;
        const toolName = content.name;
        const toolInput = content.input;

        console.log(`   🔧 [${toolCallCount}] Executing tool: ${toolName}`);

        try {
          const toolResult = await executeMCPTool(toolName, toolInput);
          
          // Tool sonuçlarını collectedData'ya ekle
          if (toolName === 'football_data') {
            collectedData.fixtureData = toolResult?.data;
          } else if (toolName === 'team_stats') {
            if (toolInput.teamId === matchData.homeTeamId) {
              collectedData.homeTeamStats = toolResult?.data;
            } else if (toolInput.teamId === matchData.awayTeamId) {
              collectedData.awayTeamStats = toolResult?.data;
            }
          } else if (toolName === 'head_to_head') {
            collectedData.h2hData = toolResult?.data;
          } else if (toolName === 'odds_data') {
            collectedData.oddsData = toolResult?.data;
          } else if (toolName === 'match_context') {
            collectedData.contextData = toolResult?.data;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: JSON.stringify({
              success: true,
              data: toolResult?.data || toolResult,
            }),
          });

          console.log(`   ✅ [${toolCallCount}] ${toolName}: Data collected`);
        } catch (error: any) {
          console.error(`   ❌ [${toolCallCount}] ${toolName}: Error - ${error.message}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: JSON.stringify({
              success: false,
              error: error.message,
            }),
          });
        }
      }
    }

    // Veri kalitesini hesapla
    collectedData.dataQuality = Math.min(100, toolCallCount * 20);
    
    // Özet oluştur
    const collectedFields = [];
    if (collectedData.fixtureData) collectedFields.push('fixtureData');
    if (collectedData.homeTeamStats) collectedFields.push('homeTeamStats');
    if (collectedData.awayTeamStats) collectedFields.push('awayTeamStats');
    if (collectedData.h2hData) collectedFields.push('h2hData');
    if (collectedData.oddsData) collectedFields.push('oddsData');
    if (collectedData.contextData) collectedFields.push('contextData');
    
    collectedData.summary = `${toolCallCount} tool çalıştırıldı. Toplanan: ${collectedFields.join(', ')}`;

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
