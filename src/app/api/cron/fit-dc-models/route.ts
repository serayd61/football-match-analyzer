// ============================================================================
// CRON JOB — FIT DIXON-COLES MODELS
// Her kapsanan lig için geçmiş maçlardan takım-gücü parametrelerini fit eder
// ve dc_model_params tablosuna yazar. Haftada bir (Salı 04:00 UTC) çalışır.
//
// Tahmin anında fit yapılmaz; bu cron parametreleri önceden hesaplar.
// ⚠️ football-data.org rate limit: data-loader istekler arası 6.5s bekler.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DixonColesModel } from '@/lib/statistical/dixon-coles';
import { loadTwoSeasons, FD_CODES } from '@/lib/statistical/data-loader';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
  const startTime = Date.now();

  // Auth — strict (CRON_SECRET zorunlu)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'FOOTBALL_DATA_API_KEY yok' },
      { status: 500 }
    );
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🧮 FIT DIXON-COLES MODELS CRON JOB');
  console.log('═'.repeat(70));

  const supabase = getSupabase();
  const results: Array<{ code: string; ok: boolean; matches?: number; error?: string }> = [];

  for (const code of FD_CODES) {
    try {
      console.log(`\n📥 ${code}: 2 sezon çekiliyor...`);
      const { matches, seasons } = await loadTwoSeasons(code);

      if (matches.length < 40) {
        console.warn(`⚠️ ${code}: yetersiz maç (${matches.length}) — fit atlandı.`);
        results.push({ code, ok: false, matches: matches.length, error: 'insufficient_matches' });
        continue;
      }

      console.log(`🧮 ${code}: ${matches.length} maç ile fit ediliyor...`);
      const model = new DixonColesModel();
      model.fit(matches, { xi: 0.0018, iters: 250 });
      const params = model.getParams();

      const { error } = await supabase.from('dc_model_params').insert({
        league_code: code,
        params,
        trained_matches: matches.length,
        season: seasons.join(','),
      });

      if (error) {
        console.error(`❌ ${code}: DB yazımı başarısız — ${error.message}`);
        results.push({ code, ok: false, matches: matches.length, error: error.message });
      } else {
        console.log(`✅ ${code}: ${matches.length} maç ile fit edildi ve kaydedildi.`);
        results.push({ code, ok: true, matches: matches.length });
      }
    } catch (e: any) {
      console.error(`❌ ${code}: ${e?.message || e}`);
      results.push({ code, ok: false, error: e?.message || String(e) });
      // Rate-limit/transient hatada diğer liglere devam et
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n✅ Tamamlandı: ${okCount}/${FD_CODES.length} lig fit edildi (${elapsed}s)`);

  return NextResponse.json({
    success: true,
    fitted: okCount,
    total: FD_CODES.length,
    elapsedSeconds: Number(elapsed),
    results,
  });
}
