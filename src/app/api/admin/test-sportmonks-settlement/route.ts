// ============================================================================
// ADMIN API - TEST SPORTMONKS SETTLEMENT
// Belirli bir fixture için Sportmonks'tan sonuç alıp alınamadığını test eder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Sportmonks API'den maç sonucu çek
async function fetchMatchResultFromSportmonks(fixtureId: number): Promise<{
  homeScore: number;
  awayScore: number;
  status: string;
  state: string;
} | null> {
  const apiKey = process.env.SPORTMONKS_API_KEY;

  if (!apiKey) {
    console.log('❌ SPORTMONKS_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${apiKey}&include=state;scores`;

    console.log(`   📡 Fetching fixture ${fixtureId}...`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.log(`   ❌ API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      return {
        homeScore: 0,
        awayScore: 0,
        status: `ERROR_${response.status}`,
        state: errorText.substring(0, 100)
      };
    }

    const data = await response.json();
    const fixture = data.data;

    if (!fixture) {
      console.log(`   ❌ No fixture data`);
      return {
        homeScore: 0,
        awayScore: 0,
        status: 'NO_DATA',
        state: 'Fixture not found'
      };
    }

    // State kontrolü
    const stateInfo = fixture.state;
    const stateName = stateInfo?.state || stateInfo?.developer_name || stateInfo?.short_name || '';
    const stateId = fixture.state_id;

    // Finished state IDs: 5 = FT, 11 = AET, 12 = PEN
    const finishedStateIds = [5, 11, 12];
    const finishedStates = ['FT', 'AET', 'PEN', 'FINISHED', 'ended'];

    const isFinished =
      finishedStates.includes(stateName) ||
      finishedStateIds.includes(stateId) ||
      stateInfo?.short_name === 'FT';

    // Skorları çek
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;

    // CURRENT skorlarını bul (nihai skor)
    for (const scoreEntry of scores) {
      const participant = scoreEntry.score?.participant || scoreEntry.participant;
      const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;

      if (scoreEntry.description === 'CURRENT') {
        if (participant === 'home') homeScore = goals;
        if (participant === 'away') awayScore = goals;
      }
    }

    // Eğer CURRENT bulunamadıysa, 2ND_HALF veya FULLTIME dene
    if (homeScore === 0 && awayScore === 0) {
      for (const scoreEntry of scores) {
        const participant = scoreEntry.score?.participant || scoreEntry.participant;
        const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;

        if (scoreEntry.description === '2ND_HALF' || scoreEntry.description === 'FULLTIME') {
          if (participant === 'home' && goals > homeScore) homeScore = goals;
          if (participant === 'away' && goals > awayScore) awayScore = goals;
        }
      }
    }

    return {
      homeScore,
      awayScore,
      status: isFinished ? 'FINISHED' : 'NOT_FINISHED',
      state: `${stateName} (ID: ${stateId})`
    };
  } catch (error: any) {
    console.error(`   ❌ Sportmonks error:`, error.message);
    return {
      homeScore: 0,
      awayScore: 0,
      status: 'EXCEPTION',
      state: error.message
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixture_id');

    if (!fixtureId) {
      return NextResponse.json({
        success: false,
        error: 'fixture_id parameter required'
      }, { status: 400 });
    }

    const fixtureIdNum = parseInt(fixtureId, 10);
    if (isNaN(fixtureIdNum)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid fixture_id'
      }, { status: 400 });
    }

    console.log(`\n🔍 Testing Sportmonks settlement for fixture ${fixtureIdNum}\n`);

    const result = await fetchMatchResultFromSportmonks(fixtureIdNum);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch from Sportmonks',
        fixture_id: fixtureIdNum
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fixture_id: fixtureIdNum,
      result: {
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: result.status,
        state: result.state,
        canSettle: result.status === 'FINISHED' && result.homeScore >= 0 && result.awayScore >= 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
