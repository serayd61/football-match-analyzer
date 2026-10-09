// ============================================================================
// KAPSAM KURALLARI (saf) — lig istatistiğinden terfi / indirme / izleme önerisi
// ----------------------------------------------------------------------------
// Ölçü: günün seçimi kuralının kullandığı sinyal — model seviyesi eşiğini geçen
// gol pazarı ayaklarının isabeti (Üst ≥ %65, KG ≥ %60). 1X2 isabeti bilgi amaçlı.
// Eşikler 12 Eyl backtest'i ve 20 Eyl λ analizinden; n ≥ 40 altında öneri yok.
// ============================================================================

import { EDGE_BUCKETS, edgeBucket } from '@/lib/site/signal-buckets';

export type CoverageStatus = 'whitelist' | 'observe' | 'excluded' | 'hidden';

/**
 * Gizleme kapısı (24 Eyl): kapsam dışı ligde 1X2 log-loss rastgele tahminden (ln 3 =
 * 1,0986) kötüyse model o ligde sinyalsiz → sitede/Tier-B'de gösterilmez. Histerezis:
 * LL < 1,05'e inince geri açılır. Motor tahmin üretmeye devam eder (karne birikir).
 * Neden: El Salvador Apertura 9/21, LL 1,12; aynı durumda 55 lig (23 Eyl taraması).
 */
export const HIDE_GATE = { minN: 20, hideLl: Math.log(3), unhideLl: 1.05 } as const;
export function hideDecision(status: CoverageStatus, s: LeagueStats, g = HIDE_GATE): 'hide' | 'unhide' | null {
  const ll = s.x12.ll;
  const strong = (s.strong ?? []).length > 0; // güçlü pazarı olan lig gizlenmez (Isthmian KG 17/24, 24 Eyl)
  if (status === 'hidden' && strong) return 'unhide';
  if (ll == null || s.x12.n < g.minN) return null;
  if (status === 'excluded' && ll >= g.hideLl && !strong) return 'hide';
  if (status === 'hidden' && ll < g.unhideLl) return 'unhide';
  return null;
}

export interface BucketCell { n: number; won: number }
/** Olasılık dilimi karnesi (23 Eyl): pazar → dilim etiketi → n/won. Etiketler BUCKETS'tan. */
export interface LeagueBuckets { x12: Record<string, BucketCell>; ou25: Record<string, BucketCell>; under25: Record<string, BucketCell>; btts: Record<string, BucketCell> }
/** Ligin güçlü pazarı (24 Eyl): üst dilimlerde ≥15 maç ve ≥%70 isabet. `from` = model olasılık eşiği. */
export interface StrongMarket { market: keyof LeagueBuckets; from: number; n: number; won: number }
export const STRONG_GATE = { minN: 15, minAcc: 0.70 } as const;
const STRONG_ZONES: Array<[keyof LeagueBuckets, number, string[]]> = [
  ['x12', 0.70, ['70–80', '≥80']], ['ou25', 0.75, ['75–85', '≥85']], ['under25', 0.75, ['≥75']], ['btts', 0.70, ['70–80', '≥80']],
];
export function strongMarkets(b: LeagueBuckets | undefined, g = STRONG_GATE): StrongMarket[] {
  if (!b) return [];
  const out: StrongMarket[] = [];
  for (const [market, from, labels] of STRONG_ZONES) {
    let n = 0, won = 0;
    for (const l of labels) { const c = b[market]?.[l]; if (c) { n += c.n; won += c.won; } }
    if (n >= g.minN && won / n >= g.minAcc) out.push({ market, from, n, won });
  }
  return out;
}

/**
 * Piyasa farkı karnesi (2026-10-09): pazar → fark kovası (EDGE_BUCKETS: ≤−5 / −5…0 /
 * 0…+5 / +5…+10 / >+10 puan) → n/won. Fark = seçilen tarafın model olasılığı − aynı
 * tarafın marjsız EN GEÇ FAZ piyasa olasılığı. Oranı olmayan maç kovaya girmez.
 */
export type EdgeMarket = 'x12' | 'ou25' | 'btts';
export interface LeagueEdge { x12: Record<string, BucketCell>; ou25: Record<string, BucketCell>; btts: Record<string, BucketCell> }
/** Satıra iliştirilen marjsız piyasa olasılıkları (en geç faz). Eksik pazar null. */
export interface RowMarket { pHome: number | null; pDraw: number | null; pAway: number | null; pOver: number | null; pBttsYes: number | null }

