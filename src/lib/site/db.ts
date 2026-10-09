import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client for the public site. Uses the service key so
// RLS never gets in the way of public reads; nothing here is exposed to the
// browser. Caching happens one level up with `unstable_cache`; the inner
// fetch carries a short `revalidate` (not `no-store`, which throws a
// DynamicServerError while ISR pages are prerendered at build time).
let _sb: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  _sb = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (i: any, init?: any) => fetch(i, { ...init, next: { revalidate: 300 } }) },
  });
  return _sb;
}

/** Revalidation windows (seconds) per the product brief. */
/** Oran okuyan önbellekler (gün listesi, 1X2 anlık, pazar kitabı): snapshot-odds yazınca
 *  `revalidateTag(ODDS_TAG)` ile hemen tazelenir (2026-10-10: iç içe iki 15 dk önbellek,
 *  yeni oran siteye 30 dk gecikiyordu). */
export const ODDS_TAG = 'site-odds';

export const REVALIDATE = {
  fixtures: 15 * 60,
  results: 5 * 60,
  performance: 60 * 60,
} as const;

// Önbelleksiz istemci (cron/yazma yolları): db() GET yanıtları 5 dk Next fetch
// önbelleğinde kalır — 2026-09-14'te af_fixture_map ilk boş okuması 5 dk boyunca
// "boş" döndü ve eşleme her turda yeniden yapıldı. Sayfalar db() ile kalır.
let _fresh: SupabaseClient | null = null;
export function dbFresh(): SupabaseClient {
  if (_fresh) return _fresh;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  _fresh = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) } });
  return _fresh;
}
