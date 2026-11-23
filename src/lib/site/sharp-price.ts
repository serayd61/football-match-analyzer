// ============================================================================
// Keskin fiyat kuralı (GÖLGE ölçüm, 2026-11-23) — saf fonksiyonlar
// ----------------------------------------------------------------------------
// Soru: bir bahisçinin fiyatı, keskin piyasanın (Pinnacle) AYNI ANDAKİ marjsız
// fiyatının üstündeyse o bahis kâr eder mi? Model kullanılmaz. Backtest
// (reports/backtest-open-value.md) kapanışı %57–67 geçtiğini gösterdi ama ROI
// aralığı sıfırı içeriyordu; burada canlı fiyatla, yayına çıkmadan ölçülür.
// Hiçbir sayfa bu dosyayı okumaz; yalnız cron yazımı ve karne betiği.
// ============================================================================

import { devigMultiplicative } from '@/lib/odds/devig';

export const SHARP_BOOK_ID = 4; // API-Football: Pinnacle
export const SHARP_SELECTIONS = ['home', 'draw', 'away', 'over25', 'under25', 'btts_yes', 'btts_no'] as const;
export type SharpSelection = (typeof SHARP_SELECTIONS)[number];

/** Tablo satırı biçimi (odds_book_prices) — yalnız fiyat alanları. */
export interface BookRow {
  bookmaker_id: number; bookmaker: string;
  home: number | null; draw: number | null; away: number | null;
  over25: number | null; under25: number | null;
  btts_yes: number | null; btts_no: number | null;
}

const GROUPS: SharpSelection[][] = [['home', 'draw', 'away'], ['over25', 'under25'], ['btts_yes', 'btts_no']];
const ok = (v: number | null | undefined): v is number => typeof v === 'number' && v > 1 && v < 1000;

/** Keskin bahisçinin marjsız olasılıkları; pazarı eksikse o pazar yok. */
export function sharpFair(sharp: BookRow | undefined | null): Partial<Record<SharpSelection, number>> {
  const out: Partial<Record<SharpSelection, number>> = {};
  if (!sharp) return out;
  for (const g of GROUPS) {
    const odds = g.map((s) => sharp[s]);
    if (!odds.every(ok)) continue;
    const p = devigMultiplicative(odds as number[]);
    g.forEach((s, i) => { out[s] = p[i]; });
  }
  return out;
}

export interface SharpEdge { selection: SharpSelection; bookmakerId: number; bookmaker: string; odds: number; fair: number; edge: number }

/**
 * Her seçim için keskin olmayan bahisçilerin EN İYİ fiyatı ve keskin adil fiyata göre avantajı
 * (fair · odds − 1). `only` verilirse yalnız o bahisçiler (ör. tek bir alınabilir bahisçi).
 */
export function sharpEdges(books: BookRow[], opts: { sharpId?: number; only?: number[] } = {}): SharpEdge[] {
  const sharpId = opts.sharpId ?? SHARP_BOOK_ID;
  const fair = sharpFair(books.find((b) => b.bookmaker_id === sharpId));
  const soft = books.filter((b) => b.bookmaker_id !== sharpId && (!opts.only || opts.only.includes(b.bookmaker_id)));
  const out: SharpEdge[] = [];
  for (const s of SHARP_SELECTIONS) {
    const f = fair[s];
    if (!f) continue;
    let best: BookRow | null = null;
    for (const b of soft) if (ok(b[s]) && (!best || (b[s] as number) > (best[s] as number))) best = b;
    if (!best) continue;
    const odds = best[s] as number;
    out.push({ selection: s, bookmakerId: best.bookmaker_id, bookmaker: best.bookmaker, odds, fair: f, edge: f * odds - 1 });
  }
  return out;
}

/** Seçim kazandı mı? Skor yoksa null. */
export function selectionWon(s: SharpSelection, homeGoals: number | null, awayGoals: number | null): boolean | null {
  if (homeGoals == null || awayGoals == null) return null;
  const t = homeGoals + awayGoals;
  switch (s) {
    case 'home': return homeGoals > awayGoals;
    case 'draw': return homeGoals === awayGoals;
    case 'away': return homeGoals < awayGoals;
    case 'over25': return t > 2.5;
    case 'under25': return t < 2.5;
    case 'btts_yes': return homeGoals > 0 && awayGoals > 0;
    case 'btts_no': return !(homeGoals > 0 && awayGoals > 0);
  }
}
