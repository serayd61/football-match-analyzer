// ============================================================================
// ORTAK DEĞERLENDİRME — kural assess-1.0 (saf, testli; 'server-only' yok)
// ----------------------------------------------------------------------------
// Neden (2026-10-16): aynı maç için bir yerde "%74 güven / önerilen tahmin",
// başka yerde "benzer seçimler %24 tuttu" görülüyordu. Bu modül üç ayrı
// sinyali — model olasılığı, piyasa (marjsız) olasılığı, aynı durumdaki geçmiş
// seçimlerin kaydı — pazar başına TEK bir kanıt durumuna indirger:
//
//   supported    kanıt destekliyor   (kayıt alt sınırı güçlü eşiği geçiyor, piyasa çelişmiyor)
//   conflicting  sinyaller çelişiyor (piyasa koruması bayrağı ya da kayıt modeli dışlıyor)
//   insufficient kanıt yetersiz      (kova ince, aralık kararsız, piyasa sıkı, kayıt yok)
//
// Bunlar YENİ kazanma olasılığı değildir; kanıtın durumunu anlatan etiketlerdir.
// Üç sinyal matematiksel olarak aynı şeyi ölçmez: model p bu maçın olasılığı,
// piyasa p bahisçinin fiyatı, kayıt ise "aynı kovaya düşen geçmiş seçimlerimizin
// isabeti" (kova sınırları 12 Eyl backtest'inde geçmiş veride bulundu → ileriye
// dönük doğrulanmış sayılmaz, `validation: 'exploratory'`). Kalibre güven de
// aynı sonuçlanmış satırlardan türediği için kayıtla ÖRTÜŞÜR; bu yüzden ikinci
// bir oy gibi birleştirilmez, yalnız gösterim değeri olarak taşınır.
//
// Karar sırası (deterministik):
//   1. Piyasa koruması (risk.ts marketFlag): ayrışma ya da ≥+5 puan → conflicting.
//      Yüksek kalibre güven bunu geri çeviremez (canlı kayıt: ayrışmada %27,7,
//      +5 üstünde %30).
//   2. Kayıt modeli dışlıyorsa (Wilson üst sınırı hem güçlü eşiğin hem model
//      olasılığının altında) → conflicting.
//   3. Sıkı piyasa (favori < %45) → insufficient; asla supported olmaz.
//   4. Kayıt destekliyorsa (Wilson alt sınırı ≥ eşik, n ≥ MIN_SUPPORT_N) → supported.
//   5. Aksi hâlde insufficient (kova ince / aralık kararsız / kayıt yok).
// Eksik piyasa tek başına ret sebebi değildir: 1X2'de kayıt seviye kovasına düşer,
// gol pazarlarında piyasa zaten yalnız harman için kullanılır. Pazarlar birbirinden
// bağımsız değerlendirilir; 1X2'deki çelişki gol pazarına taşınmaz.
//
// Eşik gerekçesi: STRONG_ACC (1X2 %55, gol %65) ve MIN_EVIDENCE (10) projede zaten
// kullanılan "güçlü" tanımıdır; buradaki fark nokta isabet yerine %95 Wilson ALT
// sınırının eşiği geçmesi ve destek için ≥20 maç (kapsam bant kuralıyla aynı
// alt sınır, bandFor). 9/10 gibi küçük ama parlak örneklem böylece "destekli"
// sayılmaz. Wilson aralığı yalnız belirsizlik ölçüsüdür; avantaj ya da kârlılık
// kanıtı değildir.
// ============================================================================
import { marketFlag, OVER_EDGE, type MarketProbs, type MarketFlag } from './risk';
import { STRONG_ACC, MIN_EVIDENCE, type MarketStanding } from './match-standing';
import type { SignalMarket, SignalKind } from './signal-buckets';

export const ASSESSMENT_RULE_VERSION = 'assess-1.0';

export type AssessmentStatus = 'supported' | 'conflicting' | 'insufficient';
export type AssessmentMarket = SignalMarket;
export type AssessmentSelection = '1' | 'X' | '2' | 'over' | 'under' | 'yes' | 'no';

