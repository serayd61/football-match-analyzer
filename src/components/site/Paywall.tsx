// Members-only surfaces (2026-09-08). Server components, no hooks.
//   <Paywall/>      — the page body for an account whose 7-day trial is over.
//   <TrialNotice/>  — one line above gated content while the trial runs.
//   <LockedBlock/>  — landing-page stand-in for a table an anonymous visitor
//                     must not see (count only, sign-up CTA).
import { Lock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SiteAccess } from '@/lib/site/access';

// Account and billing still live in the legacy (unlocalized) app shell.
export const REGISTER_HREF = '/login?mode=register';
export const SIGNIN_HREF = '/login';
export const PRICING_HREF = '/pricing';

const primary = 'inline-flex h-10 items-center rounded-[2px] bg-s-brand px-4 text-sm font-medium text-s-brand-ink hover:opacity-90';
const secondary = 'inline-flex h-10 items-center rounded-[2px] border border-s-line px-4 text-sm font-medium hover:border-s-muted';

export async function Paywall() {
  const t = await getTranslations('paywall');
  return (
    <section className="my-8 border border-s-line bg-s-raised/40 px-6 py-12 text-center" aria-labelledby="paywall-title">
      <Lock size={20} aria-hidden className="mx-auto text-s-muted" />
      <h2 id="paywall-title" className="mt-3 text-2xl">{t('expiredTitle')}</h2>
      <p className="mx-auto mt-2 max-w-xl text-s-muted">{t('expiredLead')}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <a href={PRICING_HREF} className={primary}>{t('expiredCta')}</a>
        <Link href="/performance" className={secondary}>{t('expiredAlt')}</Link>
      </div>
    </section>
  );
}

export async function TrialNotice({ access }: { access: SiteAccess }) {
  if (access.state !== 'trial') return null;
  const t = await getTranslations('paywall');
  return (
    <p role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-s-line bg-s-raised/40 px-3 py-2 text-sm">
      <span>{t('trialLeft', { days: access.trialDaysLeft })}</span>
      <a href={PRICING_HREF} className="underline underline-offset-4">{t('trialCta')}</a>
    </p>
  );
}

export async function LockedBlock({ count, lead }: { count: number; lead?: string }) {
  const t = await getTranslations('paywall');
  return (
    <div className="mt-2 border border-dashed border-s-line px-6 py-10 text-center">
      <Lock size={18} aria-hidden className="mx-auto text-s-muted" />
      <p className="mt-2 font-medium">{count > 0 ? t('lockedCount', { n: count }) : t('lockedTitle')}</p>
      <p className="mx-auto mt-1 max-w-lg text-sm text-s-muted">{lead ?? t('lockedLead')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <a href={REGISTER_HREF} className={primary}>{t('lockedCta')}</a>
        <a href={SIGNIN_HREF} className="text-sm underline underline-offset-4">{t('lockedSignIn')}</a>
      </div>
    </div>
  );
}
