import { NextRequest, NextResponse } from 'next/server';
import { prepareMatchAnalysis } from '@/lib/football-api';
import { analyzeMatch } from '@/lib/ai-analysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      homeTeamId,
      homeTeamName,
      awayTeamId,
      awayTeamName,
      competition,
      matchDate,
      aiProvider = 'openai',
    } = body;

    if (!homeTeamId || !awayTeamId || !homeTeamName || !awayTeamName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get match data
    const matchData = await prepareMatchAnalysis(
      homeTeamId,
      homeTeamName,
      awayTeamId,
      awayTeamName,
      competition || 'Unknown',
      matchDate,
      process.env.FOOTBALL_DATA_API_KEY
    );

    // Get AI analysis
    const analysis = await analyzeMatch(matchData, aiProvider);

    return NextResponse.json({
      success: true,
      data: matchData,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Analyze API Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
