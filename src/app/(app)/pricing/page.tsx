import { redirect } from 'next/navigation';
import { resolveLegacyLocale, localizedPath } from '@/lib/site/legacy-redirect';

// Pricing moved to the localized site (/[locale]/pricing) with the Modernist
// redesign (2026-09-11). Stripe's cancel URL still points here; it lands on
// the new page with the same `payment` flag.
export const dynamic = 'force-dynamic';

export default function LegacyPricingRedirect({ searchParams }: { searchParams: { lang?: string; payment?: string } }) {
  const locale = resolveLegacyLocale(searchParams.lang);
  redirect(localizedPath(locale, '/pricing', { payment: searchParams.payment }));
}
