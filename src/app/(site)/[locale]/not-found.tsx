import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Page } from '@/components/site/ui';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <Page>
      <div className="max-w-xl py-24">
        <p className="text-xs font-semibold uppercase tracking-wider text-s-muted">404</p>
        <h1 className="mt-2 text-4xl">{t('notFoundTitle')}</h1>
        <p className="mt-3 text-s-muted">{t('notFoundLead')}</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-sm bg-s-brand px-4 font-medium text-s-brand-ink">
          {t('home')}
        </Link>
      </div>
    </Page>
  );
}
