import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSiteAccess } from '@/lib/site/access';
import { getAccountSummary } from '@/lib/site/account';
import { Page, PageTitle, SectionTitle } from '@/components/site/ui';
import LocaleSwitcher from '@/components/site/LocaleSwitcher';
import ThemeToggle from '@/components/site/ThemeToggle';
import { StripeButton, SignOutButton } from '@/components/site/account/BillingActions';

// Account (2026-09-08): one page for who you are, what your access is and
// where it comes from, and the billing/settings actions. Replaces the legacy
// /profile and /settings views for the new site. Per-user → force-dynamic.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

const PRICING_HREF = '/pricing';
const RESET_HREF = '/forgot-password';

export default async function AccountPage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const access = await getSiteAccess();
  if (access.state === 'anon') redirect(`/login?callbackUrl=${encodeURIComponent(`/${locale}/account`)}`);
  const [t, f, acct] = await Promise.all([getTranslations('account'), getFormatter(), getAccountSummary(access)]);
  if (!acct) redirect(`/login?callbackUrl=${encodeURIComponent(`/${locale}/account`)}`);

  const day = (iso: string | null) => (iso ? f.dateTime(new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`), 'dateFull') : '–');
  const b = acct.billing;
  const stripeLive = b.hasStripe && (b.status === 'active' || b.status === 'trialing' || b.status === 'past_due');

  // Plan headline + one-line explanation per state.
  const state = access.state;
  const planTitle = state === 'pro' ? t('planPro') : state === 'trial' ? t('planTrial') : t('planExpired');
  const planLead =
    state === 'trial' ? t('trialLead', { days: access.trialDaysLeft, date: day(access.trialEndsAt) })
    : state === 'pro' && stripeLive ? (b.cancelAtPeriodEnd ? t('proEnding', { date: day(b.periodEnd) }) : t('proRenews', { date: day(b.periodEnd) }))
    : state === 'pro' ? t('proManual', { date: day(b.manualEnd) })
    : t('expiredLead');

  const chip = state === 'expired' ? 'border-s-line text-s-muted' : 'border-s-brand text-s-brand';
  const row = 'grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4';
  const dt = 'text-xs font-semibold uppercase tracking-wider text-s-muted';

  return (
    <Page>
      <PageTitle
        title={t('title')}
        lead={t('lead')}
        aside={<Link href="/dashboard" className="text-sm underline underline-offset-4">{t('toDashboard')}</Link>}
      />

      {/* ── Subscription ─────────────────────────────────────────────── */}
      <section aria-labelledby="sub-title" className="border border-s-line bg-s-raised/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={dt}>{t('subscription')}</p>
            <h2 id="sub-title" className="mt-1 text-2xl">{planTitle}</h2>
            <p className="mt-1 text-s-muted">{planLead}</p>
          </div>
          <span className={`inline-flex h-7 items-center rounded-[2px] border px-2 text-xs font-medium ${chip}`}>
            {state === 'trial' ? t('chipTrial', { days: access.trialDaysLeft }) : state === 'pro' ? t('chipPro') : t('chipExpired')}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {stripeLive ? (
            <StripeButton kind="portal" />
          ) : (
            <>
              <StripeButton kind="checkout" />
              <a href={PRICING_HREF} className="text-sm underline underline-offset-4">{t('seePlans')}</a>
            </>
          )}
        </div>
        <p className="mt-4 text-xs text-s-muted">{stripeLive ? t('portalNote') : t('checkoutNote')}</p>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* ── Profile ────────────────────────────────────────────────── */}
        <section aria-labelledby="profile-title">
          <SectionTitle title={t('profile')} />
          <dl className="divide-y divide-s-line">
            <div className={row}><dt className={dt}>{t('name')}</dt><dd>{acct.name || '–'}</dd></div>
            <div className={row}><dt className={dt}>{t('email')}</dt><dd className="break-all">{acct.email}</dd></div>
            <div className={row}><dt className={dt}>{t('memberSince')}</dt><dd>{day(acct.memberSince)}</dd></div>
            <div className={row}><dt className={dt}>{t('accessSource')}</dt><dd>{state === 'trial' ? t('sourceTrial') : stripeLive ? t('sourceStripe') : state === 'pro' ? t('sourceManual') : t('sourceNone')}</dd></div>
          </dl>
        </section>

        {/* ── Billing ────────────────────────────────────────────────── */}
        <section aria-labelledby="billing-title">
          <SectionTitle title={t('billing')} />
          {b.hasStripe ? (
            <dl className="divide-y divide-s-line">
              <div className={row}><dt className={dt}>{t('stripeStatus')}</dt><dd>{b.status ? t(`status_${b.status}` as any) : '–'}</dd></div>
              <div className={row}><dt className={dt}>{b.cancelAtPeriodEnd ? t('endsOn') : t('renewsOn')}</dt><dd>{day(b.periodEnd)}</dd></div>
              <div className={row}><dt className={dt}>{t('invoices')}</dt><dd><StripeButton kind="portal" variant="secondary" /></dd></div>
            </dl>
          ) : (
            <p className="py-3 text-sm text-s-muted">{t('noBilling')}</p>
          )}
        </section>

        {/* ── Settings ───────────────────────────────────────────────── */}
        <section aria-labelledby="settings-title" className="lg:col-span-2">
          <SectionTitle title={t('settings')} />
          <dl className="divide-y divide-s-line">
            <div className={row}><dt className={dt}>{t('language')}</dt><dd><LocaleSwitcher /></dd></div>
            <div className={row}><dt className={dt}>{t('theme')}</dt><dd><ThemeToggle /></dd></div>
            <div className={row}><dt className={dt}>{t('password')}</dt><dd><a href={RESET_HREF} className="underline underline-offset-4">{t('resetPassword')}</a></dd></div>
            <div className={row}><dt className={dt}>{t('session')}</dt><dd><SignOutButton /></dd></div>
          </dl>
          <p className="mt-3 text-xs text-s-muted">{t('legacyNote')} <a href="/settings" className="underline underline-offset-4">{t('legacyLink')}</a></p>
        </section>
      </div>
    </Page>
  );
}
