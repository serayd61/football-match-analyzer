// ============================================================================
// engine_model_versions okuyucu — public params rotası, official.ts ve ingest
// tarafından paylaşılır. 60 sn modül cache'i (Vercel instance başına).
// Tablo yoksa / hata varsa null + boş liste döner; çağıran kendi varsayılanına düşer.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface EngineVersionSpec {
  version: string;
  kind: 'goals' | 'xg';
  status: 'candidate' | 'shadow' | 'active' | 'retired';
  params: Record<string, unknown>;
  activated_at?: string | null;
}

export interface EngineVersions {
  active: EngineVersionSpec | null;
  shadow: EngineVersionSpec[];
  /** tüm bilinen sürüm adları (retired dahil) — ingest bunları kabul eder */
  known: Set<string>;
  fetchedAt: string;
}

const TTL_MS = 60 * 1000;
let _cache: { at: number; value: EngineVersions } | null = null;
let _sb: SupabaseClient | null = null;

function sb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_sb) _sb = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) } });
  return _sb;
}

export async function loadEngineVersions(force = false): Promise<EngineVersions> {
  if (!force && _cache && Date.now() - _cache.at < TTL_MS) return _cache.value;
  const empty: EngineVersions = { active: null, shadow: [], known: new Set(), fetchedAt: new Date().toISOString() };
  const client = sb();
  if (!client) return empty;
  try {
    const { data, error } = await client.from('engine_model_versions').select('version, status, kind, params, activated_at').order('created_at');
    if (error) { console.error('[engine/versions] read failed:', error.message); return _cache?.value ?? empty; }
    const all = ((data || []) as any[]).map((r): EngineVersionSpec => ({ version: r.version, kind: r.kind === 'xg' ? 'xg' : 'goals', status: r.status, params: r.params ?? {}, activated_at: r.activated_at }));
    const value: EngineVersions = {
      active: all.find((r) => r.status === 'active') ?? null,
      shadow: all.filter((r) => r.status === 'shadow'),
      known: new Set(all.map((r) => r.version)),
      fetchedAt: new Date().toISOString(),
    };
    _cache = { at: Date.now(), value };
    return value;
  } catch (e: any) {
    console.error('[engine/versions] read threw:', e?.message);
    return _cache?.value ?? empty;
  }
}

export function invalidateEngineVersions() { _cache = null; }
