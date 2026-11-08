// Erişim durumu — SAF modül (2026-11-08, anonim ISR).
//
// Tipler ve oturum okumayan yardımcılar burada; oturumu gerçekten okuyan
// `getSiteAccess()` / `requireSiteAccess()` `lib/site/access.ts`'te kaldı ve
// bunları yeniden ihraç ediyor. Ayrımın nedeni: anonim ISR ağacındaki hiçbir
// dosya `next-auth`/`next/headers`'a dokunmamalı — dokunması tek başına
// sayfayı dinamik yapmaz (Next çağrıya bakar) ama kuralın denetlenebilir
// olması gerekiyor (tests/isr-anon-tree.test.ts import grafiğini yürüyor).
export type SiteAccessState = 'anon' | 'trial' | 'pro' | 'expired';

export interface SiteAccess {
  state: SiteAccessState;
  email: string | null;
  trialEndsAt: string | null;
  /** Whole days left in the registration trial (0 on the last day). */
  trialDaysLeft: number;
}

/** Deneme ya da ücretli: maçları görebilir. */
export const canSeeMatches = (a: SiteAccess): boolean => a.state === 'trial' || a.state === 'pro';

/**
 * Oturum okumadan "anonim ziyaretçi". Herkese açık sayfanın CDN'den servis
 * edilen ISR sürümü bunu kullanır; oturum çerezi olan ziyaretçi middleware'de
 * üye rotasına yazılır ve orada gerçek `getSiteAccess()` çalışır.
 */
export const ANON_ACCESS: SiteAccess = { state: 'anon', email: null, trialEndsAt: null, trialDaysLeft: 0 };

/**
 * Sign-in link that brings the visitor back to `path` (locale-free) afterwards.
 * Localized (2026-10-22): the unprefixed /login is the legacy app route, whose
 * server redirect fires mid-stream — Googlebot got a 200 shell with no canonical
 * and Search Console listed 70 `/login?callbackUrl=…` URLs as duplicates.
 */
export function signInHref(locale: string, path: string, register = false): string {
  const qs = new URLSearchParams();
  if (register) qs.set('mode', 'register');
  qs.set('callbackUrl', `/${locale}${path}`);
  return `/${locale}/login?${qs.toString()}`;
}
