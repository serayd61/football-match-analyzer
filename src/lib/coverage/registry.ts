import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { db, REVALIDATE } from '@/lib/site/db';
import { LEAGUE_TIER } from '@/lib/site/daily-picks-rule';
import type { CoverageStatus, LeagueStats } from './rules';

// Kapsam sicili okuma katmanı — tek kaynak league_coverage tablosu.
// Tablo boşsa/okunamazsa koddaki LEAGUE_TIER'a düşer (site kırılmaz).

export interface CoverageRow {
  league_id: number; slug: string | null; name: string; ccode: string | null; country: string | null;
  status: CoverageStatus; tier: number; reason: string | null; stats: LeagueStats | null;
  decided_at: string; decided_by: string; review_at: string | null; updated_at: string;
}

export const COVERAGE_TAG = 'league-coverage';

export const loadCoverage = unstable_cache(
  async (): Promise<CoverageRow[]> => {
    const { data, error } = await db().from('league_coverage').select('*').order('tier').order('name');
    if (error) { console.error('[coverage] read failed:', error.message); return []; }
    return (data ?? []) as CoverageRow[];
  },
  ['league-coverage-v1'],
  { revalidate: REVALIDATE.fixtures, tags: [COVERAGE_TAG] },
);

/** Günün seçimi / kupon beyaz listesi: slug → kademe. Sicil boşsa koddaki liste. */
export async function whitelistTiers(): Promise<Record<string, number>> {
  const rows = (await loadCoverage()).filter((r) => r.status === 'whitelist' && r.slug);
  if (!rows.length) return LEAGUE_TIER;
  return Object.fromEntries(rows.map((r) => [r.slug!, r.tier]));
}

/** Motor kapsamı dışı (excluded) lig id'leri — fikstür ?scope=model bunları eler. */
export async function excludedLeagueIds(): Promise<Set<number>> {
  return new Set((await loadCoverage()).filter((r) => r.status === 'excluded').map((r) => Number(r.league_id)));
}

export function invalidateCoverage() { try { revalidateTag(COVERAGE_TAG); } catch { /* build/test ortamı */ } }

/** league_id → sicil satırı (kapsam dışı risk notu için). */
export async function coverageById(): Promise<Map<number, CoverageRow>> {
  return new Map((await loadCoverage()).map((r) => [Number(r.league_id), r]));
}

/** Gizli ligler: sitede ve Tier-B'de gösterilmez (1X2 log-loss rastgeleden kötü ya da admin kararı). */
export async function hiddenLeagueIds(): Promise<Set<number>> {
  return new Set((await loadCoverage()).filter((r) => r.status === 'hidden').map((r) => Number(r.league_id)));
}
