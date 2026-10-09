// ============================================================================
// KAPSAM DIŞI MAÇ RİSKİ (saf) — lig dilim karnesinden "bu maç nerede" + risk
// ----------------------------------------------------------------------------
// Neden (2026-09-23): kapsam dışı 340 lig sitede "model kapsamı dışında"
// etiketiyle, beyaz liste eğrisinden türeyen bir risk notuyla duruyordu — o
// eğri bu ligler için fit edilmedi. Sicil artık her lig için pazar × olasılık
// dilimi karnesi tutuyor (league_coverage.stats.buckets). Bu modül seçimi
// ilgili dilime oturtur: ligin kendi dilimi ≥10 maçsa lig, yoksa kapsam dışı
// tüm liglerin toplamı esas alınır; risk o dilimin geçmiş isabetinden gelir.
// Müşteriye gösterilen şey bir garanti değil, aynı durumdaki maçların kaydı.
// ============================================================================
import { bucketOf, BUCKETS, EDGE_LABELS, type LeagueBuckets, type BucketCell, type LeagueStats, type StrongMarket, type LeagueEdge, type EdgeMarket } from '@/lib/coverage/rules';
import { edgeBucket } from './signal-buckets';
import { finishStanding, MIN_EVIDENCE, type MarketStanding, type StandingEvidence } from './match-standing';
import { RISK_LOW, RISK_MEDIUM, type Risk } from './risk';

export type BucketKind = keyof LeagueBuckets;
const EMPTY: LeagueBuckets = { x12: {}, ou25: {}, under25: {}, btts: {} };

/** Kapsam dışı liglerin toplam dilim karnesi (tüm liglerin hücreleri toplanır). */
export function sumBuckets(list: Array<LeagueStats | null | undefined>): LeagueBuckets {
  const out: LeagueBuckets = { x12: {}, ou25: {}, under25: {}, btts: {} };
  for (const s of list) {
    const b = s?.buckets; if (!b) continue;
    for (const k of Object.keys(out) as BucketKind[]) {
      for (const [label, cell] of Object.entries(b[k] ?? {})) {
        const c = (out[k][label] ??= { n: 0, won: 0 }); c.n += cell.n; c.won += cell.won;
      }
    }
  }
  return out;
}

const cellOf = (b: LeagueBuckets | null | undefined, k: BucketKind, label: string): BucketCell | null => b?.[k]?.[label] ?? null;
const toSignal = (c: BucketCell | null) => (c ? { n: c.n, won: c.won, acc: c.n ? c.won / c.n : null } : { n: 0, won: 0, acc: null });

export interface CoverageStandingInput {
  pick: '1' | 'X' | '2' | null; pHome: number; pDraw: number; pAway: number;
  over: { pick: 'over' | 'under'; pRaw: number } | null;
  btts: { pick: 'yes' | 'no'; pRaw: number } | null;
}
/** Marjsız piyasa (en geç faz): 1X2 üçlüsü, Üst 2,5 ve KG Var olasılığı; eksik pazar null. */
export interface CoverageMarket { x12: { pHome: number; pDraw: number; pAway: number } | null; overYes: number | null; bttsYes: number | null }
/** Fark kovası kanıtı: ligin kendi kovaları + toplam (sumEdge). */
export interface CoverageEdge { league: LeagueEdge | null; all: LeagueEdge }

/** Piyasa farkı kanıtı (2026-10-09): seçilen taraf − aynı tarafın marjsız piyasası → EDGE kovası. */
function edgeEvidence(m: EdgeMarket, pModel: number, pMarket: number | null | undefined, edge: CoverageEdge | undefined): StandingEvidence | null {
  if (!edge || pMarket == null || !Number.isFinite(pMarket)) return null;
  const label = EDGE_LABELS[edgeBucket(pModel - pMarket)];
  return { kind: 'edge', bucket: label, league: edge.league ? toSignal(edge.league[m]?.[label] ?? null) : null, all: toSignal(edge.all[m]?.[label] ?? null) };
}

function evidence(kind: BucketKind, p: number, league: LeagueBuckets | null, all: LeagueBuckets): StandingEvidence | null {
  const label = bucketOf(kind, p);
  if (!label) return null;
  return { kind: 'level', bucket: label, league: league ? toSignal(cellOf(league, kind, label)) : null, all: toSignal(cellOf(all, kind, label)) };
}

/**
 * Seçimleri lig / kapsam dışı dilim karnesine oturtur (MatchStanding bileşeniyle aynı şekil).
 * `market` + `edge` verilirse standingFor ile aynı mantık: 1X2'de birincil kanıt fark kovası
 * (seviye ikincil), gol pazarlarında seviye birincil, fark ikincil (2026-10-09).
 */
