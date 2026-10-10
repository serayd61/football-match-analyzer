// ============================================================================
// /picks kaydı — saf yardımcılar (testli; 'server-only' yok)
// ----------------------------------------------------------------------------
// Dondurulmuş "güçlü" seçimi skorla sonuçlandırır ve günlere (Zürih) böler.
// Kazanan ve kaybeden aynı listede kalır; hiçbir satır sonuca göre atılmaz.
// ============================================================================
import type { SignalMarket } from './signal-buckets';
import { ymdOf } from './time';

export const STANDING_RULE_VERSION = 'standing-1.0';

export interface StoredStandingPick {
  fixtureId: number;
  market: SignalMarket;
  selection: string;
  kickoff: string;
  leagueLabel: string;
  leagueSlug: string | null;
  covered: boolean;
  homeName: string;
  awayName: string;
  homeCrest: string | null;
  awayCrest: string | null;
  modelP: number;
  marketP: number | null;
  edge: number | null;
  verdict: string;
  acc: number | null;
  evidenceN: number;
  evidenceWon: number;
  scope: string | null;
}

export interface SettledStandingPick extends StoredStandingPick {
  homeScore: number | null;
  awayScore: number | null;
  /** null → skor yok (ertelenen / iptal / henüz sonuçlanmamış) */
  won: boolean | null;
}

export interface StandingDay {
  /** Zürih günü, YYYY-MM-DD */
  day: string;
  n: number; won: number;
  /** skoru olmayan dondurulmuş seçim */
  pending: number;
  byMarket: Record<SignalMarket, { n: number; won: number }>;
  picks: SettledStandingPick[];
}

/** Seçim skorla tuttu mu. Üst/Alt 2,5'te tam 2,5 yok; KG'de iki taraf da gol. */
export function settleStanding(market: SignalMarket, selection: string, h: number, a: number): boolean {
  if (market === 'ou25') return selection === 'over' ? h + a > 2.5 : h + a < 2.5;
  if (market === 'btts') return (selection === 'yes') === (h > 0 && a > 0);
  const res = h > a ? '1' : a > h ? '2' : 'X';
  return selection === res;
}

const emptyMarkets = (): StandingDay['byMarket'] => ({ '1x2': { n: 0, won: 0 }, ou25: { n: 0, won: 0 }, btts: { n: 0, won: 0 } });

/**
 * Dondurulmuş seçimleri skorla eşler ve günlere böler; en yeni gün önce, gün
 * içinde başlama saatine göre. Skoru olmayan satır `won: null` ile listede kalır
 * ve `pending` sayılır; isabet payına girmez.
 */
export function groupStandingDays(rows: StoredStandingPick[], scores: Map<number, [number, number]>): StandingDay[] {
  const days = new Map<string, StandingDay>();
  for (const r of rows) {
    const day = ymdOf(r.kickoff);
    if (!days.has(day)) days.set(day, { day, n: 0, won: 0, pending: 0, byMarket: emptyMarkets(), picks: [] });
    const d = days.get(day)!;
    const sc = scores.get(r.fixtureId);
    const won = sc ? settleStanding(r.market, r.selection, sc[0], sc[1]) : null;
    d.picks.push({ ...r, homeScore: sc ? sc[0] : null, awayScore: sc ? sc[1] : null, won });
    if (won == null) { d.pending++; continue; }
    d.n++; d.byMarket[r.market].n++;
    if (won) { d.won++; d.byMarket[r.market].won++; }
  }
  for (const d of days.values()) d.picks.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.fixtureId - b.fixtureId || a.market.localeCompare(b.market));
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}
