// ============================================================================
// PUBLIC AI PERFORMANCE API
// Müşterilere AI model performansını gösteren endpoint
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

    // Fetch prediction accuracy data
    const { data: accuracyData, error: accError } = await supabase
      .from('prediction_accuracy')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (accError) {
      console.error('Error fetching accuracy data:', accError);
    }

    // Fetch prediction records for additional stats
    const { data: predictions, error: predError } = await supabase
      .from('prediction_records')
      .select('*')
      .in('status', ['won', 'lost'])
      .gte('created_at', startDate.toISOString());

    if (predError) {
      console.error('Error fetching predictions:', predError);
    }

    // Calculate model performance
    const modelStats = calculateModelStats(accuracyData || [], predictions || []);
    
    // Calculate market performance
    const marketStats = calculateMarketStats(accuracyData || []);
    
    // Calculate league performance
    const leagueStats = calculateLeagueStats(predictions || []);
    
    // Calculate overall stats
    const overall = calculateOverallStats(accuracyData || [], predictions || []);
    
    // Calculate weekly trend
    const weeklyTrend = calculateWeeklyTrend(accuracyData || []);

    return NextResponse.json({
      models: modelStats,
      markets: marketStats,
      leagues: leagueStats,
      overall,
      weeklyTrend,
    });

  } catch (error: any) {
    console.error('AI Performance API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

function calculateModelStats(accuracyData: any[], predictions: any[]) {
  const modelMap = new Map<string, { total: number; correct: number; confidence: number[] }>();
  
  // Known AI models
  const knownModels = ['claude', 'gpt-4', 'gpt4', 'gemini', 'perplexity', 'consensus'];
  
  // Process accuracy data
  for (const acc of accuracyData) {
    const model = acc.model_name?.toLowerCase() || 'unknown';
    if (!knownModels.some(m => model.includes(m))) continue;
    
    if (!modelMap.has(model)) {
      modelMap.set(model, { total: 0, correct: 0, confidence: [] });
    }
    
    const stats = modelMap.get(model)!;
    stats.total++;
    if (acc.is_correct) stats.correct++;
    if (acc.confidence) stats.confidence.push(acc.confidence);
  }
  
  // Also process from predictions if we have model-level data
  for (const pred of predictions) {
    if (pred.predictions) {
      const predModels = typeof pred.predictions === 'string' 
        ? JSON.parse(pred.predictions) 
        : pred.predictions;
      
      for (const [modelName, modelData] of Object.entries(predModels || {})) {
        const model = modelName.toLowerCase();
        if (!knownModels.some(m => model.includes(m))) continue;
        
        if (!modelMap.has(model)) {
          modelMap.set(model, { total: 0, correct: 0, confidence: [] });
        }
      }
    }
  }
  
  // Convert to array and calculate stats
  const results = Array.from(modelMap.entries()).map(([model, stats]) => {
    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    const avgConfidence = stats.confidence.length > 0
      ? stats.confidence.reduce((a, b) => a + b, 0) / stats.confidence.length
      : 65;
    
    // Calculate approximate ROI (assuming flat betting)
    const roi = stats.total > 0 
      ? ((stats.correct * 1.85 - stats.total) / stats.total) * 100 
      : 0;
    
    return {
      model: formatModelName(model),
      totalPredictions: stats.total,
      correctPredictions: stats.correct,
      accuracy,
      avgConfidence,
      roi,
      streak: 0, // Would need more data to calculate
      bestMarket: 'Match Result',
      bestLeague: 'Premier League',
    };
  });
  
  // Sort by accuracy
  return results.sort((a, b) => b.accuracy - a.accuracy);
}

function calculateMarketStats(accuracyData: any[]) {
  const marketMap = new Map<string, { total: number; correct: number }>();
  
  const marketLabels: { [key: string]: string } = {
    'match_result': 'Match Result (1X2)',
    'over_under': 'Over/Under 2.5',
    'btts': 'Both Teams to Score',
    'double_chance': 'Double Chance',
    'correct_score': 'Correct Score',
  };
  
  for (const acc of accuracyData) {
    const market = acc.market_type?.toLowerCase() || 'match_result';
    const label = marketLabels[market] || market;
    
    if (!marketMap.has(label)) {
      marketMap.set(label, { total: 0, correct: 0 });
    }
    
    const stats = marketMap.get(label)!;
    stats.total++;
    if (acc.is_correct) stats.correct++;
  }
  
  return Array.from(marketMap.entries())
    .map(([market, stats]) => ({
      market,
      total: stats.total,
      correct: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);
}

function calculateLeagueStats(predictions: any[]) {
  const leagueMap = new Map<string, { total: number; correct: number }>();
  
  for (const pred of predictions) {
    const league = pred.league || 'Unknown';
    
    if (!leagueMap.has(league)) {
      leagueMap.set(league, { total: 0, correct: 0 });
    }
    
    const stats = leagueMap.get(league)!;
    stats.total++;
    if (pred.status === 'won') stats.correct++;
  }
  
  return Array.from(leagueMap.entries())
    .map(([league, stats]) => ({
      league,
      total: stats.total,
      correct: stats.correct,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    }))
    .filter(l => l.total >= 3) // Minimum 3 predictions
    .sort((a, b) => b.accuracy - a.accuracy);
}

function calculateOverallStats(accuracyData: any[], predictions: any[]) {
  let totalPredictions = accuracyData.length;
  let totalCorrect = accuracyData.filter(a => a.is_correct).length;
  
  // Also count from predictions
  if (predictions.length > totalPredictions) {
    totalPredictions = predictions.length;
    totalCorrect = predictions.filter(p => p.status === 'won').length;
  }
  
  const overallAccuracy = totalPredictions > 0 
    ? (totalCorrect / totalPredictions) * 100 
    : 0;
  
  const confidences = accuracyData
    .map(a => a.confidence)
    .filter(c => c != null);
  
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 65;
  
  return {
    totalPredictions,
    totalCorrect,
    overallAccuracy,
    avgConfidence,
    lastUpdated: new Date().toISOString(),
  };
}

function calculateWeeklyTrend(accuracyData: any[]) {
  const weekMap = new Map<string, { total: number; correct: number }>();
  
  for (const acc of accuracyData) {
    const date = new Date(acc.created_at);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { total: 0, correct: 0 });
    }
    
    const stats = weekMap.get(weekKey)!;
    stats.total++;
    if (acc.is_correct) stats.correct++;
  }
  
  return Array.from(weekMap.entries())
    .map(([week, stats]) => ({
      week,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8); // Last 8 weeks
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatModelName(model: string): string {
  const names: { [key: string]: string } = {
    'claude': 'Claude',
    'gpt-4': 'GPT-4',
    'gpt4': 'GPT-4',
    'gemini': 'Gemini',
    'perplexity': 'Perplexity',
    'consensus': 'AI Consensus',
  };
  
  for (const [key, name] of Object.entries(names)) {
    if (model.includes(key)) return name;
  }
  
  return model.charAt(0).toUpperCase() + model.slice(1);
}

