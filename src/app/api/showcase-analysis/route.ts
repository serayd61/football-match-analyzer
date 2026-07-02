// ============================================================================
// API: SHOWCASE ANALYSIS — vitrin için tek örnek analiz (public, cache'li).
// Cron'un zaten ürettiği smart_analysis kayıtlarından en güncel, kaliteli
// olanı kompakt şekilde döner. Amaç: free/yeni kullanıcıya "bir analiz böyle
// görünür"ü SIFIR ek AI maliyetiyle göstermek. PII yok, tek kayıt.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    // En güncel, verisi olan analiz (no_data hariç) — yaklaşan maç tercih edilir,
    // yoksa en son analiz edilen maç gösterilir (sezon arası fallback).
    const base = () =>
      sb()
        .from('smart_analysis')
        .select(
          'fixture_id, home_team, away_team, league, match_date, ' +
            'match_result_prediction, match_result_confidence, ' +
            'over_under_prediction, over_under_confidence, ' +
            'btts_prediction, btts_confidence, ' +
            'overall_confidence, risk_level, analysis, created_at',
        )
        .neq('data_quality', 'no_data');

    const nowIso = new Date().toISOString();
    const { data: upcoming } = await base()
      .gte('match_date', nowIso)
      .order('match_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    let row: any = upcoming;
    if (!row) {
      const { data: latest } = await base()
        .order('match_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      row = latest;
    }

    if (!row) {
      return NextResponse.json({ ok: false, code: 'no_showcase' }, { status: 404 });
    }

    const a: any = row.analysis || {};
    return NextResponse.json(
      {
        ok: true,
        showcase: {
          fixtureId: row.fixture_id,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
          league: row.league,
          matchDate: row.match_date,
          matchResult: {
            prediction: row.match_result_prediction,
            confidence: row.match_result_confidence,
            reasoning: a?.matchResult?.reasoning || null,
          },
          overUnder: { prediction: row.over_under_prediction, confidence: row.over_under_confidence },
          btts: { prediction: row.btts_prediction, confidence: row.btts_confidence },
          bestBet: a?.bestBet
            ? { market: a.bestBet.market, selection: a.bestBet.selection, confidence: a.bestBet.confidence, reason: a.bestBet.reason }
            : null,
          overallConfidence: row.overall_confidence,
          riskLevel: row.risk_level,
          analyzedAt: row.created_at,
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
    );
  } catch (e: any) {
    console.error('[showcase-analysis] error', e?.message);
    return NextResponse.json({ ok: false, code: 'internal_error' }, { status: 500 });
  }
}
