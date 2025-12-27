// ============================================================================
// ODDS ANALYSIS SETTLEMENT
// Maç sonuçlarını odds_analysis_log tablosuna kaydeder
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface MatchResult {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  corners?: number;
  yellowCards?: number;
  redCards?: number;
}

/**
 * Maç sonucunu odds_analysis_log tablosuna kaydet
 */
export async function settleOddsAnalysis(fixtureId: number, result: MatchResult): Promise<boolean> {
  try {
    const matchResult = result.homeScore > result.awayScore ? '1' : 
                        result.homeScore < result.awayScore ? '2' : 'X';
    const totalGoals = result.homeScore + result.awayScore;
    const actualOver25 = totalGoals > 2.5;
    const actualBtts = result.homeScore > 0 && result.awayScore > 0;
    
    // Get the analysis log
    const { data: log, error: fetchError } = await supabase
      .from('odds_analysis_log')
      .select('*')
      .eq('fixture_id', fixtureId)
      .single();
    
    if (fetchError || !log) {
      console.error('❌ Odds analysis log not found for fixture:', fixtureId);
      return false;
    }
    
    // Calculate prediction correctness
    const predictionCorrect = 
      (log.recommendation === 'Over' && actualOver25) ||
      (log.recommendation === 'Under' && !actualOver25) ||
      (log.match_winner_value === 'home' && matchResult === '1') ||
      (log.match_winner_value === 'away' && matchResult === '2') ||
      (log.match_winner_value === 'draw' && matchResult === 'X');
    
    // Calculate value bet success
    let valueBetSuccess = false;
    if (log.best_value_market && log.best_value_amount > 0) {
      if (log.best_value_market === 'home' && matchResult === '1') valueBetSuccess = true;
      if (log.best_value_market === 'away' && matchResult === '2') valueBetSuccess = true;
      if (log.best_value_market === 'over25' && actualOver25) valueBetSuccess = true;
      if (log.best_value_market === 'under25' && !actualOver25) valueBetSuccess = true;
      if (log.best_value_market === 'btts' && actualBtts) valueBetSuccess = true;
      if (log.best_value_market === 'bttsNo' && !actualBtts) valueBetSuccess = true;
    }
    
    // Update the log
    const { error: updateError } = await supabase
      .from('odds_analysis_log')
      .update({
        actual_result: matchResult,
        actual_score: `${result.homeScore}-${result.awayScore}`,
        actual_over_25: actualOver25,
        actual_btts: actualBtts,
        actual_corners: result.corners || null,
        actual_cards: (result.yellowCards || 0) + (result.redCards || 0) || null,
        prediction_correct: predictionCorrect,
        value_bet_success: valueBetSuccess,
        settled_at: new Date().toISOString()
      })
      .eq('fixture_id', fixtureId);
    
    if (updateError) {
      console.error('❌ Error settling odds analysis:', updateError);
      return false;
    }
    
    console.log(`✅ Odds analysis settled for fixture ${fixtureId}: ${result.homeScore}-${result.awayScore}`);
    return true;
  } catch (error) {
    console.error('❌ Exception settling odds analysis:', error);
    return false;
  }
}

/**
 * Sportmonks'tan maç sonucunu çek ve settle et
 */
export async function settleOddsAnalysisFromSportmonks(fixtureId: number): Promise<boolean> {
  try {
    // Sportmonks API'den maç sonucunu çek
    const response = await fetch(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}?api_token=${process.env.SPORTMONKS_API_KEY}&include=scores;`
    );
    
    if (!response.ok) {
      console.error('❌ Failed to fetch fixture result from Sportmonks');
      return false;
    }
    
    const data = await response.json();
    const fixture = data.data;
    
    if (!fixture || fixture.result_info !== 'FT') {
      console.log(`⏳ Match ${fixtureId} not finished yet`);
      return false;
    }
    
    // Get scores
    const scores = fixture.scores || [];
    const homeScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant_id === fixture.participants?.find((p: any) => p.meta?.location === 'home')?.id)?.score?.goals || 0;
    const awayScore = scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant_id === fixture.participants?.find((p: any) => p.meta?.location === 'away')?.id)?.score?.goals || 0;
    
    if (homeScore === 0 && awayScore === 0 && fixture.result_info === 'FT') {
      // Try alternative method
      const homeParticipant = fixture.participants?.find((p: any) => p.meta?.location === 'home');
      const awayParticipant = fixture.participants?.find((p: any) => p.meta?.location === 'away');
      
      // This is a simplified version - you might need to adjust based on actual API response
      return false;
    }
    
    const result: MatchResult = {
      fixtureId,
      homeScore,
      awayScore,
      corners: fixture.statistics?.find((s: any) => s.type?.name === 'Corners')?.value || null,
      yellowCards: fixture.statistics?.find((s: any) => s.type?.name === 'Yellow Cards')?.value || null,
      redCards: fixture.statistics?.find((s: any) => s.type?.name === 'Red Cards')?.value || null
    };
    
    return await settleOddsAnalysis(fixtureId, result);
  } catch (error) {
    console.error('❌ Exception fetching result from Sportmonks:', error);
    return false;
  }
}

/**
 * Tüm unsettled odds analysis log'ları settle et
 */
export async function settleAllUnsettledOddsAnalyses(): Promise<{ settled: number; errors: number }> {
  try {
    // Get all unsettled logs where match date is in the past
    const { data: unsettledLogs, error } = await supabase
      .from('odds_analysis_log')
      .select('fixture_id, match_date')
      .is('actual_result', null)
      .lt('match_date', new Date().toISOString());
    
    if (error) {
      console.error('❌ Error fetching unsettled logs:', error);
      return { settled: 0, errors: 0 };
    }
    
    let settled = 0;
    let errors = 0;
    
    for (const log of unsettledLogs || []) {
      const success = await settleOddsAnalysisFromSportmonks(log.fixture_id);
      if (success) {
        settled++;
      } else {
        errors++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`✅ Settled ${settled} odds analyses, ${errors} errors`);
    return { settled, errors };
  } catch (error) {
    console.error('❌ Exception settling all odds analyses:', error);
    return { settled: 0, errors: 0 };
  }
}