export type AssessmentReason =
  | 'market_disagrees'    // 1X2: piyasa favorisi seçimden farklı; gol: ham model seçilen tarafı <%50 görüyor (yön harmandan geldi)
  | 'market_above'        // seçimin model olasılığı marjsız piyasanın ≥ OVER_EDGE üstünde (aşırı güven bandı)
  | 'market_tight'        // 1X2: piyasa favorisi < TIGHT_FAV
  | 'market_missing'      // marjsız piyasa olasılığı yok
  | 'market_stale'        // son piyasa görüşü MARKET_STALE_HOURS'tan eski
  | 'record_supports'     // Wilson alt sınırı ≥ güçlü eşiği ve n ≥ MIN_SUPPORT_N
  | 'record_contradicts'  // Wilson üst sınırı < eşik VE < model olasılığı
  | 'record_uncertain'    // n ≥ MIN_EVIDENCE ama aralık ne destekliyor ne dışlıyor
  | 'record_thin'         // n < MIN_EVIDENCE
  | 'record_missing'      // kova yok (karne yüklenemedi / pazar karnede yok)
  | 'calibration_missing'; // kalibrasyon eğrisi yok → gösterilen değer HAM model çıktısı

/** Destek için gereken en az maç (kapsam bant kuralı bandFor ile aynı alt sınır). */
export const MIN_SUPPORT_N = 20;
/** %95 Wilson aralığı. */
export const WILSON_Z = 1.96;
/** Piyasa görüşü bu kadar saatten eskiyse 'market_stale'. */
export const MARKET_STALE_HOURS = 24;

export interface WilsonInterval { lower: number; upper: number }

/** Wilson skor aralığı (iki yönlü). n = 0 → null. */
export function wilson(won: number, n: number, z = WILSON_Z): WilsonInterval | null {
  if (!(n > 0) || won < 0 || won > n) return null;
  const p = won / n, z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lower: Math.max(0, centre - half), upper: Math.min(1, centre + half) };
}

export interface AssessmentRecordInput {
  n: number; won: number;
  scope: 'league' | 'all';
  kind: SignalKind;
  bucket: string;
}

export interface AssessmentMarketInput {
  market: AssessmentMarket;
  selection: AssessmentSelection;
  /** seçilen tarafın HAM model olasılığı */
  modelP: number;
  /** kalibrasyon eğrisinden geçmiş olasılık (eğri yoksa null) — gol pazarlarında harman DEĞİL */
  calibratedP: number | null;
  calibrationAvailable: boolean;
  calibrationSegment?: string | null;
  /** seçilen tarafın marjsız piyasa olasılığı (yoksa null) */
  marketP: number | null;
  /** 1X2 için marjsız üçlü (favori / sıkı maç kontrolü) */
  market1x2?: MarketProbs | null;
  marketOdds?: number | null;
  marketCapturedAt?: string | null;
  marketPhase?: string | null;
  marketProvider?: string | null;
  /** karne kovası: standingFor / coverageStanding birincil kanıtının KULLANILAN hücresi */
  record: AssessmentRecordInput | null;
}

export interface AssessmentEvidenceMeta {
  /** 'signals' = kapsanan lig sinyal karnesi, 'coverage' = sicil dilim karnesi */
  source: 'signals' | 'coverage' | null;
  from: string | null;
  to: string | null;
  /** karnedeki sonuçlanmış maç sayısı (biliniyorsa) */
  decided: number | null;
}

export interface AssessmentContext {
  /** değerlendirme anı (ISO) */
  now: string;
  kickoff: string;
  modelVersion: string | null;
  evidence: AssessmentEvidenceMeta;
}

export interface MarketAssessment {
  market: AssessmentMarket;
  selection: AssessmentSelection;
  status: AssessmentStatus;
  /** öncelik sırasıyla; ilk kod kartta kısa gerekçe olarak kullanılır */
  reasons: AssessmentReason[];
  model: { p: number };
  calibration: { p: number | null; available: boolean; segment: string | null };
  /** piyasa fiyatı (marjsız olasılık, oran, veri zamanı) ve koruma bayrağı */
  price: { p: number | null; odds: number | null; capturedAt: string | null; phase: string | null; provider: string | null; stale: boolean; flag: MarketFlag };
  record: {
    n: number; won: number; acc: number | null;
    lower: number | null; upper: number | null;
    threshold: number; scope: 'league' | 'all'; kind: SignalKind; bucket: string;
  } | null;
  evidence: AssessmentEvidenceMeta;
  /** kova sınırları geçmiş veride bulundu; ileriye dönük ölçüm gölge kayıttan gelecek */
  validation: 'exploratory';
  ruleVersion: string;
  modelVersion: string | null;
  assessedAt: string;
}

