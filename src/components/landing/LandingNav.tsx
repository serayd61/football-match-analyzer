'use client';

// ============================================================================
// LandingNav — modern marketing top nav for the public landing page.
// Scoped under `.fa-shell`. The global neon <Navigation/> is hidden on '/'.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Menu, X } from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';

const NAV_LABELS: Record<string, { features: string; pricing: string; how: string; signin: string; start: string }> = {
  tr: { features: 'Özellikler', pricing: 'Fiyatlandırma', how: 'Nasıl Çalışır', signin: 'Giriş Yap', start: 'Ücretsiz Başla' },
  en: { features: 'Features', pricing: 'Pricing', how: 'How it works', signin: 'Sign in', start: 'Start free' },
  de: { features: 'Funktionen', pricing: 'Preise', how: 'Wie es funktioniert', signin: 'Anmelden', start: 'Kostenlos starten' },
};

export default function LandingNav({ lang = 'en' }: { lang?: string }) {
  const l = NAV_LABELS[lang] || NAV_LABELS.en;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const anchors = [
    { href: '#features', label: l.features },
    { href: '#how-it-works', label: l.how },
    { href: '#pricing', label: l.pricing },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-line bg-surface-0/85 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-brand">
            <Activity size={18} className="text-[#06281d]" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold text-content tracking-tight">Football Analytics</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="px-3 py-2 rounded-lg text-[13px] font-medium text-content-muted hover:text-content hover:bg-surface-2 transition-colors"
            >
              {a.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSelector />
          </div>
          <Link href="/login" className="hidden sm:inline-flex fa-btn fa-btn-ghost">
            {l.signin}
          </Link>
          <Link href="/login" className="fa-btn fa-btn-primary">
            {l.start}
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="md:hidden grid place-items-center w-9 h-9 rounded-lg text-content-muted hover:text-content hover:bg-surface-2"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] max-w-[85vw] bg-surface-1 border-l border-line z-50 md:hidden p-4"
            >
              <div className="flex items-center justify-between h-12 mb-2">
                <span className="text-sm font-semibold text-content">Menu</span>
                <button onClick={() => setOpen(false)} className="grid place-items-center w-9 h-9 rounded-lg text-content-muted hover:bg-surface-3">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-1">
                {anchors.map((a) => (
                  <a key={a.href} href={a.href} onClick={() => setOpen(false)}
                    className="block px-3 py-3 rounded-lg text-sm font-medium text-content-muted hover:text-content hover:bg-surface-3">
                    {a.label}
                  </a>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-line space-y-2">
                <div className="px-1 pb-2"><LanguageSelector /></div>
                <Link href="/login" onClick={() => setOpen(false)} className="fa-btn fa-btn-secondary w-full">{l.signin}</Link>
                <Link href="/login" onClick={() => setOpen(false)} className="fa-btn fa-btn-primary w-full">{l.start}</Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
