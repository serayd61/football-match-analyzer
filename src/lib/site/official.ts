// ---------------------------------------------------------------------------
// Resmi tahmin seçimi (fixture_id, model_version) çokluğu için.
// ---------------------------------------------------------------------------
// engine_predictions'ın tekil anahtarı (fixture_id, model_version). Denetim
// 2026-09-05: liste/detay/sonuç/performans sürüm ayırmıyordu — ikinci bir
// sürüm yayımlandığı an aynı maç iki kez listelenir, detay rastgele birini
// gösterir, isabet iki kez sayılırdı (5 Eylül itibarıyla tabloda tek sürüm
// var: dc-1.0; risk gizli ama gerçek).
//
// Kural (deterministik):
//   1. SITE_MODEL_VERSION ayarlıysa yalnız o sürüm resmi kabul edilir; sorgu
//      tarafında da filtrelenir (sayfalama/sayım doğru kalsın).
//   2. Ayarlı değilse fixture başına tek satır seçilir: en son updated_at,
//      eşitlikte model_version sözlük sırasına göre en büyük.
// Model karşılaştırmaları bu yoldan geçmez; ayrı veri kümesi olarak ele alınır.
// ---------------------------------------------------------------------------

export const OFFICIAL_MODEL_VERSION: string | null = (process.env.SITE_MODEL_VERSION || '').trim() || null;

// ---------------------------------------------------------------------------
// Faz 3 (2026-09-07): env yoksa engine_model_versions.status='active' satırı
// resmi sürümdür. Env varsa o kazanır — geçişte ikisinin çelişmemesine dikkat.
// Tablo yoksa/boşsa null → eski "fixture başına en yeni satır" kuralı.
// Okuma yolu: siteActiveVersionRow (önbelleklenebilir). Bkz. oradaki not.
// ---------------------------------------------------------------------------
export async function resolveOfficialVersion(): Promise<string | null> {
  if (OFFICIAL_MODEL_VERSION) return OFFICIAL_MODEL_VERSION;
  try {
    return (await siteActiveVersionRow())?.version ?? null;
  } catch {
    return null;
  }
}

export interface ActiveVersionRow {
  version: string;
  params: Record<string, unknown>;
}

/**
 * Aktif motor sürümü + params — sitenin KENDİ önbelleklenebilir istemcisiyle
 * (db(), fetch `revalidate: 300`), `unstable_cache` içinde 60 sn.
 *
 * `lib/engine/versions.ts` ASLA sayfa render'ından çağrılmaz: o istemci
 * `cache: 'no-store'` kullanıyor ve Next'te tek bir no-store fetch, render
 * eden rotanın `revalidate` değerini 0'a çeker — hata yakalansa bile. Yan etki
 * kalıcı: sayfa `private, no-store` ile çıkar, CDN'e hiç girmez.
 *
 * 2026-11-08 ölçümü: bu yüzden /{l}/teams/{slug}, /{l}/matches/{slug} ve gün
 * merkezleri `revalidate` tanımlı olmasına rağmen önbelleğe girmiyordu, ve
 * hangi sayfanın gireceği 5 dakikalık süreç memo'sunun (predictions.ts
 * loadContext) o anda sıcak olup olmamasına bağlıydı — yani kura gibi.
 * official.ts bu tuzak için 2026-10-17'de düzeltilmişti, loadContext atlanmış.
 *
 * no-store okuyucu ingest ve /api/v2/engine/params için duruyor: oraya tazelik
 * gerekiyor ve route handler'ın önbelleklenecek HTML'i yok.
 */
async function siteActiveRow(): Promise<ActiveVersionRow | null> {
  const [{ unstable_cache }, { db }] = await Promise.all([import('next/cache'), import('./db')]);
  const read = unstable_cache(
    async (): Promise<ActiveVersionRow | null> => {
      const { data, error } = await db().from('engine_model_versions').select('version, params').eq('status', 'active').order('created_at').limit(1);
      if (error) { console.error('[site/official] active version read failed:', error.message); return null; }
      const r = (data as Array<{ version: string; params: unknown }> | null)?.[0];
      return r?.version ? { version: String(r.version), params: (r.params ?? {}) as Record<string, unknown> } : null;
    },
    ['site-official-version-v2'],
    { revalidate: 60 },
  );
  return read();
}

export async function siteActiveVersionRow(): Promise<ActiveVersionRow | null> {
  return siteActiveRow();
}

export async function invalidateOfficialCache(): Promise<void> {
  try { (await import('@/lib/engine/versions')).invalidateEngineVersions(); } catch { /* yok say */ }
}

interface Versioned { fixture_id: number; model_version: string | null; updated_at?: string | null }

function rank(a: Versioned, b: Versioned): number {
  const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
  const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
  if (ta !== tb) return tb - ta;
  return (b.model_version || '').localeCompare(a.model_version || '');
}

/** One row per fixture; preserves the incoming order of first occurrence. */
export function pickOfficial<T extends Versioned>(rows: T[], official: string | null = OFFICIAL_MODEL_VERSION): T[] {
  const best = new Map<number, T>();
  const order: number[] = [];
  for (const r of rows) {
    if (official && r.model_version !== official) continue;
    const cur = best.get(r.fixture_id);
    if (!cur) { best.set(r.fixture_id, r); order.push(r.fixture_id); continue; }
    if (rank(r, cur) < 0) best.set(r.fixture_id, r);
  }
  return order.map((id) => best.get(id)!);
}

/** Apply the official-version filter to a PostgREST query when configured. */
export function officialFilter<Q>(q: Q, official: string | null = OFFICIAL_MODEL_VERSION): Q {
  // `any`: PostgrestFilterBuilder's `this`-typed chain makes a constrained
  // generic blow TS2589 ("excessively deep"); the call shape is stable.
  return official ? (q as any).eq('model_version', official) : q;
}
