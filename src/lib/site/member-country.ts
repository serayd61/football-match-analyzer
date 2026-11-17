// Üyenin ülkesi → e-postadaki fiyat (2026-11-17, migration 20261117010000).
// E-posta cron'larında IP yoktur; ülke profiles.last_country (yoksa
// signup_country) sütunundan okunur ve regional.offerFor ile fiyata çevrilir.
// Sütunlar yokken (migration uygulanmamış) boş harita döner: herkes standart
// fiyatı görür, gönderim durmaz.
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from './page-all';
import { offerFor } from './regional';

let warned = false;

/** Son görülen ülke öncelikli; yoksa kayıt ülkesi. */
export const memberCountry = (row: { last_country?: string | null; signup_country?: string | null }): string | null =>
  row.last_country || row.signup_country || null;

/** e-posta (küçük harf) → ISO ülke kodu. Okuma hatasında boş harita. */
export async function loadMemberCountries(sb: SupabaseClient): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const rows = await fetchAllRows<{ email: string | null; last_country: string | null; signup_country: string | null }>(
      (from, to) => sb.from('profiles').select('email, last_country, signup_country').order('email').range(from, to),
    );
    for (const r of rows) {
      const c = memberCountry(r);
      if (r.email && c) out.set(r.email.toLowerCase().trim(), c);
    }
  } catch (e: any) {
    if (!warned) { warned = true; console.error('[member-country] read failed (migration 20261117010000 applied?)', e?.message); }
  }
  return out;
}

/** Bu üyeye e-postada yazılacak teklif (bölgesel ya da standart). */
export const memberOffer = (countries: Map<string, string>, email: string) => offerFor(countries.get(email.toLowerCase().trim()) ?? null);
