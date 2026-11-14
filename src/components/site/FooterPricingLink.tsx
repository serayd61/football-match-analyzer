'use client';

import { Link } from '@/i18n/navigation';
import { useAppMode } from '@/lib/site/app-mode';

// Footer "Pricing" link. Hidden only in Play app versions without Play Billing
// (< v1.3.0): there is nothing to buy there and the page may not point at
// another payment method (Play payments policy, see src/lib/site/twa.ts).
// Client-side so the server footer/layout stays static.
export default function FooterPricingLink({ label }: { label: string }) {
  if (useAppMode() === 'app-legacy') return null;
  return <Link href="/pricing" className="hover:text-s-ink">{label}</Link>;
}
