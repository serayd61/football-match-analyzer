// ============================================================================
// PUBLIC — haftalık motor karnesi (agregat; PII yok)
// GET /api/v2/engine/weekly?weeks=12&version=official&league_id=0&market=1x2
//   → { weeks: [...haftalık satırlar], rolling: {market → toplam}, bins: {...},
//       latest: {week, alerts, proposals(sayı)} }
// Yalnız engine_weekly_metrics'ten okur (yeniden hesap yok). 5 dk cache.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mergeBins, eceFromBins, type BinAcc } from '@/lib/engine/scoring';

export const dynamic = 'force-dynamic';

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
  });
}

const MARKETS = ['1x2', 'dc', 'ou25', 'btts'] as const;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const weeks = Math.min(Math.max(Number(url.searchParams.get('weeks')) || 12, 1), 52);
  const version = (url.searchParams.get('version') || 'official').slice(0, 40);
  const leagueId = Number(url.searchParams.get('league_id') ?? 0) || 0;
  const marketParam = url.searchParams.get('market');
  const client = sb();

  let q = client
    .from('engine_weekly_metrics')
    .select('iso_year, iso_week, week_start, league_id, market, model_version, n, n_correct, accuracy, brier, log_loss, ece, avg_confidence, conf_brier_raw, conf_brier_cal, calib_fitted_at, odds_n, market_accuracy, market_brier, model_accuracy_on_odds, roi_closing, computed_at')
    .eq('model_version', version)
    .eq('league_id', leagueId)
    .order('week_start', { ascending: false })
    .limit(weeks * MARKETS.length);
  if (marketParam && (MARKETS as readonly string[]).includes(marketParam)) q = q.eq('market', marketParam);
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const weekKeys = [...new Set(((rows || []) as any[]).map((r: any) => `${r.iso_year}-W${String(r.iso_week).padStart(2, '0')}`))].slice(0, weeks);
  const keep = new Set(weekKeys);
  const list = ((rows || []) as any[]).filter((r: any) => keep.has(`${r.iso_year}-W${String(r.iso_week).padStart(2, '0')}`));

  // n-ağırlıklı yuvarlanan toplam (pencere = döndürülen haftalar)
  const rolling: Record<string, any> = {};
  for (const m of MARKETS) {
    const rs = list.filter((r: any) => r.market === m);
    const n = rs.reduce((s: number, r: any) => s + r.n, 0);
    if (!n) continue;
    const w = (f: string) => {
      let num = 0, den = 0;
      for (const r of rs) if (r[f] != null) { num += Number(r[f]) * r.n; den += r.n; }
      return den ? Math.round((num / den) * 10000) / 10000 : null;
    };
    const oddsN = rs.reduce((s: number, r: any) => s + (r.odds_n || 0), 0);
    const wo = (f: string) => {
      let num = 0, den = 0;
      for (const r of rs) if (r[f] != null && r.odds_n) { num += Number(r[f]) * r.odds_n; den += r.odds_n; }
      return den ? Math.round((num / den) * 10000) / 10000 : null;
    };
    rolling[m] = {
      weeks: rs.length, n, nCorrect: rs.reduce((s: number, r: any) => s + r.n_correct, 0),
      accuracy: w('accuracy'), brier: w('brier'), logLoss: w('log_loss'), avgConfidence: w('avg_confidence'),
      confBrierRaw: w('conf_brier_raw'), confBrierCal: w('conf_brier_cal'),
      oddsN: oddsN || null, marketAccuracy: wo('market_accuracy'), marketBrier: wo('market_brier'), modelAccuracyOnOdds: wo('model_accuracy_on_odds'), roiClosing: wo('roi_closing'),
    };
  }

  // Kovalar: pencere boyunca kesin toplam (league 0 için yazılır)
  const bins: Record<string, { bins: BinAcc[]; ece: number | null }> = {};
  if (leagueId === 0 && weekKeys.length) {
    const yearWeeks = list.map((r: any) => ({ y: r.iso_year, w: r.iso_week }));
    const minKey = Math.min(...yearWeeks.map((x) => x.y * 100 + x.w));
    const [minY, minW] = [Math.floor(minKey / 100), minKey % 100];
    const { data: binRows } = await client
      .from('engine_calibration_bins')
      .select('iso_year, iso_week, market, outcome, bin, n, sum_pred, sum_obs')
      .eq('model_version', version)
      .or(`iso_year.gt.${minY},and(iso_year.eq.${minY},iso_week.gte.${minW})`)
      .limit(5000);
    const groups = new Map<string, BinAcc[][]>();
    for (const r of (binRows || []) as any[]) {
      const k = `${r.market}/${r.outcome}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push([{ bin: r.bin, n: r.n, sum_pred: Number(r.sum_pred), sum_obs: Number(r.sum_obs) }]);
    }
    for (const [k, parts] of groups) {
      const merged = mergeBins(parts);
      bins[k] = { bins: merged.filter((b) => b.n > 0), ece: eceFromBins(merged) };
    }
  }

  // Son rapor: yalnız uyarı kodları ve öneri sayısı (kanıt ayrıntısı admin rotasında)
  const { data: rep } = await client.from('engine_weekly_reports').select('iso_year, iso_week, summary, generated_at').order('iso_year', { ascending: false }).order('iso_week', { ascending: false }).limit(1).maybeSingle();
  const latest = rep ? {
    week: (rep as any).summary?.week, generatedAt: (rep as any).generated_at,
    quality: (rep as any).summary?.quality ?? null,
    alerts: ((rep as any).summary?.alerts ?? []).map((a: any) => ({ code: a.code, severity: a.severity, message: a.message })),
    proposals: ((rep as any).summary?.proposals ?? []).map((p: any) => ({ type: p.type, subject: p.subject })),
  } : null;

  return NextResponse.json(
    { ok: true, version, leagueId, weeks: list, rolling, bins, latest },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
