'use client';

// ============================================================================
// LanguageSelector — tıklamayla açılan dil menüsü.
// ESKİ sürüm hover'la açılıyordu (group-hover): mobilde hover olmadığı için
// dil HİÇ seçilemiyordu ve dokunmatikte takılı kalan menü, slide-over
// içindeki öğelerin üstüne biniyordu ("yazılar iç içe"). Bu sürüm: click ile
// aç/kapa, dışarı tıklayınca kapan, seçimde kapan, tasarım sistemi renkleri.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

const languages = [
  { code: 'en' as const, flag: '🇬🇧', name: 'English' },
  { code: 'tr' as const, flag: '🇹🇷', name: 'Türkçe' },
  { code: 'de' as const, flag: '🇩🇪', name: 'Deutsch' },
];

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, []);

  const currentLang = languages.find((l) => l.code === lang) || languages[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
      >
        <span>{currentLang.flag}</span>
        <span className="text-white text-sm">{currentLang.name}</span>
        <ChevronDown size={14} className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-[#12151c] shadow-2xl overflow-hidden z-[130]"
        >
          {languages.map((language) => (
            <button
              key={language.code}
              type="button"
              role="option"
              aria-selected={lang === language.code}
              onClick={() => { setLang(language.code); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/[0.06] transition-colors ${
                lang === language.code ? 'bg-white/[0.04]' : ''
              }`}
            >
              <span>{language.flag}</span>
              <span className="text-white text-sm">{language.name}</span>
              {lang === language.code && <Check size={14} className="ml-auto text-brand-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
