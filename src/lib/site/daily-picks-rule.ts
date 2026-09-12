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

/** Lig öncelik sırası (küçük = önce). Listede olmayan lig aday değildir. */
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
  return { fixtureId: r.fixtureId, leagueSlug: r.leagueSlug, kickoff: r.kickoff, market, selection: market === 'btts' ? 'yes' : 'over', modelP: p, odds: fair(p), oddsSource: 'fair' };
}

/**
 * Günün seçimleri: her maçtan en fazla bir ayak (eşiğini en çok aşan pazar),
 * olasılığa göre sıralı, lig kademesi eşitlik bozucu, en fazla TAKE ayak.
 * `now` verilirse başlamış maçlar elenir.
 */
export function selectDailyPicks(rows: PickCandidateInput[], now?: number, take = TAKE): PickCandidate[] {
  const out: PickCandidate[] = [];
  for (const r of rows) {
    if (!r.leagueSlug || !(r.leagueSlug in LEAGUE_TIER)) continue;
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
    .sort((a, b) => b.modelP - a.modelP || LEAGUE_TIER[a.leagueSlug] - LEAGUE_TIER[b.leagueSlug] || a.kickoff.localeCompare(b.kickoff))
    .slice(0, take);
}

/** Skordan sonuçlandırma; pazar tablosuyla aynı kural. */
export function settlePick(market: PickMarket, homeGoals: number, awayGoals: number): boolean {
  return market === 'btts' ? homeGoals > 0 && awayGoals > 0 : homeGoals + awayGoals >= 3;
}
