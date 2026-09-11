// Members-only surfaces (2026-09-08, restyled 2026-09-11). Server components.
//   <Paywall/>      — the page body for an account whose 7-day trial is over.
//   <TrialNotice/>  — one line above gated content while the trial runs.
//   <LockedBlock/>  — landing-page stand-in for a table an anonymous visitor
//                     must not see (count only, sign-up CTA).
//   <LockedPick/>   — the blurred pick text + "Unlock with Pro →" link used on
//                     prediction cards and the match page.
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { SiteAccess } from '@/lib/site/access';
import { RiskNote } from './Risk';

// Account and billing now live on the localized site.
export const REGISTER_HREF = '/login?mode=register';
export const SIGNIN_HREF = '/login';
export const PRICING_HREF = '/pricing';

export async function Paywall() {
  const t = await getTranslations('paywall');
  return (
    <section className="rule-t rule-b my-8 grid gap-6 py-8 lg:grid-cols-[1fr_1fr]" aria-labelledby="paywall-title">
      <div>
        <p className="kicker">{t('expiredKicker')}</p>
        <h2 id="paywall-title" className="mt-2 text-[30px]">{t('expiredTitle')}</h2>
        <p className="mt-3 max-w-xl text-[15px] text-s-muted">{t('expiredLead')}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={PRICING_HREF} className="btn btn-primary">{t('expiredCta')}</Link>
          <Link href="/performance" className="btn btn-secondary">{t('expiredAlt')}</Link>
        </div>
      </div>
      <RiskNote className="max-w-md self-end lg:justify-self-end">{t('expiredNote')}</RiskNote>
    </section>
  );
}

export async function TrialNotice({ access }: { access: SiteAccess }) {
  if (access.state !== 'trial') return null;
  const t = await getTranslations('paywall');
  return (
    <p role="status" className="rule-t-1 rule-b-1 mb-3 flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
      <span>{t('trialLeft', { days: access.trialDaysLeft })}</span>
      <Link href={PRICING_HREF} className="font-semibold text-s-accent hover:text-s-accent-600">{t('trialCta')} →</Link>
    </p>
  );
}

export async function LockedBlock({ count, lead }: { count: number; lead?: string }) {
  const t = await getTranslations('paywall');
  return (
    <div className="rule-b-1 mt-3 grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-end">
      <div>
        <p className="text-[20px] font-extrabold">{count > 0 ? t('lockedCount', { n: count }) : t('lockedTitle')}</p>
        <p className="mt-1 max-w-lg text-[14px] text-s-muted">{lead ?? t('lockedLead')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={REGISTER_HREF} className="btn btn-primary">{t('lockedCta')}</Link>
        <Link href={SIGNIN_HREF} className="text-sm font-semibold hover:text-s-accent-600">{t('lockedSignIn')}</Link>
      </div>
    </div>
  );
}

export async function LockedPick({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const t = await getTranslations('paywall');
  return (
    <span className="flex flex-col gap-1">
      <span aria-hidden className={`blur-locked ${size === 'lg' ? 'text-[24px] font-extrabold' : 'text-[13px] font-semibold'}`} style={size === 'lg' ? { filter: 'blur(6px)' } : undefined}>{t('hiddenPick')}</span>
      <span className="sr-only">{t('hiddenPick')}</span>
      <Link href={PRICING_HREF} className={`font-semibold text-s-accent hover:text-s-accent-600 ${size === 'lg' ? 'btn btn-primary btn-block mt-2 !text-s-brand-ink' : 'text-[12px]'}`}>{size === 'lg' ? t('unlockLong') : t('unlock')}</Link>
    </span>
  );
}
