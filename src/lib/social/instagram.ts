// ============================================================================
// Instagram içerik yayınlama (Instagram API with Instagram Login, graph.instagram.com)
// ----------------------------------------------------------------------------
// Neden: Telegram'daki günlük seçim / haftalık karne gönderileri Instagram'a da
// aynı anda düşsün (@_footballanalyticspro, 2026-10-31 kullanıcı isteği).
// Facebook Sayfası GEREKMEZ: Meta geliştirici panelinde "Instagram" tipi uygulama,
// Business/Creator hesabı, uzun ömürlü token (60 gün; yenileme: refresh_access_token).
// İzinler: instagram_business_basic, instagram_business_content_publish,
// instagram_business_manage_comments. Kurulum adımları: docs/INSTAGRAM_SETUP.md
//
// Akış: görsel HERKESE AÇIK bir URL'den verilir (/api/social/image) → container
// oluştur → hazır olana dek bekle → yayınla. Sonuç yanıtları gönderiye yorum olur.
// ============================================================================
import 'server-only';

export type InstagramResult = { ok: true; id: string } | { ok: false; error: string };

const API = 'https://graph.instagram.com/v22.0';
const token = () => (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim();
const userId = () => (process.env.INSTAGRAM_USER_ID || '').trim();
export const hasInstagram = () => !!(token() && userId());

async function call(path: string, params: Record<string, string>, method: 'POST' | 'GET' = 'POST'): Promise<any> {
  const body = new URLSearchParams({ ...params, access_token: token() });
  const url = method === 'GET' ? `${API}/${path}?${body}` : `${API}/${path}`;
  const r = await fetch(url, { method, body: method === 'POST' ? body : undefined, signal: AbortSignal.timeout(60_000) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) throw new Error(`instagram ${path} http ${r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 240)}`);
  return j;
}

/** Container hazır olana dek bekler (Instagram görseli kendi sunucusuna çeker; genelde 2–10 sn). */
async function waitReady(creationId: string, maxMs = 90_000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const j = await call(creationId, { fields: 'status_code,status' }, 'GET');
    if (j.status_code === 'FINISHED') return;
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') throw new Error(`instagram container ${j.status_code}: ${String(j.status || '').slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('instagram container zaman aşımı');
}

/** Tek görselli gönderi. imageUrl herkese açık JPEG/PNG olmalı (en boy 4:5–1.91:1, ≤8 MB). */
export async function publishImage(imageUrl: string, caption: string): Promise<InstagramResult> {
  try {
    const c = await call(`${userId()}/media`, { image_url: imageUrl, caption: caption.slice(0, 2200) });
    await waitReady(String(c.id));
    const p = await call(`${userId()}/media_publish`, { creation_id: String(c.id) });
    return { ok: true, id: String(p.id) };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).slice(0, 300) }; }
}

/** Gönderiye yorum (sonuç yanıtları, haftalık dizinin devamı). */
export async function comment(mediaId: string, message: string): Promise<InstagramResult> {
  try {
    const j = await call(`${mediaId}/comments`, { message: message.slice(0, 2200) });
    return { ok: true, id: String(j.id) };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).slice(0, 300) }; }
}

/** Uzun ömürlü token yenileme (token ≥24 saatlik ve 60 gün dolmadan). Yeni token döner; env'e elle yazılır. */
export async function refreshToken(): Promise<{ ok: true; token: string; expiresIn: number } | { ok: false; error: string }> {
  try {
    const j = await call('refresh_access_token', { grant_type: 'ig_refresh_token' }, 'GET');
    return { ok: true, token: String(j.access_token), expiresIn: Number(j.expires_in) };
  } catch (e: any) { return { ok: false, error: String(e?.message || e).slice(0, 300) }; }
}
