// ============================================================================
// API V2: ENGINE PERFORMANCE (salt okuma, agregat)
// Sonuçlanan (settled) motor tahminlerinden doğruluk istatistiği üretir.
// Açık (agregat, PII yok) — performans/pazarlama sayfasında kullanılabilir.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _sb;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const recentLimit = Math.min(parseInt(searchParams.get('recent') || '40', 10) || 40, 100);

  const { data, error } = await sb()
    .from('engine_predictions')
    .select(
      'fixture_id, league_name, home_name, away_name, kickoff, pick, confidence, ' +
        'home_score, away_score, result, correct',
    )
    .eq('settled', true)
    .not('result', 'is', null)
    .order('kickoff', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data || [];
  const total = rows.length;
  const correct = rows.filter((r: any) => r.correct === true).length;
  const accuracy = total ? Math.round((correct / total) * 1000) / 10 : 0; // %, 1 ondalık

  // Pick türüne göre kırılım (1 / X / 2)
  const byPick: Record<string, { total: number; correct: number }> = {
    '1': { total: 0, correct: 0 },
    X: { total: 0, correct: 0 },
    '2': { total: 0, correct: 0 },
  };
  for (const r of rows as any[]) {
    if (r.pick && byPick[r.pick]) {
      byPick[r.pick].total++;
      if (r.correct) byPick[r.pick].correct++;
    }
  }

  const recent = (rows as any[]).slice(0, recentLimit).map((r) => ({
    fixtureId: r.fixture_id,
    leagueName: r.league_name,
    homeName: r.home_name,
    awayName: r.away_name,
    kickoff: r.kickoff,
    pick: r.pick,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    homeScore: r.home_score,
    awayScore: r.away_score,
    result: r.result,
    correct: r.correct,
  }));

  return NextResponse.json({
    ok: true,
    total,
    correct,
    accuracy, // yüzde
    byPick: {
      home: byPick['1'],
      draw: byPick.X,
      away: byPick['2'],
    },
    recent,
  });
}
