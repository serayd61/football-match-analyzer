import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import LocaleSwitcher from './LocaleSwitcher';

// Footer (design 2026-09-11): top 2px rule, 12px muted line
// "© 2026 footballanalytics.pro · Predictions are statistical estimates, not
// financial advice. 18+ · Play responsibly." + links Methodology / Terms /
// Privacy. Leagues / About / Contact stay reachable here too.
export default async function SiteFooter() {
  const t = await getTranslations('v2.footer');
  const nav = await getTranslations('nav');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-0 border-t border-s-line bg-s-surface text-[13px] text-s-muted">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-8 sm:px-8">
        <span className="max-w-3xl">{t('line', { year })}</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-3" aria-label="Footer">
          <Link href="/methodology" className="hover:text-s-ink">{nav('methodology')}</Link>
          <Link href="/leagues" className="hover:text-s-ink">{nav('leagues')}</Link>
          <Link href="/about" className="hover:text-s-ink">{nav('about')}</Link>
          <Link href="/terms" className="hover:text-s-ink">{t('terms')}</Link>
          <Link href="/privacy" className="hover:text-s-ink">{t('privacy')}</Link>
          <a href="/contact" className="hover:text-s-ink">{t('contact')}</a>
          <LocaleSwitcher />
        </nav>
      </div>
    </footer>
  );
}
