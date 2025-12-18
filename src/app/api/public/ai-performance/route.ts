// ============================================================================
// PUBLIC AI PERFORMANCE API
// Müşterilere AI model performansını gösteren endpoint
// GERÇEK VERİ - SİMÜLASYON YOK
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    
    const supabase = getSupabaseAdmin();
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date('2024-01-01');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FETCH DATA FROM MULTIPLE TABLES
    // ═══════════════════════════════════════════════════════════════════════

    // 1. Old prediction_records table
    let oldPredictions: any[] = [];
    try {
      const { data, error } = await supabase
        .from('prediction_records')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        oldPredictions = data;
      }
    } catch (e) {
      console.log('prediction_records table not available');
    }

    // 2. New prediction_sessions table (enhanced tracking)
    let newPredictions: any[] = [];
    try {
      const { data, error } = await supabase
        .from('prediction_sessions')
        .select(`
          *,
          ai_model_predictions (*)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        newPredictions = data;
      }
    } catch (e) {
      console.log('prediction_sessions table not available');
    }

    // 3. Professional market predictions
    let proMarketPredictions: any[] = [];
    try {
      const { data, error } = await supabase
        .from('professional_market_predictions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        proMarketPredictions = data;
      }
    } catch (e) {
      console.log('professional_market_predictions table not available');
    }

    // Combine all predictions
    const allPredictions = [
      ...oldPredictions.map(p => ({ ...p, source: 'old' })),
      ...newPredictions.map(p => ({ ...p, source: 'new' })),
    ];

    // Calculate stats
    const modelStats = calculateModelStats(newPredictions, oldPredictions);
    const marketStats = calculateMarketStats(allPredictions, proMarketPredictions);
    const leagueStats = calculateLeagueStats(allPredictions);
    const overall = calculateOverallStats(allPredictions, newPredictions, proMarketPredictions);
    const weeklyTrend = calculateWeeklyTrend(allPredictions);
    const recentPredictions = getRecentPredictions(allPredictions);

    // Summary counts
    const settledOld = oldPredictions.filter(p => p.status === 'won' || p.status === 'lost');
    const settledNew = newPredictions.filter(p => p.is_settled);
    
    const wonCount = 
      oldPredictions.filter(p => p.status === 'won').length +
      newPredictions.filter(p => p.btts_correct || p.over_under_correct || p.match_result_correct).length;
    
    const lostCount =
      oldPredictions.filter(p => p.status === 'lost').length +
      newPredictions.filter(p => p.is_settled && !p.btts_correct && !p.over_under_correct && !p.match_result_correct).length;

    return NextResponse.json({
      models: modelStats,
      markets: marketStats,
      leagues: leagueStats,
      overall,
      weeklyTrend,
      recentPredictions,
      summary: {
        totalPredictions: allPredictions.length + proMarketPredictions.length,
        settledCount: settledOld.length + settledNew.length,
        pendingCount: allPredictions.filter(p => 
          (p.source === 'old' && p.status === 'pending') || 
          (p.source === 'new' && !p.is_settled)
        ).length,
        wonCount,
        lostCount,
      }
    });

  } catch (error: any) {
    console.error('AI Performance API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================================
// CALCULATION HELPERS - ONLY REAL DATA
// ============================================================================

function calculateModelStats(newPredictions: any[], oldPredictions: any[]) {
  const modelMap = new Map<string, { 
    total: number; 
    settled: number;
    correct: number; 
    confidence: number[];
  }>();
  
  // Initialize with known models
  const knownModels = [
    { key: 'claude', name: 'Claude' },
    { key: 'gpt4', name: 'GPT-4' },
    { key: 'gemini', name: 'Gemini' },
    { key: 'perplexity', name: 'Perplexity' },
    { key: 'consensus', name: 'AI Consensus' },
  ];

  // Initialize all models
  knownModels.forEach(m => {
    modelMap.set(m.key, { total: 0, settled: 0, correct: 0, confidence: [] });
  });

  // Process new predictions (ai_model_predictions)
  for (const session of newPredictions) {
    const modelPreds = session.ai_model_predictions || [];
    
    for (const modelPred of modelPreds) {
      const modelName = modelPred.model_name?.toLowerCase() || '';
      
      for (const known of knownModels) {
        if (modelName.includes(known.key) || modelName === known.key) {
          const stats = modelMap.get(known.key)!;
          stats.total++;
          
          if (session.is_settled) {
            stats.settled++;
            // Count correct predictions
            const correctCount = [
              modelPred.btts_correct,
              modelPred.over_under_correct,
              modelPred.match_result_correct
            ].filter(c => c === true).length;
            
            const totalMarkets = [
              modelPred.btts_correct,
              modelPred.over_under_correct,
              modelPred.match_result_correct
            ].filter(c => c !== null).length;
            
            if (totalMarkets > 0 && correctCount > totalMarkets / 2) {
              stats.correct++;
            }
          }
          
          // Average confidence
          const avgConf = [
            modelPred.btts_confidence,
            modelPred.over_under_confidence,
            modelPred.match_result_confidence
          ].filter(c => c !== null && c !== undefined);
          
          if (avgConf.length > 0) {
            stats.confidence.push(avgConf.reduce((a, b) => a + b, 0) / avgConf.length);
          }
          
          break;
        }
      }
    }

    // Count consensus predictions
    if (session.consensus_btts || session.consensus_over_under || session.consensus_match_result) {
      const stats = modelMap.get('consensus')!;
      stats.total++;
      
      if (session.is_settled) {
        stats.settled++;
        const correctCount = [
          session.btts_correct,
          session.over_under_correct,
          session.match_result_correct
        ].filter(c => c === true).length;
        
        if (correctCount >= 2) {
          stats.correct++;
        }
      }
      
      const avgConf = [
        session.consensus_btts_confidence,
        session.consensus_over_under_confidence,
        session.consensus_match_result_confidence
      ].filter(c => c !== null && c !== undefined);
      
      if (avgConf.length > 0) {
        stats.confidence.push(avgConf.reduce((a, b) => a + b, 0) / avgConf.length);
      }
    }
  }

  // Also count from old predictions
  for (const pred of oldPredictions) {
    if (pred.predictions && typeof pred.predictions === 'object') {
      for (const known of knownModels) {
        if (pred.predictions[known.key] || pred.predictions[known.name.toLowerCase()]) {
          const stats = modelMap.get(known.key)!;
          stats.total++;
          if (pred.status === 'won') stats.correct++;
          if (pred.status !== 'pending') stats.settled++;
        }
      }
    }
    
    // Count consensus
    if (pred.consensus) {
      const stats = modelMap.get('consensus')!;
      stats.total++;
      if (pred.status === 'won') stats.correct++;
      if (pred.status !== 'pending') stats.settled++;
    }
  }

  // Convert to array - NO SIMULATION
  const results = knownModels.map(model => {
    const stats = modelMap.get(model.key)!;
    
    // Calculate REAL accuracy only from settled predictions
    const accuracy = stats.settled > 0 
      ? (stats.correct / stats.settled) * 100 
      : 0; // NO FAKE DATA!
    
    // Calculate average confidence
    const avgConfidence = stats.confidence.length > 0
      ? stats.confidence.reduce((a, b) => a + b, 0) / stats.confidence.length
      : 0;
    
    // ROI calculation (only from settled)
    const roi = stats.settled > 0 
      ? ((stats.correct * 1.85 - stats.settled) / stats.settled) * 100 
      : 0;
    
    return {
      model: model.name,
      totalPredictions: stats.total,
      correctPredictions: stats.correct,
      settledPredictions: stats.settled,
      accuracy: Math.round(accuracy * 10) / 10,
      avgConfidence: Math.round(avgConfidence),
      roi: Math.round(roi * 10) / 10,
      hasRealData: stats.settled > 0, // Only true if we have REAL settled data
    };
  }).filter(m => m.totalPredictions > 0);
  
  return results.sort((a, b) => {
    // Sort by settled predictions first, then by accuracy
    if (b.settledPredictions !== a.settledPredictions) {
      return b.settledPredictions - a.settledPredictions;
    }
    return b.accuracy - a.accuracy;
  });
}

function calculateMarketStats(predictions: any[], proMarketPredictions: any[]) {
  const marketMap = new Map<string, { total: number; won: number; lost: number }>();
  
  const marketTypes = [
    { key: 'match_result', label: 'Match Result (1X2)' },
    { key: 'over_under_25', label: 'Over/Under 2.5' },
    { key: 'btts', label: 'Both Teams to Score' },
    { key: 'over_under_15', label: 'Over/Under 1.5' },
    { key: 'fh_result', label: 'First Half Result' },
    { key: 'asian_hc', label: 'Asian Handicap' },
  ];

  // Initialize markets
  marketTypes.forEach(m => {
    marketMap.set(m.key, { total: 0, won: 0, lost: 0 });
  });

  // Count from professional market predictions
  for (const pred of proMarketPredictions) {
    if (pred.is_settled) {
      // Match Result
      if (pred.match_result_correct !== null) {
        const stats = marketMap.get('match_result')!;
        stats.total++;
        if (pred.match_result_correct) stats.won++;
        else stats.lost++;
      }
      
      // Over/Under 2.5
      if (pred.over_under_25_correct !== null) {
        const stats = marketMap.get('over_under_25')!;
        stats.total++;
        if (pred.over_under_25_correct) stats.won++;
        else stats.lost++;
      }
      
      // BTTS
      if (pred.btts_correct !== null) {
        const stats = marketMap.get('btts')!;
        stats.total++;
        if (pred.btts_correct) stats.won++;
        else stats.lost++;
      }
      
      // Over/Under 1.5
      if (pred.over_under_15_correct !== null) {
        const stats = marketMap.get('over_under_15')!;
        stats.total++;
        if (pred.over_under_15_correct) stats.won++;
        else stats.lost++;
      }
      
      // First Half
      if (pred.fh_result_correct !== null) {
        const stats = marketMap.get('fh_result')!;
        stats.total++;
        if (pred.fh_result_correct) stats.won++;
        else stats.lost++;
      }
      
      // Asian Handicap
      if (pred.asian_hc_correct !== null) {
        const stats = marketMap.get('asian_hc')!;
        stats.total++;
        if (pred.asian_hc_correct) stats.won++;
        else stats.lost++;
      }
    }
  }

  // Also count from prediction_sessions
  for (const pred of predictions) {
    if (pred.source === 'new' && pred.is_settled) {
      if (pred.match_result_correct !== null) {
        const stats = marketMap.get('match_result')!;
        stats.total++;
        if (pred.match_result_correct) stats.won++;
        else stats.lost++;
      }
      if (pred.over_under_correct !== null) {
        const stats = marketMap.get('over_under_25')!;
        stats.total++;
        if (pred.over_under_correct) stats.won++;
        else stats.lost++;
      }
      if (pred.btts_correct !== null) {
        const stats = marketMap.get('btts')!;
        stats.total++;
        if (pred.btts_correct) stats.won++;
        else stats.lost++;
      }
    }
  }

  return marketTypes
    .map(m => {
      const stats = marketMap.get(m.key)!;
      const settled = stats.won + stats.lost;
      const accuracy = settled > 0 ? (stats.won / settled) * 100 : 0;
      
      return {
        market: m.label,
        total: stats.total,
        correct: stats.won,
        accuracy: Math.round(accuracy * 10) / 10,
      };
    })
    .filter(m => m.total > 0)
    .sort((a, b) => b.accuracy - a.accuracy);
}

function calculateLeagueStats(predictions: any[]) {
  const leagueMap = new Map<string, { total: number; won: number; lost: number }>();
  
  for (const pred of predictions) {
    const league = pred.league || 'Unknown';
    if (league === 'Unknown') continue;
    
    if (!leagueMap.has(league)) {
      leagueMap.set(league, { total: 0, won: 0, lost: 0 });
    }
    
    const stats = leagueMap.get(league)!;
    stats.total++;
    
    // Check status based on source
    if (pred.source === 'old') {
      if (pred.status === 'won') stats.won++;
      if (pred.status === 'lost') stats.lost++;
    } else if (pred.source === 'new' && pred.is_settled) {
      const correctCount = [
        pred.btts_correct,
        pred.over_under_correct,
        pred.match_result_correct
      ].filter(c => c === true).length;
      
      if (correctCount >= 2) stats.won++;
      else stats.lost++;
    }
  }
  
  return Array.from(leagueMap.entries())
    .map(([league, stats]) => {
      const settled = stats.won + stats.lost;
      const accuracy = settled > 0 ? (stats.won / settled) * 100 : 0;
      
      return {
        league,
        total: stats.total,
        correct: stats.won,
        accuracy: Math.round(accuracy * 10) / 10,
      };
    })
    .filter(l => l.total >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
}

function calculateOverallStats(allPredictions: any[], newPredictions: any[], proMarketPredictions: any[]) {
  const totalPredictions = allPredictions.length + proMarketPredictions.length;
  
  // Count settled from all sources
  let totalSettled = 0;
  let totalCorrect = 0;
  
  // From old predictions
  for (const pred of allPredictions) {
    if (pred.source === 'old') {
      if (pred.status === 'won' || pred.status === 'lost') {
        totalSettled++;
        if (pred.status === 'won') totalCorrect++;
      }
    } else if (pred.source === 'new' && pred.is_settled) {
      totalSettled++;
      const correctCount = [
        pred.btts_correct,
        pred.over_under_correct,
        pred.match_result_correct
      ].filter(c => c === true).length;
      if (correctCount >= 2) totalCorrect++;
    }
  }
  
  // From professional markets
  for (const pred of proMarketPredictions) {
    if (pred.is_settled) {
      totalSettled++;
      // Count correct markets
      const markets = [
        pred.match_result_correct,
        pred.over_under_25_correct,
        pred.btts_correct
      ].filter(c => c !== null);
      
      const correct = markets.filter(c => c === true).length;
      if (correct > markets.length / 2) totalCorrect++;
    }
  }
  
  const overallAccuracy = totalSettled > 0 
    ? (totalCorrect / totalSettled) * 100 
    : 0;
  
  // Calculate average confidence
  const confidences: number[] = [];
  for (const pred of newPredictions) {
    const avgConf = [
      pred.consensus_btts_confidence,
      pred.consensus_over_under_confidence,
      pred.consensus_match_result_confidence
    ].filter(c => c !== null && c !== undefined);
    
    if (avgConf.length > 0) {
      confidences.push(avgConf.reduce((a, b) => a + b, 0) / avgConf.length);
    }
  }
  
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  
  return {
    totalPredictions,
    totalCorrect,
    totalSettled,
    pendingCount: totalPredictions - totalSettled,
    overallAccuracy: Math.round(overallAccuracy * 10) / 10,
    avgConfidence: Math.round(avgConfidence),
    lastUpdated: new Date().toISOString(),
  };
}

function calculateWeeklyTrend(predictions: any[]) {
  const weekMap = new Map<string, { total: number; won: number; lost: number }>();
  
  for (const pred of predictions) {
    const date = new Date(pred.created_at);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { total: 0, won: 0, lost: 0 });
    }
    
    const stats = weekMap.get(weekKey)!;
    stats.total++;
    
    if (pred.source === 'old') {
      if (pred.status === 'won') stats.won++;
      if (pred.status === 'lost') stats.lost++;
    } else if (pred.source === 'new' && pred.is_settled) {
      const correctCount = [
        pred.btts_correct,
        pred.over_under_correct,
        pred.match_result_correct
      ].filter(c => c === true).length;
      
      if (correctCount >= 2) stats.won++;
      else stats.lost++;
    }
  }
  
  return Array.from(weekMap.entries())
    .map(([week, stats]) => {
      const settled = stats.won + stats.lost;
      const accuracy = settled > 0 ? (stats.won / settled) * 100 : 0;
      
      return {
        week,
        total: stats.total,
        accuracy: Math.round(accuracy * 10) / 10,
      };
    })
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8);
}

function getRecentPredictions(predictions: any[]) {
  return predictions
    .slice(0, 20)
    .map(p => {
      let status: 'won' | 'lost' | 'pending' = 'pending';
      
      if (p.source === 'old') {
        status = p.status || 'pending';
      } else if (p.source === 'new') {
        if (p.is_settled) {
          const correctCount = [
            p.btts_correct,
            p.over_under_correct,
            p.match_result_correct
          ].filter(c => c === true).length;
          
          status = correctCount >= 2 ? 'won' : 'lost';
        }
      }
      
      return {
        id: p.id,
        match: `${p.home_team} vs ${p.away_team}`,
        league: p.league || 'Unknown',
        status,
        date: p.match_date || p.created_at,
        analysisType: p.analysis_type || p.prediction_source || 'ai_agents',
      };
    });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
