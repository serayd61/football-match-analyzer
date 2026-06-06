// ============================================================================
// API: MATCH INTELLIGENCE (korumalı, salt okuma — CACHE'ten)
// match_intelligence tablosundan önizleme/haber digesti/istatistik tahmini döner.
// ⚠️ Senkron Dolphin çağrısı YOK — yalnızca Hetzner batch'in yazdığı cache okunur.
// ERİŞİM: giriş + aktif abonelik/deneme (veya admin). engine_predictions ile aynı kapı.
//   Giriş yoksa 401, abonelik yoksa 403 → veri sızdırmaz.
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

const COLS =
  'match_id, league_id, league_name, home_id, home_name, away_id, away_name, kickoff, ' +
  'stats_prediction, news_digest, preview_tr, preview_en, preview_de, confidence, ' +
  'preview_de_provider, model_version, updated_at';

function mapRow(r: any) {
  return {
    matchId: r.match_id,
    leagueId: r.league_id,
    leagueName: r.league_name,
    homeId: r.home_id,
    homeName: r.home_name,
    awayId: r.away_id,
    awayName: r.away_name,
    kickoff: r.kickoff,
    statsPrediction: r.stats_prediction,
    newsDigest: r.news_digest,
    preview: { tr: r.preview_tr, en: r.preview_en, de: r.preview_de },
    previewDeProvider: r.preview_de_provider,
    confidence: r.confidence,
    modelVersion: r.model_version,
    updatedAt: r.updated_at,
  };
}

export async function GET(request: NextRequest) {
  // --- Erişim: giriş + abonelik/deneme (veya admin) ---
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json(
      { ok: false, code: 'auth_required', error: 'Giriş gerekli', items: [] },
      { status: 401 },
    );
  }
  const allowed = await hasEnginePredictionAccess(email);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, code: 'subscription_required', error: 'Aktif abonelik/deneme gerekli', items: [] },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('matchId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 300);

  // Tek maç (maç kartı sekmesi için)
  if (matchId) {
    const { data, error } = await sb()
      .from('match_intelligence')
      .select(COLS)
      .eq('match_id', Number(matchId))
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[match-intelligence] error:', error.message);
      return NextResponse.json({ ok: false, error: error.message, item: null }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: data ? mapRow(data) : null });
  }

  // Liste: yaklaşan (kickoff >= şimdi) maçlar
  const nowIso = new Date().toISOString();
  const { data, error } = await sb()
    .from('match_intelligence')
    .select(COLS)
    .gte('kickoff', nowIso)
    .order('kickoff', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[match-intelligence] error:', error.message);
    return NextResponse.json({ ok: false, error: error.message, items: [] }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: (data || []).length, items: (data || []).map(mapRow) });
}
