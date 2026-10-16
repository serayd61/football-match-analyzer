import { wilson } from './assessment';
import type { AssessmentMarket, AssessmentSelection, AssessmentStatus } from './assessment';
import { levelBucket, edgeBucket, LEVEL_BUCKETS, EDGE_BUCKETS } from './signal-buckets';
import { OVER_EDGE, TIGHT_FAV } from './risk';
import { scoreBinary, isoWeekOf, isoWeekLabel } from '@/lib/engine/scoring';

// ============================================================================
// BİTEN MAÇ DERECE KARTI — grade-1.0 (saf kural, 2026-10-16)
// ----------------------------------------------------------------------------
// Her sonuçlanmış maç için, pazar başına, "kim haklıydı" kaydı: modelin seçimi,
// bahisçinin favorisi, ikisi ayrıştığında hangisi tuttu, maç-öncesi değerlendirme
// durumu (yalnız gölge kayıttan; sonradan hesaplanmaz) ve sonuç. Haftalık özet
// (`weekLessons`) bu kartları lig × pazar × boyut kovalarında Wilson aralığıyla
// toplar ve birkaç deterministik "ders" kodu üretir.
//
// Dürüstlük sınırları (docs/grade-agent.md):
//  • Durum YALNIZ kickoff'tan önce yazılmış site_assessment_snapshots satırından gelir; yoksa
//    `statusSource: 'none'`. Bugünkü kuralla geriye dönük durum üretilmez.
//  • Piyasa yalnız kickoff ÖNCESİ yakalanmış anlık görüntü; sonrası yok sayılır (`preKickoffMarket`).
//  • Dersler keşifseldir; hiçbir seçimi, modeli ya da assess-1.0 kuralını değiştirmez. Kurala
//    girmesi ayrı sürüm (assess-1.1) ve ≥4 haftalık gölge karne ister.
//  • Küçük örneklem (n < MIN_LESSON_N) ders üretmez, "thin" olarak kalır.
// ============================================================================

export const GRADE_RULE_VERSION = 'grade-1.0';
export const GRADE_TABLE = 'site_match_grades';
export const GRADE_VALIDATION = 'exploratory' as const;
/** Bir kovadan ders çıkarmak için gereken en az maç (assess-1.0 MIN_SUPPORT_N ile aynı). */
export const MIN_LESSON_N = 20;

export interface GradeMarketSnapshot { pHome: number; pDraw: number; pAway: number; phase: string | null; capturedAt: string; provider: string | null }
export interface GradeStatusSnapshot { market: AssessmentMarket; selection: string; status: AssessmentStatus; reasons: string[]; ruleVersion: string; assessedAt: string }

export interface GradeInput {
  fixtureId: number;
  leagueId: number | null;
  leagueSlug: string | null;
  covered: boolean;
  homeName: string;
  awayName: string;
  kickoff: string;
  modelVersion: string | null;
  pHome: number; pDraw: number; pAway: number;
  pick: '1' | 'X' | '2' | null;
  /** modelin ham Üst 2,5 olasılığı ve seçimi */
  pOver25: number | null; overPick: 'over' | 'under' | null;
  pBtts: number | null; bttsPick: 'yes' | 'no' | null;
  homeScore: number; awayScore: number;
  /** kickoff öncesi en geç faz 1X2 anlık görüntüsü (preKickoffMarket ile süzülmüş) */
  market: GradeMarketSnapshot | null;
  /** kickoff öncesi assess-1.0 gölge kaydı satırları (yoksa boş) */
  statuses: GradeStatusSnapshot[];
}

export type Clash = 'agree' | 'model_right' | 'market_right' | 'both_wrong';
export type GradeCode =
  | 'pick_hit' | 'pick_miss'
  | 'market_missing' | 'market_fav_hit' | 'market_fav_miss'
  | 'agree' | 'disagree_model_right' | 'disagree_market_right' | 'disagree_both_wrong'
  | 'over_edge' | 'tight_market'
  | 'status_missing' | 'status_hit' | 'status_miss';

