// football-data.org yedek skor kaynağı — ağ kısmı. Ücretsiz katman 10 istek/dk;
// aynı gün 60 sn Redis'te tutulur ki saatlik sonuçlanma (≤10 tarih) + site
// isteği kotayı aşmasın. Anahtar: FOOTBALL_DATA_API_KEY (Vercel, tüm ortamlar).
import 'server-only';
import { getRedisClient } from '@/lib/cache/redis';
import { parseFdMatches, type FdMatch } from './football-data-pure';
export { FD_FREE_CODES, fdCodeForLeagueId, overlayFd, fdStatusFlags } from './football-data-pure';
export type { FdMatch, FdOverlay, OverlayRow } from './football-data-pure';

const HOST = 'https://api.football-data.org/v4';
const TTL = 60;

export function hasFootballDataKey(): boolean { return !!(process.env.FOOTBALL_DATA_API_KEY || '').trim(); }

/** Bir UTC gün için football-data maçları; anahtar yok / hata → null (boş gün [] ile karışmaz). */
export async function fdMatchesByDate(ymd: string): Promise<FdMatch[] | null> {
  const key = (process.env.FOOTBALL_DATA_API_KEY || '').trim();
  if (!key) return null;
  const ck = `fd:matches:${ymd}`;
  try { const c = await getRedisClient().get<FdMatch[]>(ck); if (Array.isArray(c)) return c; } catch { /* önbellek opsiyonel */ }
  try {
    const r = await fetch(`${HOST}/matches?date=${ymd}`, { headers: { 'X-Auth-Token': key }, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!r.ok) { console.error(`[football-data] ${ymd}: http ${r.status}`); return null; }
    const rows = parseFdMatches(await r.json());
    try { await getRedisClient().set(ck, rows, { ex: TTL }); } catch { /* opsiyonel */ }
    return rows;
  } catch (e: any) { console.error(`[football-data] ${ymd}:`, e?.message); return null; }
}