export interface MatchAssessment {
  markets: MarketAssessment[];
  ruleVersion: string;
  modelVersion: string | null;
  assessedAt: string;
}

const fin = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

function isStale(capturedAt: string | null | undefined, now: string, hours = MARKET_STALE_HOURS): boolean {
  if (!capturedAt) return false;
  const a = Date.parse(capturedAt), b = Date.parse(now);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b - a > hours * 3_600_000;
}

type RecordVerdict = 'supports' | 'contradicts' | 'uncertain' | 'thin' | 'missing';

function judgeRecord(rec: AssessmentRecordInput | null, modelP: number, threshold: number): { verdict: RecordVerdict; ci: WilsonInterval | null } {
  if (!rec) return { verdict: 'missing', ci: null };
  if (rec.n < MIN_EVIDENCE) return { verdict: 'thin', ci: wilson(rec.won, rec.n) };
  const ci = wilson(rec.won, rec.n)!;
  if (ci.upper < threshold && ci.upper < modelP) return { verdict: 'contradicts', ci };
  if (ci.lower >= threshold && rec.n >= MIN_SUPPORT_N) return { verdict: 'supports', ci };
  return { verdict: 'uncertain', ci };
}

/** Piyasa bayrağı: 1X2 risk.ts'teki korumayla birebir; gol pazarlarında yön ve +5 bandı. */
function flagFor(i: AssessmentMarketInput): MarketFlag {
  if (i.market === '1x2') {
    if (!i.market1x2) return null;
    return marketFlag(i.selection as '1' | 'X' | '2', i.market1x2, i.modelP);
  }
  if (!fin(i.marketP)) return null;
  if (i.modelP < 0.5) return 'disagree';
  if (i.modelP - i.marketP >= OVER_EDGE - 1e-9) return 'over';
  return null;
}

export function assessMarket(i: AssessmentMarketInput, ctx: AssessmentContext): MarketAssessment {
  const threshold = STRONG_ACC[i.market];
  const hasMarket = fin(i.marketP);
  const flag = flagFor(i);
  const stale = hasMarket && isStale(i.marketCapturedAt, ctx.now);
  const { verdict, ci } = judgeRecord(i.record, i.modelP, threshold);

  const reasons: AssessmentReason[] = [];
  if (flag === 'disagree') reasons.push('market_disagrees');
  else if (flag === 'over') reasons.push('market_above');
  else if (flag === 'tight') reasons.push('market_tight');
  if (verdict === 'contradicts') reasons.push('record_contradicts');
  if (verdict === 'supports') reasons.push('record_supports');
  if (verdict === 'uncertain') reasons.push('record_uncertain');
  if (verdict === 'thin') reasons.push('record_thin');
  if (verdict === 'missing') reasons.push('record_missing');
  if (!hasMarket) reasons.push('market_missing');
  if (stale) reasons.push('market_stale');
  if (!i.calibrationAvailable) reasons.push('calibration_missing');

  let status: AssessmentStatus;
  if (flag === 'disagree' || flag === 'over') status = 'conflicting';
  else if (verdict === 'contradicts') status = 'conflicting';
  else if (flag === 'tight') status = 'insufficient';
  else if (verdict === 'supports') status = 'supported';
  else status = 'insufficient';

  return {
    market: i.market,
    selection: i.selection,
    status,
    reasons,
    model: { p: i.modelP },
    calibration: { p: i.calibrationAvailable && fin(i.calibratedP) ? i.calibratedP : null, available: i.calibrationAvailable, segment: i.calibrationSegment ?? null },
    price: {
      p: hasMarket ? i.marketP : null, odds: fin(i.marketOdds) ? i.marketOdds : null,
      capturedAt: hasMarket ? i.marketCapturedAt ?? null : null, phase: hasMarket ? i.marketPhase ?? null : null, provider: hasMarket ? i.marketProvider ?? null : null,
      stale, flag,
    },
    record: i.record ? {
      n: i.record.n, won: i.record.won, acc: i.record.n ? i.record.won / i.record.n : null,
      lower: ci?.lower ?? null, upper: ci?.upper ?? null,
      threshold, scope: i.record.scope, kind: i.record.kind, bucket: i.record.bucket,
    } : null,
    evidence: ctx.evidence,
    validation: 'exploratory',
    ruleVersion: ASSESSMENT_RULE_VERSION,
    modelVersion: ctx.modelVersion,
    assessedAt: ctx.now,
  };
}

