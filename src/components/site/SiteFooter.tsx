import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Wordmark from './Wordmark';
import LocaleSwitcher from './LocaleSwitcher';

export default async function SiteFooter() {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-s-line bg-s-surface text-sm">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr_auto]">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-sm text-s-muted">{t('dataSourceText')}</p>
        </div>
        <div>
          <h2 className="font-body text-xs font-semibold uppercase tracking-wider text-s-muted">{t('responsible')}</h2>
          <p className="mt-2 max-w-sm text-s-muted">{t('responsibleText')}</p>
        </div>
        <div>
          <h2 className="font-body text-xs font-semibold uppercase tracking-wider text-s-muted">{t('links')}</h2>
          <ul className="mt-2 space-y-1.5">
            <li><Link href="/methodology" className="inline-block py-1 hover:underline underline-offset-4">{nav('methodology')}</Link></li>
            <li><Link href="/about" className="inline-block py-1 hover:underline underline-offset-4">{nav('about')}</Link></li>
            <li><Link href="/privacy" className="inline-block py-1 hover:underline underline-offset-4">{t('privacy')}</Link></li>
            <li><Link href="/terms" className="inline-block py-1 hover:underline underline-offset-4">{t('terms')}</Link></li>
            <li><a href="/contact" className="inline-block py-1 hover:underline underline-offset-4">{t('contact')}</a></li>
          </ul>
        </div>
        <div className="md:justify-self-end">
          <LocaleSwitcher />
        </div>
      </div>
      <div className="border-t border-s-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-s-muted sm:px-6">
          <span>{t('rights', { year })}</span>
          <span>18+</span>
        </div>
      </div>
    </footer>
  );
}