export interface MatchGrade {
  fixtureId: number;
  market: AssessmentMarket;
  selection: AssessmentSelection;
  ruleVersion: string;
  modelVersion: string | null;
  assessmentRuleVersion: string | null;
  kickoff: string;
  isoYear: number;
  isoWeek: number;
  leagueId: number | null;
  leagueSlug: string | null;
  covered: boolean;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  result: 'H' | 'D' | 'A';
  hit: boolean;
  modelP: number;
  /** ikili Brier / log-loss, seçilen taraf */
  brier: number;
  logLoss: number;
  levelBucket: string;
  marketP: number | null;
  marketPhase: string | null;
  marketCapturedAt: string | null;
  /** 1X2: bahisçinin favorisi (marjsız en yüksek); gol pazarlarında null */
  marketFav: AssessmentSelection | null;
  marketFavHit: boolean | null;
  edge: number | null;
  edgeBucket: string | null;
  clash: Clash | null;
  status: AssessmentStatus | null;
  statusSource: 'snapshot' | 'none';
  statusReasons: string[];
  codes: GradeCode[];
}

const resultOf = (h: number, a: number): 'H' | 'D' | 'A' => (h > a ? 'H' : h < a ? 'A' : 'D');

function hitOf(sel: AssessmentSelection, h: number, a: number): boolean {
  switch (sel) {
    case '1': return h > a; case 'X': return h === a; case '2': return h < a;
    case 'over': return h + a >= 3; case 'under': return h + a < 3;
    case 'yes': return h > 0 && a > 0; case 'no': return !(h > 0 && a > 0);
  }
}

/** Kickoff ÖNCESİ yakalanmış satırlar arasından en geç faz (kapanış > h3 > … > açılış); sonrası yok sayılır. */
export function preKickoffMarket<T extends { capturedAt: string }>(rows: T[], kickoff: string, latest: (rows: T[]) => T | null): T | null {
  const ko = Date.parse(kickoff);
  const before = rows.filter((r) => Date.parse(r.capturedAt) < ko);
  return before.length ? latest(before) : null;
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

export function gradeMatch(i: GradeInput): MatchGrade[] {
  const result = resultOf(i.homeScore, i.awayScore);
  const wk = isoWeekOf(new Date(i.kickoff));
  const base = {
    fixtureId: i.fixtureId, ruleVersion: GRADE_RULE_VERSION, modelVersion: i.modelVersion, kickoff: i.kickoff, isoYear: wk.isoYear, isoWeek: wk.isoWeek,
    leagueId: i.leagueId, leagueSlug: i.leagueSlug, covered: i.covered, homeName: i.homeName, awayName: i.awayName, homeScore: i.homeScore, awayScore: i.awayScore, result,
  };
  const statusOf = (market: AssessmentMarket) => {
    const s = i.statuses.filter((x) => x.market === market && Date.parse(x.assessedAt) < Date.parse(i.kickoff)).sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))[0] ?? null;
    return s;
  };
  const mk = (market: AssessmentMarket, selection: AssessmentSelection, modelP: number, marketP: number | null, marketFav: AssessmentSelection | null, extra: Partial<MatchGrade> = {}): MatchGrade => {
    const hit = hitOf(selection, i.homeScore, i.awayScore);
    const sc = scoreBinary(modelP, hit);
    const st = statusOf(market);
    const codes: GradeCode[] = [hit ? 'pick_hit' : 'pick_miss'];
    let clash: Clash | null = null;
    let marketFavHit: boolean | null = null;
    if (marketP == null || !i.market) codes.push('market_missing');
    else {
      if (marketFav) {
        marketFavHit = hitOf(marketFav, i.homeScore, i.awayScore);
        codes.push(marketFavHit ? 'market_fav_hit' : 'market_fav_miss');
        if (marketFav === selection) { clash = 'agree'; codes.push('agree'); }
        else { clash = hit ? 'model_right' : marketFavHit ? 'market_right' : 'both_wrong'; codes.push(clash === 'model_right' ? 'disagree_model_right' : clash === 'market_right' ? 'disagree_market_right' : 'disagree_both_wrong'); }
      }
      if (modelP - marketP >= OVER_EDGE) codes.push('over_edge');
      if (market === '1x2' && Math.max(i.market.pHome, i.market.pDraw, i.market.pAway) < TIGHT_FAV) codes.push('tight_market');
    }
    if (!st) codes.push('status_missing'); else codes.push(hit ? 'status_hit' : 'status_miss');
    const edge = marketP == null ? null : round4(modelP - marketP);
    return {
      ...base, market, selection, assessmentRuleVersion: st?.ruleVersion ?? null,
      hit, modelP: round4(modelP), brier: round4(sc.brier), logLoss: round4(sc.ll), levelBucket: LEVEL_BUCKETS[levelBucket(modelP)],
      marketP: marketP == null ? null : round4(marketP), marketPhase: i.market?.phase ?? null, marketCapturedAt: i.market?.capturedAt ?? null,
      marketFav, marketFavHit, edge, edgeBucket: edge == null ? null : EDGE_BUCKETS[edgeBucket(edge)], clash,
      status: st?.status ?? null, statusSource: st ? 'snapshot' : 'none', statusReasons: st?.reasons ?? [],
      codes, ...extra,
    };
  };
  const out: MatchGrade[] = [];
  if (i.pick) {
    const m = i.market;
    const fav: AssessmentSelection | null = m ? (m.pHome >= m.pDraw && m.pHome >= m.pAway ? '1' : m.pAway >= m.pHome && m.pAway >= m.pDraw ? '2' : 'X') : null;
    const modelP = i.pick === '1' ? i.pHome : i.pick === '2' ? i.pAway : i.pDraw;
    const marketP = m ? (i.pick === '1' ? m.pHome : i.pick === '2' ? m.pAway : m.pDraw) : null;
    out.push(mk('1x2', i.pick, modelP, marketP, fav));
  }
  // Gol pazarlarında piyasa anlık görüntüsü bu sürümde yok (goal book ayrı tablo/sütun) → market_missing.
  if (i.overPick && i.pOver25 != null) out.push(mk('ou25', i.overPick, i.overPick === 'over' ? i.pOver25 : 1 - i.pOver25, null, null));
  if (i.bttsPick && i.pBtts != null) out.push(mk('btts', i.bttsPick, i.bttsPick === 'yes' ? i.pBtts : 1 - i.pBtts, null, null));
  return out;
}

