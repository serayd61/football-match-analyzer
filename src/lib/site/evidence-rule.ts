import { wilson } from './assessment';
import type { MatchAssessment, AssessmentMarket, AssessmentSelection, AssessmentStatus } from './assessment';

// ============================================================================
// GEÇMİŞ KANIT ANALİZİ — evidence-1.0 (saf kural, 2026-10-16)
// ----------------------------------------------------------------------------
// Bir maç için üç kanıt grubunu DETERMİNİSTİK kodla hesaplar:
//   A) takımların kendi geçmişi: ev sahibinin iç saha, deplasmanın dış saha maçları
//   B) karşılaştırılabilir maçlar: modelin maç-öncesi λ uzayında en yakın komşular
//   C) sinyal karnesi: assess-1.0 çıktısı (burada yeniden hesaplanmaz, olduğu gibi taşınır)
// Hiçbir sayı LLM'den gelmez; bu dosyada LLM çağrısı yoktur ve ilk sürümde hiç yoktur.
//
// Dürüstlük sınırları (docs/evidence-agent.md):
//  • Tek maç-öncesi özellik modelin kendi λ'sıdır (engine_predictions). Komşuların "gerçekleşme
//    oranı" bu yüzden modelin kendi kalibrasyonunun bir kontrolüdür; kalibrasyon eğrisi ve kova
//    kaydıyla ÖRTÜŞEN kanıttır, bağımsız oy değildir. Yeni olasılık üretilmez, harmanlanmaz.
//  • xG / Elo canlı modelde yok; geçmiş maç başına zaman damgalı kaydı yok → "hesaplanamıyor".
//  • Analiz zamanı (asOf) gerçek sınırdır: başlamamış ya da asOf'ta sonucu bilinmeyen maç havuza girmez.
//  • Grupların kesişimi sayılır ve raporlanır; yüzdeler toplanmaz, ortalanmaz.
//  • Durum (supported / conflicting / insufficient) yalnız assess-1.0'dan gelir; bu dosya değiştirmez.
// ============================================================================

export const EVIDENCE_RULE_VERSION = 'evidence-1.0';
export const EVIDENCE_VALIDATION = 'exploratory' as const;

/** Benzerlik parametreleri — sürümlü; değişirse EVIDENCE_RULE_VERSION de değişir. */
export const SIMILARITY = {
  /** maç-öncesi özellikler: modelin beklenen golleri (ev, deplasman) */
  features: ['lambdaHome', 'lambdaAway'] as const,
  /** en fazla komşu */
  k: 50,
  /** z-birimi yarıçap (özellikler havuzun kendi standart sapmasıyla ölçeklenir) — başlangıç seçimi */
  radius: 0.35,
  /** bunun altında 'similar_insufficient' */
  minN: 20,
  /** geçmiş penceresi (gün) */
  windowDays: 365,
  /** sonuç bilinme gecikmesi: settled_at yoksa kickoff + bu kadar saat */
  settleLagHours: 3,
} as const;

/** Takımın kendi geçmişi için ince örneklem sınırı (match-standing MIN_EVIDENCE ile aynı). */
export const OWN_THIN_N = 10;
/** Model–piyasa "uyuşuyor" bandı (puan); risk.ts OVER_EDGE ile aynı eşik. */
export const MARKET_AGREE_PTS = 0.05;

export interface PoolRow {
  fixtureId: number;
  leagueId: number | null;
  homeId: number | null;
  awayId: number | null;
  homeName: string;
  awayName: string;
  kickoff: string;
  /** sonucun yazıldığı an; yoksa kickoff + settleLagHours varsayılır */
  settledAt: string | null;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number | null;
  pBtts: number | null;
  lambdaHome: number;
  lambdaAway: number;
  homeScore: number;
  awayScore: number;
}

export interface EvidenceTarget {
  fixtureId: number;
  leagueId: number | null;
  homeId: number | null;
  awayId: number | null;
  homeName: string;
  awayName: string;
  kickoff: string;
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number | null;
  pBtts: number | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  pick: '1' | 'X' | '2' | null;
  overPick: 'over' | 'under' | null;
  bttsPick: 'yes' | 'no' | null;
  modelVersion: string | null;
  /** özelliklerin (λ, p) son yazıldığı an; asOf'tan sonraysa uyarı */
  featuresAt: string | null;
}

