// ============================================================================
// GÜÇLÜ PAZARLAR (saf) — ana sayfa "bugün güçlü pazarlar" + "pazar karnesi"
// ----------------------------------------------------------------------------
// Neden (24 Eyl, kullanıcı onaylı plan): müşteri hangi lig-pazar çiftinde
// karnenin güçlü olduğunu ve bugün o bölgeye düşen maçları tek bakışta görsün.
// Kaynak sicil `stats.strong` (≥15 maç, ≥%70; pazartesi yenilenir). Vitrinde
// kadın/altyapı/hazırlık/kupa ligleri yok: sitede kalırlar ama öne çıkmazlar.
// ============================================================================
import type { StrongMarket } from '@/lib/coverage/rules';
import { strongPickFor, type StrongPick, type CoverageStandingInput } from './coverage-risk';

export const SHOWCASE_NOISE = /friendl|hazırlık|\(w\)|women|frauen|femen|feminin|kvinn|dames|toppserien|damallsvenskan|\bu-?(15|16|17|18|19|20|21|23)\b|youth|junior|reserve|\bii\b|primavera|next pro|\bcup\b|pokal|coppa|\bcopa\b|kupa|qualification/i;

export interface StrongLeagueRow { leagueId: number; name: string; ccode: string | null; status: string; market: StrongMarket['market']; from: number; n: number; won: number; acc: number }
export interface StrongBoard { market: StrongMarket['market']; rows: StrongLeagueRow[] }

const MARKET_ORDER: StrongMarket['market'][] = ['ou25', 'btts', 'under25', 'x12'];

/** Pazar başına en iyi ligler (isabet, sonra n). Gürültü ligleri ve gizli ligler dışarıda. */
export function strongBoard(rows: Array<{ league_id: number; name: string; ccode: string | null; status: string; stats: { strong?: StrongMarket[] } | null }>, top = 3): StrongBoard[] {
  const all: StrongLeagueRow[] = [];
  for (const r of rows) {
    if (r.status === 'hidden' || SHOWCASE_NOISE.test(r.name)) continue;
    for (const m of r.stats?.strong ?? []) all.push({ leagueId: r.league_id, name: r.name, ccode: r.ccode, status: r.status, market: m.market, from: m.from, n: m.n, won: m.won, acc: m.won / m.n });
  }
  return MARKET_ORDER.map((market) => ({ market, rows: all.filter((x) => x.market === market).sort((a, b) => b.acc - a.acc || b.n - a.n).slice(0, top) })).filter((b) => b.rows.length);
}

export interface StrongTodayInput<T> { row: T; leagueId: number | null; leagueName: string; kickoff: string; input: CoverageStandingInput }
export interface StrongTodayRow<T> { row: T; pick: StrongPick; leagueName: string }

/** Günün maçlarından güçlü bölgeye düşenler (kapsam içi ve dışı; gürültü ve gizli lig hariç), kickoff sırasıyla. */
export function strongToday<T>(items: StrongTodayInput<T>[], strongOf: (leagueId: number) => { strong?: StrongMarket[]; status?: string; name?: string } | undefined, limit = 8): StrongTodayRow<T>[] {
  const out: StrongTodayRow<T>[] = [];
  for (const it of items) {
    if (it.leagueId == null) continue;
    const c = strongOf(it.leagueId);
    if (!c?.strong?.length || c.status === 'hidden' || SHOWCASE_NOISE.test(c.name ?? it.leagueName)) continue;
    const pick = strongPickFor(it.input, c.strong);
    if (pick) out.push({ row: it.row, pick, leagueName: c.name ?? it.leagueName });
  }
  return out.sort((a, b) => Date.parse((a.row as any).kickoff) - Date.parse((b.row as any).kickoff)).slice(0, limit);
}
