// ============================================================================
// ADMIN API - AGENT LEARNING SYSTEM TEST
// Agent iyileştirme sisteminin çalışıp çalışmadığını test etmek için endpoint
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateDynamicPromptGuidance } from '@/lib/agent-learning/dynamic-prompts';
import { getLearningContext } from '@/lib/ai-brain/learning-context';
import { getAgentWeights } from '@/lib/agent-learning/performance-tracker';

export const dynamic = 'force-dynamic';

// Secret key kontrolü
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-secret-key-here';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const secret = request.headers.get('x-admin-secret');
  
  if (authHeader === `Bearer ${ADMIN_SECRET}` || secret === ADMIN_SECRET) {
    return true;
  }
  
  // URL'den de kontrol et
  const { searchParams } = new URL(request.url);
  const urlSecret = searchParams.get('secret');
  return urlSecret === ADMIN_SECRET;
}

export async function GET(request: NextRequest) {
  try {
    // Auth kontrolü
    if (!checkAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const league = searchParams.get('league') || 'Premier League';
    const agentName = searchParams.get('agent') || 'stats';
    const language = (searchParams.get('lang') || 'tr') as 'tr' | 'en' | 'de';

    const results: any = {
      timestamp: new Date().toISOString(),
      test_config: {
        league,
        agent_name: agentName,
        language
      },
      tests: {}
    };

    // TEST 1: Learning Context
    console.log('🧪 TEST 1: Learning Context...');
    try {
      const learningContext = await getLearningContext(league, 'Test Home Team', 'Test Away Team', language);
      results.tests.learning_context = {
        success: true,
        has_data: !!learningContext,
        preview: learningContext ? learningContext.substring(0, 200) + '...' : 'No data',
        length: learningContext?.length || 0
      };
    } catch (error: any) {
      results.tests.learning_context = {
        success: false,
        error: error.message
      };
    }

    // TEST 2: Dynamic Prompt Guidance
    console.log('🧪 TEST 2: Dynamic Prompt Guidance...');
    try {
      const dynamicPrompt = await generateDynamicPromptGuidance(agentName, league, language);
      results.tests.dynamic_prompt = {
        success: true,
        has_guidance: !!dynamicPrompt,
        preview: dynamicPrompt ? dynamicPrompt.substring(0, 300) + '...' : 'No guidance (insufficient data)',
        length: dynamicPrompt?.length || 0,
        note: dynamicPrompt ? 'Agent has performance data, prompt guidance generated' : 'Agent needs at least 10 predictions to generate guidance'
      };
    } catch (error: any) {
      results.tests.dynamic_prompt = {
        success: false,
        error: error.message
      };
    }

    // TEST 3: Agent Weights
    console.log('🧪 TEST 3: Agent Weights...');
    try {
      const weights = await getAgentWeights(league);
      results.tests.agent_weights = {
        success: true,
        weights: weights,
        has_weights: Object.keys(weights).length > 0,
        note: Object.keys(weights).length > 0 
          ? 'Dynamic weights are being calculated based on performance'
          : 'No weights yet (need settled predictions)'
      };
    } catch (error: any) {
      results.tests.agent_weights = {
        success: false,
        error: error.message
      };
    }

    // TEST 4: All Agents Test
    console.log('🧪 TEST 4: Testing all agents...');
    const agents = ['stats', 'odds', 'deepAnalysis'];
    const allAgentsTest: any = {};
    
    for (const agent of agents) {
      try {
        const prompt = await generateDynamicPromptGuidance(agent, league, language);
        allAgentsTest[agent] = {
          success: true,
          has_guidance: !!prompt,
          guidance_length: prompt?.length || 0
        };
      } catch (error: any) {
        allAgentsTest[agent] = {
          success: false,
          error: error.message
        };
      }
    }
    
    results.tests.all_agents = allAgentsTest;

    // Özet
    results.summary = {
      learning_context_working: results.tests.learning_context?.success,
      dynamic_prompts_working: results.tests.dynamic_prompt?.success,
      agent_weights_working: results.tests.agent_weights?.success,
      system_ready: results.tests.learning_context?.success && 
                     results.tests.dynamic_prompt?.success && 
                     results.tests.agent_weights?.success
    };

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error: any) {
    console.error('❌ Error testing agent learning system:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
