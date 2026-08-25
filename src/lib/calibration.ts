// ============================================================================
// GÜVEN KALİBRASYONU — "yazdığın yüzde, gerçekten o yüzde olsun."
// ----------------------------------------------------------------------------
// Ölçüm (2026-08-11, 3.737 sonuçlanmış tahmin): model sıralamayı DOĞRU yapıyor
// (güven arttıkça isabet artıyor: %43.7 → %67.6) ama ölçeği şişik — üst
// dilimde %79.9 iddia edip %67.6 tutuyor. Bu, modelin bilgisiz olduğu değil,
// olasılıklarının fazla keskin olduğu anlamına gelir. Çözüm: izotonik
// regresyon (PAVA) ile monoton, veriye dayalı bir yeniden ölçekleme.
//
// Neden izotonik? Sıralamayı KORUR (monoton), biçim varsayımı yapmaz.
// Platt/sigmoid ölçeklemeden farkı: eğrinin şekli veriden gelir.
//
// Eğri `confidence_calibration` tablosunda saklanır, haftalık cron yeniden
// fit eder (bkz. /api/cron/fit-calibration). Eğri yoksa kimlik fonksiyonu
// döner — kalibrasyon ASLA veriyi bozacak şekilde tahmin etmez.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Knot { x: number; y: number }
export interface CalibrationCurve {
  knots: Knot[];
  segment: string;
  nSamples: number;
  fittedAt: string | null;
}

// ----------------------------------------------------------------------------
// FIT — Pool Adjacent Violators Algorithm
// ----------------------------------------------------------------------------
/**
 * İzotonik regresyon: (güven, sonuç 0/1) çiftlerinden monoton artan bir
 * güven→olasılık eşlemesi çıkarır.
 * Girdi sıralı olmak zorunda değil; içeride sıralanır.
 */
export function fitIsotonic(
  points: Array<{ x: number; y: number }>,
  maxKnots = 40,
): Knot[] {
  const pts = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
  if (pts.length < 30) return [];

  // Aynı x'leri tek bloğa topla (aynı güvende farklı sonuçlar)
  const blocks: Array<{ x: number; sum: number; w: number }> = [];
  for (const p of pts) {
    const last = blocks[blocks.length - 1];
    if (last && last.x === p.x) { last.sum += p.y; last.w += 1; }
    else blocks.push({ x: p.x, sum: p.y, w: 1 });
  }

  // PAVA: monotonluk bozulduğunda komşu blokları birleştir
  const stack: Array<{ x: number; sum: number; w: number }> = [];
  for (const b of blocks) {
    stack.push({ ...b });
    while (stack.length > 1) {
      const cur = stack[stack.length - 1];
      const prev = stack[stack.length - 2];
      if (prev.sum / prev.w <= cur.sum / cur.w) break;
      stack.pop(); stack.pop();
      stack.push({ x: cur.x, sum: prev.sum + cur.sum, w: prev.w + cur.w });
    }
  }

  // Blok ortalamalarını knot'a çevir; uçları sabitle
  let knots: Knot[] = stack.map((b) => ({
    x: Math.round(b.x * 1000) / 1000,
    y: Math.round((b.sum / b.w) * 1000) / 1000,
  }));

  // Çok fazla knot varsa eşit aralıklı örnekle (tabloyu şişirmemek için)
  if (knots.length > maxKnots) {
    const step = (knots.length - 1) / (maxKnots - 1);
    const sampled: Knot[] = [];
    for (let i = 0; i < maxKnots; i++) sampled.push(knots[Math.round(i * step)]);
    knots = sampled;
  }
  return knots;
}

/** Brier skoru — kalibrasyonun işe yarayıp yaramadığının tek sayılık ölçüsü. */
export function brier(points: Array<{ x: number; y: number }>): number {
  if (!points.length) return NaN;
  const s = points.reduce((acc, p) => acc + (p.x - p.y) ** 2, 0);
  return Math.round((s / points.length) * 10000) / 10000;
}

// ----------------------------------------------------------------------------
// APPLY — parçalı doğrusal ara değerleme
// ----------------------------------------------------------------------------
export function applyCurve(raw: number | null | undefined, knots: Knot[]): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  if (!knots || knots.length < 2) return raw; // eğri yok → dokunma
  if (raw <= knots[0].x) return knots[0].y;
  const last = knots[knots.length - 1];
  if (raw >= last.x) return last.y;
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1], b = knots[i];
    if (raw <= b.x) {
      const t = b.x === a.x ? 0 : (raw - a.x) / (b.x - a.x);
      return Math.round((a.y + t * (b.y - a.y)) * 1000) / 1000;
    }
  }
  return raw;
}

// ----------------------------------------------------------------------------
// LOAD — 15 dk modül cache'i (league-catalog ile aynı desen)
// ----------------------------------------------------------------------------
const TTL_MS = 15 * 60 * 1000;
const _cache = new Map<string, { curve: CalibrationCurve; at: number }>();
let _sb: SupabaseClient | null = null;

/**
 * Kalibre edilen pazarlar. '1x2' ana seçimin güvenidir (segment tercihi
 * covered > all); 'ou25' ve 'btts' gol pazarlarıdır — eğrilerini
 * fit-calibration cron'u aynı tabloya kendi segment adıyla yazar.
 * Ölçüm (2026-08-25, 5.714 sonuçlanmış maç): iki pazar da monoton sinyal
 * taşıyor (Ü/A %52→%75, KG %53→%66) ama ham olasılıklar 10-30 puan şişik;
 * bu yüzden gösterim HER ZAMAN kalibre değer üzerinden yapılır.
 */
export type CalibrationMarket = '1x2' | 'ou25' | 'btts';

function sb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_sb) {
    _sb = createClient(url, key, {
      auth: { persistSession: false },
      global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) },
    });
  }
  return _sb;
}

const EMPTY: CalibrationCurve = { knots: [], segment: 'none', nSamples: 0, fittedAt: null };

/**
 * En güncel kalibrasyon eğrisi. '1x2' için 'covered' segmenti yeterli
 * örnekle fit edildiyse o tercih edilir (modelli ligler kendi rejimini hak
 * eder), yoksa 'all'. Gol pazarları kendi segment adını okur. Eğri yoksa /
 * hata olursa boş eğri → applyCurve kimlik fonksiyonu gibi davranır.
 */
export async function getCalibration(market: CalibrationMarket = '1x2'): Promise<CalibrationCurve> {
  const hit = _cache.get(market);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.curve;
  const client = sb();
  if (!client) return EMPTY;
  try {
    const prefer = market === '1x2' ? ['covered', 'all'] : [market];
    const { data, error } = await client
      .from('confidence_calibration')
      .select('segment, n_samples, knots, fitted_at')
      .in('segment', prefer)
      .order('fitted_at', { ascending: false })
      .limit(10);
    if (error || !data?.length) return EMPTY;
    let row: any = null;
    for (const seg of prefer) {
      row = data.find((r: any) => r.segment === seg);
      if (row) break;
    }
    if (!row) return EMPTY;
    const curve: CalibrationCurve = {
      knots: Array.isArray(row.knots) ? row.knots : [],
      segment: row.segment,
      nSamples: row.n_samples,
      fittedAt: row.fitted_at,
    };
    _cache.set(market, { curve, at: Date.now() });
    return curve;
  } catch {
    return EMPTY;
  }
}

export function invalidateCalibrationCache() { _cache.clear(); }
