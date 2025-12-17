// ============================================================================
// ADMIN DEBUG - Check system status
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { matchResultManager } from '@/lib/match-results';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // 1. Check prediction_records table
    const { data: predictions, error: predError, count } = await supabase
      .from('prediction_records')
      .select('id, fixture_id, home_team, away_team, match_date, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);

    results.checks.prediction_records = {
      status: !predError ? 'OK' : 'ERROR',
      error: predError?.message,
      total_count: count,
      recent: predictions?.map(p => ({
        id: p.id?.substring(0, 8),
        fixture_id: p.fixture_id,
        match: `${p.home_team} vs ${p.away_team}`,
        match_date: p.match_date,
        status: p.status,
        created_at: p.created_at,
      })),
    };

    // 2. Check pending predictions that should be settled
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    
    const { data: pendingOld, error: pendingError } = await supabase
      .from('prediction_records')
      .select('id, fixture_id, home_team, away_team, match_date, status')
      .eq('status', 'pending')
      .lt('match_date', cutoffTime.toISOString())
      .limit(10);

    results.checks.pending_to_settle = {
      status: !pendingError ? 'OK' : 'ERROR',
      error: pendingError?.message,
      count: pendingOld?.length || 0,
      cutoff_time: cutoffTime.toISOString(),
      predictions: pendingOld?.map(p => ({
        fixture_id: p.fixture_id,
        match: `${p.home_team} vs ${p.away_team}`,
        match_date: p.match_date,
      })),
    };

    // 3. Check match_results table
    const { data: matchResults, error: matchError, count: matchCount } = await supabase
      .from('match_results')
      .select('*', { count: 'exact' })
      .order('match_date', { ascending: false })
      .limit(5);

    results.checks.match_results = {
      status: !matchError ? 'OK' : 'ERROR',
      error: matchError?.message,
      total_count: matchCount,
      recent: matchResults,
    };

    // 4. Check prediction_accuracy table
    const { data: accuracyData, error: accError, count: accCount } = await supabase
      .from('prediction_accuracy')
      .select('*', { count: 'exact' })
      .limit(5);

    results.checks.prediction_accuracy = {
      status: !accError ? 'OK' : 'ERROR',
      error: accError?.message,
      total_count: accCount,
    };

    // 5. Check available API providers
    const availableProviders = matchResultManager.getAvailableProviders();
    
    results.checks.api_providers = {
      available: availableProviders,
      count: availableProviders.length,
      env_check: {
        RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
        FOOTBALL_DATA_API_KEY: !!process.env.FOOTBALL_DATA_API_KEY,
        LIVESCORE_API_KEY: !!process.env.LIVESCORE_API_KEY,
        SPORTMONKS_API_KEY: !!process.env.SPORTMONKS_API_KEY,
        ODDS_API_KEY: !!process.env.ODDS_API_KEY,
      },
    };

    // 6. Test one provider if there are pending predictions
    if (pendingOld && pendingOld.length > 0) {
      const testPrediction = pendingOld[0];
      try {
        const testResult = await matchResultManager.fetchResult(
          testPrediction.fixture_id,
          testPrediction.home_team,
          testPrediction.away_team,
          testPrediction.match_date
        );
        
        results.checks.provider_test = {
          tested_match: `${testPrediction.home_team} vs ${testPrediction.away_team}`,
          fixture_id: testPrediction.fixture_id,
          result: testResult ? {
            score: `${testResult.homeScore}-${testResult.awayScore}`,
            source: testResult.source,
            status: testResult.status,
          } : 'No result found',
        };
      } catch (err: any) {
        results.checks.provider_test = {
          error: err.message,
        };
      }
    }

    // Summary
    const hasProblems = 
      results.checks.prediction_records?.total_count === 0 ||
      results.checks.api_providers?.count === 0;

    results.summary = {
      has_predictions: (results.checks.prediction_records?.total_count || 0) > 0,
      has_pending_to_settle: (results.checks.pending_to_settle?.count || 0) > 0,
      has_providers: availableProviders.length > 0,
      overall_status: hasProblems ? 'ISSUES_FOUND' : 'OK',
    };

    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

