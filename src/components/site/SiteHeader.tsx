'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { signOut, useSession } from 'next-auth/react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import Wordmark from './Wordmark';
import LocaleSwitcher from './LocaleSwitcher';
import ThemeToggle from './ThemeToggle';

// Header v3 (2026-09-26): 60px, sticky, translucent. Brand · Today's matches /
// Record / Leagues / Pricing · right: language, theme, auth. On < lg the nav
// collapses to a sheet; primary sections are also in the mobile tab bar.
const NAV: Array<{ href: string; key: 'predictions' | 'performance' | 'leagues' | 'pricing' }> = [
  { href: '/predictions', key: 'predictions' },
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
        <Link href="/" className="shrink-0 text-s-ink" aria-label="footballanalytics.pro">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-[14.5px] font-semibold leading-none transition-colors ${isActive(n.href) ? 'bg-s-raised text-s-ink' : 'text-s-muted hover:bg-s-raised/70 hover:text-s-ink'}`}
            >
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
                  <Link role="menuitem" href="/dashboard" className="block rounded-lg px-3 py-2 text-[14px] font-medium hover:bg-s-raised">{t('dashboard')}</Link>
                  <Link role="menuitem" href="/account" className="block rounded-lg px-3 py-2 text-[14px] font-medium hover:bg-s-raised">{t('account')}</Link>
                  <button role="menuitem" type="button" onClick={() => signOut({ callbackUrl: '/' })} className="block w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium text-s-muted hover:bg-s-raised hover:text-s-ink">{t('signOut')}</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">{t('signIn')}</Link>
              <Link href="/login?mode=register" className="btn btn-primary btn-sm" data-cta="header">{t('tryFree')}</Link>
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
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? 'page' : undefined}
                className={`rounded-lg px-3 py-2.5 text-[16px] font-semibold ${isActive(n.href) ? 'bg-s-raised' : 'hover:bg-s-raised/70'}`}
              >
                {t(n.key)}
              </Link>
            ))}
            {authed ? (
              <>
                <Link href="/dashboard" className="rounded-lg px-3 py-2.5 text-[16px] font-semibold hover:bg-s-raised/70">{t('dashboard')}</Link>
                <Link href="/account" className="rounded-lg px-3 py-2.5 text-[16px] font-semibold hover:bg-s-raised/70">{t('account')}</Link>
              </>
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
                  <Link href="/login" className="btn btn-sm btn-secondary">{t('signIn')}</Link>
                  <Link href="/login?mode=register" className="btn btn-sm btn-primary">{t('tryFree')}</Link>
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
