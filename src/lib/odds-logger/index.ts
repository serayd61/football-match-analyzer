// ============================================================================
// ODDS ANALYSIS LOGGER
// Odds analizlerinin detaylı kayıtlarını database'e kaydeder
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface OddsAnalysisLogData {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
  
  // Odds
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  over25Odds: number;
  under25Odds: number;
  bttsYesOdds: number;
  bttsNoOdds: number;
  
  // Implied Probabilities
  homeImpliedProb: number;
  drawImpliedProb: number;
  awayImpliedProb: number;
  over25ImpliedProb: number;
  under25ImpliedProb: number;
  bttsYesImpliedProb: number;
  bttsNoImpliedProb: number;
  
  // Form-Based Probabilities
  homeFormProb: number;
  awayFormProb: number;
  drawFormProb: number;
  over25FormProb: number;
  under25FormProb: number;
  bttsYesFormProb: number;
  bttsNoFormProb: number;
  
  // Value Calculations
  homeValue: number;
  awayValue: number;
  drawValue: number;
  over25Value: number;
  under25Value: number;
  bttsYesValue: number;
  bttsNoValue: number;
  
  // Best Value
  bestValueMarket: string;
  bestValueAmount: number;
  valueRating: 'None' | 'Low' | 'Medium' | 'High';
  
  // Odds Movement
  homeOddsMovement?: string;
  awayOddsMovement?: string;
  over25OddsMovement?: string;
  bttsOddsMovement?: string;
  
  // Sharp Money
  sharpMoneyDirection?: string;
  sharpMoneyConfidence?: string;
  sharpMoneyReasoning?: any;
  
  // Predictions
  recommendation?: string;
  matchWinnerValue?: string;
  bttsValue?: string;
  asianHandicapRecommendation?: string;
  correctScoreMostLikely?: string;
  htftPrediction?: string;
  cornersPrediction?: string;
  cardsPrediction?: string;
  
  // Confidence Levels
  recommendationConfidence?: number;
  matchWinnerConfidence?: number;
  bttsConfidence?: number;
  asianHandicapConfidence?: number;
  correctScoreConfidence?: number;
  htftConfidence?: number;
  cornersConfidence?: number;
  cardsConfidence?: number;
  
  // Reasoning
  recommendationReasoning?: string;
  matchWinnerReasoning?: string;
  bttsReasoning?: string;
  asianHandicapReasoning?: string;
  correctScoreReasoning?: string;
  htftReasoning?: string;
  cornersReasoning?: string;
  cardsReasoning?: string;
  
  // Value Bets
  valueBets?: string[];
  
  // Full Analysis Data
  fullAnalysisData?: any;
}

/**
 * Odds analiz sonuçlarını database'e kaydet
 */