export interface LeagueStats {
  n: number;                                   // sonuçlanmış satır (pencere)
  x12: { n: number; won: number; ll: number | null };
  ouHi: { n: number; won: number };            // p_over25 ≥ MIN_OVER ayakları
  bttsHi: { n: number; won: number };          // p_btts_yes ≥ MIN_BTTS ayakları
  buckets?: LeagueBuckets;
  /** üst dilimlerde ≥15 maç, ≥%70 tutan pazarlar (strongMarkets) */
  strong?: StrongMarket[];
  /** piyasa farkı kovaları (yalnız oranı olan maçlar) */
  edge?: LeagueEdge;
  /** oranı olan sonuçlanmış maç sayısı (fark karnesinin kapsamı) */
  oddsN?: number;
  lastKickoff: string | null;
  windowDays: number;
}

export const EDGE_LABELS = EDGE_BUCKETS as readonly string[];
export const emptyEdge = (): LeagueEdge => ({ x12: {}, ou25: {}, btts: {} });
/** Birden çok ligin fark kovalarını toplar (kapsam dışı toplam vb.). */
export function sumEdge(list: Array<LeagueStats | null | undefined>): LeagueEdge {
  const out = emptyEdge();
  for (const s of list) {
    const e = s?.edge; if (!e) continue;
    for (const k of Object.keys(out) as EdgeMarket[]) for (const [label, cell] of Object.entries(e[k] ?? {})) { const c = (out[k][label] ??= { n: 0, won: 0 }); c.n += cell.n; c.won += cell.won; }
  }
  return out;
}

/**
 * Bant özeti: −5…+5 "bant içi" vs ≥+5 "bant dışı artı". Ligde toplam ≥ minN maç varsa
 * lig, yoksa verilen toplam (tüm ligler). `strong` = bant içi ≥ minN, bant dışı ≥ minOut
 * ve isabet farkı ≥ gap → bu ligde bant ayırt edici.
 */
export const BAND = { inBand: ['−5…0', '0…+5'], outPlus: ['+5…+10', '>+10'], outMinus: ['≤−5'], minN: 20, minOut: 10, gap: 0.15 } as const;
export interface BandCell { n: number; won: number; acc: number | null }
export interface BandSummary { market: EdgeMarket; inBand: BandCell; outPlus: BandCell; outMinus: BandCell; scope: 'league' | 'all'; strong: boolean }
const cellSum = (b: Record<string, BucketCell> | undefined, labels: readonly string[]): BandCell => {
  let n = 0, won = 0;
  for (const l of labels) { const c = b?.[l]; if (c) { n += c.n; won += c.won; } }
  return { n, won, acc: n ? won / n : null };
};
export function bandFor(market: EdgeMarket, league: LeagueEdge | undefined, all: LeagueEdge | undefined, g = BAND): BandSummary | null {
  const pick = (e: LeagueEdge | undefined) => e ? { inBand: cellSum(e[market], g.inBand), outPlus: cellSum(e[market], g.outPlus), outMinus: cellSum(e[market], g.outMinus) } : null;
  const lg = pick(league);
  const useLeague = !!lg && lg.inBand.n + lg.outPlus.n + lg.outMinus.n >= g.minN;
  const src = useLeague ? lg! : pick(all);
  if (!src) return null;
  const strong = src.inBand.n >= g.minN && src.outPlus.n >= g.minOut && src.inBand.acc != null && src.outPlus.acc != null && src.inBand.acc - src.outPlus.acc >= g.gap;
  return { market, ...src, scope: useLeague ? 'league' : 'all', strong };
}

export const BUCKETS = {
  x12: [[0, '<50'], [0.5, '50–60'], [0.6, '60–70'], [0.7, '70–80'], [0.8, '≥80']],
  ou25: [[0, '<55'], [0.55, '55–65'], [0.65, '65–75'], [0.75, '75–85'], [0.85, '≥85']],
  under25: [[0.65, '65–75'], [0.75, '≥75']],
  btts: [[0, '<50'], [0.5, '50–60'], [0.6, '60–70'], [0.7, '70–80'], [0.8, '≥80']],
} as const satisfies Record<string, ReadonlyArray<readonly [number, string]>>;
export function bucketOf(kind: keyof typeof BUCKETS, p: number): string | null {
  let label: string | null = null;
  for (const [lo, name] of BUCKETS[kind]) { if (p >= lo) label = name; }
  return label;
}

