// ============================================================================
// ADMIN: Reset all settlements and re-settle with correct scores
// GET /api/admin/reset-settlements
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Fresh client to avoid stale data
function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, supabaseKey);
}

// Sportmonks'tan skor çek (düzeltilmiş versiyon)
async function fetchScoreFromSportmonks(fixtureId: number): Promise<{
  homeScore: number;
  awayScore: number;
} | null> {
  const apiKey = process.env.SPORTMONKS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${apiKey}&include=state;scores`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const fixture = data.data;
    if (!fixture) return null;

    // State kontrolü
    const stateId = fixture.state_id;
    const finishedStateIds = [5, 11, 12];
    if (!finishedStateIds.includes(stateId)) return null;

    // Skorları çek - Sportmonks v3 format
    const scores = fixture.scores || [];
    let homeScore = 0;
    let awayScore = 0;

    // CURRENT skorlarını bul
    for (const scoreEntry of scores) {
      const participant = scoreEntry.score?.participant || scoreEntry.participant;
      const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;
      
      if (scoreEntry.description === 'CURRENT') {
        if (participant === 'home') homeScore = goals;
        if (participant === 'away') awayScore = goals;
      }
    }

    // Eğer CURRENT bulunamadıysa, 2ND_HALF dene
    if (homeScore === 0 && awayScore === 0) {
      for (const scoreEntry of scores) {
        const participant = scoreEntry.score?.participant || scoreEntry.participant;
        const goals = scoreEntry.score?.goals ?? scoreEntry.goals ?? 0;
        
        if (scoreEntry.description === '2ND_HALF') {
          if (participant === 'home' && goals > homeScore) homeScore = goals;
          if (participant === 'away' && goals > awayScore) awayScore = goals;
        }
      }
    }

    return { homeScore, awayScore };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Resetting and re-settling all matches...');
    
    // Create fresh client inline
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all settled matches - no filter first to debug
    const { data: allData, error: allError } = await supabase
      .from('unified_analysis')
      .select('fixture_id, is_settled');
    
    const totalRecords = allData?.length || 0;
    const settledCount = allData?.filter(r => r.is_settled === true).length || 0;
    
    console.log(`📊 Total: ${totalRecords}, Settled: ${settledCount}`);
    
    // Now get settled matches
    const { data: settledMatches, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('is_settled', true);
    
    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message, debug: { totalRecords, settledCount } }, { status: 500 });
    }
    
    if (!settledMatches || settledMatches.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No settled matches to reset', 
        count: 0,
        debug: { totalRecords, settledCount, settledMatchesFromQuery: 0 }
      });
    }
    
    console.log(`📋 Found ${settledMatches.length} settled matches to re-settle`);
    
    let resettledCount = 0;
    let errorCount = 0;
    const results: any[] = [];
    
    for (const match of settledMatches) {
      try {
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Fetch fresh score from Sportmonks
        const score = await fetchScoreFromSportmonks(match.fixture_id);
        
        if (!score) {
          console.log(`   ⏭️ Skip ${match.fixture_id} - no score available`);
          continue;
        }
        
        // Calculate results
        const totalGoals = score.homeScore + score.awayScore;
        const actualMatchResult = score.homeScore > score.awayScore ? '1' : score.homeScore < score.awayScore ? '2' : 'X';
        const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
        const actualBtts = score.homeScore > 0 && score.awayScore > 0;
        
        // Calculate correctness
        const matchResultCorrect = match.match_result_prediction === actualMatchResult;
        const overUnderCorrect = match.over_under_prediction === actualOverUnder;
        const bttsCorrect = (match.btts_prediction === 'Yes' && actualBtts) || 
                           (match.btts_prediction === 'No' && !actualBtts);
        
        // Update
        const { error: updateError } = await supabase
          .from('unified_analysis')
          .update({
            actual_home_score: score.homeScore,
            actual_away_score: score.awayScore,
            actual_total_goals: totalGoals,
            actual_btts: actualBtts,
            actual_match_result: actualMatchResult,
            match_result_correct: matchResultCorrect,
            over_under_correct: overUnderCorrect,
            btts_correct: bttsCorrect,
            updated_at: new Date().toISOString()
          })
          .eq('fixture_id', match.fixture_id);
        
        if (updateError) {
          console.error(`   ❌ Update error for ${match.fixture_id}:`, updateError.message);
          errorCount++;
          continue;
        }
        
        console.log(`   ✅ Re-settled: ${match.home_team} ${score.homeScore}-${score.awayScore} ${match.away_team}`);
        resettledCount++;
        results.push({
          fixtureId: match.fixture_id,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          score: `${score.homeScore}-${score.awayScore}`,
          matchResult: { predicted: match.match_result_prediction, actual: actualMatchResult, correct: matchResultCorrect },
          overUnder: { predicted: match.over_under_prediction, actual: actualOverUnder, correct: overUnderCorrect },
          btts: { predicted: match.btts_prediction, actual: actualBtts ? 'Yes' : 'No', correct: bttsCorrect }
        });
        
      } catch (err: any) {
        console.error(`   ❌ Error:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Re-settlement complete: ${resettledCount} re-settled, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      message: 'Re-settlement complete',
      stats: {
        total: settledMatches.length,
        resettled: resettledCount,
        errors: errorCount
      },
      results
    });
    
  } catch (error: any) {
    console.error('❌ Reset error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

