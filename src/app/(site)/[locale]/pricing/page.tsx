import type { Metadata } from 'next';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { Page } from '@/components/site/ui';
import { getSiteAccess } from '@/lib/site/access';
import { PLAN_PRICES, money } from '@/lib/site/plans';
import PlanChooser from './PlanChooser';

// Pricing (Modernist redesign 2026-09-11), localized. Top grid: H1 + intro
// with the Weekly / Monthly toggle; two plan columns split by a 2px rule;
// an honest "what you are buying" paragraph at the bottom. Prices mirror
// src/lib/stripe.ts. Checkout goes through /api/stripe/create-checkout.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'v2.pricing' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/pricing') };
}

export default async function PricingPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('v2.pricing');
  const access = await getSiteAccess();
  const weeklyAvailable = !!process.env.STRIPE_PRICE_ID_WEEKLY;

  return (
    <Page>
      <PlanChooser
        locale={locale}
        signedIn={access.state !== 'anon'}
        isPro={access.state === 'pro'}
        weeklyAvailable={weeklyAvailable}
        prices={{ monthly: money(PLAN_PRICES.monthly.amount), weekly: money(PLAN_PRICES.weekly.amount) }}
        labels={{
          title: t('title'), lead: t('lead'), weekly: t('weekly'), monthly: t('monthly'),
          freeName: t('freeName'), freeSub: t('freeSub'), freePrice: t('freePrice'), freeFor: t('freeFor'),
          free: [t('free1'), t('free2'), t('free3')], freeNot: t('freeNot'), freeCta: t('freeCta'),
          proName: t('proName'), proSub: t('proSub'), mostPopular: t('mostPopular'), perMonth: t('perMonth'), perWeek: t('perWeek'),
          noteMonthly: t('noteMonthly'), noteWeekly: t('noteWeekly'),
          pro: [t('pro1'), t('pro2'), t('pro3'), t('pro4'), t('pro5')],
          proCta: t('proCta'), proCtaSignedIn: t('proCtaSignedIn'), loading: t('loading'), signInFirst: t('signInFirst'), error: t('error'),
        }}
      />
      <div className="rule-t mt-8 grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h4 className="text-[20px]">{t('buyTitle')}</h4>
        <div>
          <p className="text-[14px] text-s-muted">{t('buyText')}</p>
          <p className="mt-3 text-[13px]"><Link href="/performance" className="font-semibold hover:text-s-accent-600">{t('trackLink')}</Link></p>
        </div>
      </div>
    </Page>
  );
}
