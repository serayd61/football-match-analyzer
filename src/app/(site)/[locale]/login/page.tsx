import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import DemoAnalysis from '@/components/site/DemoAnalysis';
import { redirect } from 'next/navigation';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { alternatesFor } from '@/lib/site/seo';
import { Page } from '@/components/site/ui';
import { RiskNote } from '@/components/site/Risk';
import { getSiteAccess } from '@/lib/site/access';
import { legacyHref } from '@/lib/site/legacy';
import LoginForm from './LoginForm';

// Sign in (Modernist redesign 2026-09-11), localized. Grid 1fr / 1fr with a
// 2px vertical rule: claim + age note on the left, the form on the right
// (max 480px). `?mode=register` opens the account form; `?callbackUrl=`
// is honoured after sign-in (same contract as the legacy /login).
export const dynamic = 'force-dynamic';

type Search = { callbackUrl?: string; mode?: string; error?: string };

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'v2.login' });
  return { title: t('title'), description: t('lead'), alternates: alternatesFor(locale as Locale, '/login'), robots: { index: false } };
}

// Only same-origin paths are accepted as a return target.
function safeCallback(raw: string | undefined, locale: string): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return `/${locale}/dashboard`;
}

export default async function LoginPage({ params: { locale }, searchParams }: { params: { locale: string }; searchParams: Search }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('v2.login');
  const tl = await getTranslations('v2.landing');
  const callbackUrl = safeCallback(searchParams.callbackUrl, locale);
  const access = await getSiteAccess();
  if (access.state !== 'anon') redirect(callbackUrl);
  const register = searchParams.mode === 'register';

  return (
    <Page>
      <div className="grid items-start gap-8 py-10 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-14 lg:py-16">
        <div className="card !gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] sm:text-[32px]">{register ? t('titleRegister') : t('title')}</h1>
            <p className="text-[15px] text-s-muted">{register ? t('leadRegister') : t('lead')}</p>
          </div>
          <LoginForm
            locale={locale}
            callbackUrl={callbackUrl}
            initialMode={register ? 'register' : 'signin'}
            forgotHref={legacyHref('/forgot-password', locale)}
            labels={{
              name: t('name'), email: t('email'), password: t('password'), signIn: t('signIn'), register: t('register'), google: t('google'),
              noAccount: t('noAccount'), startFree: t('startFree'), hasAccount: t('hasAccount'), signInLink: t('signInLink'), forgot: t('forgot'),
              processing: t('processing'), errorInvalid: t('errorInvalid'), errorGeneral: t('errorGeneral'), or: t('or'),
            }}
          />
        </div>
        <aside className="flex flex-col gap-6">
          <ul className="flex flex-col gap-3 text-[15px]">
            {[tl('show1T'), tl('show2T'), tl('show3T')].map((b) => (
              <li key={b} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-s-win" aria-hidden />{b}</li>
            ))}
          </ul>
          <div className="max-w-[460px]"><DemoAnalysis /></div>
          <RiskNote className="max-w-[460px]">{t('note')}</RiskNote>
        </aside>
      </div>
    </Page>
  );
}
