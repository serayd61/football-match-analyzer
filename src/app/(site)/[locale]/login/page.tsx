import type { Metadata } from 'next';
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
  const callbackUrl = safeCallback(searchParams.callbackUrl, locale);
  const access = await getSiteAccess();
  if (access.state !== 'anon') redirect(callbackUrl);
  const register = searchParams.mode === 'register';

  return (
    <Page>
      <div className="grid min-h-[60vh] lg:grid-cols-2">
        <div className="flex flex-col gap-4 py-8 lg:rule-r lg:pr-6">
          <h1 className="text-[clamp(36px,5vw,60px)]">{register ? t('titleRegister') : t('title')}</h1>
          <p className="max-w-[440px] text-[16px] text-s-muted">{register ? t('leadRegister') : t('lead')}</p>
          <RiskNote className="mt-2 max-w-[440px]">{t('note')}</RiskNote>
        </div>
        <div className="rule-t py-8 lg:rule-t-0 lg:pl-6">
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
      </div>
    </Page>
  );
}
