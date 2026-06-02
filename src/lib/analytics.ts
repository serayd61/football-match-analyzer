// ============================================================================
// Analytics — GA4 event helper (conversion funnel)
// ============================================================================
// Thin, type-safe wrapper over @next/third-parties' sendGAEvent. Safe to call
// anywhere: if GA isn't configured (no NEXT_PUBLIC_GA_ID) the events queue
// harmlessly to dataLayer and are dropped.

import { sendGAEvent } from '@next/third-parties/google';

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

// Canonical funnel event names (keep stable — they become GA4 reports).
export const Events = {
  // Acquisition / SEO
  VIEW_ANALYSIS: 'view_analysis',
  CTA_CLICK: 'cta_click',
  SHARE_CLICK: 'share_click',
  // Auth
  SIGN_UP: 'sign_up',
  LOGIN: 'login',
  // Monetization funnel
  VIEW_PRICING: 'view_pricing',
  BEGIN_CHECKOUT: 'begin_checkout',
  PURCHASE: 'purchase',
  // Product engagement
  RUN_ANALYSIS: 'run_analysis',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];

type EventParams = Record<string, string | number | boolean | undefined>;

/** Fire a GA4 event. No-op on the server or when GA is not configured. */
export function trackEvent(name: EventName | string, params: EventParams = {}): void {
  if (typeof window === 'undefined') return;
  try {
    sendGAEvent('event', name, params);
  } catch {
    /* analytics must never break the app */
  }
}

// Convenience helpers for the key funnel steps -------------------------------

export const PRO_PRICE_USD = 19.99;

export const track = {
  ctaClick: (location: string, label?: string) =>
    trackEvent(Events.CTA_CLICK, { location, label: label ?? '' }),
  signUp: (method: 'credentials' | 'google') =>
    trackEvent(Events.SIGN_UP, { method }),
  login: (method: 'credentials' | 'google') =>
    trackEvent(Events.LOGIN, { method }),
  viewPricing: () => trackEvent(Events.VIEW_PRICING, {}),
  beginCheckout: () =>
    trackEvent(Events.BEGIN_CHECKOUT, { currency: 'USD', value: PRO_PRICE_USD }),
  purchase: () =>
    trackEvent(Events.PURCHASE, { currency: 'USD', value: PRO_PRICE_USD }),
  viewAnalysis: (fixtureId: number | string) =>
    trackEvent(Events.VIEW_ANALYSIS, { fixture_id: String(fixtureId) }),
  runAnalysis: (league?: string) =>
    trackEvent(Events.RUN_ANALYSIS, { league: league ?? '' }),
  shareClick: (network: string, fixtureId?: number | string) =>
    trackEvent(Events.SHARE_CLICK, { network, fixture_id: fixtureId ? String(fixtureId) : '' }),
};