export const COVERAGE_GATE = {
  minHi: 40,          // öneri için pazar başına en az ayak
  promoteOu: 0.65,    // observe → whitelist: Üst ayakları isabeti
  promoteBtts: 0.62,  // observe → whitelist: KG ayakları isabeti
  demoteOu: 0.55,     // whitelist → observe
  demoteBtts: 0.52,
  watchMinN: 100,     // excluded → observe adayı: toplam satır (22 Eyl: 60 → 100; İKİ pazar da eşik üstü)
} as const;

/** Hazırlık, kadın, altyapı, rezerv ligleri hiçbir öneriye girmez (motor kapsamı için anlamsız). */
const NOISE = /friendl|hazırlık|premier league 2|professional development|\(w\)|women|frauen|femen|feminin|kvinn|dames|\bu-?(15|16|17|18|19|20|21|23)\b|youth|junior|reserve|reserves|\bii\b|\bb\b|primavera|next pro|regionalliga|oberliga|3\. divisjon|2\. divisjon|\bettan\b|division 2|non league|national league (north|south)|highland|lowland|amateur/i;
export function isProposalEligibleName(name: string | null | undefined): boolean {
  return !!name && !NOISE.test(name);
}

export type ProposalType = 'promote' | 'demote' | 'watch';
export interface CoverageProposal { type: ProposalType; from: CoverageStatus; to: CoverageStatus; reason: string; evidence: Record<string, unknown> }

const acc = (c: { n: number; won: number }) => (c.n ? c.won / c.n : null);
const pct = (x: number | null) => (x == null ? '–' : `${Math.round(x * 100)}%`);

/** Satır listesinden lig istatistiği. Satır: p_over25/p_btts_yes/skor/1X2 sonucu. */
export function aggregateLeague(rows: Array<{ p_over25: number | null; p_btts_yes: number | null; p_home?: number | null; p_draw?: number | null; p_away?: number | null; home_score: number | null; away_score: number | null; correct: boolean | null; ll_1x2: number | null; kickoff: string; market?: RowMarket | null }>, windowDays: number, minOver = 0.65, minBtts = 0.60): LeagueStats {
  const s: LeagueStats = { n: 0, x12: { n: 0, won: 0, ll: null }, ouHi: { n: 0, won: 0 }, bttsHi: { n: 0, won: 0 }, buckets: { x12: {}, ou25: {}, under25: {}, btts: {} }, edge: emptyEdge(), oddsN: 0, lastKickoff: null, windowDays };
  const hit = (kind: keyof LeagueBuckets, p: number, won: boolean) => {
    const b = bucketOf(kind, p); if (!b) return;
    const c = (s.buckets![kind][b] ??= { n: 0, won: 0 }); c.n++; if (won) c.won++;
  };
  // Fark kovası: seçilen taraf (model) − aynı taraf (marjsız piyasa); piyasa yoksa sayılmaz.
  const edgeHit = (m: EdgeMarket, pModel: number, pMarket: number | null | undefined, won: boolean) => {
    if (pMarket == null || !Number.isFinite(pMarket)) return;
    const c = (s.edge![m][EDGE_LABELS[edgeBucket(pModel - pMarket)]] ??= { n: 0, won: 0 }); c.n++; if (won) c.won++;
  };
  let llSum = 0, llN = 0;
  for (const r of rows) {
    if (r.home_score == null || r.away_score == null) continue;
    s.n++;
    const mk = r.market ?? null;
    if (mk && (mk.pHome != null || mk.pOver != null || mk.pBttsYes != null)) s.oddsN!++;
    if (r.p_home != null && r.p_draw != null && r.p_away != null) {
      const ps = [r.p_home, r.p_draw, r.p_away]; const i = ps.indexOf(Math.max(...ps));
      const w = i === 0 ? r.home_score > r.away_score : i === 1 ? r.home_score === r.away_score : r.home_score < r.away_score;
      hit('x12', ps[i], w);
      if (mk) edgeHit('x12', ps[i], [mk.pHome, mk.pDraw, mk.pAway][i], w);
    }
    if (r.p_over25 != null) {
      hit('ou25', r.p_over25, r.home_score + r.away_score >= 3); hit('under25', 1 - r.p_over25, r.home_score + r.away_score <= 2);
      if (mk && mk.pOver != null) {
        const over = r.p_over25 >= 0.5;
        edgeHit('ou25', over ? r.p_over25 : 1 - r.p_over25, over ? mk.pOver : 1 - mk.pOver, over ? r.home_score + r.away_score >= 3 : r.home_score + r.away_score <= 2);
      }
    }
    if (r.p_btts_yes != null) {
      const both = r.home_score > 0 && r.away_score > 0;
      hit('btts', r.p_btts_yes, both);
      if (mk && mk.pBttsYes != null) {
        const yes = r.p_btts_yes >= 0.5;
        edgeHit('btts', yes ? r.p_btts_yes : 1 - r.p_btts_yes, yes ? mk.pBttsYes : 1 - mk.pBttsYes, yes ? both : !both);
      }
    }
    if (!s.lastKickoff || r.kickoff > s.lastKickoff) s.lastKickoff = r.kickoff;
    if (r.correct != null) { s.x12.n++; if (r.correct) s.x12.won++; }
    if (r.ll_1x2 != null && Number.isFinite(Number(r.ll_1x2))) { llSum += Number(r.ll_1x2); llN++; }
    const tot = r.home_score + r.away_score, both = r.home_score > 0 && r.away_score > 0;
    if (r.p_over25 != null && r.p_over25 >= minOver) { s.ouHi.n++; if (tot >= 3) s.ouHi.won++; }
    if (r.p_btts_yes != null && r.p_btts_yes >= minBtts) { s.bttsHi.n++; if (both) s.bttsHi.won++; }
  }
  s.x12.ll = llN ? Math.round((llSum / llN) * 10000) / 10000 : null;
  s.strong = strongMarkets(s.buckets);
  return s;
}

