// ============================================================================
// "Karneye uyan maçlar" (saf) — günün kapsanan maçlarını maç sayfasındaki
// "Bu maç karnemizde nerede" ölçeğinden (standingFor) toplu geçirir; pazar
// başına (1X2 / Üst-Alt 2,5 / KG) "güçlü" hükmü alan seçimleri, model–piyasa
// farkıyla birlikte tek listede döner.
// ----------------------------------------------------------------------------
// Neden (2026-10-08): müşteri her maçı açıp ölçeğe bakmak, modelle piyasayı
// kendisi karşılaştırmak zorunda kalmasın. Kural yeni değil; maç sayfasıyla
// birebir aynı hüküm. 1X2'de kanıt piyasa farkı kovası (fark büyüdükçe isabet
// düşüyor; +edge TERS sinyal), gol pazarlarında model seviyesi — yani bu liste
// "en büyük fark" değil, "geçmişte en çok tutan kova" listesidir.
// ============================================================================
import type { SitePrediction } from './predictions';
import type { SignalTable, SignalMarket } from './signal-buckets';
import { standingFor, type MarketStanding, type Verdict } from './match-standing';

export interface MarketProbs1x2 { pHome: number; pDraw: number; pAway: number }

export interface StandingPick {
  fixtureId: number;
  row: SitePrediction;
  standing: MarketStanding;
  market: SignalMarket;
  selection: string;
  /** seçilen tarafın model olasılığı */
  modelP: number;
  /** seçilen tarafın marjsız piyasa olasılığı (yoksa null) */
  marketP: number | null;
  /** modelP − marketP, 0–1 ölçeğinde (yoksa null) */
  edge: number | null;
  verdict: Verdict;
}

export interface DailyStandingBoard {
  /** pazar sırası sabit: 1x2, ou25, btts */
  markets: Array<{ market: SignalMarket; picks: StandingPick[] }>;
  /** taranan maç sayısı (kapsanan + modelli + oynanmamış) */
  scanned: number;
  /** en az bir güçlü pazarı olan maç sayısı */
  matches: number;
}

export const MARKET_ORDER: SignalMarket[] = ['1x2', 'ou25', 'btts'];

/** Seçilen tarafın marjsız piyasa olasılığı; GoalCall.pMarket zaten seçilen taraf için. */
function marketFor(row: SitePrediction, s: MarketStanding, m: MarketProbs1x2 | null): number | null {
  if (s.market === '1x2') return m ? (s.selection === '1' ? m.pHome : s.selection === '2' ? m.pAway : m.pDraw) : null;
  if (s.market === 'ou25') return row.overUnder?.pMarket ?? null;
  return row.btts?.pMarket ?? null;
}

/**
 * Günün satırlarını hükme oturtur ve `verdicts` kümesindeki (varsayılan yalnız
 * 'strong') seçimleri pazar pazar listeler. Her pazar kendi içinde geçmiş
 * isabete (acc) göre, eşitlikte örneklem büyüklüğüne göre sıralanır.
 */
export function dailyStandingBoard(
  rows: SitePrediction[],
  markets1x2: Record<number, MarketProbs1x2 | undefined>,
  tables: SignalTable[],
  verdicts: ReadonlySet<Verdict> = new Set<Verdict>(['strong']),
  /** Kapsam dışı (gözlem) satır için hüküm — lig dilim + fark karnesinden (coverageStanding); null → satır taranmaz (2026-10-09) */
  outside?: (row: SitePrediction, market1x2: MarketProbs1x2 | null) => MarketStanding[] | null,
): DailyStandingBoard {
  const live = (r: SitePrediction) => r.hasModel && !r.settled && r.status !== 'finished' && r.status !== 'cancelled' && r.status !== 'postponed';
  const eligible = rows.filter((r) => live(r) && (r.covered || !!outside));
  const byMarket = new Map<SignalMarket, StandingPick[]>(MARKET_ORDER.map((m) => [m, []]));
  const matchIds = new Set<number>();
  let scanned = 0;
  for (const row of eligible) {
    const m = markets1x2[row.fixtureId] ?? null;
    const bttsYes = row.btts?.pMarket == null ? null : row.btts.pick === 'yes' ? row.btts.pMarket : 1 - row.btts.pMarket;
    const standing = !row.covered ? outside!(row, m) : standingFor({
      leagueSlug: row.league?.slug ?? null,
      pick: row.pick, pHome: row.pHome, pDraw: row.pDraw, pAway: row.pAway,
      over: row.overUnder ? { pick: row.overUnder.pick, pRaw: row.overUnder.pRaw } : null,
      btts: row.btts ? { pick: row.btts.pick, pRaw: row.btts.pRaw } : null,
      market: m,
      bttsMarketYes: bttsYes,
    }, tables);
    if (!standing) continue;
    scanned++;
    for (const s of standing) {
      if (!verdicts.has(s.verdict)) continue;
      const marketP = marketFor(row, s, m);
      byMarket.get(s.market)!.push({
        fixtureId: row.fixtureId, row, standing: s, market: s.market, selection: s.selection,
        modelP: s.modelP, marketP, edge: marketP == null ? null : s.modelP - marketP, verdict: s.verdict,
      });
      matchIds.add(row.fixtureId);
    }
  }
  const sortPicks = (a: StandingPick, b: StandingPick) =>
    ((b.standing.acc ?? 0) - (a.standing.acc ?? 0)) || (b.standing.n - a.standing.n) || a.row.kickoff.localeCompare(b.row.kickoff);
  return {
    markets: MARKET_ORDER.map((market) => ({ market, picks: byMarket.get(market)!.sort(sortPicks) })),
    scanned,
    matches: matchIds.size,
  };
}