// ── Haftalık dersler ──────────────────────────────────────────────────────

export interface LessonCell { n: number; hits: number; acc: number | null; lower: number | null; upper: number | null; meanModelP: number | null }
export type LessonCode =
  | 'status_order_holds'      // destekli ≥ çelişkili isabet (iki kova da ≥ MIN) — assess-1.0 sırası tutuyor
  | 'status_order_inverted'   // çelişkili Wilson alt sınırı > destekli üst sınırı — sıra ters, incelenmeli
  | 'disagreements_market_led' // ayrışmalarda bahisçi daha çok haklı (Wilson alt > 0.5)
  | 'disagreements_model_led'  // ayrışmalarda model daha çok haklı
  | 'level_overconfident'      // seviye kovasında Wilson üst < kova alt sınırı
  | 'level_underconfident'     // seviye kovasında Wilson alt > kova üst sınırı
  | 'over_edge_not_paying';    // model ≥ +5 puan üstteyken isabet Wilson üst < model ortalaması
export interface Lesson { code: LessonCode; market: AssessmentMarket; subject: string; n: number; detail: Record<string, number | string | null> }

export interface WeekLessons {
  ruleVersion: string;
  validation: typeof GRADE_VALIDATION;
  week: string;
  /** 'covered': yalnız sitenin kapsadığı ligler (karne sayfasıyla aynı evren); 'all': tüm resmî satırlar */
  scope: 'covered' | 'all';
  /** kapsam dışı bırakılan kart sayısı (scope 'covered' iken) */
  excluded: number;
  grades: number;
  fixtures: number;
  byMarket: Record<string, LessonCell>;
  /** market|status — yalnız statusSource='snapshot' kartlar */
  byStatus: Record<string, LessonCell>;
  statusCoverage: { withSnapshot: number; without: number };
  /** market|clash — yalnız piyasa olan 1X2 kartlar */
  byClash: Record<string, LessonCell>;
  /** market|levelBucket */
  byLevel: Record<string, LessonCell>;
  /** market|edgeBucket — yalnız piyasa olan kartlar */
  byEdge: Record<string, LessonCell>;
  /** leagueSlug|market */
  byLeague: Record<string, LessonCell>;
  lessons: Lesson[];
}

function cellOf(gs: MatchGrade[]): LessonCell {
  const n = gs.length; const hits = gs.filter((g) => g.hit).length;
  const w = n ? wilson(hits, n) : null;
  return { n, hits, acc: n ? round4(hits / n) : null, lower: w ? round4(w.lower) : null, upper: w ? round4(w.upper) : null, meanModelP: n ? round4(gs.reduce((s, g) => s + g.modelP, 0) / n) : null };
}

