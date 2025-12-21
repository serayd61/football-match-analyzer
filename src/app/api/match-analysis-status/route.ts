// ============================================================================
// API: Get Match Analysis Status
// Bir maçın 3 farklı sistemle analiz edilip edilmediğini kontrol eder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface SystemStatus {
  available: boolean;
  btts?: { prediction: string; confidence: number };
  overUnder?: { prediction: string; confidence: number };
  matchResult?: { prediction: string; confidence: number };
  analyzedAt?: string;
}

interface AnalysisStatus {
  hasAnalysis: boolean;
  ai_consensus: SystemStatus;
  quad_brain: SystemStatus;
  ai_agents: SystemStatus;
  bestSystem?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixture_id');
    
    if (!fixtureId) {
      return NextResponse.json({ error: 'fixture_id required' }, { status: 400 });
    }

    // Check match_full_analysis table
    const { data: analysis, error } = await supabase
      .from('match_full_analysis')
      .select('*')
      .eq('fixture_id', parseInt(fixtureId))
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Query error:', error);
    }

    if (!analysis) {
      return NextResponse.json({
        hasAnalysis: false,
        ai_consensus: { available: false },
        quad_brain: { available: false },
        ai_agents: { available: false }
      });
    }

    // ✅ FIX: hasAnalysis should only be true if deepseek_master exists
    // Because the dashboard only shows DeepSeek Master analysis
    const hasDeepSeekMaster = !!(analysis.deepseek_master && analysis.deepseek_master.finalVerdict);

    // Parse each system's analysis
    const parseSystem = (data: any): SystemStatus => {
      if (!data) return { available: false };
      
      return {
        available: true,
        btts: data.consensus?.btts,
        overUnder: data.consensus?.overUnder,
        matchResult: data.consensus?.matchResult,
        analyzedAt: data.analyzedAt
      };
    };

    const result: AnalysisStatus = {
      hasAnalysis: hasDeepSeekMaster, // Only true if deepseek_master exists
      ai_consensus: parseSystem(analysis.ai_consensus),
      quad_brain: parseSystem(analysis.quad_brain),
      ai_agents: parseSystem(analysis.ai_agents)
    };

    // Determine best system (highest average confidence)
    const systems = [
      { name: 'ai_consensus', data: analysis.ai_consensus },
      { name: 'quad_brain', data: analysis.quad_brain },
      { name: 'ai_agents', data: analysis.ai_agents }
    ].filter(s => s.data);

    if (systems.length > 0) {
      const best = systems.reduce((best, curr) => {
        const currConf = (curr.data.consensus?.btts?.confidence || 0) +
                        (curr.data.consensus?.overUnder?.confidence || 0) +
                        (curr.data.consensus?.matchResult?.confidence || 0);
        const bestConf = (best.data.consensus?.btts?.confidence || 0) +
                        (best.data.consensus?.overUnder?.confidence || 0) +
                        (best.data.consensus?.matchResult?.confidence || 0);
        return currConf > bestConf ? curr : best;
      });
      result.bestSystem = best.name;
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Bulk check for multiple matches
export async function POST(request: NextRequest) {
  try {
    const { fixture_ids } = await request.json();
    
    if (!fixture_ids || !Array.isArray(fixture_ids)) {
      return NextResponse.json({ error: 'fixture_ids array required' }, { status: 400 });
    }

    const { data: analyses, error } = await supabase
      .from('match_full_analysis')
      .select('fixture_id, ai_consensus, quad_brain, ai_agents, deepseek_master')
      .in('fixture_id', fixture_ids);

    if (error) {
      console.error('Bulk query error:', error);
    }

    // Create a map for quick lookup
    const result: Record<number, any> = {};
    
    for (const id of fixture_ids) {
      const analysis = analyses?.find(a => a.fixture_id === id);
      
      if (!analysis) {
        result[id] = {
          hasAnalysis: false,
          ai_consensus: { available: false },
          quad_brain: { available: false },
          ai_agents: { available: false }
        };
      } else {
        // ✅ FIX: hasAnalysis should only be true if deepseek_master exists
        const hasDeepSeekMaster = !!(analysis.deepseek_master && analysis.deepseek_master.finalVerdict);
        
        result[id] = {
          hasAnalysis: hasDeepSeekMaster, // Only true if deepseek_master exists
          ai_consensus: { 
            available: !!analysis.ai_consensus,
            summary: analysis.ai_consensus ? summarize(analysis.ai_consensus) : null
          },
          quad_brain: { 
            available: !!analysis.quad_brain,
            summary: analysis.quad_brain ? summarize(analysis.quad_brain) : null
          },
          ai_agents: { 
            available: !!analysis.ai_agents,
            summary: analysis.ai_agents ? summarize(analysis.ai_agents) : null
          }
        };
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function summarize(data: any) {
  if (!data?.consensus) return null;
  return {
    btts: data.consensus.btts?.prediction,
    bttsConf: data.consensus.btts?.confidence,
    ou: data.consensus.overUnder?.prediction,
    ouConf: data.consensus.overUnder?.confidence,
    mr: data.consensus.matchResult?.prediction,
    mrConf: data.consensus.matchResult?.confidence
  };
}

