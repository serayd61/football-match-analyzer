// ============================================================================
// API V2: PREDICTION FOR MATCH — analiz sonucu ekranındaki dönüşüm kartı.
// Tek fikstür için motor seçiminin VARLIĞINI ve ligdeki son 30 gün isabetini
// herkese açık döner (kanıt + merak); seçimin KENDİSİ yalnızca Pro'ya açılır
// (hasEnginePredictionAccess — predictions/list ile aynı kapı). Free'ye pick
// alanları null döner, veri sızmaz.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasEnginePredictionAccess } from '@/lib/accessControl';

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
  const fixtureId = parseInt(searchParams.get('fixtureId') || '', 10);
  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ ok: false, error: 'fixtureId required' }, { status: 400 });
  }

  try {
    const { data: predRow, error } = await sb()
      .from('engine_predictions')
      .select(
        'fixture_id, league_id, league_name, home_name, away_name, kickoff, ' +
          'pick, confidence, p_home, p_draw, p_away, rationale, settled',
      )
      .eq('fixture_id', fixtureId)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!predRow) {
      return NextResponse.json({ ok: true, exists: false });
    }
    const pred = predRow as any;

    // Bu ligde son 30 günün settled isabeti (public kanıt satırı)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: leagueRows } = await sb()
      .from('engine_predictions')
      .select('correct')
      .eq('settled', true)
      .not('result', 'is', null)
      .eq('league_id', pred.league_id)
      .gte('kickoff', since);

    const leagueTotal = leagueRows?.length || 0;
    const leagueCorrect = leagueRows?.filter((r: any) => r.correct === true).length || 0;
    const leagueAccuracy = leagueTotal
      ? Math.round((leagueCorrect / leagueTotal) * 1000) / 10
      : null;

    const session = await getServerSession(authOptions);
    const unlocked = await hasEnginePredictionAccess(session?.user?.email);

    return NextResponse.json({
      ok: true,
      exists: true,
      locked: !unlocked,
      leagueId: pred.league_id,
      leagueName: pred.league_name,
      league30d: { total: leagueTotal, correct: leagueCorrect, accuracy: leagueAccuracy },
      pick: unlocked
        ? {
            pick: pred.pick,
            confidence: pred.confidence != null ? Number(pred.confidence) : null,
            pHome: pred.p_home != null ? Number(pred.p_home) : null,
            pDraw: pred.p_draw != null ? Number(pred.p_draw) : null,
            pAway: pred.p_away != null ? Number(pred.p_away) : null,
            rationale: pred.rationale ?? null,
            homeName: pred.home_name,
            awayName: pred.away_name,
          }
        : null,
    });
  } catch (e: any) {
    console.error('[predictions/for-match] error:', e?.message);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
