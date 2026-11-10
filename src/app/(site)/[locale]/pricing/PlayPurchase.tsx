'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { nativeBridge } from '@/lib/site/app-links';
import {
  PlayBillingError,
  playBillingAvailable,
  purchasePlaySubscription,
  queryPlayProducts,
  queryPlayPurchases,
  selectPlayOffers,
  verifyPlayPurchase,
  type PlayBillingBridge,
  type PlayOffer,
} from '@/lib/site/play-billing';

export type PlayLabels = {
  perMonth: string; perYear: string; loading: string;
  twaNote: string; twaSignIn: string;
  playNote: string; playSuccess: string; playPending: string; playError: string; playManage: string;
};

// Pro card body inside the Google Play app (PlanChooser `purchasable=false`).
// Without the billing bridge (app < v1.3.0) this is the old policy-safe text:
// no prices, no checkout. With the bridge it sells through Play Billing:
// Play-localized prices, native purchase sheet, then POST /api/play/verify.
export default function PlayPurchase({ locale, signedIn, isPro, accountId, labels: l }: {
  locale: string; signedIn: boolean; isPro: boolean; accountId: string | null; labels: PlayLabels;
}) {
  const router = useRouter();
  const [bridge, setBridge] = useState<Required<PlayBillingBridge> | null>(null);
  const [offers, setOffers] = useState<{ monthly: PlayOffer | null; yearly: PlayOffer | null } | null>(null);
  const [phase, setPhase] = useState<'idle' | 'buying' | 'done' | 'pending' | 'error'>('idle');

  // The bridge only exists in the client WebView — detect after mount.
  useEffect(() => {
    const b = nativeBridge() as PlayBillingBridge | null;
    if (!playBillingAvailable(b)) return;
    setBridge(b);
    queryPlayProducts(b).then((list) => setOffers(selectPlayOffers(list))).catch(() => setOffers(null));
  }, []);

  // Restore: a Play subscription bought on this Google account (reinstall,
  // new device, app killed before verify) is re-linked on sight.
  useEffect(() => {
    if (!bridge || !signedIn || isPro) return;
    queryPlayPurchases(bridge)
      .then(async (owned) => {
        for (const p of owned) {
          if (await verifyPlayPurchase(p.purchaseToken)) {
            setPhase('done');
            router.refresh();
            return;
          }
        }
      })
      .catch(() => { /* restore is best-effort */ });
  }, [bridge, signedIn, isPro, router]);

  // App < 1.3.0 (or billing unavailable): the pre-billing policy-safe body.
  if (!bridge) {
    return (
      <>
        <p className="mt-auto text-[14px] text-s-muted">{l.twaNote}</p>
        {!signedIn && <Link href="/login" className="btn btn-secondary btn-block">{l.twaSignIn}</Link>}
      </>
    );
  }

  if (isPro || phase === 'done') {
    return (
      <>
        {phase === 'done' && <p role="status" className="text-[14px] font-semibold text-s-win">{l.playSuccess}</p>}
        <p className="mt-auto text-[14px] text-s-muted">{l.playManage}</p>
      </>
    );
  }

  const buy = async (offer: PlayOffer) => {
    if (!signedIn || !accountId) {
      track.ctaClick('pricing_page', 'play_subscribe_logged_out');
      router.push(`/login?callbackUrl=${encodeURIComponent(`/${locale}/pricing`)}`);
      return;
    }
    track.beginCheckout();
    setPhase('buying');
    try {
      const purchase = await purchasePlaySubscription(bridge, offer, accountId);
      const entitled = await verifyPlayPurchase(purchase.purchaseToken);
      setPhase(entitled ? 'done' : 'pending');
      if (entitled) router.refresh();
    } catch (e) {
      if (e instanceof PlayBillingError && e.code === 'cancelled') setPhase('idle');
      else if (e instanceof PlayBillingError && e.code === 'pending') setPhase('pending');
      else setPhase('error');
    }
  };

  return (
    <div className="mt-auto flex flex-col gap-2.5">
      {offers?.yearly && (
        <button type="button" onClick={() => buy(offers.yearly!)} disabled={phase === 'buying'} className="btn btn-primary btn-lg btn-block">
          {phase === 'buying' ? l.loading : `${offers.yearly.formattedPrice} ${l.perYear}`}
        </button>
      )}
      {offers?.monthly && (
        <button type="button" onClick={() => buy(offers.monthly!)} disabled={phase === 'buying'} className={`btn btn-block ${offers.yearly ? 'btn-secondary' : 'btn-primary btn-lg'}`}>
          {phase === 'buying' ? l.loading : `${offers.monthly.formattedPrice} ${l.perMonth}`}
        </button>
      )}
      {!offers && <p className="text-[14px] text-s-muted">{l.loading}</p>}
      {phase === 'pending' && <p role="status" className="text-[13px] text-s-muted">{l.playPending}</p>}
      {phase === 'error' && <p role="alert" className="risk-note">{l.playError}</p>}
      <p className="text-[13px] text-s-muted">{l.playNote}</p>
    </div>
  );
}
