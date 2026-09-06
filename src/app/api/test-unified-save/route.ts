// ============================================================================
// TEST ENDPOINT — unified_analysis yazma testi
// ⚠️ Denetim 2026-09-05 (P0): bu uç nokta üretimde kimliksiz çağrılabiliyor ve
// service-role ile yazıp siliyordu. Artık üretimde 404 döner; yalnızca
// geliştirme ortamında veya CRON_SECRET/ADMIN_SECRET Bearer ile çalışır.
// Yazma testleri için izole veritabanı kullanın (bkz. tests/).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { devOnlyGuard } from '@/lib/api/dev-only';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const blocked = devOnlyGuard(request);
  if (blocked) return blocked;

  const results: any = { timestamp: new Date().toISOString(), steps: [] };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    results.steps.push({ step: 1, name: 'Environment Check', supabaseUrl: supabaseUrl ? 'SET' : 'MISSING', supabaseKey: supabaseKey ? 'SET' : 'MISSING' });
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ ...results, error: 'Missing credentials' });

    const supabase = createClient(supabaseUrl, supabaseKey);
    const testFixtureId = 99999999;
    const testData = {
      fixture_id: testFixtureId, home_team: 'Test Home', away_team: 'Test Away', league: 'Test League', match_date: '2026-01-01',
      analysis: { test: true }, match_result_prediction: '1', match_result_confidence: 70, over_under_prediction: 'Over', over_under_confidence: 65,
      btts_prediction: 'Yes', btts_confidence: 60, best_bet_market: 'Match Result', best_bet_selection: 'Home', best_bet_confidence: 70,
      overall_confidence: 65, agreement: 80, risk_level: 'medium', data_quality: 'good', processing_time: 1000, systems_used: ['test'],
      is_settled: false, created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('unified_analysis').upsert(testData, { onConflict: 'fixture_id' }).select();
    if (error) {
      results.steps.push({ step: 2, name: 'Insert', status: 'FAILED', error: { message: error.message, code: error.code } });
      return NextResponse.json(results);
    }
    results.steps.push({ step: 2, name: 'Insert', status: 'OK', rows: data?.length ?? 0 });

    const { error: deleteError } = await supabase.from('unified_analysis').delete().eq('fixture_id', testFixtureId);
    results.steps.push({ step: 3, name: 'Cleanup', status: deleteError ? 'FAILED' : 'OK' });
    results.success = true;
    return NextResponse.json(results);
  } catch (error: any) {
    results.error = error.message;
    return NextResponse.json(results);
  }
}