export interface Rate { won: number; n: number; p: number; lower: number; upper: number }

export interface GroupFixture {
  fixtureId: number;
  kickoff: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  lambdaHome: number;
  lambdaAway: number;
  /** yalnız benzer maçlarda: z-uzayı uzaklığı */
  distance: number | null;
}

export interface GroupStats {
  n: number;
  from: string | null;
  to: string | null;
  x12: { home: number; draw: number; away: number };
  over25: number;
  btts: number;
  /** gruptaki maçlarda modelin ortalama olasılığı — gerçekleşme oranıyla yan yana okunur (kalibrasyon kontrolü) */
  modelMean: { home: number; draw: number; away: number; over25: number | null; btts: number | null };
  fixtures: GroupFixture[];
}

export type SimilarScope = 'league' | 'covered' | 'all';

export interface SimilarGroup extends GroupStats {
  /** lig → kapsanan ligler → tüm ligler; ilk yeterli olan */
  scope: SimilarScope;
  /** ölçekleme için kullanılan havuz std'si (asOf öncesi veriden) */
  scale: { lambdaHome: number; lambdaAway: number };
  /** yarıçap içindeki aday sayısı (k ile kırpılmadan önce) */
  withinRadius: number;
  maxDistance: number | null;
}

export type EvidenceFinding =
  | 'similar_insufficient' | 'similar_agrees' | 'similar_below' | 'similar_above'
  | 'own_home_thin' | 'own_away_thin'
  | 'market_missing' | 'market_after_asof' | 'market_agrees' | 'market_above' | 'market_below'
  | 'calibration_missing';

export interface MarketEvidence {
  market: AssessmentMarket;
  selection: AssessmentSelection;
  /** assess-1.0 durumu; yoksa null — burada hesaplanmaz */
  status: AssessmentStatus | null;
  modelP: number;
  calibratedP: number | null;
  calibrationAvailable: boolean;
  marketP: number | null;
  marketCapturedAt: string | null;
  rates: { similar: Rate | null; homeAtHome: Rate | null; awayAtAway: Rate | null };
  findings: EvidenceFinding[];
}

export type MissingKey = 'xg' | 'elo' | 'market' | 'calibration' | 'similar' | 'own_home' | 'own_away' | 'league_scope';
export type MissingReason = 'not_live' | 'no_history' | 'none' | 'after_asof' | 'no_curve' | 'insufficient' | 'thin' | 'fallback_covered' | 'fallback_all';
export interface MissingItem { key: MissingKey; reason: MissingReason; n?: number }

export interface EvidenceReport {
  ruleVersion: string;
  validation: typeof EVIDENCE_VALIDATION;
  asOf: string;
  modelVersion: string | null;
  assessmentRuleVersion: string | null;
  fixture: { id: number; leagueId: number | null; homeName: string; awayName: string; kickoff: string };
  features: { lambdaHome: number | null; lambdaAway: number | null; at: string | null; afterAsOf: boolean };
  pool: { n: number; from: string | null; to: string | null; leagueN: number; truncated: boolean };
  groups: { homeAtHome: GroupStats | null; awayAtAway: GroupStats | null; similar: SimilarGroup | null };
  /** kendi geçmişi ile benzer maçların ortak fixture sayısı — bağımsız örnek sayılmaz */
  overlap: { homeSimilar: number; awaySimilar: number };
  markets: MarketEvidence[];
  missing: MissingItem[];
  similarity: typeof SIMILARITY & { scope: SimilarScope | null };
}

// ── yardımcılar ────────────────────────────────────────────────────────────

const ms = (iso: string) => Date.parse(iso);

/** asOf'ta sonucu bilinen, hedefin kendisi olmayan, pencere içindeki satırlar. */
export function eligibleRows(pool: PoolRow[], target: { fixtureId: number }, asOf: string): PoolRow[] {
  const t = ms(asOf);
  const minKo = t - SIMILARITY.windowDays * 86_400_000;
  const lag = SIMILARITY.settleLagHours * 3_600_000;
  return pool.filter((r) => {
    if (r.fixtureId === target.fixtureId) return false;
    const ko = ms(r.kickoff);
    if (!Number.isFinite(ko) || ko >= t || ko < minKo) return false;
    const known = r.settledAt ? ms(r.settledAt) : ko + lag;
    if (!Number.isFinite(known) || known > t) return false;
    return Number.isFinite(r.lambdaHome) && Number.isFinite(r.lambdaAway) && Number.isInteger(r.homeScore) && Number.isInteger(r.awayScore);
  }).sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.fixtureId - b.fixtureId); // girdi sırasından bağımsız (kayan nokta toplamı dahil)
}

