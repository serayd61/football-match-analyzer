// ============================================================================
// PUBLIC API — Dixon-Coles backtest sonuçları (track-record)
// dc_backtest_results'tan her lig için EN SON kaydı döner.
// Bahis sonucu değil, dürüst doğruluk vitrini → public (gating yok).
// ============================================================================

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

let sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!sb) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase credentials yok');
    sb = createClient(url, key);
  }
  return sb;
}

export async function GET() {
  try {
    const supabase = getSupabase();
    // Son 200 kaydı çek, lig başına en yenisini seç
    const { data, error } = await supabase
      .from('dc_backtest_results')
      .select('league_code, tested_matches, mr_accuracy, ou_accuracy, btts_accuracy, log_loss, brier, run_at')
      .order('run_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, results: [] }, { status: 500 });
    }

    const latestByLeague = new Map<string, any>();
    for (const row of data || []) {
      if (!latestByLeague.has(row.league_code)) latestByLeague.set(row.league_code, row);
    }

    const results = Array.from(latestByLeague.values());
    // Toplam test maçıyla ağırlıklı ortalama doğruluk
    const totalTested = results.reduce((s, r) => s + (r.tested_matches || 0), 0);
    const wAvg = (key: 'mr_accuracy' | 'ou_accuracy' | 'btts_accuracy') =>
      totalTested > 0
        ? results.reduce((s, r) => s + (r[key] || 0) * (r.tested_matches || 0), 0) / totalTested
        : 0;

    return NextResponse.json({
      ok: true,
      results: results.sort((a, b) => (b.tested_matches || 0) - (a.tested_matches || 0)),
      summary: {
        leagues: results.length,
        totalTested,
        mrAccuracy: wAvg('mr_accuracy'),
        ouAccuracy: wAvg('ou_accuracy'),
        bttsAccuracy: wAvg('btts_accuracy'),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'hata', results: [] }, { status: 500 });
  }
}
