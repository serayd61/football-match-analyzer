// X/Twitter: medya yükle (v1.1 upload) + tweet at (v2). OAuth 1.0a kullanıcı bağlamı.
// Ücretsiz katman yazma kotası aylık sınırlı (2026: 500 gönderi); günde ≤6 gönderi.
import 'server-only';
import { oauth1Header, type OAuth1Creds } from './oauth1';

const UPLOAD = 'https://upload.twitter.com/1.1/media/upload.json';
const TWEETS = 'https://api.x.com/2/tweets';

export type TwitterResult = { ok: true; id: string } | { ok: false; error: string };

export function twitterCreds(prefix: string): OAuth1Creds | null {
  const g = (k: string) => (process.env[`${prefix}_${k}`] || '').trim();
  const c = { apiKey: g('API_KEY'), apiSecret: g('API_SECRET'), accessToken: g('ACCESS_TOKEN'), accessSecret: g('ACCESS_SECRET') };
  return c.apiKey && c.apiSecret && c.accessToken && c.accessSecret ? c : null;
}

/** PNG/JPEG yükle → media_id_string. Gövde form-urlencoded (media_data base64) olduğu için imzaya girer. */
export async function uploadMedia(creds: OAuth1Creds, png: Buffer): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const body = { media_data: png.toString('base64'), media_category: 'tweet_image' };
  const auth = oauth1Header('POST', UPLOAD, creds, body);
  try {
    const r = await fetch(UPLOAD, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString(), signal: AbortSignal.timeout(60_000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.media_id_string) return { ok: false, error: `upload http ${r.status}: ${JSON.stringify(j).slice(0, 200)}` };
    return { ok: true, mediaId: String(j.media_id_string) };
  } catch (e: any) { return { ok: false, error: `upload: ${String(e?.message || e).slice(0, 120)}` }; }
}

export async function postTweet(creds: OAuth1Creds, text: string, opts: { mediaId?: string; replyTo?: string } = {}): Promise<TwitterResult> {
  const payload: any = { text };
  if (opts.mediaId) payload.media = { media_ids: [opts.mediaId] };
  if (opts.replyTo) payload.reply = { in_reply_to_tweet_id: opts.replyTo };
  const auth = oauth1Header('POST', TWEETS, creds); // JSON gövde imzaya girmez
  try {
    const r = await fetch(TWEETS, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.data?.id) return { ok: false, error: `tweet http ${r.status}: ${JSON.stringify(j).slice(0, 300)}` };
    return { ok: true, id: String(j.data.id) };
  } catch (e: any) { return { ok: false, error: `tweet: ${String(e?.message || e).slice(0, 120)}` }; }
}

/**
 * Günün trendleri (X API v2 trends/by_woeid; 1 = dünya, 23424975 = UK). Kredili
 * çağrı; günde bir kez, günlük gönderi öncesi. Hata → boş liste, gönderi etiketsiz gider.
 */
export async function fetchTrends(creds: OAuth1Creds, woeids: number[] = [1, 23424975]): Promise<string[]> {
  const out: string[] = [];
  for (const w of woeids) {
    const url = `https://api.x.com/2/trends/by_woeid/${w}?max_trends=50`;
    try {
      const r = await fetch(url, { headers: { Authorization: oauth1Header('GET', url, creds) }, signal: AbortSignal.timeout(15_000) });
      const j: any = await r.json().catch(() => ({}));
      for (const t of j?.data ?? []) { const n = String(t?.trend_name ?? '').trim(); if (n && !out.includes(n)) out.push(n); }
    } catch { /* etiketsiz devam */ }
  }
  return out;
}
