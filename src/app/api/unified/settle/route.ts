// ============================================================================
// SETTLEMENT API
// Maç sonuçlarını günceller ve doğruluk hesaplar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { serviceOnlyGuard } from '@/lib/api/dev-only';

export const dynamic = 'force-dynamic';

// Denetim 2026-09-18 (B01): skorlar istekten geliyor → yalnız servis sırrıyla
// ve katı şemayla. Eskiden kimliksiz POST, karneyi kalıcı olarak bozabiliyordu
// (is_settled=true olan satırı settle-unified cron'u bir daha düzeltmez).
const SettleBody = z.object({
  fixtureId: z.coerce.number().int().positive(),
  homeScore: z.number().int().min(0).max(30),
  awayScore: z.number().int().min(0).max(30),
});

let _sb: SupabaseClient | null = null;
function getSupabase() {
  if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return _sb;
}
const supabase = new Proxy({} as SupabaseClient, { get(_, p) { return (getSupabase() as any)[p]; } });

export async function POST(request: NextRequest) {
  const denied = serviceOnlyGuard(request);
  if (denied) return denied;
  try {
    const parsed = SettleBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid body: fixtureId, homeScore, awayScore (integers, scores 0-30)' },
        { status: 400 }
      );
    }
    const { fixtureId, homeScore, awayScore } = parsed.data;
    
    // Get analysis
    const { data: analysis, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('fixture_id', fixtureId)
      .single();
    
    if (fetchError || !analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }
    
    // Calculate actual results
    const totalGoals = homeScore + awayScore;
    const actualMatchResult = homeScore > awayScore ? '1' : homeScore < awayScore ? '2' : 'X';
    const actualOverUnder = totalGoals > 2.5 ? 'Over' : 'Under';
    const actualBtts = homeScore > 0 && awayScore > 0;
    
    // Check predictions
    const matchResultCorrect = analysis.match_result_prediction === actualMatchResult;
    const overUnderCorrect = analysis.over_under_prediction === actualOverUnder;
    const bttsCorrect = (analysis.btts_prediction === 'Yes' && actualBtts) || (analysis.btts_prediction === 'No' && !actualBtts);
    
    // Score prediction check (from analysis JSON)
    const predictedScore = analysis.analysis?.predictions?.matchResult?.scorePrediction;
    const scorePredictionCorrect = predictedScore ? 
      predictedScore === `${homeScore}-${awayScore}` : false;
    
    // Update
    const { error: updateError } = await supabase
      .from('unified_analysis')
      .update({
        is_settled: true,
        actual_home_score: homeScore,
        actual_away_score: awayScore,
        actual_total_goals: totalGoals,
        actual_btts: actualBtts,
        actual_match_result: actualMatchResult,
        match_result_correct: matchResultCorrect,
        over_under_correct: overUnderCorrect,
        btts_correct: bttsCorrect,
        score_prediction_correct: scorePredictionCorrect,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fixture_id', fixtureId);
    
    if (updateError) throw updateError;
    
    return NextResponse.json({
      success: true,
      updated: {
        fixtureId,
        matchResult: { predicted: analysis.match_result_prediction, actual: actualMatchResult, correct: matchResultCorrect },
        overUnder: { predicted: analysis.over_under_prediction, actual: actualOverUnder, correct: overUnderCorrect },
        btts: { predicted: analysis.btts_prediction, actual: actualBtts, correct: bttsCorrect },
        score: { predicted: predictedScore, actual: `${homeScore}-${awayScore}`, correct: scorePredictionCorrect }
      }
    });
    
  } catch (error: any) {
    console.error('Settle API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

