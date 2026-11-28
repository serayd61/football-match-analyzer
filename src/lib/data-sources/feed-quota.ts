// Maç akışı (RapidAPI free-api-live-football-data) aylık kota izi (2026-11-28).
// Yanıt başlıklarındaki sayaç Redis'e yazılır; ops raporu eşik aşılınca uyarır.
// 25 Kasım 2026'da 200.000'lik kota fark edilmeden bitti ve akış 1 hafta kapalı kaldı.
import { getRedisClient } from '@/lib/cache/redis';

export interface FeedQuota { limit: number; remaining: number; resetAtMs: number; at: number }

export const FEED_QUOTA_KEY = 'ff:quota:v1';
export const FEED_QUOTA_WARN = 0.7;
export const FEED_QUOTA_ALARM = 0.85;

/** RapidAPI başlıklarından kota (başlık yoksa null). */
export function feedQuotaFromHeaders(get: (name: string) => string | null, nowMs: number): FeedQuota | null {
  const raw = { limit: get('x-ratelimit-requests-limit'), rem: get('x-ratelimit-requests-remaining'), reset: get('x-ratelimit-requests-reset') };
  if (raw.limit == null || raw.rem == null || raw.reset == null) return null;
  const limit = Number(raw.limit), rem = Number(raw.rem), reset = Number(raw.reset);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(rem) || !Number.isFinite(reset)) return null;
  return { limit, remaining: Math.max(0, rem), resetAtMs: nowMs + reset * 1000, at: nowMs };
}

/** Kullanım eşiği aşıldıysa tek satırlık uyarı; altında ya da veri yoksa/eskiyse null. */
export function feedQuotaNotice(q: FeedQuota | null | undefined, nowMs: number): { level: 'warn' | 'alarm' | 'out'; text: string } | null {
  if (!q || nowMs >= q.resetAtMs) return null; // sayaç sıfırlandı: eski ölçüm geçersiz
  const used = (q.limit - q.remaining) / q.limit;
  if (used < FEED_QUOTA_WARN) return null;
  const days = Math.max(0, (q.resetAtMs - nowMs) / 86_400_000);
  const level = q.remaining <= 0 ? 'out' : used >= FEED_QUOTA_ALARM ? 'alarm' : 'warn';
  const head = level === 'out' ? 'MAÇ AKIŞI KOTASI BİTTİ' : `Maç akışı kotası %${Math.round(used * 100)}`;
  return { level, text: `${head}: ${q.remaining.toLocaleString('tr-TR')} / ${q.limit.toLocaleString('tr-TR')} istek kaldı, sıfırlanmaya ${days.toFixed(1)} gün (RapidAPI free-api-live-football-data).` };
}

// Örnek başına en çok 10 dakikada bir yazılır: akış çağrısı başına Redis yazımı olmasın.
let lastWrite = 0;
const WRITE_EVERY_MS = 10 * 60_000;

/** Akış yanıtından kotayı kaydet (en iyi çaba; hata yutulur). */
export function noteFeedQuota(headers: { get: (name: string) => string | null }, nowMs = Date.now()): void {
  if (nowMs - lastWrite < WRITE_EVERY_MS) return;
  const q = feedQuotaFromHeaders((n) => headers.get(n), nowMs);
  if (!q) return;
  lastWrite = nowMs;
  void getRedisClient().set(FEED_QUOTA_KEY, q, { ex: 40 * 86_400 }).catch(() => { /* opsiyonel */ });
}

export async function readFeedQuota(): Promise<FeedQuota | null> {
  try { return (await getRedisClient().get<FeedQuota>(FEED_QUOTA_KEY)) ?? null; } catch { return null; }
}
