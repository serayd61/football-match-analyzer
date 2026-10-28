// Üye aktivasyon izi (2026-10-28): profiles.last_seen_at / first_match_view_at.
// Neden: analiz geçmişi artık kullanımı ölçmüyor (AI analizini cron üretiyor);
// "yeni kayıt maç sayfası açtı mı?" sorusu cevapsızdı. Rapor: scripts/activation-report.ts
//
// Yazım koşullu UPDATE ile, okuma yok: last_seen_at boşsa ya da 1 saatten eskiyse
// güncellenir (render başına en fazla bir yazım/saat); first_match_view_at yalnız
// boşken yazılır. Migration uygulanmamışsa hata bir kez loglanır, sayfa etkilenmez.
import { getSupabaseAdmin } from '@/lib/supabase';

const HOUR = 3600_000;
let warned = false;

export async function touchSeen(email: string | null | undefined, opts: { matchView?: boolean } = {}): Promise<void> {
  if (!email) return;
  const e = email.toLowerCase();
  const nowIso = new Date().toISOString();
  const stale = new Date(Date.now() - HOUR).toISOString();
  try {
    const db = getSupabaseAdmin();
    const writes = [
      db.from('profiles').update({ last_seen_at: nowIso }).ilike('email', e).or(`last_seen_at.is.null,last_seen_at.lt.${stale}`),
    ];
    if (opts.matchView) writes.push(db.from('profiles').update({ first_match_view_at: nowIso }).ilike('email', e).is('first_match_view_at', null));
    const results = await Promise.all(writes);
    const err = results.find((r) => r.error)?.error;
    if (err && !warned) { warned = true; console.error('[seen] write failed (migration 20261028010000 applied?)', err.message); }
  } catch (err) {
    if (!warned) { warned = true; console.error('[seen] write failed', err); }
  }
}
