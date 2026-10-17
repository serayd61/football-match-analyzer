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
// resmi sürümdür (60 sn cache; lib/engine/versions.ts). Env varsa o kazanır —
// geçişte ikisinin çelişmemesine dikkat. Tablo yoksa/boşsa null → eski
// "fixture başına en yeni satır" kuralı.
// ---------------------------------------------------------------------------
export async function resolveOfficialVersion(): Promise<string | null> {
  if (OFFICIAL_MODEL_VERSION) return OFFICIAL_MODEL_VERSION;
  // SEO Faz 1a (2026-10-17): lib/engine/versions.ts reads with `cache: 'no-store'`, which
  // throws DynamicServerError while an ISR page (/matches, /leagues/{slug}/results) is
  // prerendered or regenerated — the catch below then returned null, the version filter was
  // skipped and shadow-version rows (dc-1.2-cal) leaked into public lists whose match pages
  // 404 (getPrediction does filter). The site reads the active version through its own
  // cacheable client first; the no-store reader stays for ingest / the params route.
  try {
    const v = await siteActiveVersion();
    if (v) return v;
  } catch { /* fall through */ }
  try {
    const { loadEngineVersions } = await import('@/lib/engine/versions');
    return (await loadEngineVersions()).active?.version ?? null;
  } catch { return null; }
}

/** Active engine version via the site's revalidating client (60 s cache); null when the table is empty. */
async function siteActiveVersion(): Promise<string | null> {
  const [{ unstable_cache }, { db }] = await Promise.all([import('next/cache'), import('./db')]);
  const read = unstable_cache(
    async (): Promise<string | null> => {
      const { data, error } = await db().from('engine_model_versions').select('version').eq('status', 'active').order('created_at').limit(1);
      if (error) { console.error('[site/official] active version read failed:', error.message); return null; }
      const v = (data as Array<{ version: string }> | null)?.[0]?.version;
      return v ? String(v) : null;
    },
    ['site-official-version-v1'],
    { revalidate: 60 },
  );
  return read();
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
