// ============================================================================
// API V2: PREDICTIONS LIST (public, read-only)
// engine_predictions tablosundan yaklaşan tahminleri döndürür.
// Abonelik/giriş akışına dokunmaz — sadece okuma.
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
  const date = searchParams.get('date'); // YYYY-MM-DD (opsiyonel)
  const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 500);

  let q = sb()
    .from('engine_predictions')
    .select(
      'fixture_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, ' +
        'p_home, p_draw, p_away, p_over25, p_btts_yes, lambda_home, lambda_away, ' +
        'pick, confidence, rationale, settled, home_score, away_score, result, correct, model_version',
    )
    .order('kickoff', { ascending: true })
    .limit(limit);

  if (date) {
    // o günün maçları (kickoff o tarihte)
    q = q.gte('kickoff', `${date}T00:00:00Z`).lt('kickoff', `${date}T23:59:59Z`);
  } else {
    // varsayılan: henüz sonuçlanmamış (yaklaşan) tahminler
    q = q.eq('settled', false);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[predictions/list] error:', error.message);
    return NextResponse.json({ ok: false, error: error.message, predictions: [] }, { status: 500 });
  }

  const predictions = (data || []).map((p: any) => ({
    fixtureId: p.fixture_id,
    leagueId: p.league_id,
    leagueName: p.league_name,
    homeId: p.home_id,
    homeName: p.home_name,
    awayId: p.away_id,
    awayName: p.away_name,
    kickoff: p.kickoff,
    pHome: Number(p.p_home),
    pDraw: Number(p.p_draw),
    pAway: Number(p.p_away),
    pOver25: p.p_over25 != null ? Number(p.p_over25) : null,
    pBttsYes: p.p_btts_yes != null ? Number(p.p_btts_yes) : null,
    lambdaHome: p.lambda_home != null ? Number(p.lambda_home) : null,
    lambdaAway: p.lambda_away != null ? Number(p.lambda_away) : null,
    pick: p.pick,
    confidence: p.confidence != null ? Number(p.confidence) : null,
    rationale: p.rationale,
    settled: p.settled,
    homeScore: p.home_score,
    awayScore: p.away_score,
    result: p.result,
    correct: p.correct,
  }));

  return NextResponse.json({ ok: true, count: predictions.length, predictions });
}
