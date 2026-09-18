// Telegram Bot API: kanala fotoğraf + başlık, metin yanıtı. Bot kanalda yönetici olmalı.
import 'server-only';

export type TelegramResult = { ok: true; id: string } | { ok: false; error: string };

const base = () => `https://api.telegram.org/bot${(process.env.TELEGRAM_BOT_TOKEN || '').trim()}`;
export const hasTelegram = () => !!(process.env.TELEGRAM_BOT_TOKEN || '').trim();

export async function sendPhoto(chat: string, png: Buffer, caption: string, replyTo?: string): Promise<TelegramResult> {
  const fd = new FormData();
  fd.set('chat_id', chat);
  fd.set('caption', caption.slice(0, 1024));
  if (replyTo) fd.set('reply_to_message_id', replyTo);
  fd.set('photo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'pick.png');
  try {
    const r = await fetch(`${base()}/sendPhoto`, { method: 'POST', body: fd, signal: AbortSignal.timeout(60_000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) return { ok: false, error: `telegram http ${r.status}: ${JSON.stringify(j).slice(0, 200)}` };
    return { ok: true, id: String(j.result.message_id) };
  } catch (e: any) { return { ok: false, error: `telegram: ${String(e?.message || e).slice(0, 120)}` }; }
}

export async function sendMessage(chat: string, text: string, replyTo?: string): Promise<TelegramResult> {
  const payload: any = { chat_id: chat, text, disable_web_page_preview: true };
  if (replyTo) payload.reply_to_message_id = Number(replyTo);
  try {
    const r = await fetch(`${base()}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) return { ok: false, error: `telegram http ${r.status}: ${JSON.stringify(j).slice(0, 200)}` };
    return { ok: true, id: String(j.result.message_id) };
  } catch (e: any) { return { ok: false, error: `telegram: ${String(e?.message || e).slice(0, 120)}` }; }
}
