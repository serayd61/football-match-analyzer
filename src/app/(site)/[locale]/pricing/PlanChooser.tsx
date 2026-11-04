'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

type Labels = {
  title: string; lead: string;
  freeName: string; freeSub: string; freePrice: string; freeFor: string; free: string[]; freeNot: string; freeCta: string;
  proName: string; proSub: string; mostPopular: string; perMonth: string; perYear: string; noteMonthly: string; noteYearly: string;
  billingMonthly: string; billingYearly: string; saveBadge: string; promoNote: string; promoShort: string;
  pro: string[]; proCta: string; proCtaSignedIn: string; loading: string; signInFirst: string; error: string;
  twaNote: string; twaSignIn: string;
};

export type Billing = 'monthly' | 'yearly';

// Client half of the pricing page: the plan columns and the checkout call.
// `purchasable=false` is the Google Play (TWA) build: the plan comparison stays,
// but the price and the checkout button are not
// rendered (Play payments policy — see src/lib/site/twa.ts).
// 2026-11-04: monthly / yearly toggle (yearly only when the server says the
// Stripe price exists) and the year-end promo note on the monthly view.
export default function PlanChooser({ locale, signedIn, isPro, purchasable = true, price, yearlyPrice, yearlyEnabled = false, promo, labels: l }: {
  locale: string; signedIn: boolean; isPro: boolean; purchasable?: boolean;
  /** monthly Pro price, formatted */ price: string;
  /** yearly Pro price, formatted */ yearlyPrice?: string;
  yearlyEnabled?: boolean;
  /** active promotion code for the monthly plan (null when the campaign is over) */
  promo?: string | null;
  labels: Labels;
}) {
  const router = useRouter();
  // No Stripe trial (weekly removed 2026-10-13). Yearly is the default when
  // available: the toggle shows the cheaper per-month figure first.
  const [billing, setBilling] = useState<Billing>(yearlyEnabled ? 'yearly' : 'monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const yearly = yearlyEnabled && billing === 'yearly';

  useEffect(() => { track.viewPricing(); }, []);

  const subscribe = async () => {
    if (!signedIn) {
      track.ctaClick('pricing_page', yearly ? 'subscribe_logged_out_yearly' : 'subscribe_logged_out');
      router.push(`/login?callbackUrl=${encodeURIComponent(`/${locale}/pricing`)}`);
      return;
    }
    track.beginCheckout();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: yearly ? 'PRO_YEARLY' : 'PRO' }),
      });
      const data = await res.json();
      if (data?.url) { window.location.href = data.url; return; }
      setError(l.error);
    } catch { setError(l.error); }
    setLoading(false);
  };

  return (
    <>
      {/* Top grid */}
      <div className="grid items-end gap-6 pb-8 pt-12 lg:grid-cols-2 lg:pt-16">
        <h1 className="max-w-[16ch] text-[36px] sm:text-[48px]">{l.title}</h1>
        <div>
          <p className="max-w-[440px] text-[16px] text-s-muted">{l.lead}</p>
        </div>
      </div>

      {/* Billing toggle (only when the yearly plan exists and prices are shown) */}
      {purchasable && yearlyEnabled && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={`${l.billingMonthly} / ${l.billingYearly}`}>
          <button type="button" onClick={() => setBilling('monthly')} aria-pressed={billing === 'monthly'} className={`btn btn-sm ${billing === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}>{l.billingMonthly}</button>
          <button type="button" onClick={() => setBilling('yearly')} aria-pressed={billing === 'yearly'} className={`btn btn-sm ${billing === 'yearly' ? 'btn-primary' : 'btn-secondary'}`}>
            {l.billingYearly} <span className="tag tag-accent ml-1">{l.saveBadge}</span>
          </button>
          {promo && <span className="text-[13px] text-s-muted">{l.promoShort}</span>}
        </div>
      )}

      {/* Plan columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card card-flat !gap-5" aria-labelledby="plan-free">
          <div>
            <h3 id="plan-free" className="text-[24px]">{l.freeName}</h3>
            <p className="mt-1 text-[14px] text-s-muted">{l.freeSub}</p>
          </div>
          <p className="flex items-baseline gap-2"><span className="num text-[48px] font-extrabold leading-none">{l.freePrice}</span><span className="text-[14px] text-s-muted">{l.freeFor}</span></p>
          <ul className="flex flex-col gap-2.5 border-t border-s-line pt-4 text-[15px]">
            {l.free.map((f) => <li key={f} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-s-win" aria-hidden />{f}</li>)}
            <li className="pt-1 text-[14px] text-s-muted">{l.freeNot}</li>
          </ul>
          <Link href="/login?mode=register" className="btn btn-secondary btn-lg btn-block mt-auto">{l.freeCta}</Link>
        </section>

        <section className="card card-accent !gap-5" aria-labelledby="plan-pro">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="plan-pro" className="text-[24px]">{l.proName}</h3>
              <p className="mt-1 text-[14px] text-s-muted">{l.proSub}</p>
            </div>
            <span className="tag tag-accent">{l.mostPopular}</span>
          </div>
          {purchasable && (
            <div>
              <p className="flex items-baseline gap-2">
                <span className="num text-[48px] font-extrabold leading-none">{yearly ? yearlyPrice : price}</span>
                <span className="text-[14px] text-s-muted">{yearly ? l.perYear : l.perMonth}</span>
              </p>
              <p className="mt-2 text-[14px] text-s-accent-700">{yearly ? l.noteYearly : l.noteMonthly}</p>
              {/* Promo note on both views (2026-11-04): the page opens on Yearly, so a monthly-only note was invisible. */}
              {promo && <p className="mt-2 rounded-[8px] border border-s-line bg-s-surface px-3 py-2 text-[13px]">{l.promoNote}</p>}
            </div>
          )}
          <ul className="flex flex-col gap-2.5 border-t border-s-line pt-4 text-[15px]">
            {l.pro.map((f) => <li key={f} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-s-win" aria-hidden />{f}</li>)}
          </ul>
          {!purchasable ? (
            <>
              <p className="mt-auto text-[14px] text-s-muted">{l.twaNote}</p>
              {!signedIn && <Link href="/login" className="btn btn-secondary btn-block">{l.twaSignIn}</Link>}
            </>
          ) : isPro ? (
            <Link href="/account" className="btn btn-secondary btn-block">{l.proCtaSignedIn}</Link>
          ) : (
            <button type="button" onClick={subscribe} disabled={loading} className="btn btn-primary btn-lg btn-block mt-auto">
              {loading ? l.loading : signedIn ? l.proCtaSignedIn : l.proCta}
            </button>
          )}
          {purchasable && !signedIn && <p className="text-[13px] text-s-muted">{l.signInFirst}</p>}
          {error && <p role="alert" className="risk-note">{error}</p>}
        </section>
      </div>
    </>
  );
}
