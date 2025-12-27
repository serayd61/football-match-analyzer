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
    
    // Get unsettled smart_analysis where match date is in the past
    const { data: pendingSmartAnalyses, error: smartError } = await supabase
      .from('smart_analysis')
      .select('*')
      .eq('is_settled', false)
      .lt('match_date', new Date().toISOString().split('T')[0]);
    
    if (smartError) {
      console.error('Error fetching pending smart analyses:', smartError);
    }
    
    // Get unsettled agent_analysis where match date is in the past
    const { data: pendingAgentAnalyses, error: agentError } = await supabase
      .from('agent_analysis')
      .select('*')
      .eq('is_settled', false)
      .lt('match_date', new Date().toISOString().split('T')[0]);
    
    if (agentError) {
      console.error('Error fetching pending agent analyses:', agentError);
    }
    
    const allPending = [
      ...(pendingSmartAnalyses || []).map(a => ({ ...a, type: 'smart' })),
      ...(pendingAgentAnalyses || []).map(a => ({ ...a, type: 'agent' }))
    ];
    
    console.log(`Found ${allPending.length} pending analyses to settle (${pendingSmartAnalyses?.length || 0} smart, ${pendingAgentAnalyses?.length || 0} agent)`);
    
    let updated = 0;
    let errors = 0;
    const processedFixtures = new Set<number>();
    
    for (const analysis of allPending) {
      // Skip if we already processed this fixture
      if (processedFixtures.has(analysis.fixture_id)) {
        continue;
      }
      
      try {
        const result = await fetchFixtureResult(analysis.fixture_id);
        
        if (!result) {
          console.log(`⏳ No result yet for fixture ${analysis.fixture_id}`);
          continue;
        }
        
        processedFixtures.add(analysis.fixture_id);
        
        // Update smart_analysis if exists
        if (analysis.type === 'smart' || pendingSmartAnalyses?.some(a => a.fixture_id === analysis.fixture_id)) {
          const { error: updateError } = await supabase
            .from('smart_analysis')
            .update({
              is_settled: true,
              actual_btts: result.btts ? 'yes' : 'no',
              actual_total_goals: result.totalGoals,
              actual_match_result: result.matchResult === 'home' ? '1' : result.matchResult === 'away' ? '2' : 'X'
            })
            .eq('fixture_id', analysis.fixture_id)
            .eq('is_settled', false);
          
          if (updateError) {
            console.error(`Error updating smart_analysis ${analysis.fixture_id}:`, updateError);
            errors++;
          } else {
            console.log(`✅ Settled smart_analysis: ${analysis.fixture_id} (${result.homeScore}-${result.awayScore})`);
            updated++;
          }
        }
        
        // Update agent_analysis if exists
        if (analysis.type === 'agent' || pendingAgentAnalyses?.some(a => a.fixture_id === analysis.fixture_id)) {
          const { error: updateError } = await supabase
            .from('agent_analysis')
            .update({
              is_settled: true,
              actual_btts: result.btts ? 'yes' : 'no',
              actual_total_goals: result.totalGoals,
              actual_match_result: result.matchResult === 'home' ? '1' : result.matchResult === 'away' ? '2' : 'X'
            })
            .eq('fixture_id', analysis.fixture_id)
            .eq('is_settled', false);
          
          if (updateError) {
            console.error(`Error updating agent_analysis ${analysis.fixture_id}:`, updateError);
            errors++;
          } else {
            console.log(`✅ Settled agent_analysis: ${analysis.fixture_id} (${result.homeScore}-${result.awayScore})`);
            updated++;
          }
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
      total: allPending.length,
      smart: pendingSmartAnalyses?.length || 0,
      agent: pendingAgentAnalyses?.length || 0
    });
    
  } catch (error) {
    console.error('Settle API error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

