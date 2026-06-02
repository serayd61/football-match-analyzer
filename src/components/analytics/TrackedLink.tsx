'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

/**
 * A next/link that fires a GA4 event on click. Use for funnel CTAs rendered
 * inside server components.
 */
export default function TrackedLink({
  href,
  event,
  params = {},
  className,
  children,
}: {
  href: string;
  event: string;
  params?: Record<string, string | number | boolean | undefined>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackEvent(event, params)}>
      {children}
    </Link>
  );
}
