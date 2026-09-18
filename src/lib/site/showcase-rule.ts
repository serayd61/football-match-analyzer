// ============================================================================
// Vitrin seçimi — kural E (saf, testli)
// ----------------------------------------------------------------------------
// Neden: aylık 1X2 isabeti (%43 Eyl, %48 Ağu 2026) müşteri vitrini olarak
// ürkütücü; backtest (2026-09-13, 231 oranlı maç) 1X2'nin tek başına %50'yi
// geçmediğini (piyasa favorisi %47), pozitif farkın ters sinyal olduğunu
// (+5…+10 → %30, >+10 → %24) ve gol pazarlarının seviye eşiğinde tuttuğunu
// gösterdi. Kural E: önce gol pazarı (Üst ≥ %65 / KG Var ≥ %60), yoksa 1X2
// yalnız fark < +5 iken, zayıf liglerde 1X2 hiç; aksi halde "seçim yok".
// Backtest: 113/183 = %62, kapsam %79 (F: fark<0 → %66, kapsam %61).
// Motorun ham çıktısına dokunulmaz; vitrin seçimi ayrı tabloda dondurulur ve
// kendi karnesiyle ölçülür (site_showcase_picks). LLM karar vermez.
// ============================================================================
import { MIN_BTTS, MIN_OVER } from './daily-picks-rule';

export const SHOWCASE_RULE_VERSION = 'showcase-E-1.0';
/** Bu fark (model − marjsız piyasa, seçilen taraf) ve üstünde 1X2 vitrine çıkmaz. */
export const EDGE_MAX_1X2 = 0.05;
/** 1X2'nin karnede zayıf olduğu ligler (F kuralı kırılımı: PL %40, Ligue 1 %50, Portekiz %44, Brezilya %33). */
export const NO_1X2_LEAGUES: ReadonlySet<string> = new Set(['premier-league', 'ligue-1', 'liga-portugal', 'brasileirao']);
/** Başlamaya bu kadar dakika kala satır dondurulur; sonrası değişmez. */
export const FREEZE_MINUTES = 180;

export type FreezeState = 'open' | 'freeze' | 'late';
/**
 * Denetim 2026-09-18 (B07): eski koşul `mins <= 180` alt sınırsızdı; başlamış maç
 * (mins < 0) ilk kez hesaplanıp "dondurulmuş" karneye girebiliyordu.
 *  open   → 3 saatten uzak: yazılır, sonraki cron yeniden hesaplar
 *  freeze → (0, 180] dk: yazılır ve dondurulur
 *  late   → başlamış: yeni seçim YAZILMAZ (donmamış eski satır karneye girmez)
 */
export function freezeState(kickoff: string, now: number): FreezeState {
  const mins = (Date.parse(kickoff) - now) / 60000;
  if (!(mins > 0)) return 'late';
  return mins <= FREEZE_MINUTES ? 'freeze' : 'open';
}

export type ShowcaseMarket = '1x2' | 'ou25' | 'btts';
export type ShowcaseSelection = '1' | 'X' | '2' | 'over' | 'yes';
export type ShowcaseReason = 'goal' | '1x2' | 'edge_high' | 'no_market' | 'league_no_1x2' | 'below_threshold';

export interface ShowcaseInput {
  fixtureId: number;
  leagueSlug: string | null;
  kickoff: string;
  pick: '1' | 'X' | '2' | null;
  pHome: number | null; pDraw: number | null; pAway: number | null;
  pBttsYes: number | null;
  pOver25: number | null;
  /** marjsız piyasa 1X2 (son görüş); yoksa null */
  market: { pHome: number; pDraw: number; pAway: number; phase: string } | null;
}

export interface ShowcasePick {
  fixtureId: number;
  market: ShowcaseMarket | null;
  selection: ShowcaseSelection | null;
  modelP: number | null;
  /** model − piyasa, seçilen 1X2 tarafı (piyasa yoksa null) */
  edge1x2: number | null;
  marketPhase: string | null;
  reason: ShowcaseReason;
}

const fin = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

export function showcaseFor(i: ShowcaseInput): ShowcasePick {
  const base = { fixtureId: i.fixtureId, marketPhase: i.market?.phase ?? null };
  const pickP = i.pick === '1' ? i.pHome : i.pick === '2' ? i.pAway : i.pick === 'X' ? i.pDraw : null;
  const mktP = i.market && i.pick ? (i.pick === '1' ? i.market.pHome : i.pick === '2' ? i.market.pAway : i.market.pDraw) : null;
  const edge = fin(pickP) && fin(mktP) ? pickP - mktP : null;

  // 1) Gol pazarı önce: eşiğini daha fazla aşan kazanır.
  const kgM = fin(i.pBttsYes) ? i.pBttsYes - MIN_BTTS : -1;
  const ouM = fin(i.pOver25) ? i.pOver25 - MIN_OVER : -1;
  if (kgM >= 0 || ouM >= 0) {
    return kgM >= ouM
      ? { ...base, market: 'btts', selection: 'yes', modelP: i.pBttsYes!, edge1x2: edge, reason: 'goal' }
      : { ...base, market: 'ou25', selection: 'over', modelP: i.pOver25!, edge1x2: edge, reason: 'goal' };
  }
  // 2) 1X2 yalnız fark küçükken ve ligi zayıf değilse.
  if (!i.pick || !fin(pickP)) return { ...base, market: null, selection: null, modelP: null, edge1x2: edge, reason: 'below_threshold' };
  if (i.leagueSlug && NO_1X2_LEAGUES.has(i.leagueSlug)) return { ...base, market: null, selection: null, modelP: pickP, edge1x2: edge, reason: 'league_no_1x2' };
  if (edge == null) return { ...base, market: null, selection: null, modelP: pickP, edge1x2: null, reason: 'no_market' };
  if (edge >= EDGE_MAX_1X2) return { ...base, market: null, selection: null, modelP: pickP, edge1x2: edge, reason: 'edge_high' };
  return { ...base, market: '1x2', selection: i.pick, modelP: pickP, edge1x2: edge, reason: '1x2' };
}

export function settleShowcase(market: ShowcaseMarket, selection: ShowcaseSelection, h: number, a: number): boolean {
  if (market === 'btts') return h > 0 && a > 0;
  if (market === 'ou25') return h + a > 2.5;
  const res = h > a ? '1' : a > h ? '2' : 'X';
  return selection === res;
}
