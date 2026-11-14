'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { nativeBridge, PLAY_STORE_URL } from '@/lib/site/app-links';
import { clearAccessCache } from '@/components/site/UpgradeBanner';
import {
  PlayBillingError,
  playBillingSupported,
  purchasePlaySubscription,
  queryPlayProducts,
  queryPlayPurchases,
  selectPlayOffers,
  verifyPlayPurchase,
  waitForPlayBilling,
  type PlayBillingBridge,
  type PlayOffer,
} from '@/lib/site/play-billing';

export type PlayLabels = {
  perMonth: string; perYear: string; loading: string;
  twaSignIn: string;
  appUpdateNote: string; appUpdateCta: string; playUnavailable: string; playRetry: string;
  playNote: string; playSuccess: string; playPending: string; playError: string; playManage: string;
};

// Pro card body inside the Google Play app (PlanChooser `purchasable=false`).
// With the billing bridge it sells through Play Billing: Play-localized prices,
// native purchase sheet, then POST /api/play/verify.
//
// 2026-11-14 — three states that used to collapse into "subscriptions are not
// available in this app" (first customer report, 2026-11-11):
//   legacy       app < v1.3.0, no bridge → "Update the app" (Play Store). No
//                prices and no other checkout (Play payments policy).
//   connecting   bridge present, native BillingClient still connecting → wait
//                (it starts in MainActivity.onCreate and answers asynchronously).
//   unavailable  bridge present, Play not reachable or no products → say so,
//                with a retry.
export default function PlayPurchase({ locale, signedIn, isPro, accountId, labels: l }: {
  locale: string; signedIn: boolean; isPro: boolean; accountId: string | null; labels: PlayLabels;
}) {
  const router = useRouter();
  const [bridge, setBridge] = useState<Required<PlayBillingBridge> | null>(null);
  const [offers, setOffers] = useState<{ monthly: PlayOffer | null; yearly: PlayOffer | null } | null>(null);
  const [phase, setPhase] = useState<'idle' | 'buying' | 'done' | 'pending' | 'error'>('idle');
  // 'checking' until mounted; then see the header comment.
  const [store, setStore] = useState<'checking' | 'legacy' | 'connecting' | 'ready' | 'unavailable'>('checking');
  const [attempt, setAttempt] = useState(0);

  // The bridge only exists in the client WebView — detect after mount.
  useEffect(() => {
    const b = nativeBridge() as PlayBillingBridge | null;
    if (!playBillingSupported(b)) { setStore('legacy'); return; }
    let alive = true;
    setStore('connecting');
    (async () => {
      if (!(await waitForPlayBilling(b))) { if (alive) setStore('unavailable'); return; }
      try {
        const found = selectPlayOffers(await queryPlayProducts(b));
        if (!alive) return;
        if (!found.monthly && !found.yearly) { setStore('unavailable'); return; }
        setOffers(found);
        setBridge(b);
        setStore('ready');
      } catch {
        if (alive) setStore('unavailable');
      }
    })();
    return () => { alive = false; };
  }, [attempt]);

  // Restore: a Play subscription bought on this Google account (reinstall,
  // new device, app killed before verify) is re-linked on sight.
  useEffect(() => {
    if (!bridge || !signedIn || isPro) return;
    queryPlayPurchases(bridge)
      .then(async (owned) => {
        for (const p of owned) {
          if (await verifyPlayPurchase(p.purchaseToken)) {
            setPhase('done');
            clearAccessCache();
            router.refresh();
            return;
          }
        }
      })
      .catch(() => { /* restore is best-effort */ });
  }, [bridge, signedIn, isPro, router]);

  // Already Pro (any provider): nothing to sell. An old app version just shows the plan card.
  if (isPro || phase === 'done') {
    if (phase !== 'done' && store !== 'ready') return null;
    return (
      <>
        {phase === 'done' && <p role="status" className="text-[14px] font-semibold text-s-win">{l.playSuccess}</p>}
        <p className="mt-auto text-[14px] text-s-muted">{l.playManage}</p>
      </>
    );
  }

  // App < 1.3.0: nothing can be sold here; the one useful step is the update.
  if (store === 'legacy') {
    return (
      <div className="mt-auto flex flex-col gap-2.5">
        <p className="text-[14px] text-s-muted">{l.appUpdateNote}</p>
        <a href={PLAY_STORE_URL} className="btn btn-primary btn-lg btn-block" data-cta="pricing_app_update" onClick={() => track.ctaClick('pricing_page', 'app_update')}>{l.appUpdateCta}</a>
        {!signedIn && <Link href="/login" className="btn btn-secondary btn-block">{l.twaSignIn}</Link>}
      </div>
    );
  }
  if (store === 'checking' || store === 'connecting') {
    return <p className="mt-auto text-[14px] text-s-muted" role="status">{l.loading}</p>;
  }
  if (store === 'unavailable' || !bridge) {
    return (
      <div className="mt-auto flex flex-col gap-2.5">
        <p role="alert" className="risk-note">{l.playUnavailable}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn btn-secondary btn-block">{l.playRetry}</button>
      </div>
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
      if (entitled) { clearAccessCache(); router.refresh(); }
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
          {phase === 'buying' ? l.loading : `${offers.yearly.formattedPrice} /${l.perYear}`}
        </button>
      )}
      {offers?.monthly && (
        <button type="button" onClick={() => buy(offers.monthly!)} disabled={phase === 'buying'} className={`btn btn-block ${offers.yearly ? 'btn-secondary' : 'btn-primary btn-lg'}`}>
          {phase === 'buying' ? l.loading : `${offers.monthly.formattedPrice} /${l.perMonth}`}
        </button>
      )}
      {phase === 'pending' && <p role="status" className="text-[13px] text-s-muted">{l.playPending}</p>}
      {phase === 'error' && <p role="alert" className="risk-note">{l.playError}</p>}
      <p className="text-[13px] text-s-muted">{l.playNote}</p>
    </div>
  );
}
