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
export function officialFilter<Q>(q: Q): Q {
  // `any`: PostgrestFilterBuilder's `this`-typed chain makes a constrained
  // generic blow TS2589 ("excessively deep"); the call shape is stable.
  return OFFICIAL_MODEL_VERSION ? (q as any).eq('model_version', OFFICIAL_MODEL_VERSION) : q;
}
