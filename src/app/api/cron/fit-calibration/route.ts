// ============================================================================
// CRON — GÜVEN KALİBRASYONU FIT
// Sonuçlanmış tahminlerden (güven → gerçek isabet) izotonik eğri çıkarır ve
// confidence_calibration'a yazar. Haftalık (Pazartesi 03:50 UTC).
//
// Dört segment fit edilir:
//   all     — 1X2 güveni, tüm sonuçlanmış tahminler (geniş örneklem)
//   covered — 1X2 güveni, yalnızca modeli fit edilmiş ligler (DOĞRU rejim)
//   ou25    — Üst/Alt 2.5: x = seçilen tarafın ham olasılığı, y = tuttu mu
//   btts    — KG Var/Yok: aynı şema
// Okuma tarafı 1X2'de 'covered'ı tercih eder; yeterli örnek birikene kadar
// (MIN_COVERED) yazılmaz, böylece gürültülü bir eğri sağlamın yerini almaz.
//
// Denetim 2026-09-05:
//   • null/boş değerler artık 0'a dönüşmez (lib/calibration-eval.finiteOrNull).
//   • `brier_before/after` aynı örneklem üzerindedir → EĞİTİM ölçümü olarak
//     etiketlenir (in-sample). Ek olarak kronolojik %20 holdout ile dış
//     örneklem etkisi ölçülür ve varsa yeni sütunlara yazılır
//     (brier_holdout_before/after, n_holdout, fit_from, fit_to — bkz.
//     supabase/migrations/2026-09-05_confidence_calibration_holdout.sql).
//     Sütunlar yoksa eski şemaya düşülür ve uyarı loglanır.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fitIsotonic, brier, applyCurve, invalidateCalibrationCache } from '@/lib/calibration';
import { finiteOrNull, goalPoints, temporalSplit, holdoutBrier, type TPt } from '@/lib/calibration-eval';
import { getCatalogMap, isUnresolvedLeagueName } from '@/lib/league-catalog';
import { isModelCovered } from '@/lib/model-coverage';
import { pickOfficial, resolveOfficialVersion } from '@/lib/site/official';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MIN_ALL = 300;      // altında eğri fit etmeye değmez
const MIN_COVERED = 300;  // modelli ligler kendi eğrisini hak edene kadar bekle
const HOLDOUT_FRAC = 0.2;

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

const isMissingColumn = (msg: string) => /column|schema cache|PGRST204|42703/i.test(msg);

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Sonuçlanmış tahminler (void'ler hariç: result NULL olanlar oynanmamış sayılır).
  // ⚠️ PostgREST varsayılan üst sınırı 1000 satır — .limit() bunu AŞMAZ.
  // Kalibrasyonun tüm geçmişi görmesi şart, o yüzden range ile sayfalanır.
  const PAGE = 1000;
  const raw: any[] = [];
  for (let from = 0; from < 50000; from += PAGE) {
    const { data: page, error } = await sb()
      .from('engine_predictions')
      .select('fixture_id, model_version, updated_at, kickoff, league_id, league_name, confidence, correct, p_over25, p_btts_yes, home_score, away_score')
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
    raw.push(...page);
    if (page.length < PAGE) break;
  }

  // Tek resmi satır / maç (birden çok model sürümü varsa çift sayma).
  const data = pickOfficial(raw.map((r) => ({ ...r, fixture_id: Number(r.fixture_id) })), await resolveOfficialVersion());

  const catalog = await getCatalogMap().catch(() => new Map());
  const all: TPt[] = [];
  const covered: TPt[] = [];
  let skippedConfidence = 0;

  for (const r of data) {
    const x = finiteOrNull(r.confidence);
    if (x == null || x < 0 || x > 1) { skippedConfidence++; continue; }
    const y = r.correct === true ? 1 : 0;
    const t = Date.parse(r.kickoff);
    all.push({ x, y, t });

    const cat = catalog.get(Number(r.league_id));
    const name = isUnresolvedLeagueName(r.league_name) && cat ? cat.name : r.league_name;
    if (isModelCovered(name, r.league_id, cat?.ccode)) covered.push({ x, y, t });
  }
  const goals = goalPoints(data);

  const results: any[] = [];
  let legacySchema = false;

  for (const [segment, pts, min] of [
    ['all', all, MIN_ALL] as const,
    ['covered', covered, MIN_COVERED] as const,
    ['ou25', goals.ou25, MIN_ALL] as const,
    ['btts', goals.btts, MIN_ALL] as const,
  ]) {
    if (pts.length < min) {
      results.push({ segment, skipped: true, n: pts.length, need: min });
      continue;
    }
    // Üretim eğrisi tüm örneklemden fit edilir; holdout yalnız RAPOR içindir.
    const knots = fitIsotonic(pts);
    if (knots.length < 2) {
      results.push({ segment, skipped: true, reason: 'degenerate_curve', n: pts.length });
      continue;
    }
    const before = brier(pts);
    const after = brier(pts.map((p) => ({ x: applyCurve(p.x, knots) ?? p.x, y: p.y })));
    const { train, holdout } = temporalSplit(pts, HOLDOUT_FRAC, min);
    const ho = holdoutBrier(train, holdout);
    const fitFrom = new Date(pts[0].t).toISOString();
    const fitTo = new Date(pts[pts.length - 1].t).toISOString();

    const base = { segment, method: 'isotonic-pava', n_samples: pts.length, brier_before: before, brier_after: after, knots };
    const extended = { ...base, brier_holdout_before: ho?.before ?? null, brier_holdout_after: ho?.after ?? null, n_holdout: ho?.n ?? 0, fit_from: fitFrom, fit_to: fitTo };

    let insErr = legacySchema ? null : (await sb().from('confidence_calibration').insert(extended)).error;
    if (insErr && isMissingColumn(insErr.message)) {
      console.warn('[fit-calibration] holdout columns missing — apply supabase/migrations/2026-09-05_confidence_calibration_holdout.sql; writing legacy row');
      legacySchema = true;
      insErr = null;
    }
    if (legacySchema) insErr = (await sb().from('confidence_calibration').insert(base)).error;
    if (insErr) {
      console.error(`[fit-calibration] insert ${segment}:`, insErr.message);
      results.push({ segment, error: insErr.message });
      continue;
    }
    results.push({
      segment, n: pts.length, knots: knots.length, fitFrom, fitTo,
      inSample: { label: 'training-set measurement (same rows the curve was fitted on)', brierBefore: before, brierAfter: after, improvement: Math.round((before - after) * 10000) / 10000 },
      holdout: ho ? { label: `chronological last ${Math.round(HOLDOUT_FRAC * 100)}% scored with a curve fitted on the earlier rows`, ...ho } : null,
    });
  }

  invalidateCalibrationCache();
  return NextResponse.json({
    ok: true,
    rows: { fetched: raw.length, official: data.length, skippedConfidence, goalSkipped: goals.skipped },
    schema: legacySchema ? 'legacy (holdout columns missing)' : 'extended',
    results,
  });
}
