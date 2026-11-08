// Mobil LCP (ölçüm 2026-11-08): Next <Link> görüş alanına giren her bağlantı
// için RSC yükü ön yüklüyordu — anonim bir ziyarette /en/matches 18,7 KB ve
// /en/leagues 13,2 KB, yani ~32 KB kritik yolla yarışıyordu. Arama trafiğinden
// gelen ziyaretçi çoğunlukla tek sayfa görüyor; sabit gezinti (başlık, alt
// bilgi, mobil sekme çubuğu) ön yüklemesi bedava değil. prefetch={false} ile
// gezinti hâlâ istemci tarafı, yalnız tıklayınca indiriyor.
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Wordmark from './Wordmark';
import LocaleLinks from './LocaleLinks';
import FooterPricingLink from './FooterPricingLink';
import FooterAppLink from './FooterAppLink';
import FooterAppActions from './FooterAppActions';
import FooterSocial from './FooterSocial';

// Footer v3: brand + one-line disclaimer, link columns, language.
// SEO Faz 0 (2026-10-17): the product column links the public /matches hub (not the
// members-only /predictions, which 307'd every crawler to /login), /contact is on the
// localized site, the language switch is a row of crawlable <a hreflang> links, and the
// responsible-gambling block is gone — the site offers no betting and links to no
// bookmaker, and that copy is exactly what classifies a site as "gambling".
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
          <Link href="/matches" className="hover:text-s-ink" prefetch={false}>{nav('matches')}</Link>
          <Link href="/performance" className="hover:text-s-ink" prefetch={false}>{nav('performance')}</Link>
          <Link href="/leagues" className="hover:text-s-ink" prefetch={false}>{nav('leagues')}</Link>
          <Link href="/teams" className="hover:text-s-ink" prefetch={false}>{nav('teams')}</Link>
          <Link href="/methodology" className="hover:text-s-ink" prefetch={false}>{nav('methodology')}</Link>
          <Link href="/glossary" className="hover:text-s-ink" prefetch={false}>{nav('glossary')}</Link>
          <Link href="/data" className="hover:text-s-ink" prefetch={false}>{nav('data')}</Link>
          <FooterPricingLink label={nav('pricing')} />
        </nav>
        <nav className="flex flex-col gap-2" aria-label="Company">
          <Link href="/about" className="hover:text-s-ink" prefetch={false}>{nav('about')}</Link>
          <FooterAppLink label={nav('app')} />
          <Link href="/terms" className="hover:text-s-ink" prefetch={false}>{t('terms')}</Link>
          <Link href="/privacy" className="hover:text-s-ink" prefetch={false}>{t('privacy')}</Link>
          <Link href="/contact" className="hover:text-s-ink" prefetch={false}>{t('contact')}</Link>
          <a href="https://t.me/fanalytics_pro" target="_blank" rel="noopener noreferrer" className="hover:text-s-ink">{t('telegram')}</a>
          <a href="https://www.instagram.com/_footballanalyticspro/" target="_blank" rel="noopener noreferrer" className="hover:text-s-ink">{t('instagram')}</a>
          <div className="mt-2"><LocaleLinks /></div>
        </nav>
      </div>
      <FooterSocial />
      <FooterAppActions />
      <div className="border-t border-s-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-5 text-[12.5px] leading-relaxed sm:px-6">
          <p>{t('compliance')}</p>
        </div>
      </div>
    </footer>
  );
}
