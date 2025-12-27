// ============================================================================
// ODDS PATTERNS API
// Analizlerden pattern çıkarır
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOddsAnalysisLogs } from '@/lib/odds-logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const minMatches = parseInt(searchParams.get('minMatches') || '5');
    const minSuccessRate = parseInt(searchParams.get('minSuccessRate') || '50');
    const minValue = parseInt(searchParams.get('minValue') || '5');
    
    // Get all settled logs
    const logs = await getOddsAnalysisLogs({ limit: 1000 });
    const settledLogs = logs.filter(log => log.actual_result);
    
    // Pattern analysis
    const patterns: any[] = [];
    
    // Pattern 1: High Value Away Bets
    const highValueAway = settledLogs.filter(log => 
      log.best_value_market === 'away' && 
      log.best_value_amount >= minValue
    );
    if (highValueAway.length >= minMatches) {
      const successRate = (highValueAway.filter(log => log.value_bet_success).length / highValueAway.length) * 100;
      if (successRate >= minSuccessRate) {
        patterns.push({
          pattern: 'Yüksek Value Deplasman Bahisleri',
          totalMatches: highValueAway.length,
          successRate: successRate,
          avgValue: highValueAway.reduce((sum, log) => sum + (log.best_value_amount || 0), 0) / highValueAway.length,
          bestValueMarket: 'away',
          recommendations: [
            `Deplasman value ${minValue}%+ ise → ${successRate.toFixed(1)}% başarı oranı`,
            'Form analizi deplasmanı destekliyorsa güvenilir',
            'Oran düşüyorsa (sharp money) daha güvenilir'
          ]
        });
      }
    }
    
    // Pattern 2: High Value Over 2.5
    const highValueOver = settledLogs.filter(log => 
      log.best_value_market === 'over25' && 
      log.best_value_amount >= minValue
    );
    if (highValueOver.length >= minMatches) {
      const successRate = (highValueOver.filter(log => log.value_bet_success).length / highValueOver.length) * 100;
      if (successRate >= minSuccessRate) {
        patterns.push({
          pattern: 'Yüksek Value Over 2.5',
          totalMatches: highValueOver.length,
          successRate: successRate,
          avgValue: highValueOver.reduce((sum, log) => sum + (log.best_value_amount || 0), 0) / highValueOver.length,
          bestValueMarket: 'over25',
          recommendations: [
            `Over 2.5 value ${minValue}%+ ise → ${successRate.toFixed(1)}% başarı oranı`,
            'xG toplamı 2.5+ ise daha güvenilir',
            'Her iki takım da ofansif ise güvenilir'
          ]
        });
      }
    }
    
    // Pattern 3: High Value Under 2.5
    const highValueUnder = settledLogs.filter(log => 
      log.best_value_market === 'under25' && 
      log.best_value_amount >= minValue
    );
    if (highValueUnder.length >= minMatches) {
      const successRate = (highValueUnder.filter(log => log.value_bet_success).length / highValueUnder.length) * 100;
      if (successRate >= minSuccessRate) {
        patterns.push({
          pattern: 'Yüksek Value Under 2.5',
          totalMatches: highValueUnder.length,
          successRate: successRate,
          avgValue: highValueUnder.reduce((sum, log) => sum + (log.best_value_amount || 0), 0) / highValueUnder.length,
          bestValueMarket: 'under25',
          recommendations: [
            `Under 2.5 value ${minValue}%+ ise → ${successRate.toFixed(1)}% başarı oranı`,
            'xG toplamı 2.0 altı ise daha güvenilir',
            'Her iki takım da defansif ise güvenilir'
          ]
        });
      }
    }
    
    // Pattern 4: High Value Rating
    const highValueRating = settledLogs.filter(log => 
      log.value_rating === 'High'
    );
    if (highValueRating.length >= minMatches) {
      const successRate = (highValueRating.filter(log => log.value_bet_success).length / highValueRating.length) * 100;
      if (successRate >= minSuccessRate) {
        patterns.push({
          pattern: 'High Value Rating (15%+)',
          totalMatches: highValueRating.length,
          successRate: successRate,
          avgValue: highValueRating.reduce((sum, log) => sum + (log.best_value_amount || 0), 0) / highValueRating.length,
          bestValueMarket: 'mixed',
          recommendations: [
            `High value rating → ${successRate.toFixed(1)}% başarı oranı`,
            '15%+ value olan bahisler genelde karlı',
            'Sharp money onayı varsa daha güvenilir'
          ]
        });
      }
    }
    
    // Pattern 5: Odds Movement + Value
    const oddsMovementValue = settledLogs.filter(log => 
      (log.home_odds_movement === 'dropping' || log.away_odds_movement === 'dropping') &&
      log.best_value_amount >= minValue
    );
    if (oddsMovementValue.length >= minMatches) {
      const successRate = (oddsMovementValue.filter(log => log.value_bet_success).length / oddsMovementValue.length) * 100;
      if (successRate >= minSuccessRate) {
        patterns.push({
          pattern: 'Oran Düşüyor + Value Var',
          totalMatches: oddsMovementValue.length,
          successRate: successRate,
          avgValue: oddsMovementValue.reduce((sum, log) => sum + (log.best_value_amount || 0), 0) / oddsMovementValue.length,
          bestValueMarket: 'mixed',
          recommendations: [
            `Oran düşüyor + value var → ${successRate.toFixed(1)}% başarı oranı`,
            'Sharp money geldiğinde güvenilir',
            'Form analizi de destekliyorsa çok güvenilir'
          ]
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      patterns: patterns.sort((a, b) => b.successRate - a.successRate),
      totalAnalyzed: settledLogs.length
    });
    
  } catch (error: any) {
    console.error('❌ Error analyzing patterns:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to analyze patterns' },
      { status: 500 }
    );
  }
}

