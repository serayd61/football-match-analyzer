// ============================================================================
// CRON: engine_predictions settlement — ince sarmalayıcı
// Gövde: src/lib/engine/settle.ts (haftalık inceleme cron'u da aynı fonksiyonu
// çağırır). Saatlik (vercel.json). Açık (diğer cron'larla aynı desen);
// CRON_SECRET ayarlıysa Bearer ister.
//
//   GET /api/cron/settle-engine[?limit=900]   → bekleyenleri sonuçlandır
//   GET /api/cron/settle-engine?backfill=1    → Faz 1 satır skorlarını geri doldur
//                                               (kayıtlı skordan, API çağrısı yok;
//                                               1000 satır/çağrı, `remaining` döner)
// ============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { settleEnginePredictions, backfillRowScores } from '@/lib/engine/settle';

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        // 2026-09-06: Next.js, PostgREST GET'lerini URL bazında önbelleğe alıyordu.
        // Backfill seçimi sabit URL'li olduğundan her sayfa aynı 1000 satırı döndürdü
        // ("updated 20000", gerçekte 1000). Saatlik yol kickoff<now ile URL'i değiştirdiği
        // için etkilenmiyordu. Tüm okuma/yazmalar önbelleksiz.
        global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
      },
    );
  }
  return _sb;
}

export async function GET(request: NextRequest) {
  // Opsiyonel koruma: CRON_SECRET ayarlıysa Bearer iste
  const secret = process.env.CRON_SECRET || process.env.PREDICTIONS_API_SECRET || '';
  if (secret) {
    const auth = request.headers.get('authorization')?.replace('Bearer ', '');
    const isVercelCron = !!request.headers.get('x-vercel-cron');
    if (!isVercelCron && auth !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);

  try {
    if (searchParams.get('backfill') === '1') {
      const limit = parseInt(searchParams.get('limit') || '1000', 10) || 1000;
      // 300 sn fonksiyon sınırı; 240 sn bütçeyle sayfa sayfa ilerle, kalanı `remaining` bildirir
      const res = await backfillRowScores(sb(), limit, 240_000);
      return NextResponse.json({ ok: true, mode: 'backfill', ...res });
    }

    const limit = parseInt(searchParams.get('limit') || '900', 10) || 900;
    const res = await settleEnginePredictions(sb(), { limit });
    if (res.checked === 0 && res.dates === 0) {
      return NextResponse.json({ ok: true, ...res, note: 'no pending past matches' });
    }
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
