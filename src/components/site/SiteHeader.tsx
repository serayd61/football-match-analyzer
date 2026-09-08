'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { legacyHref } from '@/lib/site/legacy';
import { signOut, useSession } from 'next-auth/react';
import { Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import Wordmark from './Wordmark';
import LocaleSwitcher from './LocaleSwitcher';
import ThemeToggle from './ThemeToggle';

const NAV: Array<{ href: string; key: 'predictions' | 'results' | 'performance' | 'leagues' | 'methodology' }> = [
  { href: '/predictions', key: 'predictions' },
  { href: '/results', key: 'results' },
  { href: '/performance', key: 'performance' },
  { href: '/leagues', key: 'leagues' },
  { href: '/methodology', key: 'methodology' },
];

// Denetim 2026-09-05 (P2): at 768–1023px the desktop nav + locale/theme/login
// row measured ~885px and pushed the page into horizontal scroll (TR/DE labels
// are long). The desktop layout now opens at `lg`; the menu button serves md.
export default function SiteHeader() {
  const t = useTranslations('nav');
  const locale = useLocale();
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  // The dashboard is localized; login is a legacy (unlocalized) route.
  // Signed out: a quiet sign-in link plus the one filled button on the page
  // ("start free" → register tab). Signed in: the dashboard.
  const authed = status === 'authenticated';
  const authCls = 'h-8 inline-flex items-center rounded-sm bg-s-brand px-3 text-sm font-medium text-s-brand-ink hover:opacity-90';
  const AuthLink = ({ className }: { className: string }) =>
    authed ? (
      <span className="inline-flex items-center gap-3">
        <Link href="/dashboard" className={className}>{t('dashboard')}</Link>
        {/* 2026-09-08: account page — plan, billing, settings. */}
        <Link href="/account" className="text-sm text-s-muted hover:text-s-ink">{t('account')}</Link>
        {/* 2026-09-07: sign-out only existed on the legacy profile page. */}
        <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-s-muted hover:text-s-ink">{t('signOut')}</button>
      </span>
    ) : (
      <span className="inline-flex items-center gap-3">
        <a href={legacyHref('/login', locale)} className="text-sm text-s-muted hover:text-s-ink">{t('signIn')}</a>
        <a href={legacyHref('/login?mode=register', locale)} className={className}>{t('signUp')}</a>
      </span>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-s-line bg-s-surface/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-s-ink">
          <Wordmark />
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-2" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm rounded-sm border-b-2 -mb-px ${
                isActive(n.href)
                  ? 'border-s-accent text-s-ink font-medium'
                  : 'border-transparent text-s-muted hover:text-s-ink'
              }`}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden lg:flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <AuthLink className={authCls} />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-sm border border-s-line"
          aria-label={open ? t('close') : t('menu')}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div id="site-mobile-nav" className="lg:hidden border-t border-s-line bg-s-surface">
          <nav className="flex flex-col px-2 py-2" aria-label="Primary">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? 'page' : undefined}
                className={`px-3 py-2.5 text-base rounded-sm ${isActive(n.href) ? 'bg-s-raised font-medium' : 'text-s-muted'}`}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-t border-s-line px-4 py-3">
            <LocaleSwitcher />
            <ThemeToggle />
            <AuthLink className={`ml-auto ${authCls}`} />
          </div>
        </div>
      )}
    </header>
  );
}
