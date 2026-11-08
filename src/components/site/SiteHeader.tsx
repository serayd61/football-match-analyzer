// Mobil LCP (ölçüm 2026-11-08): Next <Link> görüş alanına giren her bağlantı
// için RSC yükü ön yüklüyordu — anonim bir ziyarette /en/matches 18,7 KB ve
// /en/leagues 13,2 KB, yani ~32 KB kritik yolla yarışıyordu. Arama trafiğinden
// gelen ziyaretçi çoğunlukla tek sayfa görüyor; sabit gezinti (başlık, alt
// bilgi, mobil sekme çubuğu) ön yüklemesi bedava değil. prefetch={false} ile
// gezinti hâlâ istemci tarafı, yalnız tıklayınca indiriyor.
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { signOut, useSession } from 'next-auth/react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import Wordmark from './Wordmark';
import LocaleSwitcher from './LocaleSwitcher';
import ThemeToggle from './ThemeToggle';
import { useIsTwa } from '@/lib/site/twa-client';

// Header v3 (2026-09-26): 60px, sticky, translucent. Brand · Today's matches /
// Record / Leagues / Pricing · right: language, theme, auth. On < lg the nav
// collapses to a sheet; primary sections are also in the mobile tab bar.
// "Uyan maçlar" (2026-10-08): günün karneye uyan seçimleri; üyelik ister, sayfa kendi yönlendirir.
// SEO 2026-10-10: oturumu olmayan ziyaretçi "Tahminler" yerine herkese açık "Maçlar" (/matches) görür;
// üye akışı değişmez. Oturum durumu istemcide okunur, bu yüzden ilk boyama "Maçlar"dır.
// Genel bakış (overview-1.0, 2026-11-03): üye için "Panel" ana menüye çıktı — hesap menüsünün içinde
// saklıydı; kullanıcı geri bildirimi "aradığımı bulmak için uğraşıyorum" idi. Ziyaretçi görmez.
const NAV: Array<{ href: string; key: 'dashboard' | 'predictions' | 'picks' | 'coupon' | 'performance' | 'leagues' | 'pricing' | 'matches' }> = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/predictions', key: 'predictions' },
  { href: '/picks', key: 'picks' },
  { href: '/coupon', key: 'coupon' },
  { href: '/performance', key: 'performance' },
  { href: '/leagues', key: 'leagues' },
  { href: '/pricing', key: 'pricing' },
];

export default function SiteHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  // Google Play app: no "Pricing" entry (Play payments policy, lib/site/twa.ts).
  const twa = useIsTwa();
  const authedNav = status === 'authenticated';
  const base = authedNav ? NAV : NAV.flatMap((n) => (n.key === 'predictions' ? [{ href: '/matches', key: 'matches' as const }] : n.key === 'picks' || n.key === 'coupon' || n.key === 'dashboard' ? [] : [n]));
  const nav = twa ? base.filter((n) => n.key !== 'pricing') : base;

  useEffect(() => { setOpen(false); setMenu(false); }, [pathname]);
  useEffect(() => {
    if (!open && !menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setMenu(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, menu]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const authed = status === 'authenticated';

  return (
    <header className="sticky top-0 z-40 border-b border-s-line bg-s-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-s-ink" aria-label="footballanalytics.pro" prefetch={false}>
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-[14.5px] font-semibold leading-none transition-colors ${isActive(n.href) ? 'bg-s-raised text-s-ink' : 'text-s-muted hover:bg-s-raised/70 hover:text-s-ink'}`} prefetch={false}>
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <LocaleSwitcher />
          <ThemeToggle />
          {authed ? (
            <div className="relative ml-1">
              <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu" className="btn btn-sm btn-secondary !gap-1.5">
                {t('account')} <ChevronDown size={14} className={`transition-transform ${menu ? 'rotate-180' : ''}`} />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-s-line bg-s-surface p-1 shadow-[var(--s-shadow)]">
                  <Link role="menuitem" href="/dashboard" className="block rounded-lg px-3 py-2 text-[14px] font-medium hover:bg-s-raised" prefetch={false}>{t('dashboard')}</Link>
                  <Link role="menuitem" href="/account" className="block rounded-lg px-3 py-2 text-[14px] font-medium hover:bg-s-raised" prefetch={false}>{t('account')}</Link>
                  <button role="menuitem" type="button" onClick={() => signOut({ callbackUrl: '/' })} className="block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium text-s-muted hover:bg-s-raised hover:text-s-ink">{t('signOut')}</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" rel="nofollow" className="btn btn-ghost btn-sm" prefetch={false}>{t('signIn')}</Link>
              <Link href="/login?mode=register" rel="nofollow" className="btn btn-primary btn-sm" data-cta="header" prefetch={false}>{t('tryFree')}</Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg border border-s-line bg-s-surface lg:hidden"
          aria-label={open ? t('close') : t('menu')}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div id="site-mobile-nav" className="border-t border-s-line bg-s-bg lg:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3" aria-label="Primary">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? 'page' : undefined}
                className={`rounded-lg px-3 py-2.5 text-[16px] font-semibold ${isActive(n.href) ? 'bg-s-raised' : 'hover:bg-s-raised/70'}`} prefetch={false}>
                {t(n.key)}
              </Link>
            ))}
            {authed ? (
              <Link href="/account" className="rounded-lg px-3 py-2.5 text-[16px] font-semibold hover:bg-s-raised/70" prefetch={false}>{t('account')}</Link>
            ) : null}
          </nav>
          <div className="rule-t-1 flex flex-wrap items-center gap-2 px-4 py-3">
            <LocaleSwitcher />
            <ThemeToggle />
            <span className="ml-auto flex items-center gap-2">
              {authed ? (
                <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="btn btn-sm btn-secondary">{t('signOut')}</button>
              ) : (
                <>
                  <Link href="/login" rel="nofollow" className="btn btn-sm btn-secondary" prefetch={false}>{t('signIn')}</Link>
                  <Link href="/login?mode=register" rel="nofollow" className="btn btn-sm btn-primary" prefetch={false}>{t('tryFree')}</Link>
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
