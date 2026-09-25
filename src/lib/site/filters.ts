import type { SitePrediction } from './predictions';

// URL-driven list filters for /predictions (pure; unit-tested).
export const STATUS_FILTERS = ['all', 'upcoming', 'live', 'finished'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const SORTS = ['time', 'confidence'] as const;
export type Sort = (typeof SORTS)[number];

export interface ListFilters { q?: string; status?: StatusFilter; ready?: boolean; league?: string | null; sort?: Sort; market?: MarketFilter | null; minP?: number | null }

// Pazar eşiği (2026-09-26): "günün maçlarında 1X2 / Üst 2,5 / KG Var %60'ın üstünde olanlar".
// Olasılık model hamı: 1X2 → seçilen tarafın olasılığı; Üst → Üst 2,5 olasılığı (seçim Alt
// olsa da 1−pRaw); KG → KG Var olasılığı. Eşik %50–%90, 5'lik adımlar.
export const MARKET_FILTERS = ['x12', 'ou25', 'btts'] as const;
export type MarketFilter = (typeof MARKET_FILTERS)[number];
export const MIN_P_STEPS = [50, 55, 60, 65, 70, 75, 80, 85, 90] as const;

export function marketProb(r: SitePrediction, m: MarketFilter): number | null {
  if (!r.hasModel) return null;
  if (m === 'x12') return r.pick === '1' ? r.pHome : r.pick === '2' ? r.pAway : r.pick === 'X' ? r.pDraw : null;
  if (m === 'ou25') return r.overUnder ? (r.overUnder.pick === 'over' ? r.overUnder.pRaw : 1 - r.overUnder.pRaw) : null;
  return r.btts ? (r.btts.pick === 'yes' ? r.btts.pRaw : 1 - r.btts.pRaw) : null;
}

/** Arama katlaması: aksanlar düşer, Türkçe İ/ı → i ("besiktas" Beşiktaş'ı, "istanbul" İstanbul'u bulur). */
export const fold = (v: string) => v.replace(/[İIı]/g, 'i').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** URL parametrelerinden güvenli filtre (bilinmeyen değerler yok sayılır). */
export function parseFilters(sp: { q?: string; status?: string; ready?: string; sort?: string; market?: string; minp?: string }): Required<Pick<ListFilters, 'q' | 'status' | 'ready' | 'sort' | 'market' | 'minP'>> {
  const status = (STATUS_FILTERS as readonly string[]).includes(sp.status || '') ? (sp.status as StatusFilter) : 'all';
  const sort = (SORTS as readonly string[]).includes(sp.sort || '') ? (sp.sort as Sort) : 'time';
  const market = (MARKET_FILTERS as readonly string[]).includes(sp.market || '') ? (sp.market as MarketFilter) : null;
  const mp = Number(sp.minp);
  const minP = market && (MIN_P_STEPS as readonly number[]).includes(mp) ? mp : market ? 60 : null;
  return { q: (sp.q || '').trim().slice(0, 60), status, ready: sp.ready === '1', sort, market, minP };
}

export function applyFilters(rows: SitePrediction[], f: ListFilters): SitePrediction[] {
  const q = fold((f.q || '').trim());
  let out = rows;
  if (f.league) out = out.filter((r) => r.league?.slug === f.league);
  if (q) out = out.filter((r) => fold(r.homeName).includes(q) || fold(r.awayName).includes(q));
  if (f.status && f.status !== 'all') {
    out = out.filter((r) => (f.status === 'upcoming' ? r.status === 'scheduled' : r.status === f.status));
  }
  if (f.ready) out = out.filter((r) => r.hasModel);
  if (f.market) {
    const m = f.market, th = (f.minP ?? 60) / 100;
    out = [...out].filter((r) => (marketProb(r, m) ?? -1) >= th).sort((a, b) => (marketProb(b, m) ?? -1) - (marketProb(a, m) ?? -1) || a.kickoff.localeCompare(b.kickoff));
  }
  if (f.sort === 'confidence') {
    out = [...out].sort((a, b) => (b.confidence ?? b.confidenceRaw ?? -1) - (a.confidence ?? a.confidenceRaw ?? -1) || a.kickoff.localeCompare(b.kickoff));
  }
  return out;
}
