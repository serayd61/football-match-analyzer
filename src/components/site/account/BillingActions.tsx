'use client';

// Account page buttons that talk to Stripe through our own routes:
//   checkout → /api/stripe/create-checkout (monthly plan) → Stripe Checkout
//   portal   → /api/stripe/portal → Stripe customer portal (card, invoices, cancel)
// plus sign-out. Errors are shown inline; nothing is optimistic.
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';

const primary = 'inline-flex h-10 items-center rounded-[2px] bg-s-brand px-4 text-sm font-medium text-s-brand-ink hover:opacity-90 disabled:opacity-60';
const secondary = 'inline-flex h-10 items-center rounded-[2px] border border-s-line px-4 text-sm font-medium hover:border-s-muted disabled:opacity-60';

export function StripeButton({ kind, variant = 'primary' }: { kind: 'checkout' | 'portal'; variant?: 'primary' | 'secondary' }) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(kind === 'checkout' ? '/api/stripe/create-checkout' : '/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'checkout' ? { plan: 'PRO' } : { returnPath: `/${locale}/account` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || `HTTP ${res.status}`);
      window.location.assign(data.url);
    } catch (e: any) {
      setError(e?.message || t('actionFailed'));
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={go} disabled={busy} className={variant === 'primary' ? primary : secondary}>
        {busy ? t('opening') : kind === 'checkout' ? t('startSubscription') : t('manageSubscription')}
      </button>
      {error && <span role="alert" className="text-xs text-s-loss">{error}</span>}
    </span>
  );
}

export function SignOutButton() {
  const t = useTranslations('account');
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className={secondary}>
      {t('signOut')}
    </button>
  );
}
