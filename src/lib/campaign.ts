// ============================================================================
// CAMPAIGN UTIL — toplu e-posta kampanyaları için ortak yardımcılar
// Unsubscribe token (HMAC), kampanya anahtarları, URL üreticiler.
// ============================================================================

import crypto from 'crypto';
import { SITE_URL } from '@/lib/seo';

export const WORLD_CUP_CAMPAIGN_KEY = 'worldcup-2026-launch';

// Unsubscribe token'ı için sunucu-yalnızca sır (URL'de email + token gider).
function secret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || 'fallback-unsub-secret';
}

/** Verilen e-posta için imzalı unsubscribe token'ı üretir. */
export function unsubscribeToken(email: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 24);
}

/** Token doğrulama (sabit-zaman karşılaştırma). */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  if (!token || token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Tam unsubscribe URL'i (e-posta footer'ında kullanılır). */
export function unsubscribeUrl(email: string): string {
  const e = encodeURIComponent(email.toLowerCase().trim());
  const t = unsubscribeToken(email);
  return `${SITE_URL}/api/unsubscribe?email=${e}&token=${t}`;
}

export { SITE_URL };
