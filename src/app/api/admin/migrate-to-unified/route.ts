// ============================================================================
// ADMIN: Migrate analysis_performance to unified_analysis
// GET /api/admin/migrate-to-unified
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Lazy-loaded Supabase client
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Starting migration from analysis_performance to unified_analysis...');
    
    const supabase = getSupabase();
    
    // Get all records from analysis_performance that don't exist in unified_analysis
    const { data: oldRecords, error: fetchError } = await supabase
      .from('analysis_performance')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }
    
    if (!oldRecords || oldRecords.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No records to migrate',
        migrated: 0 
      });
    }
    
    console.log(`📋 Found ${oldRecords.length} records in analysis_performance`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const record of oldRecords) {
      try {
        // Check if already exists in unified_analysis
        const { data: existing } = await supabase
          .from('unified_analysis')
          .select('fixture_id')
          .eq('fixture_id', record.fixture_id)
          .maybeSingle();
        
        if (existing) {
          console.log(`   ⏭️ Skip ${record.fixture_id} - already exists`);
          skippedCount++;
          continue;
        }
        
        // Normalize match_date to YYYY-MM-DD
        let matchDate = record.match_date;
        if (matchDate && matchDate.includes('T')) {
          matchDate = matchDate.split('T')[0];
        }
        
        // Map old record to unified_analysis format
        const unifiedRecord = {
          fixture_id: record.fixture_id,
          home_team: record.home_team,
          away_team: record.away_team,
          league: record.league || 'Unknown',
          match_date: matchDate,
          
          // Analysis - combine all agent data
          analysis: {
            statsAgent: record.stats_agent,
            oddsAgent: record.odds_agent,
            deepAnalysisAgent: record.deep_analysis_agent,
            geniusAnalyst: record.genius_analyst,
            masterStrategist: record.master_strategist,
            aiSmart: record.ai_smart,
          },
          
          // Predictions
          match_result_prediction: normalizeMatchResult(record.consensus_match_result),
          match_result_confidence: 65, // Default
          over_under_prediction: normalizeOverUnder(record.consensus_over_under),
          over_under_confidence: 65,
          btts_prediction: normalizeBtts(record.consensus_btts),
          btts_confidence: 65,
          
          // Best bet (from first available)
          best_bet_market: 'Match Result',
          best_bet_selection: record.consensus_match_result || 'X',
          best_bet_confidence: record.consensus_confidence || 60,
          
          // Overall
          overall_confidence: record.consensus_confidence || 60,
          agreement: 75,
          risk_level: record.consensus_confidence >= 70 ? 'low' : 'medium',
          data_quality: 'good',
          processing_time: 1000,
          systems_used: ['migration'],
          
          // Settlement status
          is_settled: record.match_settled || false,
          
          // Actual results if settled
          actual_home_score: record.actual_home_score,
          actual_away_score: record.actual_away_score,
          actual_total_goals: record.actual_home_score !== null && record.actual_away_score !== null 
            ? record.actual_home_score + record.actual_away_score 
            : null,
          actual_btts: record.actual_btts !== null 
            ? (record.actual_btts === 'yes' || record.actual_btts === true) 
            : null,
          actual_match_result: record.actual_match_result,
          
          // Correctness
          match_result_correct: record.consensus_mr_correct,
          over_under_correct: record.consensus_ou_correct,
          btts_correct: record.consensus_btts_correct,
          score_prediction_correct: false,
          
          settled_at: record.match_settled ? record.updated_at : null,
          created_at: record.created_at,
          updated_at: new Date().toISOString(),
        };
        
        // Insert into unified_analysis
        const { error: insertError } = await supabase
          .from('unified_analysis')
          .insert(unifiedRecord);
        
        if (insertError) {
          console.error(`   ❌ Insert error for ${record.fixture_id}:`, insertError.message);
          console.error(`      Details:`, JSON.stringify(insertError));
          console.error(`      Record:`, JSON.stringify({
            fixture_id: unifiedRecord.fixture_id,
            match_date: unifiedRecord.match_date,
            match_result_prediction: unifiedRecord.match_result_prediction,
            over_under_prediction: unifiedRecord.over_under_prediction,
            btts_prediction: unifiedRecord.btts_prediction
          }));
          errorCount++;
          continue;
        }
        
        console.log(`   ✅ Migrated: ${record.home_team} vs ${record.away_team}`);
        migratedCount++;
        
      } catch (err: any) {
        console.error(`   ❌ Error:`, err.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ Migration complete: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`);
    
    return NextResponse.json({
      success: true,
      message: 'Migration complete',
      stats: {
        total: oldRecords.length,
        migrated: migratedCount,
        skipped: skippedCount,
        errors: errorCount
      }
    });
    
  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper functions
function normalizeMatchResult(value: string | null | undefined): string {
  if (!value) return 'X';
  const v = value.toLowerCase();
  if (v === '1' || v === 'home' || v === 'h') return '1';
  if (v === '2' || v === 'away' || v === 'a') return '2';
  if (v === 'x' || v === 'draw' || v === 'd') return 'X';
  return 'X';
}

function normalizeOverUnder(value: string | null | undefined): string {
  if (!value) return 'Under';
  const v = value.toLowerCase();
  if (v.includes('over') || v === 'o') return 'Over';
  if (v.includes('under') || v === 'u') return 'Under';
  return 'Under';
}

function normalizeBtts(value: string | null | undefined): string {
  if (!value) return 'No';
  const v = value.toLowerCase();
  if (v === 'yes' || v === 'y' || v === 'true' || v === '1') return 'Yes';
  if (v === 'no' || v === 'n' || v === 'false' || v === '0') return 'No';
  return 'No';
}

