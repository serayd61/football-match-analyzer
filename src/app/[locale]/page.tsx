import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Page } from '@/components/site/ui';

// Phase-1 placeholder. The real home (today's fixtures, accuracy summary,
// latest settled predictions, how-it-works) lands in phase 2, step 5.
export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  unstable_setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <Page>
      <section className="max-w-3xl py-16 sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-wider text-s-muted">{t('eyebrow')}</p>
        <h1 className="mt-2 text-5xl sm:text-6xl">{t('title')}</h1>
        <p className="mt-4 max-w-xl text-lg text-s-muted">{t('lead')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/predictions" className="inline-flex h-10 items-center rounded-sm bg-s-brand px-4 font-medium text-s-brand-ink hover:opacity-90">
            {t('cta')}
          </Link>
          <Link href="/methodology" className="inline-flex h-10 items-center rounded-sm border border-s-line px-4 font-medium hover:border-s-muted">
            {t('ctaSecondary')}
          </Link>
        </div>
      </section>
    </Page>
  );
}
