import 'server-only';
import type { SitePrediction, MarketSnapshot } from './predictions';
import { getPerformance, type PerformanceReport } from './performance';
import { outsideStandingFor, type OutsideStanding } from './outside-standing';
import { getMarketSnapshots } from './dashboard';
import { rowStanding } from './daily-standing';
import type { MarketStanding } from './match-standing';
import { assessMatch, inputsFor, type MatchAssessment, type AssessmentEvidenceMeta } from './assessment';

// ============================================================================
// ORTAK DEĞERLENDİRME — sunucu sarmalayıcı (2026-10-16)
// ----------------------------------------------------------------------------
// Maç detayı, tahmin listesi, dashboard, /picks ve gölge kayıt aynı girdileri
// aynı yoldan toplar: en geç faz 1X2 anlık görüntüsü (getMarketSnapshots),
// sinyal karnesi (perf.signals) ya da sicil dilim karnesi (gözlem ligi), satırın
// kendi gol pazarı harmanı. Karar assessment.ts'te (saf); burada yalnız veri
// toplanır. Sayfalara ayrı karar mantığı YAZILMAZ.
// ============================================================================

export interface AssessedRow {
  row: SitePrediction;
  standing: MarketStanding[];
  snapshot: MarketSnapshot | null;
  assessment: MatchAssessment;
}

export interface AssessDeps {
  perf: PerformanceReport | null;
  outside: OutsideStanding | null;
  snapshots: Record<number, MarketSnapshot>;
  now: number;
}

const evidenceOf = (row: SitePrediction, deps: AssessDeps): AssessmentEvidenceMeta =>
  row.covered
    ? { source: deps.perf ? 'signals' : null, from: deps.perf?.from ?? null, to: deps.perf?.to ?? null, decided: deps.perf?.overall.n ?? null }
    : { source: 'coverage', from: null, to: null, decided: null };

/** Karne + sicil + oran bağımlılıklarını toplar. `snapshots` verilirse (cron: önbelleksiz) oran sorgusu atlanır. */
export async function loadAssessDeps(fixtureIds: number[], opts: { snapshots?: Record<number, MarketSnapshot>; now?: number } = {}): Promise<AssessDeps> {
  const [perf, outside, snapshots] = await Promise.all([
    getPerformance(null).catch((e) => { console.error('[site/assess] performance failed', e); return null; }),
    outsideStandingFor().catch((e) => { console.error('[site/assess] coverage failed', e); return null; }),
    opts.snapshots ? Promise.resolve(opts.snapshots) : (fixtureIds.length ? getMarketSnapshots(fixtureIds).catch(() => ({} as Record<number, MarketSnapshot>)) : Promise.resolve({} as Record<number, MarketSnapshot>)),
  ]);
  return { perf, outside, snapshots, now: opts.now ?? Date.now() };
}

/**
 * Tek satırı değerlendirir. `standingOverride`: çağıran hükümleri zaten hesapladıysa
 * (maç sayfasında kapsam dışı / sicil 'excluded' lig) aynı değerlendirme yoluna sokar.
 * Modelsiz satır → null.
 */
export function assessWithDeps(row: SitePrediction, deps: AssessDeps, standingOverride?: MarketStanding[] | null): AssessedRow | null {
  if (!row.hasModel) return null;
  const snap = deps.snapshots[row.fixtureId] ?? null;
  const m = snap ? { pHome: snap.pHome, pDraw: snap.pDraw, pAway: snap.pAway } : null;
  const standing = standingOverride ?? (deps.perf ? rowStanding(row, m, deps.perf.signals, deps.outside?.standing) : (deps.outside?.standing(row, m) ?? null)) ?? [];
  const assessment = assessMatch(inputsFor(row, standing, snap), {
    now: new Date(deps.now).toISOString(), kickoff: row.kickoff, modelVersion: row.modelVersion, evidence: evidenceOf(row, deps),
  });
  return { row, standing, snapshot: snap, assessment };
}

/** Satır listesini değerlendirir (fixtureId → AssessedRow). Bağımlılıklar bir kez yüklenir. */
export async function assessRows(rows: SitePrediction[], opts: { snapshots?: Record<number, MarketSnapshot>; now?: number } = {}): Promise<Map<number, AssessedRow>> {
  const rated = rows.filter((r) => r.hasModel);
  const out = new Map<number, AssessedRow>();
  if (!rated.length) return out;
  const deps = await loadAssessDeps(rated.map((r) => r.fixtureId), opts);
  for (const r of rated) {
    const a = assessWithDeps(r, deps);
    if (a) out.set(r.fixtureId, a);
  }
  return out;
}
