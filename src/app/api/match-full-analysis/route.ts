// ============================================================================
// API: Get existing match full analysis
// Dashboard'da mevcut analizi kontrol etmek için
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
    const fixtureId = searchParams.get('fixture_id');

    if (!fixtureId) {
      return NextResponse.json({ success: false, error: 'Missing fixture_id' }, { status: 400 });
    }

    // Fetch from match_full_analysis table
    const { data: analysis, error } = await supabase
      .from('match_full_analysis')
      .select('*')
      .eq('fixture_id', fixtureId)
      .not('deepseek_master', 'is', null)
      .single();

    if (error || !analysis) {
      return NextResponse.json({ success: false, error: 'Analysis not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      analysis: {
        id: analysis.id,
        fixture_id: analysis.fixture_id,
        home_team: analysis.home_team,
        away_team: analysis.away_team,
        league: analysis.league,
        match_date: analysis.match_date,
        ai_consensus: analysis.ai_consensus,
        quad_brain: analysis.quad_brain,
        ai_agents: analysis.ai_agents,
        deepseek_master: analysis.deepseek_master,
        created_at: analysis.created_at,
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

