// ============================================================================
// MCP (Model Context Protocol) Server - Football Data Tools
// Provides real-time football data to AI agents
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFullFixtureData, getTeamStats, getHeadToHead } from '@/lib/sportmonks/index';

// MCP Tool Definitions
const MCP_TOOLS = [
  {
    name: 'football_data',
    description: 'Get comprehensive football match data including team stats, form, and predictions',
    inputSchema: {
      type: 'object',
      properties: {
        fixtureId: { type: 'number', description: 'The fixture/match ID' },
        homeTeamId: { type: 'number', description: 'Home team ID' },
        awayTeamId: { type: 'number', description: 'Away team ID' },
      },
      required: ['fixtureId'],
    },
  },
  {
    name: 'team_stats',
    description: 'Get detailed team statistics including goals, form, and performance metrics',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'number', description: 'Team ID' },
        seasonId: { type: 'number', description: 'Season ID (optional)' },
      },
      required: ['teamId'],
    },
  },
  {
    name: 'head_to_head',
    description: 'Get head-to-head history between two teams',
    inputSchema: {
      type: 'object',
      properties: {
        homeTeamId: { type: 'number', description: 'Home team ID' },
        awayTeamId: { type: 'number', description: 'Away team ID' },
        limit: { type: 'number', description: 'Number of matches to retrieve (default: 10)' },
      },
      required: ['homeTeamId', 'awayTeamId'],
    },
  },
  {
    name: 'odds_data',
    description: 'Get betting odds and market analysis for a match',
    inputSchema: {
      type: 'object',
      properties: {
        fixtureId: { type: 'number', description: 'The fixture/match ID' },
      },
      required: ['fixtureId'],
    },
  },
  {
    name: 'match_context',
    description: 'Get match context including weather, referee, and venue information',
    inputSchema: {
      type: 'object',
      properties: {
        fixtureId: { type: 'number', description: 'The fixture/match ID' },
      },
      required: ['fixtureId'],
    },
  },
];

// Handle MCP Protocol Requests
export async function GET(request: NextRequest) {
  // Return available tools
  return NextResponse.json({
    tools: MCP_TOOLS,
    version: '1.0.0',
    name: 'Football Analytics MCP Server',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle JSON-RPC format (standard MCP protocol)
    if (body.jsonrpc === '2.0') {
      const { method, params, id } = body;

      switch (method) {
        case 'tools/list':
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: { tools: MCP_TOOLS },
          });

        case 'tools/call':
          const result = await executeToolCall(params.name, params.arguments);
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(result) }] },
          });

        default:
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: 'Method not found' },
          });
      }
    }

    // Handle direct tool call format
    if (body.tool && body.arguments) {
      const result = await executeToolCall(body.tool, body.arguments);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
  } catch (error: any) {
    console.error('MCP Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Execute tool calls
async function executeToolCall(toolName: string, args: any): Promise<any> {
  console.log(`🔧 MCP Tool Call: ${toolName}`, args);

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
      const fullData = await getFullFixtureData(args.fixtureId);
      return {
        success: true,
        data: {
          odds: fullData?.odds || null,
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
}

