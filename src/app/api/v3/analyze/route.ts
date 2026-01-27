/**
 * FOOTBALL ANALYZER V3 - CLEAN AGENT SYSTEM
 * 
 * 4 Agents + Consensus = Accurate predictions
 * - Agent 1: Statistics (data-driven)
 * - Agent 2: Form/Momentum (psychology)
 * - Agent 3: H2H patterns (history)
 * - Agent 4: Consensus (decision)
 */

import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface MatchData {
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: number;
  awayTeamId?: number;
  league?: string;
  date?: string;
}

interface TeamStats {
  name: string;
  form: string; // "WWDLW" etc
  last5: string; // "2W 2D 1L" etc
  avgGF: number; // goals for
  avgGA: number; // goals against
  homeWinRate: number; // % home wins
  awayWinRate?: number;
  trend: string; // "↑ Up" / "↓ Down" / "→ Stable"
  issues?: string;
  motivation?: string;
  streak?: string;
  lastMatch?: { result: string; score: string; opponent: string };
}

interface H2HStats {
  matches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  avgGoals: number;
  bttsPercent: number;
  over25Percent: number;
  homeRecord: { wins: number; draws: number; losses: number };
  awayRecord: { wins: number; draws: number; losses: number };
  recent: { date: string; home: string; homeGoals: number; awayGoals: number; away: string }[];
}

interface AgentResponse {
  istatistik: any;
  forma: any;
  h2h: any;
  konsensus: any;
}

// ============================================================================
// AGENT CALLS
// ============================================================================

async function callAgent(provider: 'openai' | 'anthropic' | 'gemini', systemPrompt: string, userPrompt: string): Promise<any> {
  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    }
    
    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await response.json();
      return JSON.parse(data.content[0].text);
    }

    if (provider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt + '\n\n' + userPrompt }
            ]
          }]
        })
      });
      const data = await response.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    }
  } catch (error) {
    console.error(`Agent error (${provider}):`, error);
    return null;
  }
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { match, homeStats, awayStats, h2h } = body;

    if (!match || !homeStats || !awayStats || !h2h) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // AGENT 1: İstatistikçi (Stats analyzer)
    const agentStatsPrompt = `
${match.homeTeam} vs ${match.awayTeam}

HOME (${match.homeTeam}):
- Form: ${homeStats.form}
- Avg Goals: ${homeStats.avgGF}/${homeStats.avgGA}
- Home Win Rate: %${homeStats.homeWinRate}

AWAY (${match.awayTeam}):
- Form: ${awayStats.form}
- Avg Goals: ${awayStats.avgGF}/${awayStats.avgGA}
- Away Win Rate: %${awayStats.awayWinRate}

H2H (${h2h.matches} matches): ${match.homeTeam} ${h2h.homeWins}W-${h2h.draws}D-${h2h.awayWins}L ${match.awayTeam}

Analyze and return JSON with: homeWinPercent, drawPercent, awayWinPercent, expectedGoals, bttsProb, over25Prob, confidence, analysis
`;

    // AGENT 2: Forma (Form/Momentum)
    const agentFormPrompt = `
${match.homeTeam} (${homeStats.last5} - ${homeStats.trend}) vs ${match.awayTeam} (${awayStats.last5} - ${awayStats.trend})

Analyze momentum, psychology, and current form.
Return JSON with: homeMomentum (1-10), awayMomentum (1-10), favoriteShift ("${match.homeTeam}"|"${match.awayTeam}"|"neutral"), forecastShift (-2 to +2)
`;

    // AGENT 3: H2H
    const agentH2HPrompt = `
${match.homeTeam} vs ${match.awayTeam} - Head to Head Analysis

${match.homeTeam} home record: ${h2h.homeRecord.wins}W-${h2h.homeRecord.draws}D-${h2h.homeRecord.losses}L
${match.awayTeam} away record: ${h2h.awayRecord.wins}W-${h2h.awayRecord.draws}D-${h2h.awayRecord.losses}L

BTTS History: ${h2h.bttsPercent}%
Over 2.5: ${h2h.over25Percent}%

Return JSON with: homeH2HEdge (1-10), awayH2HEdge (1-10), likelyPattern, bttsHistoric, over25Historic
`;

    // Run agents in parallel
    const [agentStats, agentForm, agentH2HResult] = await Promise.all([
      callAgent('openai', 'You are a football statistics analyst. Return valid JSON only.', agentStatsPrompt),
      callAgent('anthropic', 'You are a football form and momentum analyst. Return valid JSON only.', agentFormPrompt),
      callAgent('gemini', 'You are a H2H pattern analyst. Return valid JSON only.', agentH2HPrompt)
    ]);

    // AGENT 4: Konsensüs (Decision maker - requires all 3 reports)
    const agentConsensusPrompt = `
Match: ${match.homeTeam} vs ${match.awayTeam}

Stats Agent: ${JSON.stringify(agentStats)}
Form Agent: ${JSON.stringify(agentForm)}
H2H Agent: ${JSON.stringify(agentH2HResult)}

Your job: Make a final prediction decision.
Return JSON with: prediction ("${match.homeTeam} win"|"draw"|"${match.awayTeam} win"), confidence (1-100), expectedGoals, btts, over25, bestBet, reasoning
`;

    const agentConsensus = await callAgent('openai', 'You are the final decision maker. Synthesize all reports and make a bet recommendation. Return valid JSON.', agentConsensusPrompt);

    // Response
    const result = {
      match,
      timestamp: new Date().toISOString(),
      agents: {
        statistics: agentStats,
        form: agentForm,
        h2h: agentH2HResult,
        consensus: agentConsensus
      },
      recommendation: agentConsensus?.bestBet || 'inconclusive',
      confidence: agentConsensus?.confidence || 0,
      prediction: agentConsensus?.prediction || 'inconclusive',
      expectedGoals: agentConsensus?.expectedGoals || 0
    };

    // Store in cache/database
    console.log('✅ Analysis complete:', { match: `${match.homeTeam} vs ${match.awayTeam}`, prediction: result.prediction, confidence: result.confidence });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed', details: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'POST required. Send match, homeStats, awayStats, h2h' });
}
