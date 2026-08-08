// ============================================================================
// LEAGUE CATALOG — feed'de görülen liglerin kalıcı id → ad/ülke/logo kaydı.
// Sorun: feed maçlarda SEZONLUK lig id'si taşıyor (örn. Championship 25/26 =
// 938221) ama all-leagues endpoint'i kanonik id döndürüyor → harita eşleşmiyor
// ve adlar "League 938221" kalıyordu (engine_predictions'ta 263/263 çözümsüz).
// Çözüm: Supabase `league_catalog` tablosu; lig haritası her yenilendiğinde ve
// lig-detay cron'u çözdükçe beslenir, maç normalize'ı buradan tamamlanır.
// SERVER-ONLY (service role). Client tarafı countries.ts + league-names.ts.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CatalogEntry {
  id: number;
  name: string;
  ccode: string;
  logo?: string;
}

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // client bundle'a sızarsa sessiz no-op
  if (!_sb) {
    _sb = createClient(url, key, {
      auth: { persistSession: false },
      // Next fetch cache'i route handler'larda GET select'leri bayatlatabiliyor
      // (2026-08-10 mükerrer mail vakasıyla aynı ders) → her zaman no-store.
      global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) },
    });
  }
  return _sb;
}

const UNRESOLVED_RE = /^League \d+$/;

// ---- Okuma: modül içi cache'li tam katalog haritası (tablo küçük, ~300 satır)
let _cache: { at: number; map: Map<number, CatalogEntry> } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

export async function getCatalogMap(): Promise<Map<number, CatalogEntry>> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL) return _cache.map;
  const client = sb();
  if (!client) return _cache?.map || new Map();
  const { data, error } = await client
    .from('league_catalog')
    .select('league_id, name, ccode, logo')
    .limit(5000);
  if (error) {
    console.warn('[league-catalog] read failed:', error.message);
    return _cache?.map || new Map();
  }
  const map = new Map<number, CatalogEntry>();
  for (const r of (data || []) as any[]) {
    map.set(Number(r.league_id), { id: Number(r.league_id), name: r.name, ccode: r.ccode || '', logo: r.logo || '' });
  }
  _cache = { at: Date.now(), map };
  return map;
}

// ---- Yazma: çözülmüş adları upsert et (çözümsüz "League X" asla yazılmaz)
export async function upsertLeagueCatalog(entries: CatalogEntry[], source = 'feed'): Promise<number> {
  const client = sb();
  if (!client) return 0;
  const rows = entries
    .filter(e => e.id && e.name && !UNRESOLVED_RE.test(e.name.trim()))
    .map(e => ({
      league_id: e.id,
      name: e.name.trim(),
      ccode: (e.ccode || '').toUpperCase().trim(),
      logo: e.logo || '',
      source,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) return 0;
  const { error } = await client.from('league_catalog').upsert(rows, { onConflict: 'league_id' });
  if (error) {
    console.warn('[league-catalog] upsert failed:', error.message);
    return 0;
  }
  // Cache'i taze tut (bir sonraki okuma yeni adları görsün)
  _cache = null;
  return rows.length;
}

/** Fire-and-forget besleme — çağıran await etmek zorunda değil. */
export function feedLeagueCatalog(entries: CatalogEntry[], source = 'feed'): void {
  upsertLeagueCatalog(entries, source).catch(() => {});
}

/** Ad çözümsüz mü? ("League 12345" deseni) */
export function isUnresolvedLeagueName(name?: string | null): boolean {
  return !!name && UNRESOLVED_RE.test(name.trim());
}
