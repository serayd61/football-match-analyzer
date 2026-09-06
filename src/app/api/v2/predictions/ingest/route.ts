// ============================================================================
// API V2: PREDICTIONS INGEST
// n8n → FastAPI predict-service çıktısını alır, engine_predictions'a yazar.
// Bearer token: PREDICTIONS_API_SECRET (mevcut sırrı yeniden kullanır).
// Eski tahmin tablolarına DOKUNMAZ.
//
// Denetim 2026-09-05 — veri sözleşmesi:
//   • Zod şeması: fixture/model/tarih, sonlu 0–1 olasılıklar, 1X2 toplamı
//     1 ± 0.02, lambda ≥ 0, pick = argmax. Eksik değer null kalır (0 olmaz).
//   • Satır bazlı karantina: geçerli satırlar yazılır, geçersizler `rejected`
//     listesinde nedenleriyle döner. Tümü geçersizse 422 — sessiz başarı yok.
//   • Kick-off'u geçmiş maç için pre-match tahmin (yeniden) yazılamaz;
//     `allowPastKickoff: true` ile açıkça izin verilmedikçe reddedilir.
//   • Yayın geçmişi: engine_predictions üzerindeki tetikleyici (bkz.
//     supabase/migrations/2026-09-05_engine_prediction_history.sql) her
//     insert/update'i değişmez tarihçeye kopyalar — burada ek iş gerekmez.
// ============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateIngestBatch, toEngineRow } from '@/lib/engine/ingest-schema';

// İki sunucu sırrından biri yeterli: n8n PREDICTIONS_API_SECRET ile, elle
// yeniden koşular (ör. 2026-09-04 RapidAPI kesintisi sonrası) CRON_SECRET ile.
const API_SECRETS = [process.env.PREDICTIONS_API_SECRET, process.env.CRON_SECRET].filter(
  (s): s is string => !!s,
);

const MAX_BATCH = 2000;

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _sb;
}

export async function POST(request: NextRequest) {
  // --- Auth ---
  const auth = request.headers.get('authorization') || '';
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!API_SECRETS.length || !apiKey || !API_SECRETS.includes(apiKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const list: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.predictions)
      ? body.predictions
      : [];
  const allowPastKickoff = !Array.isArray(body) && body?.allowPastKickoff === true;

  // Boş gün/kapsama yok → hata değil (workflow patlamasın) ama açıkça not düşülür.
  if (!list.length) {
    return NextResponse.json({ success: true, received: 0, upserted: 0, rejected: [], note: 'no predictions' });
  }
  if (list.length > MAX_BATCH) {
    return NextResponse.json({ error: `batch too large (${list.length} > ${MAX_BATCH})` }, { status: 413 });
  }

  const { valid, rejected } = validateIngestBatch(list, { allowPastKickoff });

  if (!valid.length) {
    return NextResponse.json(
      { success: false, received: list.length, upserted: 0, rejected, error: 'no valid rows' },
      { status: 422 },
    );
  }

  const rows = valid.map(toEngineRow);
  const { error, count } = await sb()
    .from('engine_predictions')
    .upsert(rows, { onConflict: 'fixture_id,model_version', count: 'exact' });

  if (error) {
    console.error('[ingest] supabase error:', error.message);
    return NextResponse.json({ error: error.message, rejected }, { status: 500 });
  }

  if (rejected.length) {
    console.warn(`[ingest] ${rejected.length}/${list.length} rows rejected`, rejected.slice(0, 5));
  }

  return NextResponse.json({
    success: true,
    received: list.length,
    upserted: count ?? rows.length,
    rejectedCount: rejected.length,
    rejected,
    modelVersions: Array.from(new Set(rows.map((r) => r.model_version))),
  });
}

// Sağlık/kontrol için GET (kaç tahmin var, en son ne zaman)
export async function GET() {
  const { count } = await sb()
    .from('engine_predictions')
    .select('*', { count: 'exact', head: true });
  return NextResponse.json({ ok: true, total: count ?? 0 });
}
