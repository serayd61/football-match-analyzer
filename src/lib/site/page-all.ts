// Supabase/PostgREST yanıtı en fazla 1000 satır döndürür (proje ayarı max-rows);
// `.limit(3000)` sessizce 1000'e kesilir ve artan sıralamada EN ESKİ 1000 satır gelir.
// 2026-11-01'de bulundu: sitemap 17 Ekim'den beri yalnız Ağustos maçlarını listeliyor,
// takım indeksi 1000 eski satırdan kuruluyordu. Bu yardımcı `.range()` ile sayfalar.
export const PAGE_ROWS = 1000;

/**
 * `build(from, to)` sorguyu verilen satır aralığıyla kurar (range dahil edilmez, burada eklenir).
 * Sayfa dolu geldiği sürece devam eder; `maxPages` ile üst sınır (varsayılan 10 → 10.000 satır).
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<T[]> {
  const size = opts.pageSize ?? PAGE_ROWS, max = opts.maxPages ?? 10;
  const out: T[] = [];
  for (let page = 0; page < max; page++) {
    const from = page * size;
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}
