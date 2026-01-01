// ============================================================================
// TEST ENDPOINT - unified_analysis tablosuna yazma testi
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    steps: []
  };

  try {
    // Step 1: Environment variables kontrol
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    results.steps.push({
      step: 1,
      name: 'Environment Check',
      supabaseUrl: supabaseUrl ? '✅ SET' : '❌ MISSING',
      supabaseKey: supabaseKey ? '✅ SET' : '❌ MISSING'
    });

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ ...results, error: 'Missing credentials' });
    }

    // Step 2: Supabase client oluştur
    const supabase = createClient(supabaseUrl, supabaseKey);
    results.steps.push({
      step: 2,
      name: 'Supabase Client',
      status: '✅ Created'
    });

    // Step 3: Test data hazırla
    const testFixtureId = 99999999; // Test fixture ID
    const testData = {
      fixture_id: testFixtureId,
      home_team: 'Test Home',
      away_team: 'Test Away',
      league: 'Test League',
      match_date: '2026-01-01',
      analysis: { test: true },
      match_result_prediction: '1',
      match_result_confidence: 70,
      over_under_prediction: 'Over',
      over_under_confidence: 65,
      btts_prediction: 'Yes',
      btts_confidence: 60,
      best_bet_market: 'Match Result',
      best_bet_selection: 'Home',
      best_bet_confidence: 70,
      overall_confidence: 65,
      agreement: 80,
      risk_level: 'medium',
      data_quality: 'good',
      processing_time: 1000,
      systems_used: ['test'],
      is_settled: false,
      created_at: new Date().toISOString()
    };

    results.steps.push({
      step: 3,
      name: 'Test Data Prepared',
      fixtureId: testFixtureId,
      predictions: {
        matchResult: testData.match_result_prediction,
        overUnder: testData.over_under_prediction,
        btts: testData.btts_prediction
      }
    });

    // Step 4: unified_analysis tablosuna yaz
    const { data, error } = await supabase
      .from('unified_analysis')
      .upsert(testData, { onConflict: 'fixture_id' })
      .select();

    if (error) {
      results.steps.push({
        step: 4,
        name: 'Insert to unified_analysis',
        status: '❌ FAILED',
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      });
      return NextResponse.json(results);
    }

    results.steps.push({
      step: 4,
      name: 'Insert to unified_analysis',
      status: '✅ SUCCESS',
      insertedData: data
    });

    // Step 5: Verify - eklenen kaydı oku
    const { data: verifyData, error: verifyError } = await supabase
      .from('unified_analysis')
      .select('*')
      .eq('fixture_id', testFixtureId)
      .maybeSingle();

    if (verifyError) {
      results.steps.push({
        step: 5,
        name: 'Verify Insert',
        status: '❌ FAILED',
        error: verifyError.message
      });
    } else {
      results.steps.push({
        step: 5,
        name: 'Verify Insert',
        status: verifyData ? '✅ Record Found' : '❌ Record Not Found',
        record: verifyData
      });
    }

    // Step 6: Cleanup - test kaydını sil
    const { error: deleteError } = await supabase
      .from('unified_analysis')
      .delete()
      .eq('fixture_id', testFixtureId);

    results.steps.push({
      step: 6,
      name: 'Cleanup Test Record',
      status: deleteError ? '❌ FAILED' : '✅ Deleted'
    });

    results.success = true;
    return NextResponse.json(results);

  } catch (error: any) {
    results.error = error.message;
    results.stack = error.stack;
    return NextResponse.json(results);
  }
}

