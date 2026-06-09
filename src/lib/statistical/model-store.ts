// ============================================================================
// MODEL STORE — fit edilmiş Dixon-Coles parametrelerini Supabase'ten yükler.
// Tahmin anında fit YAPMAZ; sadece loadParams() + predict() (milisaniye).
// Modül-seviyesi 1 saat in-memory cache ile her istekte DB'ye gitmez.
// ============================================================================

import { getSupabaseAdmin } from '@/lib/supabase';
import { DixonColesModel, DCParams } from './dixon-coles';
import { leagueToCode } from './data-loader';

interface CacheEntry {
  model: DixonColesModel | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat
const cache = new Map<string, CacheEntry>();

/**
 * Lig kodu için en son fit edilmiş modeli döner.
 * Kayıt yoksa veya hata olursa null (çağıran graceful fallback yapar).
 */
export async function getLatestParamsByCode(leagueCode: string): Promise<DixonColesModel | null> {
  const now = Date.now();
  const cached = cache.get(leagueCode);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.model;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('dc_model_params')
      .select('params')
      .eq('league_code', leagueCode)
      .order('trained_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.params) {
      cache.set(leagueCode, { model: null, fetchedAt: now });
      return null;
    }

    const model = new DixonColesModel();
    model.loadParams(data.params as DCParams);
    cache.set(leagueCode, { model, fetchedAt: now });
    return model;
  } catch (e) {
    console.warn(`⚠️ [DC model-store] ${leagueCode} yüklenemedi:`, e);
    cache.set(leagueCode, { model: null, fetchedAt: now });
    return null;
  }
}

/**
 * Görünen lig adından (örn. "Premier League") modeli döner.
 * Kapsam dışı lig → null.
 */
export async function getModelForLeague(leagueName: string | null | undefined): Promise<DixonColesModel | null> {
  const code = leagueToCode(leagueName);
  if (!code) return null;
  return getLatestParamsByCode(code);
}

/** Test/cron sonrası cache'i temizlemek için. */
export function clearModelCache(): void {
  cache.clear();
}
