// ============================================================================
// GÜNÜN 3 SEÇİMİ — kural (saf, test edilebilir)
// ----------------------------------------------------------------------------
// 2026-09-12 backtest'i (203 oranlı + 429 kapsanan-lig sonuçlanmış maç):
//   • 1X2'de "piyasaya karşı avantaj" TERS sinyal: fark ≥ +5 → %23 isabet,
//     ROI −23; fark ≥ +15 → ROI −72. Model piyasadan uzaklaştıkça yanılıyor.
//   • Gol pazarlarında modelin SEVİYESİ çalışıyor, fark değil:
//     KG Var model ≥ %60 → %71 isabet (n=150); Üst 2,5 ≥ %65 → %77 (n=99).
//     Oranı olan 56 maçta KG ≥ %60 → %84 isabet, ROI +28. Fark şartı eklenince
//     isabet %42'ye düşüyor → piyasayla kavga eden değil, uyuşan ayak alınır.
//   • Lig: Eredivisie (KG %81 / Ü %86), Bundesliga (%89 / %75) güçlü;
//     LaLiga, Serie A küçük örneklemde iyi; Ligue 1 (%50 / %50), Liga Portugal
//     ve Brasileirão zayıf → beyaz listede yok.
//   • Kupon boyu beklenen getiriyi artırmıyor, varyansı büyütüyor → günde 3 ayak.
// Kural değişirse RULE_VERSION artar; site_daily_picks satırları sürümü taşır.
// ============================================================================

export const RULE_VERSION = 'goals-1.0';

/** Lig öncelik sırası (küçük = önce). Listede olmayan lig aday değildir.
 *  2026-09-22: tek kaynak artık league_coverage tablosu (lib/coverage/registry
 *  whitelistTiers); bu sabit tohum + tablo boşsa yedek. */
export const LEAGUE_TIER: Record<string, number> = {
  eredivisie: 0,
  bundesliga: 0,
  'la-liga': 1,
  'serie-a': 1,
  championship: 2,
  'premier-league': 2,
  'champions-league': 2,
};

export const MIN_BTTS = 0.60;
export const MIN_OVER = 0.65;
/** Bahisçi oranı bilinen ayaklarda kabul edilen bant; adil oranla gelen ayak banda tabi değil. */
export const ODDS_MIN = 1.25;
export const ODDS_MAX = 1.75;
export const TAKE = 3;

export type PickMarket = 'btts' | 'ou25';
export type PickSelection = 'yes' | 'over';

export interface PickCandidateInput {
  fixtureId: number;
  leagueSlug: string | null;
  kickoff: string;
  /** P(karşılıklı gol var), 0..1 */
  pBttsYes: number | null;
  /** P(üst 2,5), 0..1 */
  pOver25: number | null;
  /** Bahisçi KG Var oranı (marjlı), varsa */
  bttsYesOdds?: number | null;
  /** Bahisçi Üst 2,5 oranı (marjlı), varsa */
  over25Odds?: number | null;
}

export interface PickCandidate {
  fixtureId: number;
  leagueSlug: string;
  kickoff: string;
  market: PickMarket;
  selection: PickSelection;
  modelP: number;
  odds: number;
  oddsSource: 'book' | 'fair';
}

const fair = (p: number) => Math.round((1 / p) * 100) / 100;

function candidate(
  r: PickCandidateInput,
  market: PickMarket,
  p: number | null,
  min: number,
  bookOdds: number | null | undefined,
): PickCandidate | null {
  if (p == null || !Number.isFinite(p) || p < min || !r.leagueSlug) return null;
  if (bookOdds != null && Number.isFinite(bookOdds) && bookOdds > 1) {
    if (bookOdds < ODDS_MIN || bookOdds > ODDS_MAX) return null;
    return { fixtureId: r.fixtureId, leagueSlug: r.leagueSlug, kickoff: r.kickoff, market, selection: market === 'btts' ? 'yes' : 'over', modelP: p, odds: bookOdds, oddsSource: 'book' };
  }
  // Piyasa oranı yoksa (Ü/A çoğu zaman feed'de yok) adil oran 1/p ile aynı
  // bant uygulanır: p≥0.80 → ≤1.25 → kupona değer katmaz, kural dışı.
  // 2026-09-13: PSV–Sparta Ü2,5 p=0.87 (1.15) bu yüzden dışarıda kalır.
  const f = fair(p);
  if (f < ODDS_MIN || f > ODDS_MAX) return null;
  return { fixtureId: r.fixtureId, leagueSlug: r.leagueSlug, kickoff: r.kickoff, market, selection: market === 'btts' ? 'yes' : 'over', modelP: p, odds: f, oddsSource: 'fair' };
}

