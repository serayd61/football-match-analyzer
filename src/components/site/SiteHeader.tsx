'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  // Legacy app routes are not localized — plain anchors on purpose.
  const authHref = status === 'authenticated' ? '/dashboard' : '/login';
  const authLabel = status === 'authenticated' ? t('dashboard') : t('signIn');

  return (
    <header className="sticky top-0 z-40 border-b border-s-line bg-s-surface/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-s-ink" aria-label="Football Analytics">
          <Wordmark />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2" aria-label="Primary">
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

        <div className="ml-auto hidden md:flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <a
            href={authHref}
            className="h-8 inline-flex items-center rounded-sm bg-s-brand px-3 text-sm font-medium text-s-brand-ink hover:opacity-90"
          >
            {authLabel}
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto md:hidden inline-flex h-9 w-9 items-center justify-center rounded-sm border border-s-line"
          aria-label={open ? t('close') : t('menu')}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div id="site-mobile-nav" className="md:hidden border-t border-s-line bg-s-surface">
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
            <a href={authHref} className="ml-auto h-8 inline-flex items-center rounded-sm bg-s-brand px-3 text-sm font-medium text-s-brand-ink">
              {authLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
