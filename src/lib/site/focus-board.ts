// ============================================================================
// "Nereye odaklanmalı" (saf) — /picks için lig × pazar odak tablosu
// ----------------------------------------------------------------------------
// Neden (2026-10-13): karne 7 tablo × 10 lig × 3–5 kova; müşteri "hangi ligde,
// hangi pazarda, hangi aralıkta tutuyor?" sorusunu tek tabloda görmeli. Kaynak
// yeni değil: performance.ts sinyal karnesi (perf.signals). Her lig × pazar için
// /picks'in hüküm verdiği kanıt türünde (1X2 → piyasa farkı, gol pazarları →
// model seviyesi; standingFor ile aynı) ≥10 maçlık ve "güçlü" eşiğini geçen
// kovalar = o ligin güçlü bölgesi. Hücre o bölgenin toplam isabetini ve kova
// etiketlerini verir. Yanına dondurulmuş /picks seçimlerinin gerçek kaydı eklenir
// (standing-picks-rule.ts). Garanti değil, aynı durumdaki maçların kaydı.
// ============================================================================
import type { SignalTable, SignalMarket, SignalKind, SignalCell } from './signal-buckets';
import { MIN_EVIDENCE, STRONG_ACC, verdictFor, type Verdict } from './match-standing';
import type { StandingDay } from './standing-picks-rule';
import type { SiteLeague } from './leagues';

export const FOCUS_MARKETS: SignalMarket[] = ['1x2', 'ou25', 'btts'];
/** /picks hükmünün birincil kanıtı (standingFor): 1X2 fark, gol pazarları seviye. */
export const PRIMARY_KIND: Record<SignalMarket, SignalKind> = { '1x2': 'edge', ou25: 'level', btts: 'level' };

export interface FocusZone { bucket: string; n: number; won: number; acc: number }
export interface FocusCell {
  kind: SignalKind;
  /** güçlü eşiği geçen (≥ MIN_EVIDENCE) kovalar, tablo sırasıyla */
  zones: FocusZone[];
  /** güçlü bölgenin toplamı */
  n: number; won: number; acc: number | null;
  verdict: Verdict;
  /** bölge yoksa en iyi tekil kova (bilgi için); ≥ MIN_EVIDENCE */
  best: FocusZone | null;
  /** dondurulmuş /picks seçimlerinin kaydı (sonuçlanmış) */
  record: { n: number; won: number } | null;
}
export interface FocusRow {
  /** null → tüm ligler */
  league: SiteLeague | null;
  cells: Record<SignalMarket, FocusCell | null>;
  strong: number;
  /** güçlü hücrelerin en yüksek isabeti (sıralama) */
  top: number;
}
export interface FocusBoard { all: FocusRow; leagues: FocusRow[] }

export type FocusRecord = Map<string, { n: number; won: number }>;
export const recordKey = (league: string | null, market: SignalMarket) => `${league ?? '*'}|${market}`;

/** Dondurulmuş seçimlerin lig × pazar kaydı; '*' = tüm ligler. Skoru olmayan satır sayılmaz. */
export function focusRecord(days: StandingDay[]): FocusRecord {
  const out: FocusRecord = new Map();
  const bump = (k: string, won: boolean) => { const c = out.get(k) ?? { n: 0, won: 0 }; c.n++; if (won) c.won++; out.set(k, c); };
  for (const d of days) for (const p of d.picks) {
    if (p.won == null) continue;
    bump(recordKey(p.leagueSlug ?? p.leagueLabel, p.market), p.won);
    bump(recordKey(null, p.market), p.won);
  }
  return out;
}

function cellFor(market: SignalMarket, kind: SignalKind, buckets: string[], cells: SignalCell[], record: { n: number; won: number } | null): FocusCell | null {
  const eligible = cells.map((c, i) => ({ bucket: buckets[i], n: c.n, won: c.won, acc: c.acc ?? 0 })).filter((z) => z.n >= MIN_EVIDENCE);
  if (!eligible.length && !record) return null;
  const zones = eligible.filter((z) => z.acc >= STRONG_ACC[market]);
  const n = zones.reduce((a, z) => a + z.n, 0), won = zones.reduce((a, z) => a + z.won, 0);
  const acc = n ? won / n : null;
  const best = eligible.length ? eligible.reduce((a, z) => (z.acc > a.acc || (z.acc === a.acc && z.n > a.n) ? z : a)) : null;
  return { kind, zones, n, won, acc, verdict: zones.length ? 'strong' : verdictFor(market, best?.acc ?? null), best, record };
}

/**
 * Lig × pazar odak tablosu. Satırlar: en çok güçlü pazarı olan lig önce, eşitlikte en
 * yüksek güçlü isabet, sonra ad. Hiç kovası (≥10 maç) ve kaydı olmayan lig listeye girmez.
 */
export function focusBoard(tables: SignalTable[], record: FocusRecord = new Map()): FocusBoard {
  const leagues = new Map<string, SiteLeague>();
  for (const t of tables) for (const r of t.leagues) leagues.set(r.league.slug, r.league);
  const row = (league: SiteLeague | null): FocusRow => {
    const cells = {} as Record<SignalMarket, FocusCell | null>;
    for (const m of FOCUS_MARKETS) {
      const t = tables.find((x) => x.market === m && x.kind === PRIMARY_KIND[m]) ?? tables.find((x) => x.market === m && x.kind === 'level');
      const rec = record.get(recordKey(league?.slug ?? null, m)) ?? null;
      if (!t) { cells[m] = rec ? { kind: PRIMARY_KIND[m], zones: [], n: 0, won: 0, acc: null, verdict: 'thin', best: null, record: rec } : null; continue; }
      const cellsOf = league ? (t.leagues.find((l) => l.league.slug === league.slug)?.cells ?? t.buckets.map(() => ({ n: 0, won: 0, acc: null }))) : t.all;
      cells[m] = cellFor(m, t.kind, t.buckets, cellsOf, rec);
    }
    const strongCells = FOCUS_MARKETS.map((m) => cells[m]).filter((c): c is FocusCell => !!c && c.verdict === 'strong');
    return { league, cells, strong: strongCells.length, top: strongCells.reduce((a, c) => Math.max(a, c.acc ?? 0), 0) };
  };
  const rows = [...leagues.values()].map(row).filter((r) => FOCUS_MARKETS.some((m) => r.cells[m]))
    .sort((a, b) => b.strong - a.strong || b.top - a.top || a.league!.name.localeCompare(b.league!.name));
  return { all: row(null), leagues: rows };
}