/**
 * Günün seçimleri: her maçtan en fazla bir ayak (eşiğini en çok aşan pazar),
 * olasılığa göre sıralı, lig kademesi eşitlik bozucu, en fazla TAKE ayak.
 * `now` verilirse başlamış maçlar elenir.
 */
export function selectDailyPicks(rows: PickCandidateInput[], now?: number, take = TAKE, tiers: Record<string, number> = LEAGUE_TIER): PickCandidate[] {
  const out: PickCandidate[] = [];
  for (const r of rows) {
    if (!r.leagueSlug || !(r.leagueSlug in tiers)) continue;
    if (now != null && Date.parse(r.kickoff) <= now) continue;
    const over = candidate(r, 'ou25', r.pOver25, MIN_OVER, r.over25Odds);
    const btts = candidate(r, 'btts', r.pBttsYes, MIN_BTTS, r.bttsYesOdds);
    const best = [over, btts]
      .filter((c): c is PickCandidate => !!c)
      // Eşiğin üstünde kalan pay: Ü2,5 %78 (+13) KG %77 (+17) → KG öne geçer.
      .sort((a, b) => (b.modelP - (b.market === 'btts' ? MIN_BTTS : MIN_OVER)) - (a.modelP - (a.market === 'btts' ? MIN_BTTS : MIN_OVER)))[0];
    if (best) out.push(best);
  }
  return out
    .sort((a, b) => b.modelP - a.modelP || tiers[a.leagueSlug] - tiers[b.leagueSlug] || a.kickoff.localeCompare(b.kickoff))
    .slice(0, take);
}

/** Skordan sonuçlandırma; pazar tablosuyla aynı kural. */
export function settlePick(market: PickMarket, homeGoals: number, awayGoals: number): boolean {
  return market === 'btts' ? homeGoals > 0 && awayGoals > 0 : homeGoals + awayGoals >= 3;
}

export interface PicksTally {
  n: number;
  won: number;
  byMarket: Record<PickMarket, { n: number; won: number }>;
  /** sabit 1 birim, YALNIZ bahisçi oranlı ayaklar — alınabilir getiri */
  roi: number | null;
  nBook: number;
  /** adil oranlı (1/p) ayaklar: teorik senaryo, gerçek getiriye girmez */
  nFair: number;
  roiFair: number | null;
}

/**
 * Denetim 2026-09-18 (B04): adil oran (1/p) modelden türetilir, piyasada alınabilir
 * bir fiyat değildir; eskiden gerçek getiriyle aynı toplamdaydı. İsabet (n/won)
 * tüm ayakları sayar; getiri yalnız oddsSource='book'.
 */
export function tallyPicks(settled: Array<{ market: PickMarket; odds: number; oddsSource: 'book' | 'fair'; won: boolean }>): PicksTally {
  const t: PicksTally = { n: 0, won: 0, byMarket: { btts: { n: 0, won: 0 }, ou25: { n: 0, won: 0 } }, roi: null, nBook: 0, nFair: 0, roiFair: null };
  let bookRet = 0, fairRet = 0;
  for (const p of settled) {
    t.n++; t.byMarket[p.market].n++;
    if (p.won) { t.won++; t.byMarket[p.market].won++; }
    if (p.oddsSource === 'book') { t.nBook++; if (p.won) bookRet += p.odds; }
    else { t.nFair++; if (p.won) fairRet += p.odds; }
  }
  t.roi = t.nBook ? (bookRet - t.nBook) / t.nBook : null;
  t.roiFair = t.nFair ? (fairRet - t.nFair) / t.nFair : null;
  return t;
}