export async function saveOddsAnalysisLog(data: OddsAnalysisLogData): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('odds_analysis_log')
      .upsert({
        fixture_id: data.fixtureId,
        home_team: data.homeTeam,
        away_team: data.awayTeam,
        league: data.league,
        match_date: data.matchDate,
        
        // Odds
        home_odds: data.homeOdds,
        draw_odds: data.drawOdds,
        away_odds: data.awayOdds,
        over_25_odds: data.over25Odds,
        under_25_odds: data.under25Odds,
        btts_yes_odds: data.bttsYesOdds,
        btts_no_odds: data.bttsNoOdds,
        
        // Implied Probabilities
        home_implied_prob: data.homeImpliedProb,
        draw_implied_prob: data.drawImpliedProb,
        away_implied_prob: data.awayImpliedProb,
        over_25_implied_prob: data.over25ImpliedProb,
        under_25_implied_prob: data.under25ImpliedProb,
        btts_yes_implied_prob: data.bttsYesImpliedProb,
        btts_no_implied_prob: data.bttsNoImpliedProb,
        
        // Form-Based Probabilities
        home_form_prob: data.homeFormProb,
        away_form_prob: data.awayFormProb,
        draw_form_prob: data.drawFormProb,
        over_25_form_prob: data.over25FormProb,
        under_25_form_prob: data.under25FormProb,
        btts_yes_form_prob: data.bttsYesFormProb,
        btts_no_form_prob: data.bttsNoFormProb,
        
        // Value Calculations
        home_value: data.homeValue,
        away_value: data.awayValue,
        draw_value: data.drawValue,
        over_25_value: data.over25Value,
        under_25_value: data.under25Value,
        btts_yes_value: data.bttsYesValue,
        btts_no_value: data.bttsNoValue,
        
        // Best Value
        best_value_market: data.bestValueMarket,
        best_value_amount: data.bestValueAmount,
        value_rating: data.valueRating,
        
        // Odds Movement
        home_odds_movement: data.homeOddsMovement,
        away_odds_movement: data.awayOddsMovement,
        over_25_odds_movement: data.over25OddsMovement,
        btts_odds_movement: data.bttsOddsMovement,
        
        // Sharp Money
        sharp_money_direction: data.sharpMoneyDirection,
        sharp_money_confidence: data.sharpMoneyConfidence,
        sharp_money_reasoning: data.sharpMoneyReasoning,
        
        // Predictions
        recommendation: data.recommendation,
        match_winner_value: data.matchWinnerValue,
        btts_value: data.bttsValue,
        asian_handicap_recommendation: data.asianHandicapRecommendation,
        correct_score_most_likely: data.correctScoreMostLikely,
        htft_prediction: data.htftPrediction,
        corners_prediction: data.cornersPrediction,
        cards_prediction: data.cardsPrediction,
        
        // Confidence Levels
        recommendation_confidence: data.recommendationConfidence,
        match_winner_confidence: data.matchWinnerConfidence,
        btts_confidence: data.bttsConfidence,
        asian_handicap_confidence: data.asianHandicapConfidence,
        correct_score_confidence: data.correctScoreConfidence,
        htft_confidence: data.htftConfidence,
        corners_confidence: data.cornersConfidence,
        cards_confidence: data.cardsConfidence,
        
        // Reasoning
        recommendation_reasoning: data.recommendationReasoning,
        match_winner_reasoning: data.matchWinnerReasoning,
        btts_reasoning: data.bttsReasoning,
        asian_handicap_reasoning: data.asianHandicapReasoning,
        correct_score_reasoning: data.correctScoreReasoning,
        htft_reasoning: data.htftReasoning,
        corners_reasoning: data.cornersReasoning,
        cards_reasoning: data.cardsReasoning,
        
        // Value Bets
        value_bets: data.valueBets || [],
        
        // Full Analysis Data
        full_analysis_data: data.fullAnalysisData,
        
        analyzed_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('❌ Error saving odds analysis log:', error);
      return false;
    }
    
    console.log('✅ Odds analysis log saved to database');
    return true;
  } catch (error) {
    console.error('❌ Exception saving odds analysis log:', error);
    return false;
  }
}

/**
 * Odds analiz kayıtlarını getir
 */
export async function getOddsAnalysisLogs(filters?: {
  league?: string;
  valueRating?: string;
  minValueAmount?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<any[]> {
  try {
    let query = supabase
      .from('odds_analysis_log')
      .select('*')
      .order('analyzed_at', { ascending: false });
    
    if (filters?.league) {
      query = query.eq('league', filters.league);
    }
    
    if (filters?.valueRating) {
      query = query.eq('value_rating', filters.valueRating);
    }
    
    if (filters?.minValueAmount) {
      query = query.gte('best_value_amount', filters.minValueAmount);
    }
    
    if (filters?.startDate) {
      query = query.gte('match_date', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.lte('match_date', filters.endDate);
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching odds analysis logs:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Exception fetching odds analysis logs:', error);
    return [];
  }
}

