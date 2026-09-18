import type { SitePrediction } from './predictions';

// URL-driven list filters for /predictions (pure; unit-tested).
export const STATUS_FILTERS = ['all', 'upcoming', 'live', 'finished'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const SORTS = ['time', 'confidence'] as const;
export type Sort = (typeof SORTS)[number];

export interface ListFilters { q?: string; status?: StatusFilter; ready?: boolean; league?: string | null; sort?: Sort }

/** Arama katlaması: aksanlar düşer, Türkçe İ/ı → i ("besiktas" Beşiktaş'ı, "istanbul" İstanbul'u bulur). */
export const fold = (v: string) => v.replace(/[İIı]/g, 'i').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** URL parametrelerinden güvenli filtre (bilinmeyen değerler yok sayılır). */
export function parseFilters(sp: { q?: string; status?: string; ready?: string; sort?: string }): Required<Pick<ListFilters, 'q' | 'status' | 'ready' | 'sort'>> {
  const status = (STATUS_FILTERS as readonly string[]).includes(sp.status || '') ? (sp.status as StatusFilter) : 'all';
  const sort = (SORTS as readonly string[]).includes(sp.sort || '') ? (sp.sort as Sort) : 'time';
  return { q: (sp.q || '').trim().slice(0, 60), status, ready: sp.ready === '1', sort };
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
  if (f.sort === 'confidence') {
    out = [...out].sort((a, b) => (b.confidence ?? b.confidenceRaw ?? -1) - (a.confidence ?? a.confidenceRaw ?? -1) || a.kickoff.localeCompare(b.kickoff));
  }
  return out;
}
