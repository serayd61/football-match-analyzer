// ============================================================================
// KAPSAM KURALLARI (saf) — lig istatistiğinden terfi / indirme / izleme önerisi
// ----------------------------------------------------------------------------
// Ölçü: günün seçimi kuralının kullandığı sinyal — model seviyesi eşiğini geçen
// gol pazarı ayaklarının isabeti (Üst ≥ %65, KG ≥ %60). 1X2 isabeti bilgi amaçlı.
// Eşikler 12 Eyl backtest'i ve 20 Eyl λ analizinden; n ≥ 40 altında öneri yok.
// ============================================================================

export type CoverageStatus = 'whitelist' | 'observe' | 'excluded';

export interface BucketCell { n: number; won: number }
/** Olasılık dilimi karnesi (23 Eyl): pazar → dilim etiketi → n/won. Etiketler BUCKETS'tan. */
export interface LeagueBuckets { x12: Record<string, BucketCell>; ou25: Record<string, BucketCell>; under25: Record<string, BucketCell>; btts: Record<string, BucketCell> }
export interface LeagueStats {
  n: number;                                   // sonuçlanmış satır (pencere)
  x12: { n: number; won: number; ll: number | null };
  ouHi: { n: number; won: number };            // p_over25 ≥ MIN_OVER ayakları
  bttsHi: { n: number; won: number };          // p_btts_yes ≥ MIN_BTTS ayakları
  buckets?: LeagueBuckets;
  lastKickoff: string | null;
  windowDays: number;
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
export function aggregateLeague(rows: Array<{ p_over25: number | null; p_btts_yes: number | null; p_home?: number | null; p_draw?: number | null; p_away?: number | null; home_score: number | null; away_score: number | null; correct: boolean | null; ll_1x2: number | null; kickoff: string }>, windowDays: number, minOver = 0.65, minBtts = 0.60): LeagueStats {
  const s: LeagueStats = { n: 0, x12: { n: 0, won: 0, ll: null }, ouHi: { n: 0, won: 0 }, bttsHi: { n: 0, won: 0 }, buckets: { x12: {}, ou25: {}, under25: {}, btts: {} }, lastKickoff: null, windowDays };
  const hit = (kind: keyof LeagueBuckets, p: number, won: boolean) => {
    const b = bucketOf(kind, p); if (!b) return;
    const c = (s.buckets![kind][b] ??= { n: 0, won: 0 }); c.n++; if (won) c.won++;
  };
  let llSum = 0, llN = 0;
  for (const r of rows) {
    if (r.home_score == null || r.away_score == null) continue;
    s.n++;
    if (r.p_home != null && r.p_draw != null && r.p_away != null) {
      const ps = [r.p_home, r.p_draw, r.p_away]; const i = ps.indexOf(Math.max(...ps));
      const w = i === 0 ? r.home_score > r.away_score : i === 1 ? r.home_score === r.away_score : r.home_score < r.away_score;
      hit('x12', ps[i], w);
    }
    if (r.p_over25 != null) { hit('ou25', r.p_over25, r.home_score + r.away_score >= 3); hit('under25', 1 - r.p_over25, r.home_score + r.away_score <= 2); }
    if (r.p_btts_yes != null) hit('btts', r.p_btts_yes, r.home_score > 0 && r.away_score > 0);
    if (!s.lastKickoff || r.kickoff > s.lastKickoff) s.lastKickoff = r.kickoff;
    if (r.correct != null) { s.x12.n++; if (r.correct) s.x12.won++; }
    if (r.ll_1x2 != null && Number.isFinite(Number(r.ll_1x2))) { llSum += Number(r.ll_1x2); llN++; }
    const tot = r.home_score + r.away_score, both = r.home_score > 0 && r.away_score > 0;
    if (r.p_over25 != null && r.p_over25 >= minOver) { s.ouHi.n++; if (tot >= 3) s.ouHi.won++; }
    if (r.p_btts_yes != null && r.p_btts_yes >= minBtts) { s.bttsHi.n++; if (both) s.bttsHi.won++; }
  }
  s.x12.ll = llN ? Math.round((llSum / llN) * 10000) / 10000 : null;
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
