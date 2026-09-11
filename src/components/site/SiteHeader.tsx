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
const NAV: Array<{ href: string; key: 'home' | 'predictions' | 'performance' | 'pricing' }> = [
  { href: '/', key: 'home' },
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

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
  const authed = status === 'authenticated';

  const AuthLinks = ({ block = false }: { block?: boolean }) =>
    authed ? (
      <span className={`inline-flex items-center gap-3 ${block ? 'w-full justify-between' : ''}`}>
        <Link href="/dashboard" className="btn btn-primary btn-sm">{t('dashboard')}</Link>
        <Link href="/account" className="text-sm text-s-muted hover:text-s-ink">{t('account')}</Link>
        <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-s-muted hover:text-s-ink">{t('signOut')}</button>
      </span>
    ) : (
      <Link href="/login" className={`btn btn-primary btn-sm ${block ? 'btn-block' : ''}`}>{t('signIn')}</Link>
    );

  return (
    <header className="rule-b sticky top-0 z-40 bg-s-bg">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-6">
        <Link href="/" className="shrink-0 text-s-ink">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? 'page' : undefined}
              className={`text-[14px] font-semibold leading-none hover:text-s-accent-600 ${isActive(n.href) ? 'text-s-accent' : 'text-s-ink'}`}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <LocaleSwitcher />
          <ThemeToggle />
          <AuthLinks />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center border-2 border-s-ink lg:hidden"
          aria-label={open ? t('close') : t('menu')}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div id="site-mobile-nav" className="rule-t bg-s-bg lg:hidden">
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
