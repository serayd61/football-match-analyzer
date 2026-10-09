import 'server-only';
import type { SitePrediction } from './predictions';
import type { MarketStanding } from './match-standing';
import { coverageById } from '@/lib/coverage/registry';
import { sumEdge, type LeagueEdge, type LeagueBuckets } from '@/lib/coverage/rules';
import { sumBuckets, coverageStanding, type CoverageMarket } from './coverage-risk';
import type { MarketProbs1x2 } from './daily-standing';

// ============================================================================
// Gözlem ligi hükmü (2026-10-09) — /picks ve ana sayfa için kapsam dışı satırı
// lig dilim karnesi + fark kovalarıyla hükme oturtur (maç sayfasıyla aynı yol).
// Yalnız 'observe' durumundaki ligler girer: 'excluded'/'hidden' sinyalsiz,
// 'whitelist' zaten covered=true ile standingFor'dan geçer.
// ============================================================================

export interface OutsideStanding {
  eligible: (r: SitePrediction) => boolean;
  /** Lig etiketi: gözlem liginde ülke kodu önde ("WAL · Premier League"); kapsananda ad */
  label: (r: SitePrediction) => string;
  standing: (r: SitePrediction, market1x2: MarketProbs1x2 | null) => MarketStanding[] | null;
}

export async function outsideStandingFor(): Promise<OutsideStanding> {
  const cov = await coverageById();
  const stats = [...cov.values()].map((c) => c.stats);
  const outsideAll: LeagueBuckets = sumBuckets([...cov.values()].filter((c) => c.status !== 'whitelist').map((c) => c.stats));
  const edgeAll: LeagueEdge = sumEdge(stats);
  const eligible = (r: SitePrediction) => !r.covered && r.leagueId != null && cov.get(r.leagueId)?.status === 'observe';
  const side = <P extends string>(c: { pick: P; pMarket: number | null } | null, yes: P) => (c?.pMarket == null ? null : c.pick === yes ? c.pMarket : 1 - c.pMarket);
  return {
    eligible,
    label: (r) => { const c = !r.covered && r.leagueId != null ? cov.get(r.leagueId) : undefined; return c?.ccode ? `${c.ccode} · ${c.name || r.leagueName}` : r.leagueName; },
    standing: (r, m) => {
      if (!eligible(r)) return null;
      const c = cov.get(r.leagueId!)!;
      const market: CoverageMarket = { x12: m, overYes: side(r.overUnder, 'over'), bttsYes: side(r.btts, 'yes') };
      return coverageStanding({
        pick: r.pick, pHome: r.pHome, pDraw: r.pDraw, pAway: r.pAway,
        over: r.overUnder ? { pick: r.overUnder.pick, pRaw: r.overUnder.pRaw } : null,
        btts: r.btts ? { pick: r.btts.pick, pRaw: r.btts.pRaw } : null,
      }, c.stats?.buckets ?? null, outsideAll, market, { league: c.stats?.edge ?? null, all: edgeAll });
    },
  };
}
