'use client';

// Purchase entry point inside the Google Play app (2026-11-14).
//
// Until now every paywall, the header, the footer and the account page hid
// /pricing whenever the fa_twa cookie was set, and the paywall said
// "subscriptions are not available in this app" — also in v1.3.0, which does
// sell Pro through Play Billing on /pricing. An expired member had no way to
// buy (first customer report: 2026-11-11).
//
//   app-billing → link to /pricing (Play Billing, PlayPurchase.tsx)
//   app-legacy  → "Update the app" (Play Store listing); never a checkout link
//   web         → nothing: the server component already rendered the web link
import { Link } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { PLAY_STORE_URL } from '@/lib/site/app-links';
import { useAppMode } from '@/lib/site/app-mode';
import { PRICING_HREF } from '@/lib/site/auth-links';

export default function AppPlansLink({ plans, update, className, location }: {
  /** label when Play Billing is available, e.g. "See plans" */ plans: string;
  /** label for an app version without billing, e.g. "Update the app" */ update: string;
  className?: string;
  /** analytics location, e.g. "paywall_app" */ location: string;
}) {
  const mode = useAppMode();
  if (mode === 'app-billing') {
    return <Link href={PRICING_HREF} className={className} data-cta={location} onClick={() => track.ctaClick(location, 'pricing')}>{plans}</Link>;
  }
  if (mode === 'app-legacy') {
    return <a href={PLAY_STORE_URL} className={className} data-cta={location} onClick={() => track.ctaClick(location, 'app_update')}>{update}</a>;
  }
  return null;
}
