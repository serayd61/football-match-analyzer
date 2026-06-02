// ============================================================================
// API V2: PREDICTIONS INGEST
// n8n → FastAPI predict-service çıktısını alır, engine_predictions'a yazar.
// Bearer token: PREDICTIONS_API_SECRET (mevcut sırrı yeniden kullanır).
// Eski tahmin tablolarına DOKUNMAZ.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const API_SECRET = process.env.PREDICTIONS_API_SECRET || process.env.CRON_SECRET || '';

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

interface IncomingPrediction {
  fixtureId: number | string;
  leagueId?: number;
  leagueName?: string;
  homeId?: number;
  homeName?: string;
  awayId?: number;
  awayName?: string;
  kickoff?: string;
  p_home?: number;
  p_draw?: number;
  p_away?: number;
  p_over25?: number;
  p_btts_yes?: number;
  lambda_home?: number;
  lambda_away?: number;
  pick?: string;
  confidence?: number;
  rationale?: string;
  modelVersion?: string;
}

function num(v: any): number | null {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: NextRequest) {
  // --- Auth ---
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!API_SECRET || apiKey !== API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const list: IncomingPrediction[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.predictions)
      ? body.predictions
      : [];

  // Boş gün/kapsama yok → hata değil, sessizce başarı (workflow patlamasın)
  if (!list.length) {
    return NextResponse.json({ success: true, received: 0, upserted: 0, note: 'no predictions' });
  }

  const rows = list
    .filter((p) => p && p.fixtureId != null)
    .map((p) => ({
      fixture_id: Number(p.fixtureId),
      league_id: p.leagueId ?? null,
      league_name: p.leagueName ?? null,
      home_id: p.homeId ?? null,
      home_name: p.homeName ?? null,
      away_id: p.awayId ?? null,
      away_name: p.awayName ?? null,
      kickoff: p.kickoff ?? null,
      p_home: num(p.p_home),
      p_draw: num(p.p_draw),
      p_away: num(p.p_away),
      p_over25: num(p.p_over25),
      p_btts_yes: num(p.p_btts_yes),
      lambda_home: num(p.lambda_home),
      lambda_away: num(p.lambda_away),
      pick: p.pick ?? null,
      confidence: num(p.confidence),
      rationale: p.rationale ?? null,
      model_version: p.modelVersion || 'dc-1.0',
    }));

  if (!rows.length) {
    return NextResponse.json({ success: true, received: list.length, upserted: 0, note: 'no valid rows' });
  }

  const { error, count } = await sb()
    .from('engine_predictions')
    .upsert(rows, { onConflict: 'fixture_id,model_version', count: 'exact' });

  if (error) {
    console.error('[ingest] supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    received: list.length,
    upserted: count ?? rows.length,
  });
}

// Sağlık/kontrol için GET (kaç tahmin var, en son ne zaman)
export async function GET() {
  const { count } = await sb()
    .from('engine_predictions')
    .select('*', { count: 'exact', head: true });
  return NextResponse.json({ ok: true, total: count ?? 0 });
}
