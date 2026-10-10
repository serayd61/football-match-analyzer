// Google Play mode — 2026-10-10.
//
// The Play Store build (package `pro.footballanalytics`, android-app/) is a
// plain Android WebView that opens `/?src=twa`. (It started life as a
// Bubblewrap Trusted Web Activity, hence the `twa` name; the WebView replaced
// it on 2026-10-10 because Play's closed-test engagement check does not see
// usage that happens inside Chrome.) Google Play's payments policy forbids
// selling digital subscriptions inside the app through anything but Play
// Billing, and forbids steering users to another payment method. We do not
// integrate Play Billing (yet), so inside the app the site must not show a
// checkout, prices or "Unlock with Pro" links. Existing subscribers still sign
// in and get their access; everyone else uses the free tier.
//
// Detection: the start URL carries `?src=twa`, the WebView appends
// `FootballAnalyticsPro/<version> (Android WebView)` to its user agent, and the
// old TWA sent `Referer: android-app://pro.footballanalytics/`. Middleware
// turns any of these into a one-year cookie so that every later server render
// (and client bundle) knows it runs inside the Play app.
import { cookies } from 'next/headers';

export const TWA_PACKAGE = 'pro.footballanalytics';
export const TWA_COOKIE = 'fa_twa';
export const TWA_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
/** User-agent token appended by android-app/ (MainActivity.UA_SUFFIX). */
export const TWA_UA_TOKEN = 'FootballAnalyticsPro/';

/** Request-level detection (used by middleware). */
export function isTwaRequest(req: { nextUrl: { searchParams: URLSearchParams }; headers: { get(n: string): string | null } }): boolean {
  if (req.nextUrl.searchParams.get('src') === 'twa') return true;
  if ((req.headers.get('user-agent') || '').includes(TWA_UA_TOKEN)) return true;
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
