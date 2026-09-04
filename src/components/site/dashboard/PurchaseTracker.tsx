'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { track } from '@/lib/analytics';

// Fires the GA4 / Ads purchase conversion once after a successful Stripe
// checkout redirect (?payment=success). Kept from the legacy dashboard.
export default function PurchaseTracker() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get('payment') !== 'success') return;
    try {
      if (sessionStorage.getItem('purchase_tracked')) return;
      sessionStorage.setItem('purchase_tracked', '1');
    } catch { /* storage blocked: still track once per mount */ }
    track.purchase();
  }, [params]);
  return null;
}
