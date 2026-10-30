// App share / rate targets (Testers Community feedback, 2026-10-16).
// Pure module (no Next imports) so it is unit-testable.
//
// Inside the Google Play build (fa_twa cookie, lib/site/twa.ts) a share should
// point at the Play listing and "rate" at the Play Store app; on the web the
// share points at the localized site and "rate" at the public Play listing.
// Note: the listing is only reachable by closed-test testers until the
// production-access application is approved (marketing/google-play-store-listing.md §8).

export const PLAY_PACKAGE = 'pro.footballanalytics';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`;
/** Opened by the WebView via openExternal → Play Store app (MainActivity.shouldOverrideUrlLoading). */
export const PLAY_MARKET_URL = `market://details?id=${PLAY_PACKAGE}`;
export const SITE_ORIGIN = 'https://footballanalytics.pro';
/** Play listing link used by the site's own "Get it on Google Play" CTAs (UTM-tagged). */
export const PLAY_STORE_SITE_URL = `${PLAY_STORE_URL}&utm_source=website&utm_medium=cta&utm_campaign=play_launch`;

export type ShareTarget = { title: string; text: string; url: string };

/** URL a user shares. UTM-tagged so the landing shows up as `share / app_share` in analytics. */
export function shareUrl(locale: string, inApp: boolean): string {
  if (inApp) return `${PLAY_STORE_URL}&utm_source=share&utm_medium=app_share`;
  const l = /^[a-z]{2}$/.test(locale) ? locale : 'en';
  return `${SITE_ORIGIN}/${l}?utm_source=share&utm_medium=app_share`;
}

/** "Rate the app" link: Play Store app inside the WebView, public listing on the web. */
export function rateUrl(inApp: boolean): string {
  return inApp ? PLAY_MARKET_URL : PLAY_STORE_URL;
}

/**
 * Play app ≥ v4: ask the In-App Review flow (Google decides whether to show
 * it); returns true when the bridge handled it so the caller skips the link.
 */
export function requestNativeReview(bridge: NativeBridge | null): boolean {
  if (!bridge || typeof bridge.requestReview !== 'function') return false;
  try { bridge.requestReview(); return true; } catch { return false; }
}

export function buildShareTarget(locale: string, inApp: boolean, title: string, text: string): ShareTarget {
  return { title, text, url: shareUrl(locale, inApp) };
}

/**
 * JS bridge injected by the Play app (android-app/ MainActivity.AppBridge,
 * versionCode ≥ 4) as `window.FootballAnalyticsApp`. Absent on the web and in
 * older app versions, so every caller must keep its fallback.
 */
export type NativeBridge = {
  share?: (title: string, text: string, url: string) => void;
  requestReview?: () => void;
  version?: () => string;
};
export function nativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null;
  const b = (window as unknown as { FootballAnalyticsApp?: NativeBridge }).FootballAnalyticsApp;
  return b && typeof b === 'object' ? b : null;
}

/** Result of a share attempt — what the UI should tell the user. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Web Share API with clipboard fallback. Android WebView has no navigator.share,
 * so the Play build falls back to copying the link (status text in the UI).
 */
export async function shareOrCopy(
  target: ShareTarget,
  nav: { share?: (d: ShareTarget) => Promise<void>; canShare?: (d: ShareTarget) => boolean; clipboard?: { writeText(s: string): Promise<void> } },
  bridge: NativeBridge | null = null,
): Promise<ShareOutcome> {
  // Play app ≥ v4: native share sheet (Intent.ACTION_SEND) via the JS bridge.
  if (bridge && typeof bridge.share === 'function') {
    try { bridge.share(target.title, target.text, target.url); return 'shared'; } catch { /* fall through */ }
  }
  if (typeof nav.share === 'function' && (typeof nav.canShare !== 'function' || nav.canShare(target))) {
    try {
      await nav.share(target);
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
      // fall through to copy
    }
  }
  try {
    if (nav.clipboard) {
      await nav.clipboard.writeText(target.url);
      return 'copied';
    }
  } catch { /* clipboard blocked */ }
  return 'failed';
}
