// ============================================================================
// CLAUDE DATA COLLECTOR AGENT
// Claude API + MCP kullanarak Sportmonks'tan en üst düzey verileri toplar
// Tüm agent'lar için veri hazırlar
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
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

const MCP_SERVER_URL = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp`
  : process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/api/mcp`
    : 'http://localhost:3000/api/mcp';

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

  const client = new Anthropic({ apiKey: anthropicApiKey });

  try {
    console.log('🔍 Claude Data Collector: Starting intelligent data collection...');
    console.log(`   📍 Fixture: ${matchData.homeTeam} vs ${matchData.awayTeam} (ID: ${matchData.fixtureId})`);

    // MCP Tool Definitions - Claude'a sunacağımız tool'lar
    const tools = [
      {
        name: 'football_data',
        description: 'Get comprehensive match data including team stats, form, H2H, odds, lineups, injuries. Use this first to get the full picture.',
        inputSchema: {
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
        inputSchema: {
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
        inputSchema: {
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
        inputSchema: {
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
        inputSchema: {
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

    // Claude'a veri toplama görevi ver
    const systemPrompt = `Sen bir FUTBOL VERİ TOPLAMA UZMANISIN. Görevin Sportmonks API'sinden en detaylı ve kritik verileri toplamak.

ÖNEMLİ VERİLER:
1. **Venue-Spesifik Gol Ortalamaları**: homeAvgGoalsScored, homeAvgGoalsConceded, awayAvgGoalsScored, awayAvgGoalsConceded - Bu veriler tahminler için KRİTİK!
2. **Son 10 Maç İstatistikleri**: Form, gol ortalamaları, BTTS, Over/Under yüzdeleri
3. **H2H Detayları**: Son karşılaşmaların skorları, istatistikleri, trendler
4. **Kadro Durumu**: Sakatlıklar, kadro derinliği, önemli oyuncu eksiklikleri
5. **Bahis Oranları**: 1X2, Over/Under, BTTS, Asian Handicap
6. **Maç Bağlamı**: Hakem istatistikleri, hava durumu, saha koşulları

STRATEJİ:
- Önce football_data ile genel resmi al
- Eksik veya yetersiz görünen veriler için spesifik tool'ları kullan (team_stats, head_to_head)
- Her iki takım için venue-spesifik verileri MUTLAKA topla
- H2H verilerini detaylı şekilde al (limit: 10-15 maç)
- Odds ve context verilerini de topla

VERİ KALİTESİ:
- Eğer bir tool hata verirse veya veri yoksa, diğer tool'lara devam et
- Mümkün olduğunca fazla veri topla, ama gereksiz tekrar yapma
- Toplanan verileri özetle ve kalite skoru ver (0-100)`;

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
2. Özellikle venue-spesifik gol ortalamalarını (homeAvgGoalsScored, awayAvgGoalsScored) MUTLAKA al
3. Her iki takım için son 10 maç istatistiklerini topla
4. H2H maçlarının detaylı skorlarını ve istatistiklerini al
5. Sakatlık ve kadro bilgilerini topla
6. Bahis oranlarını ve maç bağlamını (hakem, hava) al

Tool'ları sırayla kullan ve toplanan verileri özetle.`;

    // Claude'a mesaj gönder
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      tools,
      tool_choice: { type: 'auto' },
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    console.log(`✅ Claude Data Collector: Initial response received`);
    console.log(`   📊 Tool calls detected: ${message.content.filter(c => c.type === 'tool_use').length}`);

    // Tool call'ları execute et
    const collectedData: CollectedData = {
      dataQuality: 0,
    };
    const toolResults: any[] = [];
    let toolCallCount = 0;

    for (const content of message.content) {
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
              summary: toolResult?.summary || `Data collected from ${toolName}`,
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

    // Tool sonuçlarını Claude'a gönder ve özet al
    if (toolResults.length > 0) {
      console.log(`   📊 Sending ${toolResults.length} tool results to Claude for summary...`);

      const summaryMessage = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
          {
            role: 'assistant',
            content: message.content,
          },
          {
            role: 'user',
            content: toolResults,
          },
          {
            role: 'user',
            content: `Toplanan verileri analiz et ve şunları sağla:
1. Veri kalitesi skoru (0-100): Kaç tool başarılı oldu? Veriler ne kadar detaylı?
2. Eksik veya yetersiz görünen veriler neler?
3. Toplanan verilerin özeti (JSON formatında)

JSON formatında döndür:
{
  "dataQuality": 85,
  "summary": "5 tool başarıyla çalıştı. Venue-spesifik gol ortalamaları, H2H verileri, odds ve context toplandı.",
  "missingData": ["lineups", "referee_stats"],
  "collectedFields": ["fixtureData", "homeTeamStats", "awayTeamStats", "h2hData", "oddsData"]
}`,
          },
        ],
      });

      // Özeti parse et
      const summaryText = summaryMessage.content[0].type === 'text' 
        ? summaryMessage.content[0].text 
        : '';

      try {
        const summaryJson = JSON.parse(summaryText);
        collectedData.summary = summaryJson.summary || summaryText;
        collectedData.dataQuality = summaryJson.dataQuality || 50;
      } catch {
        collectedData.summary = summaryText;
        collectedData.dataQuality = toolCallCount * 20; // Her tool 20 puan
      }

      console.log(`   ✅ Claude Data Collector: Summary received`);
      console.log(`   📊 Data Quality: ${collectedData.dataQuality}/100`);
      console.log(`   📝 Summary: ${collectedData.summary?.substring(0, 100)}...`);
    } else {
      console.warn('   ⚠️ No tool calls detected, returning basic data');
      collectedData.dataQuality = 0;
      collectedData.summary = 'No data collected - Claude did not use any tools';
    }

    return collectedData;
  } catch (error: any) {
    console.error('❌ Claude Data Collector error:', error.message);
    return null;
  }
}

/**
 * MCP Tool Execution Helper
 */
async function executeMCPTool(toolName: string, args: any): Promise<any> {
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'MCP tool execution failed');
    }

    // MCP JSON-RPC response formatından veriyi çıkar
    if (result.result?.content?.[0]?.text) {
      return JSON.parse(result.result.content[0].text);
    }

    return result.result || result;
  } catch (error: any) {
    console.error(`❌ MCP Tool execution error (${toolName}):`, error.message);
    throw error;
  }
}

