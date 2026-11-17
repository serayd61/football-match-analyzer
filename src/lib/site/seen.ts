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
import { cookies, headers } from 'next/headers';
import { appSignalOf } from './app-ua';
import { TWA_COOKIE } from './twa';
import { countryFromHeaders } from './regional';

const HOUR = 3600_000;
let warned = false;
let warnedViews = false;
let warnedApp = false;
let warnedCountry = false;

/** İsteğin IP ülkesi (Vercel başlığı). İstek bağlamı yoksa (cron, test) null. */
function requestCountry(): string | null {
  try { return countryFromHeaders(headers()); } catch { return null; }
}

/** İstek Play uygulamasından mı; sürüm kaç. İstek bağlamı yoksa (cron, test) null. */
function appSignal(): { appVersion: string | null } | null {
  try {
    const sig = appSignalOf(headers().get('user-agent'), cookies().get(TWA_COOKIE)?.value === '1');
    return sig.source === 'app' ? { appVersion: sig.appVersion } : null;
  } catch {
    return null;
  }
}

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
    // Uygulama izi (2026-11-15, migration 20261115010000): son görülen sürüm, saatte ≤1 yazım.
    // Ayrı yazım: sütunlar yokken last_seen_at yazımı etkilenmez.
    const app = appSignal();
    const appWrite = app
      ? db.from('profiles').update({ last_app_seen_at: nowIso, ...(app.appVersion ? { last_app_version: app.appVersion } : {}) }).ilike('email', e).or(`last_app_seen_at.is.null,last_app_seen_at.lt.${stale}`)
      : null;
    // Ülke izi (2026-11-17, migration 20261117010000): yalnız boşken ya da değiştiğinde yazılır.
    // E-posta cron'ları bölgesel fiyatı buradan seçer (member-country.ts). Ayrı yazım.
    const cc = requestCountry();
    const countryWrite = cc
      ? db.from('profiles').update({ last_country: cc }).ilike('email', e).or(`last_country.is.null,last_country.neq.${cc}`)
      : null;
    const [results, view, appRes, ccRes] = await Promise.all([Promise.all(writes), viewWrite, appWrite, countryWrite]);
    if (ccRes?.error && !warnedCountry) { warnedCountry = true; console.error('[seen] country write failed (migration 20261117010000 applied?)', ccRes.error.message); }
    if (appRes?.error && !warnedApp) { warnedApp = true; console.error('[seen] app trace write failed (migration 20261115010000 applied?)', appRes.error.message); }
    const err = results.find((r) => r.error)?.error;
    if (err && !warned) { warned = true; console.error('[seen] write failed (migration 20261028010000 applied?)', err.message); }
    if (view?.error && !warnedViews) { warnedViews = true; console.error('[seen] match view write failed (migration 20261102010000 applied?)', view.error.message); }
  } catch (err) {
    if (!warned) { warned = true; console.error('[seen] write failed', err); }
  }
}
