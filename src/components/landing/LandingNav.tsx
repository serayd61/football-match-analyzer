'use client';

// ============================================================================
// LandingNav — brutalist masthead. Mürekkep bandı, 1px çizgi, blur/şeffaflık
// yok. Sticky kalır (CTA her zaman ulaşılabilir) ama scroll durumu tutmaz:
// tek bir görünüm, her konumda aynı.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';

const NAV_LABELS: Record<string, { features: string; pricing: string; how: string; signin: string; start: string; menu: string }> = {
  tr: { features: 'Özellikler', pricing: 'Fiyatlandırma', how: 'Nasıl Çalışır', signin: 'Giriş Yap', start: 'Ücretsiz Başla', menu: 'Menü' },
  en: { features: 'Features', pricing: 'Pricing', how: 'How it works', signin: 'Sign in', start: 'Start free', menu: 'Menu' },
  de: { features: 'Funktionen', pricing: 'Preise', how: 'Wie es funktioniert', signin: 'Anmelden', start: 'Kostenlos starten', menu: 'Menü' },
};

export default function LandingNav({ lang = 'en' }: { lang?: string }) {
  const l = NAV_LABELS[lang] || NAV_LABELS.en;
  const [open, setOpen] = useState(false);

  // Çekmece açıkken arka plan kaymasın; ESC ile kapansın.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const anchors = [
    { href: '#features', label: l.features },
    { href: '#how-it-works', label: l.how },
    { href: '#pricing', label: l.pricing },
  ];

  return (
    <nav className="inv sticky top-0 z-[100] border-b">
      <div className="flex items-stretch h-14">
        <Link href="/" className="flex items-center gap-3 px-4 sm:px-6 border-r shrink-0">
          <svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
          </svg>
          <span className="fd text-[1.35rem] leading-none pt-0.5">footballanalytics</span>
        </Link>

        <div className="hidden md:flex items-stretch">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="fm-label flex items-center px-5 border-r hover:bg-[#f2efe6] hover:text-[#141414]"
            >
              {a.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-stretch">
          <div className="hidden sm:flex items-center px-3">
            <LanguageSelector />
          </div>
          <Link
            href="/login"
            className="hidden md:flex fm-label items-center px-5 border-l hover:bg-[#f2efe6] hover:text-[#141414]"
          >
            {l.signin}
          </Link>
          <Link
            href="/login"
            className="hidden md:flex fm-label items-center px-6 bg-[#e63b1f] text-[#141414] font-semibold hover:bg-[#f2efe6]"
          >
            {l.start}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="md:hidden flex items-center justify-center w-14 border-l"
            aria-label={l.menu}
            aria-expanded={open}
          >
            <Menu size={22} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden inv flex flex-col">
          <div className="flex items-center justify-between h-14 px-4 border-b">
            <span className="fm-label">{l.menu}</span>
            <button type="button" onClick={() => setOpen(false)} className="flex items-center justify-center w-10 h-10" aria-label="Close">
              <X size={22} strokeWidth={2.25} />
            </button>
          </div>
          <div className="flex flex-col">
            {anchors.map((a, i) => (
              <a
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="fd text-4xl px-4 py-4 border-b flex items-baseline gap-4"
              >
                <span className="fm text-xs opacity-60">0{i + 1}</span>
                {a.label}
              </a>
            ))}
          </div>
          <div className="mt-auto p-4 flex flex-col gap-2">
            <div className="pb-2"><LanguageSelector /></div>
            <Link href="/login" onClick={() => setOpen(false)} className="bb bb-block">{l.signin}</Link>
            <Link href="/login" onClick={() => setOpen(false)} className="bb bb-sig bb-block">{l.start}</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
