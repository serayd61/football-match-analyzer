'use client';

import { Link } from '@/i18n/navigation';
import { useIsTwa } from '@/lib/site/twa-client';

// Footer "Pricing" link; not rendered inside the Google Play app (Play
// payments policy, see src/lib/site/twa.ts). Client-side so the server
// footer/layout stays static.
export default function FooterPricingLink({ label }: { label: string }) {
  if (useIsTwa()) return null;
  return <Link href="/pricing" className="hover:text-s-ink">{label}</Link>;
}
