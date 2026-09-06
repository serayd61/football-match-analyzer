import 'server-only';
import { unstable_cache } from 'next/cache';
import { db, REVALIDATE } from './db';

// Public "Haftalık gelişim" bölümü: engine_weekly_metrics'ten okur, yeniden
// hesaplamaz. Resmi sürüm ('official'), kapsanan ligler toplamı (league_id 0).

export interface WeeklyRow {
  week: string; weekStart: string;
  market: '1x2' | 'dc' | 'ou25' | 'btts';
  n: number; nCorrect: number; accuracy: number | null; brier: number | null; logLoss: number | null; ece: number | null;
  confBrierRaw: number | null; confBrierCal: number | null;
  oddsN: number | null; marketAccuracy: number | null; modelAccuracyOnOdds: number | null; roiClosing: number | null;
}

export interface WeeklyProgress {
  weeks: string[];                                  // yeniden eskiye
  rows: WeeklyRow[];
  rolling: Record<string, { weeks: number; n: number; nCorrect: number; accuracy: number | null; brier: number | null; logLoss: number | null }>;
  benchmark: { n: number; model: number | null; market: number | null; roi: number | null } | null;
  calibration: { raw: number | null; cal: number | null } | null;
  latest: { week: string; generatedAt: string; alerts: Array<{ code: string; severity: string; message: string }> } | null;
}

const num = (v: unknown): number | null => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export const getWeeklyProgress = unstable_cache(
  async (weeks = 12): Promise<WeeklyProgress> => {
    const { data, error } = await db()
      .from('engine_weekly_metrics')
      .select('iso_year, iso_week, week_start, market, n, n_correct, accuracy, brier, log_loss, ece, conf_brier_raw, conf_brier_cal, odds_n, market_accuracy, model_accuracy_on_odds, roi_closing')
      .eq('model_version', 'official')
      .eq('league_id', 0)
      .order('week_start', { ascending: false })
      .limit(weeks * 4);
    if (error) {
      console.error('[site/weekly-progress] read failed', error.message);
      return { weeks: [], rows: [], rolling: {}, benchmark: null, calibration: null, latest: null };
    }
    const rows: WeeklyRow[] = ((data || []) as any[]).map((r) => ({
      week: `${r.iso_year}-W${String(r.iso_week).padStart(2, '0')}`, weekStart: r.week_start, market: r.market,
      n: r.n, nCorrect: r.n_correct, accuracy: num(r.accuracy), brier: num(r.brier), logLoss: num(r.log_loss), ece: num(r.ece),
      confBrierRaw: num(r.conf_brier_raw), confBrierCal: num(r.conf_brier_cal),
      oddsN: r.odds_n ?? null, marketAccuracy: num(r.market_accuracy), modelAccuracyOnOdds: num(r.model_accuracy_on_odds), roiClosing: num(r.roi_closing),
    }));
    const weekList = [...new Set(rows.map((r) => r.week))].slice(0, weeks);
    const keep = new Set(weekList);
    const kept = rows.filter((r) => keep.has(r.week));

    const rolling: WeeklyProgress['rolling'] = {};
    for (const m of ['1x2', 'dc', 'ou25', 'btts'] as const) {
      const rs = kept.filter((r) => r.market === m);
      const n = rs.reduce((s, r) => s + r.n, 0);
      if (!n) continue;
      const w = (f: (r: WeeklyRow) => number | null) => {
        let num = 0, den = 0;
        for (const r of rs) { const v = f(r); if (v != null) { num += v * r.n; den += r.n; } }
        return den ? Math.round((num / den) * 10000) / 10000 : null;
      };
      rolling[m] = { weeks: rs.length, n, nCorrect: rs.reduce((s, r) => s + r.nCorrect, 0), accuracy: w((r) => r.accuracy), brier: w((r) => r.brier), logLoss: w((r) => r.logLoss) };
    }

    const x = kept.filter((r) => r.market === '1x2' && r.oddsN);
    const oddsN = x.reduce((s, r) => s + (r.oddsN || 0), 0);
    const wo = (f: (r: WeeklyRow) => number | null) => {
      let num = 0, den = 0;
      for (const r of x) { const v = f(r); if (v != null && r.oddsN) { num += v * r.oddsN; den += r.oddsN; } }
      return den ? Math.round((num / den) * 10000) / 10000 : null;
    };
    const benchmark = oddsN ? { n: oddsN, model: wo((r) => r.modelAccuracyOnOdds), market: wo((r) => r.marketAccuracy), roi: wo((r) => r.roiClosing) } : null;

    const c = kept.filter((r) => r.market === '1x2' && r.confBrierCal != null && r.confBrierRaw != null);
    const cn = c.reduce((s, r) => s + r.n, 0);
    const calibration = cn ? {
      raw: Math.round((c.reduce((s, r) => s + r.confBrierRaw! * r.n, 0) / cn) * 10000) / 10000,
      cal: Math.round((c.reduce((s, r) => s + r.confBrierCal! * r.n, 0) / cn) * 10000) / 10000,
    } : null;

    const { data: rep } = await db().from('engine_weekly_reports').select('summary, generated_at').order('iso_year', { ascending: false }).order('iso_week', { ascending: false }).limit(1).maybeSingle();
    const latest = rep ? {
      week: String((rep as any).summary?.week ?? ''), generatedAt: (rep as any).generated_at,
      alerts: (((rep as any).summary?.alerts ?? []) as any[]).filter((a) => a.severity !== 'info').map((a) => ({ code: a.code, severity: a.severity, message: a.message })),
    } : null;

    return { weeks: weekList, rows: kept, rolling, benchmark, calibration, latest };
  },
  ['site-weekly-progress'],
  { revalidate: REVALIDATE.performance },
);
