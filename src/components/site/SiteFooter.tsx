import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Wordmark from './Wordmark';
import LocaleSwitcher from './LocaleSwitcher';
import FooterPricingLink from './FooterPricingLink';

// Footer v3: brand + one-line disclaimer, link columns, language.
export default async function SiteFooter() {
  const t = await getTranslations('v2.footer');
  const nav = await getTranslations('nav');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-s-line bg-s-surface text-[13.5px] text-s-muted">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <span className="text-s-ink"><Wordmark compact /></span>
          <p className="max-w-[46ch] leading-relaxed">{t('line', { year })}</p>
        </div>
        <nav className="flex flex-col gap-2" aria-label="Product">
          <Link href="/predictions" className="hover:text-s-ink">{nav('predictions')}</Link>
          <Link href="/performance" className="hover:text-s-ink">{nav('performance')}</Link>
          <Link href="/leagues" className="hover:text-s-ink">{nav('leagues')}</Link>
          <Link href="/methodology" className="hover:text-s-ink">{nav('methodology')}</Link>
          <FooterPricingLink label={nav('pricing')} />
        </nav>
        <nav className="flex flex-col gap-2" aria-label="Company">
          <Link href="/about" className="hover:text-s-ink">{nav('about')}</Link>
          <Link href="/terms" className="hover:text-s-ink">{t('terms')}</Link>
          <Link href="/privacy" className="hover:text-s-ink">{t('privacy')}</Link>
          <a href="/contact" className="hover:text-s-ink">{t('contact')}</a>
          <div className="mt-2"><LocaleSwitcher /></div>
        </nav>
      </div>
      <div className="border-t border-s-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-5 text-[12.5px] leading-relaxed sm:px-6">
          <p>{t('compliance')}</p>
          <p>
            {t('help')}{' '}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-s-ink">begambleaware.org</a>
            {' · '}
            <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" className="underline hover:text-s-ink">gamcare.org.uk</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