const resultOf = (r: Pick<PoolRow, 'homeScore' | 'awayScore'>): 'H' | 'D' | 'A' => (r.homeScore > r.awayScore ? 'H' : r.homeScore < r.awayScore ? 'A' : 'D');

function hit(sel: AssessmentSelection, r: Pick<PoolRow, 'homeScore' | 'awayScore'>): boolean {
  const res = resultOf(r);
  switch (sel) {
    case '1': return res === 'H';
    case 'X': return res === 'D';
    case '2': return res === 'A';
    case 'over': return r.homeScore + r.awayScore >= 3;
    case 'under': return r.homeScore + r.awayScore < 3;
    case 'yes': return r.homeScore > 0 && r.awayScore > 0;
    case 'no': return !(r.homeScore > 0 && r.awayScore > 0);
  }
}

export function rateOf(rows: Array<Pick<PoolRow, 'homeScore' | 'awayScore'>>, sel: AssessmentSelection): Rate | null {
  const n = rows.length;
  if (!n) return null;
  const won = rows.filter((r) => hit(sel, r)).length;
  const w = wilson(won, n)!;
  return { won, n, p: won / n, lower: w.lower, upper: w.upper };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function groupStats(rows: PoolRow[], distance?: Map<number, number>): GroupStats {
  const sorted = [...rows].sort((a, b) => (distance ? (distance.get(a.fixtureId)! - distance.get(b.fixtureId)!) || a.fixtureId - b.fixtureId : b.kickoff.localeCompare(a.kickoff) || a.fixtureId - b.fixtureId));
  const kos = rows.map((r) => r.kickoff).sort();
  const over = rows.map((r) => r.pOver25).filter((x): x is number => x != null);
  const btts = rows.map((r) => r.pBtts).filter((x): x is number => x != null);
  return {
    n: rows.length,
    from: kos[0] ?? null,
    to: kos[kos.length - 1] ?? null,
    x12: { home: rows.filter((r) => resultOf(r) === 'H').length, draw: rows.filter((r) => resultOf(r) === 'D').length, away: rows.filter((r) => resultOf(r) === 'A').length },
    over25: rows.filter((r) => hit('over', r)).length,
    btts: rows.filter((r) => hit('yes', r)).length,
    modelMean: {
      home: mean(rows.map((r) => r.pHome)) ?? 0, draw: mean(rows.map((r) => r.pDraw)) ?? 0, away: mean(rows.map((r) => r.pAway)) ?? 0,
      over25: over.length === rows.length ? mean(over) : null, btts: btts.length === rows.length ? mean(btts) : null,
    },
    fixtures: sorted.map((r) => ({
      fixtureId: r.fixtureId, kickoff: r.kickoff, homeName: r.homeName, awayName: r.awayName, homeScore: r.homeScore, awayScore: r.awayScore,
      lambdaHome: r.lambdaHome, lambdaAway: r.lambdaAway, distance: distance ? distance.get(r.fixtureId)! : null,
    })),
  };
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/**
 * λ uzayında en yakın komşular. Ölçek (std) yalnız asOf öncesi uygun havuzdan; hedef maç ve
 * gelecek veri ölçeklemeye girmez. Kapsam sırası: lig → kapsanan ligler (`covered` verilmişse)
 * → tüm ligler; yarıçap içinde ≥ minN aday veren ilk kapsam seçilir ve `scope` ile söylenir.
 * Sıralama (uzaklık, fixtureId) → deterministik.
 */
export function similarMatches(rows: PoolRow[], target: EvidenceTarget, covered?: ReadonlySet<number> | null): SimilarGroup | null {
  if (target.lambdaHome == null || target.lambdaAway == null) return null;
  const scale = { lambdaHome: std(rows.map((r) => r.lambdaHome)), lambdaAway: std(rows.map((r) => r.lambdaAway)) };
  if (!(scale.lambdaHome > 0) || !(scale.lambdaAway > 0)) return null;
  const dist = (r: PoolRow) => Math.hypot((r.lambdaHome - target.lambdaHome!) / scale.lambdaHome, (r.lambdaAway - target.lambdaAway!) / scale.lambdaAway);
  const pick = (cands: PoolRow[]) => {
    const scored = cands.map((r) => ({ r, d: dist(r) })).filter((x) => x.d <= SIMILARITY.radius).sort((a, b) => a.d - b.d || a.r.fixtureId - b.r.fixtureId);
    return { within: scored.length, top: scored.slice(0, SIMILARITY.k) };
  };
  const none = { within: 0, top: [] as Array<{ r: PoolRow; d: number }> };
  const league = target.leagueId != null ? pick(rows.filter((r) => r.leagueId === target.leagueId)) : none;
  const cov = covered && covered.size ? pick(rows.filter((r) => r.leagueId != null && covered.has(r.leagueId))) : none;
  const chosen = league.within >= SIMILARITY.minN ? { scope: 'league' as const, ...league }
    : cov.within >= SIMILARITY.minN ? { scope: 'covered' as const, ...cov }
    : { scope: 'all' as const, ...pick(rows) };
  const distance = new Map(chosen.top.map((x) => [x.r.fixtureId, Math.round(x.d * 1000) / 1000]));
  const base = groupStats(chosen.top.map((x) => x.r), distance);
  return { ...base, scope: chosen.scope, scale, withinRadius: chosen.within, maxDistance: chosen.top.length ? distance.get(chosen.top[chosen.top.length - 1].r.fixtureId)! : null };
}

const selP = (t: EvidenceTarget, sel: AssessmentSelection): number => {
  switch (sel) {
    case '1': return t.pHome; case 'X': return t.pDraw; case '2': return t.pAway;
    case 'over': return t.pOver25 ?? NaN; case 'under': return t.pOver25 == null ? NaN : 1 - t.pOver25;
    case 'yes': return t.pBtts ?? NaN; case 'no': return t.pBtts == null ? NaN : 1 - t.pBtts;
  }
};

export interface EvidenceInputs {
  target: EvidenceTarget;
  pool: PoolRow[];
  poolTruncated?: boolean;
  /** assess-1.0 çıktısı (durum, kalibre p, piyasa p); yoksa null */
  assessment: MatchAssessment | null;
  asOf: string;
  /** sitenin kapsadığı lig id'leri (ara kapsam); yoksa lig → tüm ligler */
  coveredLeagueIds?: ReadonlySet<number> | null;
}

/** Tüm raporu üretir. Aynı girdiler → aynı çıktı (zaman damgası eklenmez). */
export function buildEvidence(i: EvidenceInputs): EvidenceReport {
  const { target, assessment, asOf } = i;
  const rows = eligibleRows(i.pool, target, asOf);
  const kos = rows.map((r) => r.kickoff).sort();
  const homeRows = target.homeId != null ? rows.filter((r) => r.homeId === target.homeId) : [];
  const awayRows = target.awayId != null ? rows.filter((r) => r.awayId === target.awayId) : [];
  const homeAtHome = homeRows.length ? groupStats(homeRows) : null;
  const awayAtAway = awayRows.length ? groupStats(awayRows) : null;
  const similar = rows.length ? similarMatches(rows, target, i.coveredLeagueIds) : null;
  const simIds = new Set(similar?.fixtures.map((f) => f.fixtureId) ?? []);
  const overlap = { homeSimilar: homeRows.filter((r) => simIds.has(r.fixtureId)).length, awaySimilar: awayRows.filter((r) => simIds.has(r.fixtureId)).length };
  const simRows = similar ? i.pool.filter((r) => simIds.has(r.fixtureId)) : [];
  const simEnough = !!similar && similar.n >= SIMILARITY.minN;
  const featuresAfterAsOf = !!target.featuresAt && ms(target.featuresAt) > ms(asOf);

  const missing: MissingItem[] = [
    { key: 'xg', reason: 'not_live' },
    { key: 'elo', reason: 'no_history' },
  ];
  if (!similar || !simEnough) missing.push({ key: 'similar', reason: 'insufficient', n: similar?.n ?? 0 });
  else if (similar.scope !== 'league') missing.push({ key: 'league_scope', reason: similar.scope === 'covered' ? 'fallback_covered' : 'fallback_all' });
  if (!homeAtHome || homeAtHome.n < OWN_THIN_N) missing.push({ key: 'own_home', reason: 'thin', n: homeAtHome?.n ?? 0 });
  if (!awayAtAway || awayAtAway.n < OWN_THIN_N) missing.push({ key: 'own_away', reason: 'thin', n: awayAtAway?.n ?? 0 });

  const selections: Array<{ market: AssessmentMarket; selection: AssessmentSelection }> = [];
  if (target.pick) selections.push({ market: '1x2', selection: target.pick });
  if (target.overPick && target.pOver25 != null) selections.push({ market: 'ou25', selection: target.overPick });
  if (target.bttsPick && target.pBtts != null) selections.push({ market: 'btts', selection: target.bttsPick });

  let marketNoted = false;
  const markets: MarketEvidence[] = selections.map(({ market, selection }) => {
    const a = assessment?.markets.find((m) => m.market === market) ?? null;
    const modelP = selP(target, selection);
    const simRate = simEnough ? rateOf(simRows, selection) : null;
    const hRate = homeAtHome && homeAtHome.n >= OWN_THIN_N ? rateOf(homeRows, selection) : null;
    const aRate = awayAtAway && awayAtAway.n >= OWN_THIN_N ? rateOf(awayRows, selection) : null;
    const capturedAt = a?.price.capturedAt ?? null;
    const marketAfterAsOf = !!capturedAt && ms(capturedAt) > ms(asOf);
    const marketP = a && a.price.p != null && !marketAfterAsOf ? a.price.p : null;
    const findings: EvidenceFinding[] = [];
    if (!simRate) findings.push('similar_insufficient');
    else if (simRate.upper < modelP) findings.push('similar_below');
    else if (simRate.lower > modelP) findings.push('similar_above');
    else findings.push('similar_agrees');
    if (!hRate) findings.push('own_home_thin');
    if (!aRate) findings.push('own_away_thin');
    if (!a || a.price.p == null) findings.push('market_missing');
    else if (marketAfterAsOf) findings.push('market_after_asof');
    else if (modelP - a.price.p >= MARKET_AGREE_PTS) findings.push('market_above');
    else if (a.price.p - modelP >= MARKET_AGREE_PTS) findings.push('market_below');
    else findings.push('market_agrees');
    if (!a || !a.calibration.available) findings.push('calibration_missing');
    if (market === '1x2' && !marketNoted) {
      marketNoted = true;
      if (!a || a.price.p == null) missing.push({ key: 'market', reason: 'none' });
      else if (marketAfterAsOf) missing.push({ key: 'market', reason: 'after_asof' });
      if (!a || !a.calibration.available) missing.push({ key: 'calibration', reason: 'no_curve' });
    }
    return {
      market, selection, status: a?.status ?? null,
      modelP, calibratedP: a && a.calibration.available ? a.calibration.p : null, calibrationAvailable: !!a?.calibration.available,
      marketP, marketCapturedAt: capturedAt,
      rates: { similar: simRate, homeAtHome: hRate, awayAtAway: aRate },
      findings,
    };
  });

  return {
    ruleVersion: EVIDENCE_RULE_VERSION,
    validation: EVIDENCE_VALIDATION,
    asOf,
    modelVersion: target.modelVersion,
    assessmentRuleVersion: assessment?.ruleVersion ?? null,
    fixture: { id: target.fixtureId, leagueId: target.leagueId, homeName: target.homeName, awayName: target.awayName, kickoff: target.kickoff },
    features: { lambdaHome: target.lambdaHome, lambdaAway: target.lambdaAway, at: target.featuresAt, afterAsOf: featuresAfterAsOf },
    pool: { n: rows.length, from: kos[0] ?? null, to: kos[kos.length - 1] ?? null, leagueN: target.leagueId != null ? rows.filter((r) => r.leagueId === target.leagueId).length : 0, truncated: !!i.poolTruncated },
    groups: { homeAtHome, awayAtAway, similar },
    overlap,
    markets,
    missing,
    similarity: { ...SIMILARITY, scope: similar?.scope ?? null },
  };
}
