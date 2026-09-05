import type { SitePrediction } from './predictions';

// URL-driven list filters for /predictions (pure; unit-tested).
export const STATUS_FILTERS = ['all', 'upcoming', 'live', 'finished'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const SORTS = ['time', 'confidence'] as const;
export type Sort = (typeof SORTS)[number];

export interface ListFilters { q?: string; status?: StatusFilter; ready?: boolean; league?: string | null; sort?: Sort }

export function applyFilters(rows: SitePrediction[], f: ListFilters): SitePrediction[] {
  const q = (f.q || '').trim().toLocaleLowerCase();
  let out = rows;
  if (f.league) out = out.filter((r) => r.league?.slug === f.league);
  if (q) out = out.filter((r) => r.homeName.toLocaleLowerCase().includes(q) || r.awayName.toLocaleLowerCase().includes(q));
  if (f.status && f.status !== 'all') {
    out = out.filter((r) => (f.status === 'upcoming' ? r.status === 'scheduled' : r.status === f.status));
  }
  if (f.ready) out = out.filter((r) => r.hasModel);
  if (f.sort === 'confidence') {
    out = [...out].sort((a, b) => (b.confidence ?? b.confidenceRaw ?? -1) - (a.confidence ?? a.confidenceRaw ?? -1) || a.kickoff.localeCompare(b.kickoff));
  }
  return out;
}
