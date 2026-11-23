import 'server-only';
import { parseFlashEvents, parseFlashOdds, quotaFromHeaders, type FlashEvent, type FlashQuota } from './flashlive-pure';
import type { AfOdds } from './api-football-pure';

// FlashLive Sports (RapidAPI) istemcisi — bkz. flashlive-pure.ts başlığı.
// Anahtar yalnız FLASHLIVE_KEY: bilinçli aç/kapa düğmesi (diğer RapidAPI anahtarları bu
// servise abone olmayabilir; 403 ile her saat log kirletmesin). Ücretsiz plan AYDA 500 istek;
// her yanıt kalan kotayı başlıkta verir, çağıran bütçeyi ona göre yönetir (flashSpendable).
const HOST = 'flashlive-sports.p.rapidapi.com';
const LOCALE = 'en_INT';

export function hasFlashKey(): boolean { return !!(process.env.FLASHLIVE_KEY || '').trim(); }

type Res<T> = { ok: true; data: T; quota: FlashQuota | null } | { ok: false; error: string; quota: FlashQuota | null };

async function flFetch(path: string): Promise<Res<any[]>> {
  const key = (process.env.FLASHLIVE_KEY || '').trim();
  if (!key) return { ok: false, error: 'FLASHLIVE_KEY yok', quota: null };
  try {
    const r = await fetch(`https://${HOST}${path}`, { headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': key }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    const quota = quotaFromHeaders((n) => r.headers.get(n), Date.now());
    const body: any = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${String(body?.message ?? '').slice(0, 160)}`, quota };
    return { ok: true, data: Array.isArray(body?.DATA) ? body.DATA : [], quota };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e).slice(0, 160), quota: null };
  }
}

/** Bir UTC gününün tüm futbol maçları (tek çağrı; indentDays: bugün 0, yarın 1 …). */
export async function flEvents(indentDays: number): Promise<{ ok: true; events: FlashEvent[]; quota: FlashQuota | null } | { ok: false; error: string; quota: FlashQuota | null }> {
  const r = await flFetch(`/v1/events/list?sport_id=1&timezone=0&indent_days=${indentDays}&locale=${LOCALE}`);
  return r.ok ? { ok: true, events: parseFlashEvents(r.data), quota: r.quota } : r;
}

/** Bir maçın maç öncesi oranları (tek çağrı). */
export async function flOdds(eventId: string): Promise<{ ok: true; odds: AfOdds | null; quota: FlashQuota | null } | { ok: false; error: string; quota: FlashQuota | null }> {
  const r = await flFetch(`/v1/events/odds?event_id=${encodeURIComponent(eventId)}&locale=${LOCALE}`);
  return r.ok ? { ok: true, odds: parseFlashOdds(r.data), quota: r.quota } : r;
}
