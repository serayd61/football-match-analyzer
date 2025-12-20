// ============================================================================
// API: Get all analyzed matches sorted by DeepSeek Master confidence
// Dashboard'da sol tarafta gösterilecek analiz edilmiş maçları getirir
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const date = searchParams.get('date'); // Optional date filter

    // Fetch all analyzed matches with DeepSeek Master analysis
    let query = supabase
      .from('match_full_analysis')
      .select('*')
      .not('deepseek_master', 'is', null)
      .order('created_at', { ascending: false });

    // Filter by date if provided
    if (date) {
      query = query.eq('match_date', date);
    }

    const { data: analyses, error } = await query.limit(limit);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ success: true, matches: [] });
    }

    // Process and calculate average confidence for sorting
    const processedMatches = analyses
      .map((analysis: any) => {
        const deepseekMaster = analysis.deepseek_master;
        if (!deepseekMaster || !deepseekMaster.finalVerdict) {
          return null;
        }

        const verdict = deepseekMaster.finalVerdict;
        const confidences = [
          verdict.btts?.confidence || 0,
          verdict.overUnder?.confidence || 0,
          verdict.matchResult?.confidence || 0,
        ].filter((c: number) => c > 0);

        const averageConfidence = confidences.length > 0
          ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
          : 0;

        return {
          fixture_id: analysis.fixture_id,
          home_team: analysis.home_team,
          away_team: analysis.away_team,
          league: analysis.league,
          match_date: analysis.match_date,
          averageConfidence: Math.round(averageConfidence),
          deepseekMaster: deepseekMaster,
          best_btts: analysis.best_btts,
          best_btts_confidence: analysis.best_btts_confidence,
          best_over_under: analysis.best_over_under,
          best_over_under_confidence: analysis.best_over_under_confidence,
          best_match_result: analysis.best_match_result,
          best_match_result_confidence: analysis.best_match_result_confidence,
          risk_level: deepseekMaster.riskLevel || 'medium',
          created_at: analysis.created_at,
        };
      })
      .filter((m: any) => m !== null)
      .sort((a: any, b: any) => b.averageConfidence - a.averageConfidence); // Sort by confidence descending

    return NextResponse.json({
      success: true,
      matches: processedMatches,
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

