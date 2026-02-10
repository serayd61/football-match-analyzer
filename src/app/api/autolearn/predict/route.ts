// ============================================================================
// GET /api/autolearn/predict
// Bir analiz icin AutoLearn skorunu hesaplar
// Parametreler: fixtureId (varsa DB'den ceker) veya body ile agent predictions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { predict } from '@/lib/autolearn/model';
import { createClient } from '@supabase/supabase-js';
import {
  extractAgentPredictionsFromAnalysis,
  extractMatchContextFromAnalysis
} from '@/lib/autolearn/features';

export const maxDuration = 30;

// GET: fixtureId ile predict
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fixtureId = searchParams.get('fixtureId');

    if (!fixtureId) {
      return NextResponse.json({
        success: false,
        error: 'fixtureId parametresi gerekli'
      }, { status: 400 });
    }

    // DB'den analiz verisini cek
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: analysis, error } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('fixture_id', parseInt(fixtureId))
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !analysis) {
      return NextResponse.json({
        success: false,
        error: 'Analiz bulunamadi: ' + (error?.message || 'No data')
      }, { status: 404 });
    }

    const parsedAnalysis = typeof analysis.analysis === 'string'
      ? JSON.parse(analysis.analysis)
      : analysis.analysis;

    const agentPredictions = extractAgentPredictionsFromAnalysis(parsedAnalysis);
    const context = extractMatchContextFromAnalysis(parsedAnalysis, analysis);

    const results = await predict(agentPredictions, context);

    return NextResponse.json({
      success: true,
      fixtureId: parseInt(fixtureId),
      data: results,
      meta: {
        marketsScored: results.length,
        avgReliability: results.length > 0
          ? results.reduce((acc, r) => {
              const reliabilityMap = { high: 3, medium: 2, low: 1, insufficient: 0 };
              return acc + reliabilityMap[r.reliability];
            }, 0) / results.length
          : 0
      }
    });
  } catch (error: any) {
    console.error('❌ AutoLearn Predict Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Prediction failed'
    }, { status: 500 });
  }
}

// POST: Body ile direkt agent predictions gondererek predict
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentPredictions, context } = body;

    if (!agentPredictions) {
      return NextResponse.json({
        success: false,
        error: 'agentPredictions gerekli'
      }, { status: 400 });
    }

    const results = await predict(
      agentPredictions,
      context || {}
    );

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('❌ AutoLearn Predict POST Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Prediction failed'
    }, { status: 500 });
  }
}
