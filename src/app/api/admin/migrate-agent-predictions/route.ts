// ============================================================================
// ADMIN API - MIGRATE AGENT PREDICTIONS FROM UNIFIED_ANALYSIS
// unified_analysis'tan agent_predictions kayıtlarını oluşturur
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function migrateAgentPredictions(daysBack: number = 7) {
  try {
    const supabase = getSupabase();

    console.log(`\n🔄 MIGRATING AGENT PREDICTIONS FROM UNIFIED_ANALYSIS`);
    console.log(`   📅 Looking back ${daysBack} days\n`);

    // Son N günde oluşturulan unified_analysis kayıtlarını al
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const { data: analyses, error: fetchError } = await supabase
      .from('unified_analysis')
      .select('fixture_id, home_team, away_team, league, match_date, analysis, created_at')
      .gte('match_date', cutoffDateStr)
      .order('match_date', { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error('❌ Error fetching unified_analysis:', fetchError);
      return {
        success: false,
        error: fetchError.message
      };
    }

    if (!analyses || analyses.length === 0) {
      return {
        success: true,
        message: 'No analyses found to migrate',
        stats: {
          total: 0,
          migrated: 0,
          skipped: 0,
          errors: 0
        }
      };
    }

    console.log(`📋 Found ${analyses.length} analyses to process\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const analysis of analyses) {
      try {
        const analysisData = analysis.analysis;
        if (!analysisData || !analysisData.sources) {
          skippedCount++;
          continue;
        }

        const agents = analysisData.sources.agents || {};
        const normalizedMatchDate = analysis.match_date 
          ? (analysis.match_date.includes('T') ? analysis.match_date.split('T')[0] : analysis.match_date)
          : new Date().toISOString().split('T')[0];

        let fixtureMigrated = false;

        // Stats Agent
        if (agents.stats) {
          const stats = agents.stats;
          const { error } = await (supabase.from('agent_predictions') as any).upsert({
            fixture_id: analysis.fixture_id,
            agent_name: 'stats',
            league: analysis.league || null,
            match_date: normalizedMatchDate,
            match_result_prediction: stats.matchResult || null,
            match_result_confidence: stats.matchResultConfidence || null,
            over_under_prediction: stats.overUnder || null,
            over_under_confidence: stats.overUnderConfidence || null,
            btts_prediction: stats.btts || null,
            btts_confidence: stats.bttsConfidence || null,
          }, {
            onConflict: 'agent_name,fixture_id'
          });

          if (!error) {
            fixtureMigrated = true;
            console.log(`   ✅ Stats agent prediction migrated for fixture ${analysis.fixture_id}`);
          }
        }

        // Odds Agent
        if (agents.odds) {
          const odds = agents.odds;
          const { error } = await (supabase.from('agent_predictions') as any).upsert({
            fixture_id: analysis.fixture_id,
            agent_name: 'odds',
            league: analysis.league || null,
            match_date: normalizedMatchDate,
            match_result_prediction: odds.matchWinnerValue || null,
            match_result_confidence: odds.confidence || null,
            over_under_prediction: odds.recommendation || null,
            over_under_confidence: odds.confidence || null,
            btts_prediction: odds.bttsValue || null,
            btts_confidence: odds.bttsConfidence || odds.confidence || null,
          }, {
            onConflict: 'agent_name,fixture_id'
          });

          if (!error) {
            fixtureMigrated = true;
            console.log(`   ✅ Odds agent prediction migrated for fixture ${analysis.fixture_id}`);
          }
        }

        // Deep Analysis Agent
        if (agents.deepAnalysis) {
          const deepAnalysis = agents.deepAnalysis;
          const { error } = await (supabase.from('agent_predictions') as any).upsert({
            fixture_id: analysis.fixture_id,
            agent_name: 'deepAnalysis',
            league: analysis.league || null,
            match_date: normalizedMatchDate,
            match_result_prediction: deepAnalysis.matchResult?.prediction || null,
            match_result_confidence: deepAnalysis.matchResult?.confidence || null,
            over_under_prediction: deepAnalysis.overUnder?.prediction || null,
            over_under_confidence: deepAnalysis.overUnder?.confidence || null,
            btts_prediction: deepAnalysis.btts?.prediction || null,
            btts_confidence: deepAnalysis.btts?.confidence || null,
          }, {
            onConflict: 'agent_name,fixture_id'
          });

          if (!error) {
            fixtureMigrated = true;
            console.log(`   ✅ Deep Analysis agent prediction migrated for fixture ${analysis.fixture_id}`);
          }
        }

        // Master Strategist
        if (agents.masterStrategist?.finalConsensus) {
          const ms = agents.masterStrategist.finalConsensus;
          const { error } = await (supabase.from('agent_predictions') as any).upsert({
            fixture_id: analysis.fixture_id,
            agent_name: 'masterStrategist',
            league: analysis.league || null,
            match_date: normalizedMatchDate,
            match_result_prediction: ms.matchResult?.prediction || null,
            match_result_confidence: ms.matchResult?.confidence || null,
            over_under_prediction: ms.overUnder?.prediction || null,
            over_under_confidence: ms.overUnder?.confidence || null,
            btts_prediction: ms.btts?.prediction || null,
            btts_confidence: ms.btts?.confidence || null,
          }, {
            onConflict: 'agent_name,fixture_id'
          });

          if (!error) {
            fixtureMigrated = true;
            console.log(`   ✅ Master Strategist prediction migrated for fixture ${analysis.fixture_id}`);
          }
        }

        if (fixtureMigrated) {
          migratedCount++;
        } else {
          skippedCount++;
        }

      } catch (error: any) {
        console.error(`   ❌ Error migrating fixture ${analysis.fixture_id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ MIGRATION COMPLETE`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}\n`);

    return {
      success: true,
      stats: {
        total: analyses.length,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    };

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('daysBack') || '7', 10);
    
    const result = await migrateAgentPredictions(daysBack);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ GET Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    let body;
    try {
      body = await request.json();
    } catch (e) {
      // Body yoksa varsayılan değerler kullan
      body = {};
    }
    const daysBack = body.daysBack || 7; // Varsayılan 7 gün
    
    const result = await migrateAgentPredictions(daysBack);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ POST Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