function group(gs: MatchGrade[], key: (g: MatchGrade) => string | null): Record<string, LessonCell> {
  const m = new Map<string, MatchGrade[]>();
  for (const g of gs) { const k = key(g); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k)!.push(g); }
  const out: Record<string, LessonCell> = {};
  for (const k of [...m.keys()].sort()) out[k] = cellOf(m.get(k)!);
  return out;
}

const LEVEL_RANGE: Record<string, [number, number]> = { '<50%': [0, 0.5], '50–60%': [0.5, 0.6], '60–70%': [0.6, 0.7], '≥70%': [0.7, 1] };

/** Haftanın derece kartlarından deterministik özet + ders kodları. Aynı girdi → aynı çıktı. */
export function weekLessons(gradesIn: MatchGrade[], week: { isoYear: number; isoWeek: number }, opts: { scope?: 'covered' | 'all' } = {}): WeekLessons {
  const scope = opts.scope ?? 'covered';
  const inWeek = gradesIn.filter((g) => g.isoYear === week.isoYear && g.isoWeek === week.isoWeek);
  const grades = inWeek.filter((g) => scope === 'all' || g.covered).sort((a, b) => a.fixtureId - b.fixtureId || a.market.localeCompare(b.market));
  const excluded = inWeek.length - grades.length;
  const withSnap = grades.filter((g) => g.statusSource === 'snapshot');
  const withMarket = grades.filter((g) => g.marketP != null);
  const byMarket = group(grades, (g) => g.market);
  const byStatus = group(withSnap, (g) => `${g.market}|${g.status}`);
  const byClash = group(withMarket.filter((g) => g.clash), (g) => `${g.market}|${g.clash}`);
  const byLevel = group(grades, (g) => `${g.market}|${g.levelBucket}`);
  const byEdge = group(withMarket, (g) => `${g.market}|${g.edgeBucket}`);
  const byLeague = group(grades, (g) => (g.leagueSlug ? `${g.leagueSlug}|${g.market}` : null));

  const lessons: Lesson[] = [];
  const markets: AssessmentMarket[] = ['1x2', 'ou25', 'btts'];
  for (const market of markets) {
    const sup = byStatus[`${market}|supported`], con = byStatus[`${market}|conflicting`];
    if (sup && con && sup.n >= MIN_LESSON_N && con.n >= MIN_LESSON_N) {
      if (con.lower! > sup.upper!) lessons.push({ code: 'status_order_inverted', market, subject: 'status', n: sup.n + con.n, detail: { supportedAcc: sup.acc, conflictingAcc: con.acc, supportedN: sup.n, conflictingN: con.n } });
      else if (sup.acc! >= con.acc!) lessons.push({ code: 'status_order_holds', market, subject: 'status', n: sup.n + con.n, detail: { supportedAcc: sup.acc, conflictingAcc: con.acc, supportedN: sup.n, conflictingN: con.n } });
    }
    if (market === '1x2') {
      const mr = byClash['1x2|model_right']?.n ?? 0, kr = byClash['1x2|market_right']?.n ?? 0, bw = byClash['1x2|both_wrong']?.n ?? 0;
      const dis = mr + kr + bw;
      if (dis >= MIN_LESSON_N) {
        const wm = wilson(mr, mr + kr); // yalnız karar verilen ayrışmalar
        if (wm && mr + kr >= MIN_LESSON_N) {
          if (wm.lower > 0.5) lessons.push({ code: 'disagreements_model_led', market, subject: 'clash', n: dis, detail: { modelRight: mr, marketRight: kr, bothWrong: bw, lower: round4(wm.lower) } });
          else if (wm.upper < 0.5) lessons.push({ code: 'disagreements_market_led', market, subject: 'clash', n: dis, detail: { modelRight: mr, marketRight: kr, bothWrong: bw, upper: round4(wm.upper) } });
        }
      }
    }
    for (const [bucket, [lo, hi]] of Object.entries(LEVEL_RANGE)) {
      const c = byLevel[`${market}|${bucket}`];
      if (!c || c.n < MIN_LESSON_N) continue;
      if (c.upper! < lo) lessons.push({ code: 'level_overconfident', market, subject: bucket, n: c.n, detail: { acc: c.acc, upper: c.upper, meanModelP: c.meanModelP } });
      else if (c.lower! > hi && hi < 1) lessons.push({ code: 'level_underconfident', market, subject: bucket, n: c.n, detail: { acc: c.acc, lower: c.lower, meanModelP: c.meanModelP } });
    }
    const over = withMarket.filter((g) => g.market === market && g.codes.includes('over_edge'));
    if (over.length >= MIN_LESSON_N) {
      const c = cellOf(over);
      if (c.upper! < c.meanModelP!) lessons.push({ code: 'over_edge_not_paying', market, subject: 'over_edge', n: c.n, detail: { acc: c.acc, upper: c.upper, meanModelP: c.meanModelP } });
    }
  }
  return {
    ruleVersion: GRADE_RULE_VERSION, validation: GRADE_VALIDATION, week: isoWeekLabel(week), scope, excluded, grades: grades.length, fixtures: new Set(grades.map((g) => g.fixtureId)).size,
    byMarket, byStatus, statusCoverage: { withSnapshot: withSnap.length, without: grades.length - withSnap.length }, byClash, byLevel, byEdge, byLeague, lessons,
  };
}

