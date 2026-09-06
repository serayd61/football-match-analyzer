// ============================================================================
// CRON — HAFTALIK MOTOR İNCELEMESİ (Pazartesi 05:00 UTC, fit-calibration'dan sonra)
// ----------------------------------------------------------------------------
// 1. Geç kalan settlement'ı dener (settle-engine gövdesi) + satır skoru geri dolumu.
// 2. Geçen ISO haftayı ve bir öncekini (geç sonuçlananlar için) yeniden hesaplar:
//    engine_weekly_metrics / engine_calibration_bins / engine_version_pairs UPSERT,
//    engine_weekly_reports + engine_learning_log (uyarı, öneri).
// Parametreler: ?week=2026-W36 (tek hafta), ?backfillWeeks=12 (son N hafta),
//               ?skipSettle=1 (yalnız hesap). Hepsi idempotent.
// Hiçbir şey otomatik terfi etmez; öneriler admin onayı bekler.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { settleEnginePredictions, backfillRowScores } from '@/lib/engine/settle';
import { computeWeek, buildReport } from '@/lib/engine/weekly';
import { parseIsoWeek, previousIsoWeek, isoWeekLabel, type IsoWeek } from '@/lib/engine/scoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
}

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const now = new Date();
  const client = sb();
  const t0 = Date.now();

  // Hafta listesi
  let weeks: IsoWeek[] = [];
  const single = url.searchParams.get('week');
  const back = Number(url.searchParams.get('backfillWeeks'));
  if (single) {
    const k = parseIsoWeek(single);
    if (!k) return NextResponse.json({ ok: false, error: 'week must be YYYY-Www' }, { status: 400 });
    weeks = [k];
  } else if (Number.isFinite(back) && back > 0) {
    for (let i = Math.min(back, 26); i >= 1; i--) weeks.push(previousIsoWeek(now, i));
  } else {
    weeks = [previousIsoWeek(now, 2), previousIsoWeek(now, 1)];
  }

  // 1) Geç settlement + skor geri dolumu (hata olsa da hesaba devam)
  let settle: unknown = null, backfill: unknown = null;
  if (url.searchParams.get('skipSettle') !== '1') {
    try { settle = await settleEnginePredictions(client, { now }); } catch (e: any) { settle = { error: e?.message }; }
    try { backfill = await backfillRowScores(client, 1000); } catch (e: any) { backfill = { error: e?.message }; }
  }

  // 2) Haftalar (eskiden yeniye → yuvarlanan pencere doğru okunur)
  const results: any[] = [];
  for (const key of weeks) {
    const label = isoWeekLabel(key);
    try {
      const computed = await computeWeek(client, key);
      const summary = await buildReport(client, key, computed);
      results.push({
        week: label, ok: true,
        counts: computed.counts, quality: computed.quality, written: computed.written, oddsCoverage: computed.oddsCoverage,
        markets: summary.markets, benchmark: summary.benchmark, versions: summary.versions,
        alerts: summary.alerts.map((a) => `${a.severity}:${a.code}`), proposals: summary.proposals.map((p) => `${p.type}:${p.subject}`),
      });
    } catch (e: any) {
      console.error(`[engine-weekly-review] ${label} failed:`, e?.message);
      results.push({ week: label, ok: false, error: e?.message });
    }
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), ms: Date.now() - t0, settle, backfill, weeks: results });
}
