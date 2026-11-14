'use client';

// Where is this page running? (2026-11-14)
//
//   web          the open site: Stripe checkout, prices in USD
//   app-billing  Play app v1.3.0+: /pricing sells through Play Billing
//   app-legacy   older Play app: no billing bridge, so nothing can be sold
//                inside it and (Play payments policy, lib/site/twa.ts) nothing
//                may point at another payment method. The only useful call to
//                action is "update the app".
//
// The mode is only known in the browser (fa_twa cookie + the injected
// window.FootballAnalyticsApp bridge), so server components render a client
// island (AppPlansLink) instead of branching themselves.
import { useEffect, useState } from 'react';
import { nativeBridge } from '@/lib/site/app-links';
import { resolveAppMode, type AppMode } from '@/lib/site/play-billing';
import { readTwaCookie } from '@/lib/site/twa-client';

export type { AppMode };

export function readAppMode(): AppMode {
  return resolveAppMode(readTwaCookie(), nativeBridge());
}

/** `null` until mounted (server render and first paint), then the mode. */
export function useAppMode(): AppMode | null {
  const [mode, setMode] = useState<AppMode | null>(null);
  useEffect(() => { setMode(readAppMode()); }, []);
  return mode;
}
