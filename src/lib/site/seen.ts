// Üye aktivasyon izi (2026-10-28): profiles.last_seen_at / first_match_view_at.
// Neden: analiz geçmişi artık kullanımı ölçmüyor (AI analizini cron üretiyor);
// "yeni kayıt maç sayfası açtı mı?" sorusu cevapsızdı. Rapor: scripts/activation-report.ts
//
// Yazım koşullu UPDATE ile, okuma yok: last_seen_at boşsa ya da 1 saatten eskiyse
// güncellenir (render başına en fazla bir yazım/saat); first_match_view_at yalnız
// boşken yazılır. Migration uygulanmamışsa hata bir kez loglanır, sayfa etkilenmez.
// 2026-11-02: fixtureId verilirse site_match_views'a kişi×maç satırı yazılır
// (upsert, viewed_at güncellenir) — sabah raporu "dün baktığın maç" buradan okur.
import { getSupabaseAdmin } from '@/lib/supabase';

const HOUR = 3600_000;
let warned = false;
let warnedViews = false;

export async function touchSeen(email: string | null | undefined, opts: { matchView?: boolean; fixtureId?: number | null } = {}): Promise<void> {
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
    const fx = opts.matchView && opts.fixtureId && Number.isFinite(opts.fixtureId) && opts.fixtureId > 0 ? Math.floor(opts.fixtureId) : null;
    const viewWrite = fx
      ? db.from('site_match_views').upsert({ user_email: e, fixture_id: fx, viewed_at: nowIso }, { onConflict: 'user_email,fixture_id' })
      : null;
    const [results, view] = await Promise.all([Promise.all(writes), viewWrite]);
    const err = results.find((r) => r.error)?.error;
    if (err && !warned) { warned = true; console.error('[seen] write failed (migration 20261028010000 applied?)', err.message); }
    if (view?.error && !warnedViews) { warnedViews = true; console.error('[seen] match view write failed (migration 20261102010000 applied?)', view.error.message); }
  } catch (err) {
    if (!warned) { warned = true; console.error('[seen] write failed', err); }
  }
}
