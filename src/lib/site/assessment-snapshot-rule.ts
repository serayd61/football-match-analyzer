// ============================================================================
// GÖLGE KAYIT — ortak değerlendirmenin maç öncesi anlık görüntüsü (saf, testli)
// ----------------------------------------------------------------------------
// Neden (2026-10-16): assess-1.0 durumlarının ileride ölçülebilmesi için her
// pazarın değerlendirmesi başlamaya ≤3 saat kala (showcase/reco/standing ile
// aynı pencere: freezeState === 'freeze') TEK kez yazılır. Satır eklemelidir;
// tekrar eden cron turu var olan satıra dokunmaz (unique + ignoreDuplicates +
// DB tetikleyicisi). Bütün durumlar kaydedilir — yalnız 'supported' tutmak
// seçim yanlılığı olurdu. Sonuç/skor bu satıra HİÇ yazılmaz; sonradan
// engine_predictions'tan okunarak eşlenir (settleSnapshots).
// ============================================================================
import { freezeState } from './showcase-rule';
import { settleStanding } from './standing-picks-rule';
import type { MatchAssessment, AssessmentStatus, AssessmentMarket } from './assessment';

export const SNAPSHOT_TABLE = 'site_assessment_snapshots';

export interface SnapshotSubject {
  fixtureId: number;
  kickoff: string;
  leagueId: number | null;
  leagueSlug: string | null;
  covered: boolean;
  homeName: string;
  awayName: string;
}

/** DB satırı (yalnız maç öncesi bilinen alanlar; skor/sonuç alanı yok). */
export interface AssessmentSnapshotRow {
  fixture_id: number;
  market: AssessmentMarket;
  selection: string;
  status: AssessmentStatus;
  reasons: string[];
  rule_version: string;
  model_version: string | null;
  assessed_at: string;
  kickoff: string;
  league_id: number | null;
  league_slug: string | null;
  covered: boolean;
  home_name: string;
  away_name: string;
  model_p: number;
  calibrated_p: number | null;
  calibration_available: boolean;
  calibration_segment: string | null;
  market_p: number | null;
  market_odds: number | null;
  market_phase: string | null;
  market_provider: string | null;
  market_captured_at: string | null;
  record_n: number | null;
  record_won: number | null;
  record_scope: string | null;
  record_kind: string | null;
  record_bucket: string | null;
  evidence_source: string | null;
  evidence_from: string | null;
  evidence_to: string | null;
  evidence_decided: number | null;
}

/** Yazma penceresi: başlamaya (0, 180] dk — başlamış maça kayıt açılmaz. */
export const inSnapshotWindow = (kickoff: string, now: number): boolean => freezeState(kickoff, now) === 'freeze';

/**
 * Değerlendirmeden satırlar. Değerlendirme anı başlama anından önce değilse
 * (sızıntı koruması) boş döner — "maç sonrası kayıt" asla üretilmez.
 */
export function toSnapshotRows(a: MatchAssessment, s: SnapshotSubject): AssessmentSnapshotRow[] {
  const at = Date.parse(a.assessedAt), ko = Date.parse(s.kickoff);
  if (!Number.isFinite(at) || !Number.isFinite(ko) || !(at < ko)) return [];
  return a.markets.map((m) => ({
    fixture_id: s.fixtureId, market: m.market, selection: m.selection, status: m.status, reasons: [...m.reasons],
    rule_version: m.ruleVersion, model_version: m.modelVersion, assessed_at: m.assessedAt, kickoff: s.kickoff,
    league_id: s.leagueId, league_slug: s.leagueSlug, covered: s.covered, home_name: s.homeName, away_name: s.awayName,
    model_p: m.model.p, calibrated_p: m.calibration.p, calibration_available: m.calibration.available, calibration_segment: m.calibration.segment,
    market_p: m.price.p, market_odds: m.price.odds, market_phase: m.price.phase, market_provider: m.price.provider, market_captured_at: m.price.capturedAt,
    record_n: m.record?.n ?? null, record_won: m.record?.won ?? null, record_scope: m.record?.scope ?? null, record_kind: m.record?.kind ?? null, record_bucket: m.record?.bucket ?? null,
    evidence_source: m.evidence.source, evidence_from: m.evidence.from, evidence_to: m.evidence.to, evidence_decided: m.evidence.decided,
  }));
}

/** Tekillik anahtarı: (fixture, pazar, kural sürümü) — ikinci tur aynı anahtarı geçer. */
export const snapshotKey = (r: Pick<AssessmentSnapshotRow, 'fixture_id' | 'market' | 'rule_version'>) => `${r.fixture_id}:${r.market}:${r.rule_version}`;

export interface StoredSnapshot { fixtureId: number; market: AssessmentMarket; selection: string; status: AssessmentStatus; kickoff: string; ruleVersion: string }
export interface SnapshotCell { n: number; won: number; pending: number }
export interface SnapshotRecord {
  /** keşifsel: yeterli veri birikene kadar karne değil */
  exploratory: true;
  byStatus: Record<AssessmentStatus, SnapshotCell>;
  byStatusMarket: Record<AssessmentStatus, Record<AssessmentMarket, SnapshotCell>>;
  total: SnapshotCell;
}

const cell = (): SnapshotCell => ({ n: 0, won: 0, pending: 0 });
const STATUSES: AssessmentStatus[] = ['supported', 'conflicting', 'insufficient'];
const MARKETS: AssessmentMarket[] = ['1x2', 'ou25', 'btts'];

/** Gölge satırları skorla eşler ve durum × pazar sayar; skoru olmayan satır `pending`. Hiçbir satır sonuca göre atılmaz. */
export function settleSnapshots(rows: StoredSnapshot[], scores: Map<number, [number, number]>): SnapshotRecord {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, cell()])) as SnapshotRecord['byStatus'];
  const byStatusMarket = Object.fromEntries(STATUSES.map((s) => [s, Object.fromEntries(MARKETS.map((m) => [m, cell()]))])) as SnapshotRecord['byStatusMarket'];
  const total = cell();
  for (const r of rows) {
    const sc = scores.get(r.fixtureId);
    const targets = [byStatus[r.status], byStatusMarket[r.status][r.market], total];
    if (!sc) { for (const t of targets) t.pending++; continue; }
    const won = settleStanding(r.market, r.selection, sc[0], sc[1]);
    for (const t of targets) { t.n++; if (won) t.won++; }
  }
  return { exploratory: true, byStatus, byStatusMarket, total };
}
