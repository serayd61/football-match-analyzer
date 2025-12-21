// ============================================================================
// API: Get existing match full analysis
// Dashboard'da mevcut analizi kontrol etmek için
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
    const fixtureId = searchParams.get('fixture_id');

    if (!fixtureId) {
      console.error('❌ Missing fixture_id parameter');
      return NextResponse.json({ success: false, error: 'Missing fixture_id' }, { status: 400 });
    }

    // Convert to number if it's a string number
    const fixtureIdNum = parseInt(fixtureId, 10);
    if (isNaN(fixtureIdNum)) {
      console.error('❌ Invalid fixture_id format:', fixtureId);
      return NextResponse.json({ success: false, error: 'Invalid fixture_id format' }, { status: 400 });
    }

    console.log(`🔍 Fetching analysis for fixture_id: ${fixtureIdNum}`);

    // Fetch from match_full_analysis table - try both string and number
    const { data: analysis, error } = await supabase
      .from('match_full_analysis')
      .select('*')
      .eq('fixture_id', fixtureIdNum)
      .maybeSingle();

    if (error) {
      console.error('❌ Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!analysis) {
      console.log(`⚠️ Analysis not found for fixture_id: ${fixtureIdNum}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Analysis not found',
        fixture_id: fixtureIdNum
      }, { status: 404 });
    }
    
    // Additional check: If analysis exists but deepseek_master is missing/invalid, log it
    if (analysis && (!analysis.deepseek_master || !analysis.deepseek_master.finalVerdict)) {
      console.log(`⚠️ Analysis exists for fixture_id: ${fixtureIdNum} but deepseek_master is missing or invalid`);
      console.log(`   - deepseek_master exists: ${!!analysis.deepseek_master}`);
      if (analysis.deepseek_master) {
        console.log(`   - deepseek_master keys: ${Object.keys(analysis.deepseek_master)}`);
        console.log(`   - has finalVerdict: ${!!analysis.deepseek_master.finalVerdict}`);
      }
    }

    console.log(`✅ Analysis found for fixture_id: ${fixtureIdNum}`);

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

