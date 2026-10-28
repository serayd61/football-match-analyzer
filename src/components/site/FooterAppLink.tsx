'use client';

// Footer link to the Android app page; hidden inside the Play app itself.
import { Link } from '@/i18n/navigation';
import { useIsTwa } from '@/lib/site/twa-client';

export default function FooterAppLink({ label }: { label: string }) {
  if (useIsTwa()) return null;
  return <Link href="/app" className="hover:text-s-ink">{label}</Link>;
}