/** Duruma ve istatistiğe göre öneri; koşul yoksa null. Hiçbir şey otomatik değişmez. */
export function evaluateLeague(status: CoverageStatus, s: LeagueStats, g = COVERAGE_GATE): CoverageProposal | null {
  const ou = acc(s.ouHi), bt = acc(s.bttsHi);
  const ouOk = s.ouHi.n >= g.minHi && ou != null && ou >= g.promoteOu;
  const btOk = s.bttsHi.n >= g.minHi && bt != null && bt >= g.promoteBtts;
  const ouBad = s.ouHi.n >= g.minHi && ou != null && ou < g.demoteOu;
  const btBad = s.bttsHi.n >= g.minHi && bt != null && bt < g.demoteBtts;
  const ev = { n: s.n, windowDays: s.windowDays, ouHi: { ...s.ouHi, acc: ou }, bttsHi: { ...s.bttsHi, acc: bt }, x12: s.x12 };
  if (status === 'observe' && (ouOk || btOk)) {
    return { type: 'promote', from: 'observe', to: 'whitelist', reason: `Üst ayakları ${s.ouHi.won}/${s.ouHi.n} (${pct(ou)}), KG ayakları ${s.bttsHi.won}/${s.bttsHi.n} (${pct(bt)}) — eşik Üst ≥${pct(g.promoteOu)} / KG ≥${pct(g.promoteBtts)}, n≥${g.minHi}`, evidence: ev };
  }
  if (status === 'whitelist' && (ouBad || btBad)) {
    return { type: 'demote', from: 'whitelist', to: 'observe', reason: `${ouBad ? `Üst ayakları ${s.ouHi.won}/${s.ouHi.n} (${pct(ou)}) < ${pct(g.demoteOu)}` : ''}${ouBad && btBad ? '; ' : ''}${btBad ? `KG ayakları ${s.bttsHi.won}/${s.bttsHi.n} (${pct(bt)}) < ${pct(g.demoteBtts)}` : ''}`, evidence: ev };
  }
  if (status === 'excluded' && s.n >= g.watchMinN && ouOk && btOk) {
    return { type: 'watch', from: 'excluded', to: 'observe', reason: `Kapsam dışı ligde ${s.n} sonuçlanmış maç; Üst ${s.ouHi.won}/${s.ouHi.n} (${pct(ou)}), KG ${s.bttsHi.won}/${s.bttsHi.n} (${pct(bt)}) — gözleme alınmaya aday`, evidence: ev };
  }
  return null;
}

/** Aynı lig için son `days` günde aynı tip öneri varsa tekrar yazma. */
export const PROPOSAL_COOLDOWN_DAYS = 28;