export function assessMatch(markets: AssessmentMarketInput[], ctx: AssessmentContext): MatchAssessment {
  return { markets: markets.map((m) => assessMarket(m, ctx)), ruleVersion: ASSESSMENT_RULE_VERSION, modelVersion: ctx.modelVersion, assessedAt: ctx.now };
}

export function marketOf(a: MatchAssessment | null | undefined, market: AssessmentMarket): MarketAssessment | null {
  return a?.markets.find((m) => m.market === market) ?? null;
}

// ---- Karne kovasından girdi ----------------------------------------------------
/** MarketStanding'in KULLANILAN hücresi (lig ≥ MIN_EVIDENCE ise lig, yoksa tüm ligler) — finishStanding ile aynı seçim. */
export function recordFromStanding(s: MarketStanding | null | undefined): AssessmentRecordInput | null {
  if (!s) return null;
  return { n: s.n, won: s.won, scope: s.scope, kind: s.primary.kind, bucket: s.primary.bucket };
}

// ---- SitePrediction benzeri satırdan girdi listesi -----------------------------
/** Sayfaların ortak kullandığı satır alanları (SitePrediction'ın alt kümesi; test için saf). */
export interface AssessableRow {
  pick: '1' | 'X' | '2' | null;
  pHome: number; pDraw: number; pAway: number;
  confidence: number | null;
  confidenceCalibrated: boolean;
  calibrationSegment: string | null;
  overUnder: { pick: 'over' | 'under'; pRaw: number; pMarket: number | null; blended: boolean; calibrated?: boolean; pCal?: number | null } | null;
  btts: { pick: 'yes' | 'no'; pRaw: number; pMarket: number | null; blended: boolean; calibrated?: boolean; pCal?: number | null } | null;
}

export interface Snapshot1x2 extends MarketProbs {
  homeOdds?: number | null; drawOdds?: number | null; awayOdds?: number | null;
  capturedAt?: string | null; phase?: string | null; provider?: string | null;
}

/** Satır + karne hükümleri + 1X2 anlık görüntüsünden pazar girdileri (pazar sırası sabit: 1x2, ou25, btts). */
export function inputsFor(row: AssessableRow, standing: MarketStanding[], snap: Snapshot1x2 | null): AssessmentMarketInput[] {
  const out: AssessmentMarketInput[] = [];
  const st = (m: AssessmentMarket) => standing.find((s) => s.market === m) ?? null;
  if (row.pick) {
    const p = row.pick === '1' ? row.pHome : row.pick === '2' ? row.pAway : row.pDraw;
    const mp = snap ? (row.pick === '1' ? snap.pHome : row.pick === '2' ? snap.pAway : snap.pDraw) : null;
    const odds = snap ? (row.pick === '1' ? snap.homeOdds : row.pick === '2' ? snap.awayOdds : snap.drawOdds) ?? null : null;
    out.push({
      market: '1x2', selection: row.pick, modelP: p,
      calibratedP: row.confidenceCalibrated ? row.confidence : null, calibrationAvailable: row.confidenceCalibrated, calibrationSegment: row.calibrationSegment,
      marketP: fin(mp) ? mp : null, market1x2: snap ? { pHome: snap.pHome, pDraw: snap.pDraw, pAway: snap.pAway } : null,
      marketOdds: odds, marketCapturedAt: snap?.capturedAt ?? null, marketPhase: snap?.phase ?? null, marketProvider: snap?.provider ?? null,
      record: recordFromStanding(st('1x2')),
    });
  }
  for (const [market, c] of [['ou25', row.overUnder], ['btts', row.btts]] as const) {
    if (!c) continue;
    out.push({
      market, selection: c.pick, modelP: c.pRaw,
      calibratedP: c.calibrated ? c.pCal ?? null : null, calibrationAvailable: !!c.calibrated, calibrationSegment: null,
      marketP: c.blended && fin(c.pMarket) ? c.pMarket : null,
      // Gol pazarı oranı GoalBook'tan gelir; satırda zaman/faz/sağlayıcı yok → uydurulmaz (null), bayatlık kontrolü yapılmaz.
      marketCapturedAt: null, marketPhase: null, marketProvider: null,
      record: recordFromStanding(st(market)),
    });
  }
  return out;
}
