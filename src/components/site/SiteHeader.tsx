'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { signOut, useSession } from 'next-auth/react';
import { Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import Wordmark from './Wordmark';
import LocaleSwitcher from './LocaleSwitcher';
import ThemeToggle from './ThemeToggle';

// Header (design 2026-09-11): sticky, page bg, bottom 2px rule, 24px gutters,
// 56px tall. Brand · nav Home / Predictions / Performance / Pricing (active =
// accent) · right: primary "Sign in". Below `lg` the nav becomes a menu button.
// Görsel yenileme 2026-09-19: "Ana sayfa" yerine ana sayfadaki gerçek bölüme giden
// "Nasıl çalışır"; sağda sakin "Giriş yap" + tek belirgin deneme CTA'sı (aynı kayıt akışı).
const NAV: Array<{ href: string; key: 'how' | 'predictions' | 'performance' | 'pricing' }> = [
  { href: '/#how', key: 'how' },
  { href: '/predictions', key: 'predictions' },
  { href: '/performance', key: 'performance' },
  { href: '/pricing', key: 'pricing' },
];

export default function SiteHeader() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { status } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (href: string) => (href.includes('#') ? false : pathname === href || pathname.startsWith(href + '/'));
  const authed = status === 'authenticated';

  const AuthLinks = ({ block = false }: { block?: boolean }) =>
    authed ? (
      <span className={`inline-flex items-center gap-3 ${block ? 'w-full justify-between' : ''}`}>
        <Link href="/dashboard" className="btn btn-primary btn-sm">{t('dashboard')}</Link>
        <Link href="/account" className="text-sm text-s-muted hover:text-s-ink">{t('account')}</Link>
        <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-s-muted hover:text-s-ink">{t('signOut')}</button>
      </span>
    ) : (
      <span className={`inline-flex items-center gap-2 ${block ? 'w-full justify-between' : ''}`}>
        <Link href="/login" className="btn btn-ghost btn-sm">{t('signIn')}</Link>
        <Link href="/login?mode=register" className="btn btn-primary btn-sm" data-cta="header">{t('tryFree')}</Link>
      </span>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-s-line bg-s-bg/90 backdrop-blur supports-[backdrop-filter]:bg-s-bg/80">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-7 px-5 sm:px-8">
        <Link href="/" className="shrink-0 text-s-ink">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? 'page' : undefined}
              className={`whitespace-nowrap text-[15px] font-medium leading-none hover:text-s-accent-700 ${isActive(n.href) ? 'text-s-accent-700' : 'text-s-ink'}`}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 xl:flex">
          <LocaleSwitcher />
          <ThemeToggle />
          <AuthLinks />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-lg border border-s-n400 xl:hidden"
          aria-label={open ? t('close') : t('menu')}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div id="site-mobile-nav" className="border-t border-s-line bg-s-bg xl:hidden">
          <nav className="divide-rule flex flex-col px-6" aria-label="Primary">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? 'page' : undefined}
                className={`py-3 text-[16px] font-semibold ${isActive(n.href) ? 'text-s-accent' : ''}`}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="rule-t-1 flex flex-wrap items-center gap-3 px-6 py-3">
            <LocaleSwitcher />
            <ThemeToggle />
            <span className="ml-auto"><AuthLinks /></span>
          </div>
        </div>
      )}
    </header>
  );
}
