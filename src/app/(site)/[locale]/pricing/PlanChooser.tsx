'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';

type Labels = {
  title: string; lead: string; weekly: string; monthly: string;
  freeName: string; freeSub: string; freePrice: string; freeFor: string; free: string[]; freeNot: string; freeCta: string;
  proName: string; proSub: string; mostPopular: string; perMonth: string; perWeek: string; noteMonthly: string; noteWeekly: string;
  pro: string[]; proCta: string; proCtaSignedIn: string; loading: string; signInFirst: string; error: string;
};

// Client half of the pricing page: the billing toggle and the checkout call.
export default function PlanChooser({ locale, signedIn, isPro, weeklyAvailable, prices, labels: l }: {
  locale: string; signedIn: boolean; isPro: boolean; weeklyAvailable: boolean;
  prices: { monthly: string; weekly: string }; labels: Labels;
}) {
  const router = useRouter();
  // Monthly is the default (7-day trial); weekly is the low-threshold entry when configured.
  const [billing, setBilling] = useState<'weekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { track.viewPricing(); }, []);

  const subscribe = async () => {
    if (!signedIn) {
      track.ctaClick('pricing_page', 'subscribe_logged_out');
      router.push(`/login?callbackUrl=${encodeURIComponent(`/${locale}/pricing`)}`);
      return;
    }
    track.beginCheckout();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing === 'weekly' ? 'PRO_WEEKLY' : 'PRO' }),
      });
      const data = await res.json();
      if (data?.url) { window.location.href = data.url; return; }
      setError(l.error);
    } catch { setError(l.error); }
    setLoading(false);
  };

  const seg = (key: 'weekly' | 'monthly', label: string) => (
    <button type="button" onClick={() => setBilling(key)} aria-pressed={billing === key} className={`btn ${billing === key ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
  );

  return (
    <>
      {/* Top grid */}
      <div className="rule-b grid items-end gap-6 pb-6 pt-8 lg:grid-cols-2">
        <h1 className="text-[clamp(40px,5vw,60px)]">{l.title}</h1>
        <div>
          <p className="max-w-[440px] text-[16px] text-s-muted">{l.lead}</p>
          {weeklyAvailable && <div className="mt-4 flex flex-wrap gap-1">{seg('weekly', l.weekly)}{seg('monthly', l.monthly)}</div>}
        </div>
      </div>

      {/* Plan columns */}
      <div className="grid lg:grid-cols-2">
        <section className="flex flex-col gap-4 py-8 lg:rule-r lg:pr-6" aria-labelledby="plan-free">
          <div>
            <h3 id="plan-free" className="text-[24px]">{l.freeName}</h3>
            <p className="mt-1 text-[14px] text-s-muted">{l.freeSub}</p>
          </div>
          <p className="flex items-baseline gap-2"><span className="num text-[56px] font-extrabold leading-none">{l.freePrice}</span><span className="text-[14px] text-s-muted">{l.freeFor}</span></p>
          <ul className="divide-rule rule-t-1 rule-b-1 text-[14px]">
            {l.free.map((f) => <li key={f} className="py-2">{f}</li>)}
            <li className="py-2 text-s-muted">{l.freeNot}</li>
          </ul>
          <Link href="/login?mode=register" className="btn btn-secondary btn-block">{l.freeCta}</Link>
        </section>

        <section className="rule-t flex flex-col gap-4 py-8 lg:rule-t-0 lg:pl-6" aria-labelledby="plan-pro">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="plan-pro" className="text-[24px]">{l.proName}</h3>
              <p className="mt-1 text-[14px] text-s-muted">{l.proSub}</p>
            </div>
            <span className="tag tag-accent">{l.mostPopular}</span>
          </div>
          <div>
            <p className="flex items-baseline gap-2">
              <span className="num text-[56px] font-extrabold leading-none">{billing === 'weekly' ? prices.weekly : prices.monthly}</span>
              <span className="text-[14px] text-s-muted">{billing === 'weekly' ? l.perWeek : l.perMonth}</span>
            </p>
            <p className="mt-1.5 text-[12px] text-s-accent-700">{billing === 'weekly' ? l.noteWeekly : l.noteMonthly}</p>
          </div>
          <ul className="divide-rule rule-t-1 rule-b-1 text-[14px]">
            {l.pro.map((f) => <li key={f} className="py-2">{f}</li>)}
          </ul>
          {isPro ? (
            <Link href="/account" className="btn btn-secondary btn-block">{l.proCtaSignedIn}</Link>
          ) : (
            <button type="button" onClick={subscribe} disabled={loading} className="btn btn-primary btn-block">
              {loading ? l.loading : signedIn ? l.proCtaSignedIn : l.proCta}
            </button>
          )}
          {!signedIn && <p className="text-[12px] text-s-muted">{l.signInFirst}</p>}
          {error && <p role="alert" className="risk-note">{error}</p>}
        </section>
      </div>
    </>
  );
}
