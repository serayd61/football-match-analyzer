// ============================================================================
// DEBUG API - Supabase bağlantısını ve tablo durumunu kontrol eder
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {},
    supabase: {},
    tables: {},
    errors: []
  };

  // 1. Environment Variables
  results.environment = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ MISSING',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...' || 'N/A'
  };

  // 2. Try Supabase connection
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      results.supabase.status = '❌ Cannot connect - credentials missing';
      return NextResponse.json(results);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    results.supabase.status = '✅ Client created (service role)';

    // 3. Check analysis_performance table
    try {
      const { data: perfData, error: perfError, count: perfCount } = await supabase
        .from('analysis_performance')
        .select('*', { count: 'exact' })
        .limit(5);

      if (perfError) {
        results.tables.analysis_performance = {
          status: '❌ ERROR',
          error: perfError.message,
          code: perfError.code,
          hint: perfError.hint
        };
        results.errors.push(`analysis_performance: ${perfError.message}`);
      } else {
        results.tables.analysis_performance = {
          status: '✅ OK',
          totalCount: perfCount,
          sampleRecords: perfData?.length || 0,
          records: perfData?.map((r: any) => ({
            id: r.id,
            fixture_id: r.fixture_id,
            home_team: r.home_team,
            away_team: r.away_team,
            match_settled: r.match_settled,
            created_at: r.created_at
          }))
        };
      }
    } catch (err: any) {
      results.tables.analysis_performance = {
        status: '❌ EXCEPTION',
        error: err.message
      };
      results.errors.push(`analysis_performance exception: ${err.message}`);
    }

    // 4. Check unified_analysis table
    try {
      const { data: unifiedData, error: unifiedError, count: unifiedCount } = await supabase
        .from('unified_analysis')
        .select('*', { count: 'exact' })
        .limit(5);

      if (unifiedError) {
        results.tables.unified_analysis = {
          status: '❌ ERROR',
          error: unifiedError.message,
          code: unifiedError.code,
          hint: unifiedError.hint
        };
        results.errors.push(`unified_analysis: ${unifiedError.message}`);
      } else {
        results.tables.unified_analysis = {
          status: '✅ OK',
          totalCount: unifiedCount,
          sampleRecords: unifiedData?.length || 0
        };
      }
    } catch (err: any) {
      results.tables.unified_analysis = {
        status: '❌ EXCEPTION',
        error: err.message
      };
      results.errors.push(`unified_analysis exception: ${err.message}`);
    }

    // 5. Try a test insert
    try {
      const testRecord = {
        fixture_id: 99999999,
        home_team: 'TEST_HOME',
        away_team: 'TEST_AWAY',
        league: 'TEST',
        match_date: new Date().toISOString(),
        match_settled: false,
        consensus_match_result: '1',
        consensus_over_under: 'Over',
        consensus_btts: 'Yes',
        consensus_confidence: 50
      };

      const { data: insertData, error: insertError } = await supabase
        .from('analysis_performance')
        .insert(testRecord)
        .select();

      if (insertError) {
        results.testInsert = {
          status: '❌ FAILED',
          error: insertError.message,
          code: insertError.code,
          hint: insertError.hint
        };
        results.errors.push(`Test insert failed: ${insertError.message}`);
      } else {
        results.testInsert = {
          status: '✅ SUCCESS',
          insertedId: insertData?.[0]?.id
        };

        // Delete test record
        await supabase
          .from('analysis_performance')
          .delete()
          .eq('fixture_id', 99999999);
        
        results.testInsert.cleanup = '✅ Test record deleted';
      }
    } catch (err: any) {
      results.testInsert = {
        status: '❌ EXCEPTION',
        error: err.message
      };
      results.errors.push(`Test insert exception: ${err.message}`);
    }

  } catch (err: any) {
    results.supabase.status = '❌ Connection failed';
    results.supabase.error = err.message;
    results.errors.push(`Supabase connection: ${err.message}`);
  }

  // Summary
  results.summary = {
    hasErrors: results.errors.length > 0,
    errorCount: results.errors.length,
    status: results.errors.length === 0 ? '✅ ALL OK' : '❌ HAS ERRORS'
  };

  return NextResponse.json(results, { status: 200 });
}

