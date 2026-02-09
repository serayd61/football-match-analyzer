// ============================================================================
// API: Historical Accuracy by Confidence Range
// GET /api/performance/historical-accuracy
// POST /api/performance/historical-accuracy (batch)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HistoricalAccuracyResult {
  market: string;
  prediction: string;
  confidenceRange: string;
  confRangeStart: number;
  confRangeEnd: number;
  totalMatches: number;
  correctMatches: number;
  accuracy: number;
  hasEnoughData: boolean;
}

// Normalize prediction values for matching
function normalizePrediction(market: string, prediction: string): string {
  if (!prediction) return '';
  const p = prediction.toLowerCase().trim();
  
  if (market === 'mr') {
    if (p === '1' || p === 'home' || p.includes('home')) return '1';
    if (p === '2' || p === 'away' || p.includes('away')) return '2';
    if (p === 'x' || p === 'draw' || p.includes('draw')) return 'X';
  }
  
  if (market === 'ou') {
    if (p.includes('over') || p.includes('üst') || p === 'o') return 'Over';
    if (p.includes('under') || p.includes('alt') || p === 'u') return 'Under';
  }
  
  if (market === 'btts') {
    if (p === 'yes' || p === 'evet' || p === 'var' || p === 'y') return 'Yes';
    if (p === 'no' || p === 'hayır' || p === 'yok' || p === 'n') return 'No';
  }
  
  return prediction;
}

// Calculate confidence range (5-point buckets)
function getConfidenceRange(confidence: number): { start: number; end: number } {
  const start = Math.floor(confidence / 5) * 5;
  return { start, end: start + 4 };
}

