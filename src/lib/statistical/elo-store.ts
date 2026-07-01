// ============================================================================
// ELO STORE — haftalık ELO snapshot'ını (team_elo) Supabase'ten yükler.
// model-store.ts ile aynı desen: lig-başı en son kayıt, 1 saat in-memory cache.
// Kayıt yoksa/hata olursa null → çağıran ELO harmanını atlar (graceful).
// ============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import { leagueToCode } from './data-loader';
import type { EloParams } from '@/lib/odds/elo-blend';

export interface EloSnapshot {
  a: number;
  b: number;
  total: number;
  lambda: number;
  ratings: Record<string, number>; // takım adı (model namespace) → ELO
}

interface CacheEntry {
  snap: EloSnapshot | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat
const cache = new Map<string, CacheEntry>();

export async function getEloByCode(leagueCode: string): Promise<EloSnapshot | null> {
  const now = Date.now();
  const cached = cache.get(leagueCode);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.snap;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('team_elo')
      .select('elo')
      .eq('league_code', leagueCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const elo = data?.elo as EloSnapshot | undefined;
    if (error || !elo || !elo.ratings) {
      cache.set(leagueCode, { snap: null, fetchedAt: now });
      return null;
    }
    cache.set(leagueCode, { snap: elo, fetchedAt: now });
    return elo;
  } catch (e) {
    console.warn(`⚠️ [ELO store] ${leagueCode} yüklenemedi:`, e);
    cache.set(leagueCode, { snap: null, fetchedAt: now });
    return null;
  }
}

/** Görünen lig adından ELO snapshot'ı. Kapsam dışı lig → null. */
export async function getEloForLeague(leagueName: string | null | undefined): Promise<EloSnapshot | null> {
  const code = leagueToCode(leagueName);
  if (!code) return null;
  return getEloByCode(code);
}

/** EloSnapshot → blendWithElo'nun beklediği EloParams (ratings hariç). */
export function eloParamsFrom(snap: EloSnapshot): EloParams {
  return { a: snap.a, b: snap.b, total: snap.total, lambda: snap.lambda };
}

/** Test/cron sonrası cache temizliği. */
export function clearEloCache(): void {
  cache.clear();
}
