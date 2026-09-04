'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Page } from '@/components/site/ui';

// No stack traces for visitors: a plain message and a retry. The error itself
// goes to the console (and Vercel runtime logs) for us.
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  useEffect(() => { console.error('[site]', error); }, [error]);

  return (
    <Page>
      <div className="max-w-xl py-24">
        <h1 className="text-4xl">{t('title')}</h1>
        <p className="mt-3 text-s-muted">{t('lead')}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center rounded-sm bg-s-brand px-4 font-medium text-s-brand-ink"
        >
          {t('retry')}
        </button>
      </div>
    </Page>
  );
}