// GET - Single prediction historical accuracy
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get('market'); // 'mr', 'ou', 'btts'
    const prediction = searchParams.get('prediction'); // '1', '2', 'X', 'Over', 'Under', 'Yes', 'No'
    const confidence = parseInt(searchParams.get('confidence') || '0');

    if (!market || !prediction || !confidence) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: market, prediction, confidence' 
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const normalizedPrediction = normalizePrediction(market, prediction);
    const { start: confStart, end: confEnd } = getConfidenceRange(confidence);

    console.log('📊 Historical Accuracy Request:', { market, prediction, normalizedPrediction, confidence, confStart, confEnd });

    // Try materialized view first
    const { data: mvData, error: mvError } = await supabase
      .from('mv_confidence_accuracy')
      .select('*')
      .eq('market', market)
      .eq('conf_range_start', confStart)
      .eq('conf_range_end', confEnd);

    console.log('📊 MV Query Result:', { mvData, mvError: mvError?.message });

    // Find matching prediction (case-insensitive)
    if (!mvError && mvData && mvData.length > 0) {
      const match = mvData.find(row => 
        row.prediction?.toLowerCase() === normalizedPrediction.toLowerCase()
      );
      
      if (match) {
        console.log('✅ Found in MV:', match);
        return NextResponse.json({
          success: true,
          data: {
            market: match.market,
            prediction: match.prediction,
            confidenceRange: `${match.conf_range_start}-${match.conf_range_end}`,
            confRangeStart: match.conf_range_start,
            confRangeEnd: match.conf_range_end,
            totalMatches: match.total_matches,
            correctMatches: match.correct,
            accuracy: match.accuracy,
            hasEnoughData: match.total_matches >= 3
          }
        });
      }
      console.log('⚠️ Prediction not found in MV results. Available:', mvData.map(r => r.prediction));
    }

    // Fallback: Query unified_analysis directly
    console.log('⚠️ Using fallback query from unified_analysis');
    
    // Select relevant columns based on market
    const selectColumns = 'match_result_prediction, match_result_confidence, match_result_correct, over_under_prediction, over_under_confidence, over_under_correct, btts_prediction, btts_confidence, btts_correct';

    let query = supabase
      .from('unified_analysis')
      .select(selectColumns)
      .eq('is_settled', true);

    // Add market-specific filters
    if (market === 'mr') {
      query = query
        .gte('match_result_confidence', confStart)
        .lte('match_result_confidence', confEnd + 0.99)
        .not('match_result_prediction', 'is', null);
    } else if (market === 'ou') {
      query = query
        .gte('over_under_confidence', confStart)
        .lte('over_under_confidence', confEnd + 0.99)
        .not('over_under_prediction', 'is', null);
    } else if (market === 'btts') {
      query = query
        .gte('btts_confidence', confStart)
        .lte('btts_confidence', confEnd + 0.99)
        .not('btts_prediction', 'is', null);
    }

    const { data: fallbackData, error: fallbackError } = await query;

    console.log('📊 Fallback query result:', { 
      count: fallbackData?.length || 0, 
      error: fallbackError?.message
    });

    if (fallbackError) {
      return NextResponse.json({ success: false, error: fallbackError.message }, { status: 500 });
    }

    // Filter by prediction and calculate accuracy
    const filtered = (fallbackData || []).filter((row: any) => {
      let rowPrediction = '';
      if (market === 'mr') rowPrediction = normalizePrediction('mr', row.match_result_prediction);
      else if (market === 'ou') rowPrediction = normalizePrediction('ou', row.over_under_prediction);
      else if (market === 'btts') rowPrediction = normalizePrediction('btts', row.btts_prediction);
      
      return rowPrediction.toLowerCase() === normalizedPrediction.toLowerCase();
    });

    console.log('📊 Filtered results:', { 
      total: fallbackData?.length || 0, 
      filtered: filtered.length,
      normalizedPrediction 
    });

    const total = filtered.length;
    let correct = 0;

    for (const row of filtered) {
      if (market === 'mr' && row.match_result_correct === true) correct++;
      else if (market === 'ou' && row.over_under_correct === true) correct++;
      else if (market === 'btts' && row.btts_correct === true) correct++;
    }

    const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

    return NextResponse.json({
      success: true,
      data: {
        market,
        prediction: normalizedPrediction,
        confidenceRange: `${confStart}-${confEnd}`,
        confRangeStart: confStart,
        confRangeEnd: confEnd,
        totalMatches: total,
        correctMatches: correct,
        accuracy,
        hasEnoughData: total >= 1 // En az 1 maç yeterli (test için)
      }
    });

  } catch (error: any) {
    console.error('❌ Historical accuracy API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Batch historical accuracy for multiple predictions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { predictions } = body;

    if (!predictions || !Array.isArray(predictions)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing predictions array in request body' 
      }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get all data from materialized view
    const { data: mvData, error: mvError } = await supabase
      .from('mv_confidence_accuracy')
      .select('*');

    const results: HistoricalAccuracyResult[] = [];

    for (const pred of predictions) {
      const { market, prediction, confidence } = pred;
      
      if (!market || !prediction || confidence === undefined) {
        results.push({
          market: market || '',
          prediction: prediction || '',
          confidenceRange: '0-0',
          confRangeStart: 0,
          confRangeEnd: 0,
          totalMatches: 0,
          correctMatches: 0,
          accuracy: 0,
          hasEnoughData: false
        });
        continue;
      }

      const normalizedPrediction = normalizePrediction(market, prediction);
      const { start: confStart, end: confEnd } = getConfidenceRange(confidence);

      // Find in materialized view data
      if (!mvError && mvData) {
        const match = mvData.find(row => 
          row.market === market &&
          row.conf_range_start === confStart &&
          row.conf_range_end === confEnd &&
          row.prediction?.toLowerCase() === normalizedPrediction.toLowerCase()
        );

        if (match) {
          results.push({
            market: match.market,
            prediction: match.prediction,
            confidenceRange: `${match.conf_range_start}-${match.conf_range_end}`,
            confRangeStart: match.conf_range_start,
            confRangeEnd: match.conf_range_end,
            totalMatches: match.total_matches,
            correctMatches: match.correct,
            accuracy: match.accuracy,
            hasEnoughData: match.total_matches >= 3
          });
          continue;
        }
      }

      // Fallback for this prediction
      const selectColumns = 'match_result_prediction, match_result_confidence, match_result_correct, over_under_prediction, over_under_confidence, over_under_correct, btts_prediction, btts_confidence, btts_correct';
      
      let query = supabase
        .from('unified_analysis')
        .select(selectColumns)
        .eq('is_settled', true);

      if (market === 'mr') {
        query = query
          .gte('match_result_confidence', confStart)
          .lte('match_result_confidence', confEnd + 0.99)
          .not('match_result_prediction', 'is', null);
      } else if (market === 'ou') {
        query = query
          .gte('over_under_confidence', confStart)
          .lte('over_under_confidence', confEnd + 0.99)
          .not('over_under_prediction', 'is', null);
      } else if (market === 'btts') {
        query = query
          .gte('btts_confidence', confStart)
          .lte('btts_confidence', confEnd + 0.99)
          .not('btts_prediction', 'is', null);
      }

      const { data: fallbackData } = await query;

      const filtered = (fallbackData || []).filter((row: any) => {
        let rowPrediction = '';
        if (market === 'mr') rowPrediction = normalizePrediction('mr', row.match_result_prediction);
        else if (market === 'ou') rowPrediction = normalizePrediction('ou', row.over_under_prediction);
        else if (market === 'btts') rowPrediction = normalizePrediction('btts', row.btts_prediction);
        
        return rowPrediction.toLowerCase() === normalizedPrediction.toLowerCase();
      });

      const total = filtered.length;
      let correct = 0;

      for (const row of filtered) {
        if (market === 'mr' && (row as any).match_result_correct === true) correct++;
        else if (market === 'ou' && (row as any).over_under_correct === true) correct++;
        else if (market === 'btts' && (row as any).btts_correct === true) correct++;
      }

      const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

      results.push({
        market,
        prediction: normalizedPrediction,
        confidenceRange: `${confStart}-${confEnd}`,
        confRangeStart: confStart,
        confRangeEnd: confEnd,
        totalMatches: total,
        correctMatches: correct,
        accuracy,
        hasEnoughData: total >= 3
      });
    }

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error: any) {
    console.error('❌ Historical accuracy batch API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
