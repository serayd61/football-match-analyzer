// ============================================================================
// CRON — GÜVEN KALİBRASYONU FIT
// Sonuçlanmış tahminlerden (güven → gerçek isabet) izotonik eğri çıkarır ve
// confidence_calibration'a yazar. Haftalık (Pazartesi 03:50 UTC).
//
// Dört segment fit edilir:
//   all     — 1X2 güveni, tüm sonuçlanmış tahminler (geniş örneklem)
//   covered — 1X2 güveni, yalnızca modeli fit edilmiş ligler (DOĞRU rejim)
//   ou25    — Üst/Alt 2.5: x = seçilen tarafın ham olasılığı, y = tuttu mu
//   btts    — KG Var/Yok: aynı şema (bkz. lib/goal-markets.ts ölçümü —
//             ham olasılıklar 10-30 puan şişik, gösterim bu eğrilerden geçer)
// Okuma tarafı 1X2'de 'covered'ı tercih eder; yeterli örnek birikene kadar
// (MIN_COVERED) yazılmaz, böylece gürültülü bir eğri sağlamın yerini almaz.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fitIsotonic, brier, applyCurve, invalidateCalibrationCache } from '@/lib/calibration';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MIN_ALL = 300;      // altında eğri fit etmeye değmez
const MIN_COVERED = 300;  // modelli ligler kendi eğrisini hak edene kadar bekle

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
      },
    );
  }
  return _sb;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Sonuçlanmış tahminler (void'ler hariç: result NULL olanlar oynanmamış sayılır).
  // ⚠️ PostgREST varsayılan üst sınırı 1000 satır — .limit() bunu AŞMAZ.
  // Kalibrasyonun tüm geçmişi görmesi şart, o yüzden range ile sayfalanır.
  const PAGE = 1000;
  const data: any[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data: page, error } = await sb()
      .from('engine_predictions')
      .select('league_id, league_name, confidence, correct, p_over25, p_btts_yes, home_score, away_score')
      .eq('settled', true)
      .not('result', 'is', null)
      .not('correct', 'is', null)
      .not('confidence', 'is', null)
      .order('kickoff', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[fit-calibration] read error:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!page?.length) break;
    data.push(...page);
    if (page.length < PAGE) break;
  }

  const catalog = await getCatalogMap().catch(() => new Map());
  const all: Array<{ x: number; y: number }> = [];
  const covered: Array<{ x: number; y: number }> = [];
  const ou25: Array<{ x: number; y: number }> = [];
  const btts: Array<{ x: number; y: number }> = [];

  for (const r of data) {
    const x = Number(r.confidence);
    if (!Number.isFinite(x)) continue;
    const y = r.correct === true ? 1 : 0;
    all.push({ x, y });

    const cat = catalog.get(Number(r.league_id));
    const name = isUnresolvedLeagueName(r.league_name) && cat ? cat.name : r.league_name;
    if (isModelCovered(name, r.league_id, cat?.ccode)) covered.push({ x, y });

    // Gol pazarları: x = seçilen tarafın ham olasılığı (>= 0.5), y = tuttu mu.
    // Skor yoksa (void) atlanır; deriveOverUnder/deriveBtts ile aynı kural.
    const hs = Number(r.home_score), as = Number(r.away_score);
    if (Number.isFinite(hs) && Number.isFinite(as)) {
      const pOver = Number(r.p_over25);
      if (Number.isFinite(pOver) && pOver >= 0 && pOver <= 1) {
        const pickOver = pOver >= 0.5;
        ou25.push({ x: pickOver ? pOver : 1 - pOver, y: pickOver === (hs + as >= 3) ? 1 : 0 });
      }
      const pBtts = Number(r.p_btts_yes);
      if (Number.isFinite(pBtts) && pBtts >= 0 && pBtts <= 1) {
        const pickYes = pBtts >= 0.5;
        btts.push({ x: pickYes ? pBtts : 1 - pBtts, y: pickYes === (hs > 0 && as > 0) ? 1 : 0 });
      }
    }
  }

  const results: any[] = [];

  for (const [segment, pts, min] of [
    ['all', all, MIN_ALL] as const,
    ['covered', covered, MIN_COVERED] as const,
    ['ou25', ou25, MIN_ALL] as const,
    ['btts', btts, MIN_ALL] as const,
  ]) {
    if (pts.length < min) {
      results.push({ segment, skipped: true, n: pts.length, need: min });
      continue;
    }
    const knots = fitIsotonic(pts);
    if (knots.length < 2) {
      results.push({ segment, skipped: true, reason: 'degenerate_curve', n: pts.length });
      continue;
    }
    const before = brier(pts);
    const after = brier(pts.map((p) => ({ x: applyCurve(p.x, knots) ?? p.x, y: p.y })));

    const { error: insErr } = await sb().from('confidence_calibration').insert({
      segment,
      method: 'isotonic-pava',
      n_samples: pts.length,
      brier_before: before,
      brier_after: after,
      knots,
    });
    if (insErr) {
      console.error(`[fit-calibration] insert ${segment}:`, insErr.message);
      results.push({ segment, error: insErr.message });
      continue;
    }
    results.push({
      segment, n: pts.length, knots: knots.length,
      brierBefore: before, brierAfter: after,
      improvement: Math.round((before - after) * 10000) / 10000,
    });
  }

  invalidateCalibrationCache();
  return NextResponse.json({ ok: true, results });
}
