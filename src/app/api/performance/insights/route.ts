// ============================================================================
// API: Get Statistical Insights from Settled Matches
// Analyzes correlations between predictions and actual outcomes
// GET /api/performance/insights
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ConfidenceBucket {
  range: string;
  min: number;
  max: number;
  total: number;
  correct: number;
  accuracy: number;
}

interface PredictionCorrelation {
  prediction: string;
  total: number;
  actualOutcomes: {
    outcome: string;
    count: number;
    percentage: number;
  }[];
  accuracy: number;
}

interface MarketInsight {
  market: string;
  overallAccuracy: number;
  totalPredictions: number;
  byConfidence: ConfidenceBucket[];
  correlations: PredictionCorrelation[];
  paradoxes: string[]; // Unexpected patterns
}

interface BestBetInsight {
  market: string;
  selection: string;
  confidenceRange: string;
  total: number;
  correct: number;
  accuracy: number;
}

export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    console.log('🔬 GET /api/performance/insights called at', timestamp);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all settled matches with full data
    const { data, error } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('is_settled', true);
    
    if (error) {
      console.error('❌ Fetch error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    const settled = data || [];
    
    if (settled.length < 5) {
      return NextResponse.json({
        success: true,
        message: 'Yeterli veri yok - En az 5 sonuçlanmış maç gerekli',
        insights: null,
        timestamp
      });
    }
    
    console.log(`📊 Analyzing ${settled.length} settled matches...`);
    
    // ============================================================================
    // 1. MATCH RESULT INSIGHTS
    // ============================================================================
    const mrInsight = analyzeMarket(settled, 'match_result', {
      predictionField: 'match_result_prediction',
      correctField: 'match_result_correct',
      confidenceField: 'match_result_confidence',
      actualField: 'actual_match_result',
      normalize: normalizeMR
    });
    
    // ============================================================================
    // 2. OVER/UNDER INSIGHTS
    // ============================================================================
    const ouInsight = analyzeMarket(settled, 'over_under', {
      predictionField: 'over_under_prediction',
      correctField: 'over_under_correct',
      confidenceField: 'over_under_confidence',
      actualField: 'actual_total_goals',
      normalize: normalizeOU,
      deriveActual: (row: any) => row.actual_total_goals > 2.5 ? 'over' : 'under'
    });
    
    // ============================================================================
    // 3. BTTS INSIGHTS
    // ============================================================================
    const bttsInsight = analyzeMarket(settled, 'btts', {
      predictionField: 'btts_prediction',
      correctField: 'btts_correct',
      confidenceField: 'btts_confidence',
      actualField: 'actual_btts',
      normalize: normalizeBTTS,
      deriveActual: (row: any) => row.actual_btts ? 'yes' : 'no'
    });
    
    // ============================================================================
    // 4. BEST BET INSIGHTS
    // ============================================================================
    const bestBetInsights = analyzeBestBets(settled);
    
    // ============================================================================
    // 5. CROSS-MARKET CORRELATIONS (Paradoklar)
    // ============================================================================
    const crossCorrelations = analyzeCrossCorrelations(settled);
    
    // ============================================================================
    // 6. CONFIDENCE CALIBRATION
    // ============================================================================
    const confidenceCalibration = analyzeConfidenceCalibration(settled);
    
    // ============================================================================
    // 7. KEY FINDINGS
    // ============================================================================
    const keyFindings = generateKeyFindings(mrInsight, ouInsight, bttsInsight, bestBetInsights, crossCorrelations);
    
    const response = NextResponse.json({
      success: true,
      totalSettled: settled.length,
      insights: {
        matchResult: mrInsight,
        overUnder: ouInsight,
        btts: bttsInsight,
        bestBets: bestBetInsights,
        crossCorrelations,
        confidenceCalibration,
        keyFindings
      },
      timestamp
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return response;
    
  } catch (error: any) {
    console.error('❌ Insights API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeMR(val: string | null): string {
  if (!val) return 'unknown';
  const v = val.toLowerCase().trim();
  if (v === '1' || v === 'home' || v === 'ev sahibi') return 'home';
  if (v === '2' || v === 'away' || v === 'deplasman') return 'away';
  if (v === 'x' || v === 'draw' || v === 'beraberlik') return 'draw';
  return v;
}

function normalizeOU(val: string | null): string {
  if (!val) return 'unknown';
  const v = val.toLowerCase().trim();
  if (v.includes('over') || v.includes('üst')) return 'over';
  if (v.includes('under') || v.includes('alt')) return 'under';
  return v;
}

function normalizeBTTS(val: string | null): string {
  if (!val) return 'unknown';
  const v = val.toLowerCase().trim();
  if (v === 'yes' || v === 'evet' || v === 'var') return 'yes';
  if (v === 'no' || v === 'hayır' || v === 'yok') return 'no';
  return v;
}

interface AnalyzeOptions {
  predictionField: string;
  correctField: string;
  confidenceField: string;
  actualField: string;
  normalize: (val: string | null) => string;
  deriveActual?: (row: any) => string;
}

function analyzeMarket(data: any[], marketName: string, options: AnalyzeOptions): MarketInsight {
  const { predictionField, correctField, confidenceField, normalize, deriveActual } = options;
  
  // Filter valid predictions
  const validData = data.filter(r => r[predictionField] && r[correctField] !== null);
  
  // Overall accuracy
  const correct = validData.filter(r => r[correctField] === true).length;
  const overallAccuracy = validData.length > 0 ? Math.round((correct / validData.length) * 100) : 0;
  
  // By confidence buckets
  const buckets: ConfidenceBucket[] = [
    { range: '50-59%', min: 50, max: 59, total: 0, correct: 0, accuracy: 0 },
    { range: '60-69%', min: 60, max: 69, total: 0, correct: 0, accuracy: 0 },
    { range: '70-79%', min: 70, max: 79, total: 0, correct: 0, accuracy: 0 },
    { range: '80%+', min: 80, max: 100, total: 0, correct: 0, accuracy: 0 },
  ];
  
  validData.forEach(r => {
    const conf = r[confidenceField] || 50;
    const bucket = buckets.find(b => conf >= b.min && conf <= b.max);
    if (bucket) {
      bucket.total++;
      if (r[correctField] === true) bucket.correct++;
    }
  });
  
  buckets.forEach(b => {
    b.accuracy = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
  });
  
  // Correlations: What happens when we predict X?
  const predictionGroups = new Map<string, { total: number; outcomes: Map<string, number> }>();
  
  validData.forEach(r => {
    const pred = normalize(r[predictionField]);
    let actual: string;
    
    if (deriveActual) {
      actual = deriveActual(r);
    } else {
      actual = normalize(r[options.actualField]);
    }
    
    if (!predictionGroups.has(pred)) {
      predictionGroups.set(pred, { total: 0, outcomes: new Map() });
    }
    
    const group = predictionGroups.get(pred)!;
    group.total++;
    group.outcomes.set(actual, (group.outcomes.get(actual) || 0) + 1);
  });
  
  const correlations: PredictionCorrelation[] = [];
  const paradoxes: string[] = [];
  
  predictionGroups.forEach((group, pred) => {
    const outcomes = Array.from(group.outcomes.entries()).map(([outcome, count]) => ({
      outcome,
      count,
      percentage: Math.round((count / group.total) * 100)
    })).sort((a, b) => b.percentage - a.percentage);
    
    const correctOutcome = outcomes.find(o => o.outcome === pred);
    const accuracy = correctOutcome ? correctOutcome.percentage : 0;
    
    correlations.push({
      prediction: pred,
      total: group.total,
      actualOutcomes: outcomes,
      accuracy
    });
    
    // Detect paradoxes
    if (outcomes[0] && outcomes[0].outcome !== pred && outcomes[0].percentage > 50) {
      paradoxes.push(`${pred.toUpperCase()} tahmin edildiğinde %${outcomes[0].percentage} ${outcomes[0].outcome.toUpperCase()} oluyor!`);
    }
  });
  
  return {
    market: marketName,
    overallAccuracy,
    totalPredictions: validData.length,
    byConfidence: buckets.filter(b => b.total > 0),
    correlations,
    paradoxes
  };
}

function analyzeBestBets(data: any[]): BestBetInsight[] {
  const insights: BestBetInsight[] = [];
  
  // Group by market + selection + confidence range
  const groups = new Map<string, { total: number; correct: number }>();
  
  data.forEach(r => {
    if (!r.best_bet_market || !r.best_bet_selection) return;
    
    const market = r.best_bet_market;
    const selection = r.best_bet_selection;
    const conf = r.best_bet_confidence || 50;
    
    // Determine confidence range
    let confRange: string;
    if (conf >= 70) confRange = '70%+';
    else if (conf >= 60) confRange = '60-69%';
    else confRange = '50-59%';
    
    const key = `${market}|${selection}|${confRange}`;
    
    if (!groups.has(key)) {
      groups.set(key, { total: 0, correct: 0 });
    }
    
    const group = groups.get(key)!;
    group.total++;
    
    // Check if best bet was correct
    const isCorrect = checkBestBetCorrect(r, market, selection);
    if (isCorrect) group.correct++;
  });
  
  groups.forEach((group, key) => {
    const [market, selection, confRange] = key.split('|');
    if (group.total >= 2) { // Only include if at least 2 samples
      insights.push({
        market,
        selection,
        confidenceRange: confRange,
        total: group.total,
        correct: group.correct,
        accuracy: Math.round((group.correct / group.total) * 100)
      });
    }
  });
  
  return insights.sort((a, b) => b.total - a.total);
}

function checkBestBetCorrect(row: any, market: string, selection: string): boolean {
  const marketLower = market.toLowerCase();
  const selectionLower = selection.toLowerCase();
  
  if (marketLower.includes('over') || marketLower.includes('under') || marketLower.includes('2.5')) {
    const actualGoals = row.actual_total_goals;
    if (actualGoals === null || actualGoals === undefined) return false;
    const actualOU = actualGoals > 2.5 ? 'over' : 'under';
    return selectionLower.includes(actualOU);
  }
  
  if (marketLower.includes('btts') || marketLower.includes('gol')) {
    const actualBtts = row.actual_btts;
    if (actualBtts === null || actualBtts === undefined) return false;
    const actual = actualBtts ? 'yes' : 'no';
    return (selectionLower.includes('yes') || selectionLower.includes('evet')) ? actual === 'yes' :
           (selectionLower.includes('no') || selectionLower.includes('hayır')) ? actual === 'no' : false;
  }
  
  if (marketLower.includes('result') || marketLower.includes('sonuç') || marketLower.includes('1x2')) {
    const actualMR = normalizeMR(row.actual_match_result);
    const predMR = normalizeMR(selectionLower);
    return actualMR === predMR;
  }
  
  return false;
}

function analyzeCrossCorrelations(data: any[]): { finding: string; count: number; percentage: number }[] {
  const correlations: { finding: string; count: number; percentage: number }[] = [];
  
  // Under + BTTS Yes paradox
  const underBttsYes = data.filter(r => 
    normalizeOU(r.over_under_prediction) === 'under' && 
    normalizeBTTS(r.btts_prediction) === 'yes'
  );
  
  if (underBttsYes.length >= 3) {
    const actualOver = underBttsYes.filter(r => r.actual_total_goals > 2.5).length;
    if (actualOver > underBttsYes.length * 0.4) {
      correlations.push({
        finding: `Under + BTTS Yes tahminlerinde %${Math.round((actualOver / underBttsYes.length) * 100)} Over 2.5 oluyor`,
        count: underBttsYes.length,
        percentage: Math.round((actualOver / underBttsYes.length) * 100)
      });
    }
  }
  
  // High confidence but wrong
  const highConfWrong = data.filter(r => 
    r.overall_confidence >= 70 && 
    r.match_result_correct === false
  );
  
  if (highConfWrong.length >= 2) {
    correlations.push({
      finding: `%70+ güvenle yapılan ${highConfWrong.length} tahmin yanlış çıktı`,
      count: highConfWrong.length,
      percentage: Math.round((highConfWrong.length / data.filter(r => r.overall_confidence >= 70).length) * 100)
    });
  }
  
  // Draw predictions accuracy
  const drawPreds = data.filter(r => normalizeMR(r.match_result_prediction) === 'draw');
  if (drawPreds.length >= 3) {
    const drawCorrect = drawPreds.filter(r => r.match_result_correct === true).length;
    correlations.push({
      finding: `Beraberlik tahminlerinin %${Math.round((drawCorrect / drawPreds.length) * 100)}'i doğru`,
      count: drawPreds.length,
      percentage: Math.round((drawCorrect / drawPreds.length) * 100)
    });
  }
  
  return correlations;
}

function analyzeConfidenceCalibration(data: any[]): { level: string; expected: number; actual: number; calibration: string }[] {
  const levels = [
    { level: '50-59%', min: 50, max: 59, expected: 55 },
    { level: '60-69%', min: 60, max: 69, expected: 65 },
    { level: '70-79%', min: 70, max: 79, expected: 75 },
    { level: '80%+', min: 80, max: 100, expected: 85 },
  ];
  
  return levels.map(l => {
    const matches = data.filter(r => {
      const conf = r.overall_confidence || 50;
      return conf >= l.min && conf <= l.max;
    });
    
    if (matches.length < 3) {
      return { level: l.level, expected: l.expected, actual: 0, calibration: 'Yetersiz veri' };
    }
    
    // Average accuracy across all predictions
    let correct = 0;
    let total = 0;
    
    matches.forEach(m => {
      if (m.match_result_correct !== null) { total++; if (m.match_result_correct) correct++; }
      if (m.over_under_correct !== null) { total++; if (m.over_under_correct) correct++; }
      if (m.btts_correct !== null) { total++; if (m.btts_correct) correct++; }
    });
    
    const actual = total > 0 ? Math.round((correct / total) * 100) : 0;
    const diff = actual - l.expected;
    
    let calibration: string;
    if (Math.abs(diff) <= 5) calibration = '✅ İyi kalibre';
    else if (diff > 5) calibration = '🔥 Beklenenden iyi';
    else calibration = '⚠️ Aşırı güvenli';
    
    return { level: l.level, expected: l.expected, actual, calibration };
  });
}

function generateKeyFindings(
  mr: MarketInsight, 
  ou: MarketInsight, 
  btts: MarketInsight,
  bestBets: BestBetInsight[],
  crossCorrelations: { finding: string; count: number; percentage: number }[]
): string[] {
  const findings: string[] = [];
  
  // Best performing market
  const markets = [
    { name: 'Maç Sonucu', accuracy: mr.overallAccuracy },
    { name: 'Alt/Üst 2.5', accuracy: ou.overallAccuracy },
    { name: 'KG Var', accuracy: btts.overallAccuracy }
  ].sort((a, b) => b.accuracy - a.accuracy);
  
  findings.push(`🏆 En başarılı market: ${markets[0].name} (%${markets[0].accuracy})`);
  findings.push(`📉 En zayıf market: ${markets[2].name} (%${markets[2].accuracy})`);
  
  // Paradoxes
  [...mr.paradoxes, ...ou.paradoxes, ...btts.paradoxes].forEach(p => {
    findings.push(`⚠️ Paradoks: ${p}`);
  });
  
  // Best bet insights
  const goodBestBets = bestBets.filter(b => b.accuracy >= 70 && b.total >= 3);
  goodBestBets.forEach(b => {
    findings.push(`🎯 ${b.market} → ${b.selection} (${b.confidenceRange}): %${b.accuracy} başarı (${b.total} maç)`);
  });
  
  // Cross correlations
  crossCorrelations.forEach(c => {
    findings.push(`📊 ${c.finding}`);
  });
  
  return findings;
}