/** Tablo satırı (snake_case) — grades.ts yazar/okur. */
export interface GradeRow {
  fixture_id: number; market: string; selection: string; rule_version: string; model_version: string | null; assessment_rule_version: string | null;
  kickoff: string; iso_year: number; iso_week: number; league_id: number | null; league_slug: string | null; covered: boolean;
  home_name: string; away_name: string; home_score: number; away_score: number; result: string;
  hit: boolean; model_p: number; brier: number; log_loss: number; level_bucket: string;
  market_p: number | null; market_phase: string | null; market_captured_at: string | null; market_fav: string | null; market_fav_hit: boolean | null; edge: number | null; edge_bucket: string | null; clash: string | null;
  status: string | null; status_source: string; status_reasons: string[]; codes: string[];
}

export function toGradeRow(g: MatchGrade): GradeRow {
  return {
    fixture_id: g.fixtureId, market: g.market, selection: g.selection, rule_version: g.ruleVersion, model_version: g.modelVersion, assessment_rule_version: g.assessmentRuleVersion,
    kickoff: g.kickoff, iso_year: g.isoYear, iso_week: g.isoWeek, league_id: g.leagueId, league_slug: g.leagueSlug, covered: g.covered,
    home_name: g.homeName, away_name: g.awayName, home_score: g.homeScore, away_score: g.awayScore, result: g.result,
    hit: g.hit, model_p: g.modelP, brier: g.brier, log_loss: g.logLoss, level_bucket: g.levelBucket,
    market_p: g.marketP, market_phase: g.marketPhase, market_captured_at: g.marketCapturedAt, market_fav: g.marketFav, market_fav_hit: g.marketFavHit, edge: g.edge, edge_bucket: g.edgeBucket, clash: g.clash,
    status: g.status, status_source: g.statusSource, status_reasons: g.statusReasons, codes: g.codes,
  };
}

export function fromGradeRow(r: GradeRow): MatchGrade {
  return {
    fixtureId: Number(r.fixture_id), market: r.market as AssessmentMarket, selection: r.selection as AssessmentSelection, ruleVersion: r.rule_version, modelVersion: r.model_version, assessmentRuleVersion: r.assessment_rule_version,
    kickoff: r.kickoff, isoYear: Number(r.iso_year), isoWeek: Number(r.iso_week), leagueId: r.league_id == null ? null : Number(r.league_id), leagueSlug: r.league_slug, covered: !!r.covered,
    homeName: r.home_name, awayName: r.away_name, homeScore: Number(r.home_score), awayScore: Number(r.away_score), result: r.result as 'H' | 'D' | 'A',
    hit: !!r.hit, modelP: Number(r.model_p), brier: Number(r.brier), logLoss: Number(r.log_loss), levelBucket: r.level_bucket,
    marketP: r.market_p == null ? null : Number(r.market_p), marketPhase: r.market_phase, marketCapturedAt: r.market_captured_at, marketFav: (r.market_fav as AssessmentSelection | null) ?? null, marketFavHit: r.market_fav_hit ?? null,
    edge: r.edge == null ? null : Number(r.edge), edgeBucket: r.edge_bucket, clash: (r.clash as Clash | null) ?? null,
    status: (r.status as AssessmentStatus | null) ?? null, statusSource: r.status_source === 'snapshot' ? 'snapshot' : 'none', statusReasons: r.status_reasons ?? [], codes: (r.codes ?? []) as GradeCode[],
  };
}
