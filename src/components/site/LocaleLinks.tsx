'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { routing, LOCALE_LABELS } from '@/i18n/routing';

// SEO Faz 0 (2026-10-17): crawlable language links. The header keeps the <select>
// (LocaleSwitcher); a <select> is invisible to crawlers, so the footer renders one
// plain <a hreflang> per locale pointing at the same locale-free path. Client
// component only to read the pathname — it is server-rendered into the HTML.
export default function LocaleLinks({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('locale');
  const pathname = usePathname();
  const path = pathname === '/' ? '' : pathname;
  return (
    <nav aria-label={t('label')} className={`flex flex-wrap gap-x-3 gap-y-1 text-[13px] ${className}`}>
      {routing.locales.map((l) => (
        <a
          key={l}
          href={`/${l}${path}`}
          hrefLang={l}
          lang={l}
          aria-current={l === locale ? 'true' : undefined}
          className={l === locale ? 'font-semibold text-s-ink' : 'hover:text-s-ink'}
        >
          {LOCALE_LABELS[l]}
        </a>
      ))}
    </nav>
  );
}
