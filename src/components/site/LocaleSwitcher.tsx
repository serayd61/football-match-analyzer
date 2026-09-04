'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, LOCALE_LABELS, type Locale } from '@/i18n/routing';

export default function LocaleSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('locale');
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Locale;
    // Same route, other locale. Dynamic segments come from useParams.
    router.replace(
      // @ts-expect-error — pathname/params pairing is validated at runtime by next-intl
      { pathname, params },
      { locale: next },
    );
  }

  return (
    <label className={`inline-flex items-center gap-1.5 text-sm ${className}`}>
      <span className="sr-only">{t('label')}</span>
      <select
        value={locale}
        onChange={onChange}
        aria-label={t('label')}
        className="h-8 rounded-sm border border-s-line bg-s-surface px-2 text-sm text-s-ink hover:border-s-muted"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
        ))}
      </select>
    </label>
  );
}
