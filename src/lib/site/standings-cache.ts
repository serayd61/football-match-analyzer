// Puan durumu önbellek kuralı (2026-11-28). Saf: depo ve akış çağrısı dışarıdan verilir.
//
// Neden: `unstable_cache` + `fetch next.revalidate` puan durumunu canlıda fiilen
// tutmuyordu; her sayfa görüntülemesi `football-get-standing-all` çağırıyordu.
// RapidAPI paneli (21–25 Kas 2026): 95.623 çağrının 88.505'i bu uç nokta; aylık
// 200.000 kota 25 Kasım'da bitti, akış ve tahmin üretimi durdu. Kural artık Redis'te:
//   - taze kopya (FRESH_MS içinde) → akışa gidilmez
//   - bayat kopya + akış hatası → bayat kopya döner, hata MISS süresince yeniden denenmez
//   - akış boş/hatalı dönerse eldeki iyi kopya ezilmez

export const STANDINGS_FRESH_MS = 6 * 3600_000;
/** Son iyi kopyanın Redis'te kalma süresi (sn): akış günlerce kapalı kalsa da tablo görünür. */
export const STANDINGS_KEEP_S = 14 * 86_400;
/** Başarısız denemeden sonra bekleme (sn). 429 = kota/hız sınırı: daha uzun. */
export const STANDINGS_MISS_S = 10 * 60;
export const STANDINGS_MISS_429_S = 60 * 60;

export interface StandingsEntry<T> { rows: T[]; at: number }
export type StandingsFetch<T> = { ok: true; rows: T[] } | { ok: false; status: number | null };

export interface StandingsDeps<T> {
  now: () => number;
  /** entry: saklı kopya (yoksa null); miss: yakın zamanda başarısız deneme işareti */
  read: (leagueId: number) => Promise<{ entry: StandingsEntry<T> | null; miss: boolean }>;
  write: (leagueId: number, entry: StandingsEntry<T>) => Promise<void>;
  markMiss: (leagueId: number, seconds: number) => Promise<void>;
  fetch: (leagueId: number) => Promise<StandingsFetch<T>>;
}

export type StandingsSource = 'fresh' | 'fetched' | 'stale' | 'empty';

export async function loadStandings<T>(leagueId: number, deps: StandingsDeps<T>): Promise<{ rows: T[]; source: StandingsSource }> {
  const { entry, miss } = await deps.read(leagueId);
  if (entry && deps.now() - entry.at < STANDINGS_FRESH_MS) return { rows: entry.rows, source: 'fresh' };
  const fallback = (): { rows: T[]; source: StandingsSource } => (entry ? { rows: entry.rows, source: 'stale' } : { rows: [], source: 'empty' });
  if (miss) return fallback();

  const res = await deps.fetch(leagueId);
  if (res.ok && res.rows.length) {
    await deps.write(leagueId, { rows: res.rows, at: deps.now() });
    return { rows: res.rows, source: 'fetched' };
  }
  // Hata ya da boş tablo: iyi kopyayı ezme, bir süre yeniden deneme.
  await deps.markMiss(leagueId, !res.ok && res.status === 429 ? STANDINGS_MISS_429_S : STANDINGS_MISS_S);
  return fallback();
}
