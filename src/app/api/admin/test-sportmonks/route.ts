// ============================================================================
// ADMIN: Test Sportmonks API
// GET /api/admin/test-sportmonks?fixture_id=19432035
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixture_id') || '19432035';
    
    const apiKey = process.env.SPORTMONKS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'SPORTMONKS_API_KEY not configured' 
      }, { status: 500 });
    }
    
    console.log(`📡 Testing Sportmonks for fixture ${fixtureId}...`);
    
    const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${apiKey}&include=state;scores`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      return NextResponse.json({ 
        success: false, 
        error: `API error: ${response.status}`,
        statusText: response.statusText
      }, { status: response.status });
    }
    
    const data = await response.json();
    const fixture = data.data;
    
    if (!fixture) {
      return NextResponse.json({ 
        success: false, 
        error: 'No fixture data returned' 
      });
    }
    
    // Extract all relevant info
    const result = {
      fixture_id: fixture.id,
      name: fixture.name,
      state_id: fixture.state_id,
      state: fixture.state,
      starting_at: fixture.starting_at,
      scores: fixture.scores,
      
      // Try to extract scores
      extracted: {
        homeScore: 0,
        awayScore: 0,
        method: 'none'
      }
    };
    
    // Try different methods to extract scores
    const scores = fixture.scores || [];
    
    for (const score of scores) {
      console.log('Score entry:', JSON.stringify(score));
      
      if (score.description === 'CURRENT' || score.description === 'FULLTIME' || score.description === '2ND_HALF') {
        if (score.participant === 'home') {
          result.extracted.homeScore = score.goals || 0;
          result.extracted.method = score.description;
        }
        if (score.participant === 'away') {
          result.extracted.awayScore = score.goals || 0;
        }
      }
    }
    
    // If still 0-0, try other methods
    if (result.extracted.homeScore === 0 && result.extracted.awayScore === 0) {
      for (const score of scores) {
        if (score.participant === 'home' && (score.goals || 0) > result.extracted.homeScore) {
          result.extracted.homeScore = score.goals || 0;
          result.extracted.method = 'max_goals';
        }
        if (score.participant === 'away' && (score.goals || 0) > result.extracted.awayScore) {
          result.extracted.awayScore = score.goals || 0;
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      result 
    });
    
  } catch (error: any) {
    console.error('❌ Test error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

