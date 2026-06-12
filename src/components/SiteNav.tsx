'use client';

// ============================================================================
// SiteNav — shared clean top nav for public content pages
// (predictions, live, pricing, contact). Session-aware. Scoped under `.fa-shell`.
// The global neon <Navigation/> is excluded on these routes.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Menu, X, LayoutDashboard } from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/components/LanguageProvider';

const LABELS: Record<string, { home: string; predictions: string; live: string; pricing: string; contact: string; signin: string; start: string; dashboard: string }> = {
  tr: { home: 'Ana Sayfa', predictions: 'Tahminler', live: 'Canlı', pricing: 'Fiyatlandırma', contact: 'İletişim', signin: 'Giriş Yap', start: 'Ücretsiz Başla', dashboard: 'Panel' },
  en: { home: 'Home', predictions: 'Predictions', live: 'Live', pricing: 'Pricing', contact: 'Contact', signin: 'Sign in', start: 'Start free', dashboard: 'Dashboard' },
  de: { home: 'Start', predictions: 'Vorhersagen', live: 'Live', pricing: 'Preise', contact: 'Kontakt', signin: 'Anmelden', start: 'Kostenlos starten', dashboard: 'Dashboard' },
};

export default function SiteNav() {
  const { lang } = useLanguage();
  const { data: session } = useSession();
  const pathname = usePathname();
  const l = LABELS[lang] || LABELS.en;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '/', label: l.home },
    { href: '/tahminler', label: l.predictions },
    { href: '/live', label: l.live },
    { href: '/pricing', label: l.pricing },
    { href: '/contact', label: l.contact },
  ];

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-300 ${scrolled ? 'border-b border-line bg-surface-0/85 backdrop-blur-xl' : 'border-b border-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand">
            <Activity size={18} className="text-[#06281d]" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold text-content tracking-tight">Football Analytics</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((a) => {
            const active = pathname === a.href;
            return (
              <Link key={a.href} href={a.href}
                className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${active ? 'text-content bg-surface-2' : 'text-content-muted hover:text-content hover:bg-surface-2'}`}>
                {a.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><LanguageSelector /></div>
          {session ? (
            <Link href="/dashboard" className="fa-btn fa-btn-primary">
              <LayoutDashboard size={16} /> {l.dashboard}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline-flex fa-btn fa-btn-ghost">{l.signin}</Link>
              <Link href="/login" className="fa-btn fa-btn-primary">{l.start}</Link>
            </>
          )}
          <button onClick={() => setOpen(true)} className="md:hidden grid place-items-center w-9 h-9 rounded-lg text-content-muted hover:text-content hover:bg-surface-2">
            <Menu size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] max-w-[85vw] bg-surface-1 border-l border-line z-50 md:hidden p-4">
              <div className="flex items-center justify-between h-12 mb-2">
                <span className="text-sm font-semibold text-content">Menu</span>
                <button onClick={() => setOpen(false)} className="grid place-items-center w-9 h-9 rounded-lg text-content-muted hover:bg-surface-3"><X size={18} /></button>
              </div>
              <div className="space-y-1">
                {links.map((a) => (
                  <Link key={a.href} href={a.href} onClick={() => setOpen(false)}
                    className="block px-3 py-3 rounded-lg text-sm font-medium text-content-muted hover:text-content hover:bg-surface-3">{a.label}</Link>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-line space-y-2">
                <div className="px-1 pb-2"><LanguageSelector /></div>
                {session ? (
                  <Link href="/dashboard" onClick={() => setOpen(false)} className="fa-btn fa-btn-primary w-full">{l.dashboard}</Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)} className="fa-btn fa-btn-secondary w-full">{l.signin}</Link>
                    <Link href="/login" onClick={() => setOpen(false)} className="fa-btn fa-btn-primary w-full">{l.start}</Link>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
