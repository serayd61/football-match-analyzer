'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

/**
 * Fires a GA4 event once when mounted. Lets server components emit funnel
 * events (e.g. view_analysis) without becoming client components themselves.
 */
export default function MountEvent({
  name,
  params = {},
}: {
  name: string;
  params?: Record<string, string | number | boolean | undefined>;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(name, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
