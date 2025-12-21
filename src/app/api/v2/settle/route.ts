// ============================================================================
// API: Settle Smart Analysis Results
// Tamamlanan maçların sonuçlarını günceller
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const SPORTMONKS_API = 'https://api.sportmonks.com/v3/football';
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY || '';

async function fetchFixtureResult(fixtureId: number) {
  try {
    const url = `${SPORTMONKS_API}/fixtures/${fixtureId}?api_token=${SPORTMONKS_KEY}&include=scores`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data?.data) return null;
    
    const fixture = data.data;
    const scores = fixture.scores || [];
    
    // Find fulltime scores
    const ftScore = scores.find((s: any) => s.description === 'CURRENT' || s.description === 'FT');
    
    if (!ftScore) return null;
    
    const homeScore = ftScore.score?.participant === 'home' ? ftScore.score?.goals : 
                      scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'home')?.score?.goals;
    const awayScore = ftScore.score?.participant === 'away' ? ftScore.score?.goals :
                      scores.find((s: any) => s.description === 'CURRENT' && s.score?.participant === 'away')?.score?.goals;
    
    // Alternative: direct from fixture
    const home = fixture.scores?.find((s: any) => s.participant_id === fixture.participants?.[0]?.id)?.score?.goals ?? homeScore;
    const away = fixture.scores?.find((s: any) => s.participant_id === fixture.participants?.[1]?.id)?.score?.goals ?? awayScore;
    
    if (home === undefined || away === undefined) {
      // Try to get from result directly
      if (fixture.result_info) {
        const match = fixture.result_info.match(/(\d+)-(\d+)/);
        if (match) {
          return {
            homeScore: parseInt(match[1]),
            awayScore: parseInt(match[2]),
            totalGoals: parseInt(match[1]) + parseInt(match[2]),
            btts: parseInt(match[1]) > 0 && parseInt(match[2]) > 0,
            matchResult: parseInt(match[1]) > parseInt(match[2]) ? 'home' : 
                        parseInt(match[1]) < parseInt(match[2]) ? 'away' : 'draw'
          };
        }
      }
      return null;
    }
    
    return {
      homeScore: home,
      awayScore: away,
      totalGoals: home + away,
      btts: home > 0 && away > 0,
      matchResult: home > away ? 'home' : home < away ? 'away' : 'draw'
    };
  } catch (error) {
    console.error(`Error fetching fixture ${fixtureId}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting settle process...');
    
    // Get unsettled analyses where match date is in the past
    const { data: pendingAnalyses, error } = await supabase
      .from('smart_analysis')
      .select('*')
      .eq('is_settled', false)
      .lt('match_date', new Date().toISOString().split('T')[0]);
    
    if (error) {
      console.error('Error fetching pending analyses:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    console.log(`Found ${pendingAnalyses?.length || 0} pending analyses to settle`);
    
    let updated = 0;
    let errors = 0;
    
    for (const analysis of pendingAnalyses || []) {
      try {
        const result = await fetchFixtureResult(analysis.fixture_id);
        
        if (!result) {
          console.log(`⏳ No result yet for ${analysis.home_team} vs ${analysis.away_team}`);
          continue;
        }
        
        // Update analysis with actual results
        const { error: updateError } = await supabase
          .from('smart_analysis')
          .update({
            is_settled: true,
            actual_btts: result.btts,
            actual_total_goals: result.totalGoals,
            actual_match_result: result.matchResult
          })
          .eq('fixture_id', analysis.fixture_id);
        
        if (updateError) {
          console.error(`Error updating ${analysis.fixture_id}:`, updateError);
          errors++;
        } else {
          console.log(`✅ Settled: ${analysis.home_team} vs ${analysis.away_team} (${result.homeScore}-${result.awayScore})`);
          updated++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error(`Error processing ${analysis.fixture_id}:`, err);
        errors++;
      }
    }
    
    console.log(`✅ Settle complete: ${updated} updated, ${errors} errors`);
    
    return NextResponse.json({
      success: true,
      updated,
      errors,
      total: pendingAnalyses?.length || 0
    });
    
  } catch (error) {
    console.error('Settle API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

