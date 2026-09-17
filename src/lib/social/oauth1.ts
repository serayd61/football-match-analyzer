// OAuth 1.0a (HMAC-SHA1) imzalı Authorization başlığı — saf, bağımlılıksız.
// X/Twitter kullanıcı bağlamı (tweet atma, medya yükleme) bunu ister. Test:
// tests/social.test.ts, X belgelerindeki örnek vektörle doğrulanır.
import { createHmac, randomBytes } from 'node:crypto';

export interface OAuth1Creds { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }

/** RFC 3986 yüzde kodlama (encodeURIComponent + !*'() ). */
export const pctEncode = (s: string) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export function oauth1Signature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
  const base = [
    method.toUpperCase(),
    pctEncode(url),
    pctEncode(Object.keys(params).sort().map((k) => `${pctEncode(k)}=${pctEncode(params[k])}`).join('&')),
  ].join('&');
  const key = `${pctEncode(consumerSecret)}&${pctEncode(tokenSecret)}`;
  return createHmac('sha1', key).update(base).digest('base64');
}

/**
 * Authorization başlığı. `bodyParams`: yalnız application/x-www-form-urlencoded
 * gövde için (imzaya girer); JSON gövde ve multipart imzaya girmez.
 */
export function oauth1Header(method: string, url: string, creds: OAuth1Creds, bodyParams: Record<string, string> = {}, opts: { nonce?: string; timestamp?: string } = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: opts.nonce ?? randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: opts.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const u = new URL(url);
  const query: Record<string, string> = {};
  u.searchParams.forEach((v, k) => { query[k] = v; });
  const sig = oauth1Signature(method, `${u.origin}${u.pathname}`, { ...query, ...bodyParams, ...oauth }, creds.apiSecret, creds.accessSecret);
  const all: Record<string, string> = { ...oauth, oauth_signature: sig };
  return 'OAuth ' + Object.keys(all).sort().map((k) => `${pctEncode(k)}="${pctEncode(all[k])}"`).join(', ');
}
