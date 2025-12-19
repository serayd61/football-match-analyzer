// ============================================================================
// API: DeepSeek Master Analyst Results
// Admin panelde göstermek için master analizleri döner
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch match_full_analysis with DeepSeek Master data
    const { data: analyses, error } = await supabase
      .from('match_full_analysis')
      .select('*')
      .not('deepseek_master', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Calculate statistics
    const settled = analyses?.filter(a => a.is_settled) || [];
    const pending = analyses?.filter(a => !a.is_settled) || [];

    // Calculate accuracy for settled matches
    let bttsCorrect = 0, ouCorrect = 0, mrCorrect = 0;
    for (const match of settled) {
      const master = match.deepseek_master;
      if (!master?.finalVerdict) continue;

      const actualBtts = match.actual_home_score > 0 && match.actual_away_score > 0;
      const actualTotalGoals = (match.actual_home_score || 0) + (match.actual_away_score || 0);
      const actualResult = match.actual_home_score > match.actual_away_score ? 'home' 
        : match.actual_home_score < match.actual_away_score ? 'away' : 'draw';

      if ((master.finalVerdict.btts.prediction === 'yes') === actualBtts) bttsCorrect++;
      if ((master.finalVerdict.overUnder.prediction === 'over') === (actualTotalGoals > 2.5)) ouCorrect++;
      if (master.finalVerdict.matchResult.prediction === actualResult) mrCorrect++;
    }

    const stats = {
      total: analyses?.length || 0,
      settled: settled.length,
      pending: pending.length,
      accuracy: {
        btts: settled.length > 0 ? ((bttsCorrect / settled.length) * 100).toFixed(1) : '0',
        overUnder: settled.length > 0 ? ((ouCorrect / settled.length) * 100).toFixed(1) : '0',
        matchResult: settled.length > 0 ? ((mrCorrect / settled.length) * 100).toFixed(1) : '0',
        overall: settled.length > 0 
          ? (((bttsCorrect + ouCorrect + mrCorrect) / (settled.length * 3)) * 100).toFixed(1) 
          : '0'
      },
      riskDistribution: {
        low: analyses?.filter(a => a.deepseek_master?.riskLevel === 'low').length || 0,
        medium: analyses?.filter(a => a.deepseek_master?.riskLevel === 'medium').length || 0,
        high: analyses?.filter(a => a.deepseek_master?.riskLevel === 'high').length || 0
      },
      averageConfidence: analyses?.length 
        ? Math.round(analyses.reduce((sum, a) => sum + (a.deepseek_master?.confidence || 0), 0) / analyses.length)
        : 0
    };

    // Format recent analyses
    const recent = analyses?.map(a => ({
      id: a.id,
      fixture_id: a.fixture_id,
      home_team: a.home_team,
      away_team: a.away_team,
      league: a.league,
      match_date: a.match_date,
      is_settled: a.is_settled,
      actual_score: a.is_settled ? `${a.actual_home_score}-${a.actual_away_score}` : null,
      master: {
        btts: a.deepseek_master?.finalVerdict?.btts,
        overUnder: a.deepseek_master?.finalVerdict?.overUnder,
        matchResult: a.deepseek_master?.finalVerdict?.matchResult,
        confidence: a.deepseek_master?.confidence,
        riskLevel: a.deepseek_master?.riskLevel,
        bestBet: a.deepseek_master?.bestBet,
        reasoning: a.deepseek_master?.reasoning,
        systemAgreement: a.deepseek_master?.systemAgreement,
        warnings: a.deepseek_master?.warnings
      },
      // System comparisons
      systems: {
        ai_consensus: a.ai_consensus?.consensus,
        quad_brain: a.quad_brain?.consensus,
        ai_agents: a.ai_agents?.consensus
      },
      created_at: a.created_at
    })) || [];

    return NextResponse.json({
      success: true,
      stats,
      recent
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

