// ============================================================================
// "Bu maç karnemizde nerede" (saf) — maçın 1X2 / Üst 2,5 / KG seçimini, sinyal
// karnesindeki kovaya oturtur ve o kovanın geçmiş isabetini döner.
// ----------------------------------------------------------------------------
// Neden (2026-09-18): karne sayfası 30 tabloluk bir rapor; müşteri maç sayfasında
// "bu maç bizim geçmişimize göre nerede duruyor?" sorusunun cevabını tek grafikte
// görmeli. Kanıt kaynağı: 1X2 için piyasa farkı (fark büyüdükçe isabet düşüyor,
// 12 Eyl backtest), gol pazarları için model seviyesi (seviye çalışıyor). Lig
// kovasında ≥10 maç varsa lig, yoksa tüm ligler esas alınır.
// ============================================================================
import { levelBucket, edgeBucket, clashBucket, type SignalTable, type SignalCell, type SignalMarket } from './signal-buckets';
import { MIN_OVER, MIN_BTTS } from './daily-picks-rule';

export type Verdict = 'strong' | 'mid' | 'weak' | 'thin';
export interface StandingEvidence { kind: 'level' | 'edge' | 'clash'; bucket: string; league: SignalCell | null; all: SignalCell }
export interface MarketStanding {
  market: SignalMarket;
  selection: string;         // '1' | 'X' | '2' | 'over' | 'under' | 'yes' | 'no'
  modelP: number;            // seçilen tarafın model olasılığı
  primary: StandingEvidence; // grafikte gösterilen kanıt
  secondary: StandingEvidence | null;
  /** grafikteki isabet (lig ≥10 ise lig, yoksa tüm ligler) */
  acc: number | null; n: number; won: number; scope: 'league' | 'all';
  verdict: Verdict;
}

export interface StandingInput {
  leagueSlug: string | null;
  pick: '1' | 'X' | '2' | null; pHome: number; pDraw: number; pAway: number;
  over: { pick: 'over' | 'under'; pRaw: number } | null;
  btts: { pick: 'yes' | 'no'; pRaw: number } | null;
  market: { pHome: number; pDraw: number; pAway: number } | null;
  /** KG Var marjsız piyasa olasılığı */
  bttsMarketYes: number | null;
}

export const MIN_EVIDENCE = 10;

function evidence(tables: SignalTable[], market: SignalMarket, kind: StandingEvidence['kind'], bucket: number, league: string | null): StandingEvidence | null {
  const t = tables.find((x) => x.market === market && x.kind === kind);
  if (!t) return null;
  const row = league ? t.leagues.find((l) => l.league.slug === league) : undefined;
  return { kind, bucket: t.buckets[bucket], league: row ? row.cells[bucket] : null, all: t.all[bucket] };
}

export function finishStanding(market: SignalMarket, selection: string, modelP: number, primary: StandingEvidence, secondary: StandingEvidence | null): MarketStanding {
  const useLeague = !!primary.league && primary.league.n >= MIN_EVIDENCE;
  const cell = useLeague ? primary.league! : primary.all;
  const acc = cell.n >= MIN_EVIDENCE ? cell.acc : null;
  const strong = market === '1x2' ? 0.55 : 0.65;
  const verdict: Verdict = acc == null ? 'thin' : acc >= strong ? 'strong' : acc < 0.5 ? 'weak' : 'mid';
  return { market, selection, modelP, primary, secondary, acc, n: cell.n, won: cell.won, scope: useLeague ? 'league' : 'all', verdict };
}

export function standingFor(input: StandingInput, tables: SignalTable[]): MarketStanding[] {
  const out: MarketStanding[] = [];
  const lg = input.leagueSlug;
  if (input.pick) {
    const pickP = input.pick === '1' ? input.pHome : input.pick === '2' ? input.pAway : input.pDraw;
    const level = evidence(tables, '1x2', 'level', levelBucket(pickP), lg);
    let edge: StandingEvidence | null = null, clash: number | null = null;
    if (input.market) {
      const mp = input.pick === '1' ? input.market.pHome : input.pick === '2' ? input.market.pAway : input.market.pDraw;
      edge = evidence(tables, '1x2', 'edge', edgeBucket(pickP - mp), lg);
      clash = clashBucket(pickP - mp);
    }
    if (level) out.push(finishStanding('1x2', input.pick, pickP, edge ?? level, edge ? level : null));
    if (input.over) {
      const pSide = input.over.pick === 'over' ? input.over.pRaw : 1 - input.over.pRaw;
      const lv = evidence(tables, 'ou25', 'level', levelBucket(pSide), lg);
      const cl = clash != null && input.over.pick === 'over' && input.over.pRaw >= MIN_OVER ? evidence(tables, 'ou25', 'clash', clash, lg) : null;
      if (lv) out.push(finishStanding('ou25', input.over.pick, pSide, lv, cl));
    }
    if (input.btts) {
      const pSide = input.btts.pick === 'yes' ? input.btts.pRaw : 1 - input.btts.pRaw;
      const lv = evidence(tables, 'btts', 'level', levelBucket(pSide), lg);
      let sec: StandingEvidence | null = null;
      if (input.bttsMarketYes != null) sec = evidence(tables, 'btts', 'edge', edgeBucket(pSide - (input.btts.pick === 'yes' ? input.bttsMarketYes : 1 - input.bttsMarketYes)), lg);
      else if (clash != null && input.btts.pick === 'yes' && input.btts.pRaw >= MIN_BTTS) sec = evidence(tables, 'btts', 'clash', clash, lg);
      if (lv) out.push(finishStanding('btts', input.btts.pick, pSide, lv, sec));
    }
  }
  return out;
}
