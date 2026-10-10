// Google Play (TWA) mode — 2026-10-10.
//
// The Play Store build is a Trusted Web Activity (Bubblewrap, package
// `pro.footballanalytics`) that opens `/?src=twa`. Google Play's payments
// policy forbids selling digital subscriptions inside the app through anything
// but Play Billing, and forbids steering users to another payment method. We do
// not integrate Play Billing (yet), so inside the TWA the site must not show a
// checkout, prices or "Unlock with Pro" links. Existing subscribers still sign
// in and get their access; everyone else uses the free tier.
//
// Detection: the start URL carries `?src=twa` (and Android also sends
// `Referer: android-app://pro.footballanalytics/` on the first navigation).
// Middleware turns either signal into a one-year cookie so that every later
// server render (and client bundle) knows it runs inside the Play app.
import { cookies } from 'next/headers';

export const TWA_PACKAGE = 'pro.footballanalytics';
export const TWA_COOKIE = 'fa_twa';
export const TWA_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Request-level detection (used by middleware). */
export function isTwaRequest(req: { nextUrl: { searchParams: URLSearchParams }; headers: { get(n: string): string | null } }): boolean {
  if (req.nextUrl.searchParams.get('src') === 'twa') return true;
  const ref = req.headers.get('referer') || '';
  return ref.startsWith(`android-app://${TWA_PACKAGE}`);
}

/** Server components / route handlers: are we rendering inside the Play app? */
export function isTwa(): boolean {
  try {
    return cookies().get(TWA_COOKIE)?.value === '1';
  } catch {
    return false;
  }
}
