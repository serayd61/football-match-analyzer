'use client';

// ============================================================================
// LandingNav — Lithos-style fixed transparent nav over the spotlight hero.
// White wordmark (Playfair italic) + frosted center pill + white CTA.
// Falls back to a dark blurred backdrop once scrolled past the hero.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
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
    // Hero 100dvh — nav arka planı hero'dan çıkarken koyulaşır.
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.8);
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
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-between p-4 sm:p-5 transition-colors duration-300 ${
        scrolled ? 'bg-surface-0/85 backdrop-blur-xl border-b border-line' : 'border-b border-transparent'
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <svg width="26" height="26" viewBox="0 0 256 256" fill="#ffffff" xmlns="http://www.w3.org/2000/svg">
          <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
        </svg>
        <span className="text-white text-xl sm:text-2xl font-playfair italic">footballanalytics</span>
      </Link>

      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-2 py-2 items-center gap-1">
        {anchors.map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="px-4 py-1.5 rounded-full text-sm font-medium text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          >
            {a.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <LanguageSelector />
        </div>
        <Link href="/login" className="hidden md:block text-white/80 hover:text-white text-sm font-medium transition-colors">
          {l.signin}
        </Link>
        <Link
          href="/login"
          className="hidden md:block bg-white text-gray-900 text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          {l.start}
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="md:hidden grid place-items-center w-9 h-9 rounded-lg text-white hover:bg-white/20"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
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
    </nav>
  );
}