export function coverageStanding(input: CoverageStandingInput, league: LeagueBuckets | null, all: LeagueBuckets = EMPTY, market?: CoverageMarket | null, edge?: CoverageEdge): MarketStanding[] {
  const out: MarketStanding[] = [];
  if (input.pick) {
    const p = input.pick === '1' ? input.pHome : input.pick === '2' ? input.pAway : input.pDraw;
    const lv = evidence('x12', p, league, all);
    const mp = market?.x12 ? (input.pick === '1' ? market.x12.pHome : input.pick === '2' ? market.x12.pAway : market.x12.pDraw) : null;
    const ed = edgeEvidence('x12', p, mp, edge);
    if (lv) out.push(finishStanding('1x2', input.pick, p, ed ?? lv, ed ? lv : null));
  }
  if (input.over) {
    // pRaw seçilen tarafın olasılığı (≥0,5); Alt'ta 1−pRaw almak yanlış dilime düşürüyordu (düzeltme 2026-10-08).
    const p = input.over.pRaw;
    const lv = evidence(input.over.pick === 'over' ? 'ou25' : 'under25', p, league, all);
    const mp = market?.overYes == null ? null : input.over.pick === 'over' ? market.overYes : 1 - market.overYes;
    if (lv) out.push(finishStanding('ou25', input.over.pick, p, lv, edgeEvidence('ou25', p, mp, edge)));
  }
  if (input.btts && input.btts.pick === 'yes') { // KG Yok için dilim tutulmuyor
    const lv = evidence('btts', input.btts.pRaw, league, all);
    if (lv) out.push(finishStanding('btts', 'yes', input.btts.pRaw, lv, edgeEvidence('btts', input.btts.pRaw, market?.bttsYes, edge)));
  }
  return out;
}

/** Kart risk etiketi: 1X2 seçiminin dilimindeki geçmiş isabet (site eşikleri: ≥%74 düşük, ≥%65 orta). Kanıt yoksa yüksek. */
export function coverageRisk(rows: MarketStanding[]): Risk {
  const r = rows.find((x) => x.market === '1x2');
  if (!r || r.acc == null) return 'high';
  return r.acc >= RISK_LOW ? 'low' : r.acc >= RISK_MEDIUM ? 'medium' : 'high';
}

export interface LeagueSummary { n: number; x12: number | null; ou: number | null; btts: number | null }
/** Lig başlığı için 180 günlük özet (yüzde). */
export function leagueSummary(stats: LeagueStats | null | undefined): LeagueSummary {
  const pct = (won: number, n: number) => (n >= MIN_EVIDENCE ? Math.round((won / n) * 100) : null);
  if (!stats) return { n: 0, x12: null, ou: null, btts: null };
  return { n: stats.n, x12: pct(stats.x12.won, stats.x12.n), ou: pct(stats.ouHi.won, stats.ouHi.n), btts: pct(stats.bttsHi.won, stats.bttsHi.n) };
}

export const BUCKET_LABELS = BUCKETS;

// ---- Güçlü pazar (24 Eyl): ligin ≥15 maç / ≥%70 tutan üst dilimi -------------
export interface StrongPick { market: StrongMarket['market']; selection: '1' | 'X' | '2' | 'over' | 'under' | 'yes'; p: number; sm: StrongMarket }

/** Maçın seçimi ligin güçlü pazarının eşik bölgesine düşüyorsa onu döner (ilk uyan; sıra: gol pazarları önce). */
export function strongPickFor(input: CoverageStandingInput, strong: StrongMarket[] | undefined): StrongPick | null {
  if (!strong?.length) return null;
  const order: StrongMarket['market'][] = ['ou25', 'under25', 'btts', 'x12'];
  for (const m of order) {
    const sm = strong.find((x) => x.market === m); if (!sm) continue;
    if (m === 'ou25' && input.over?.pick === 'over' && input.over.pRaw >= sm.from) return { market: m, selection: 'over', p: input.over.pRaw, sm };
    if (m === 'under25' && input.over?.pick === 'under' && input.over.pRaw >= sm.from) return { market: m, selection: 'under', p: input.over.pRaw, sm };
    if (m === 'btts' && input.btts?.pick === 'yes' && input.btts.pRaw >= sm.from) return { market: m, selection: 'yes', p: input.btts.pRaw, sm };
    if (m === 'x12' && input.pick) {
      const p = input.pick === '1' ? input.pHome : input.pick === '2' ? input.pAway : input.pDraw;
      if (p >= sm.from) return { market: m, selection: input.pick, p, sm };
    }
  }
  return null;
}

/** Güçlü pazara düşen seçimde risk o pazarın lig karnesinden gelir. */
export function strongRisk(sp: StrongPick): Risk {
  const acc = sp.sm.won / sp.sm.n;
  return acc >= RISK_LOW ? 'low' : acc >= RISK_MEDIUM ? 'medium' : 'high';
}
