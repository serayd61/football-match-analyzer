'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'tr' | 'en' | 'de';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && ['tr', 'en', 'de'].includes(savedLang)) {
      setLangState(savedLang);
    } else {
      // Tarayıcı dilini kontrol et
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === 'tr') {
        setLangState('tr');
        localStorage.setItem('language', 'tr');
      } else if (browserLang === 'de') {
        setLangState('de');
        localStorage.setItem('language', 'de');
      } else {
        setLangState('en');
        localStorage.setItem('language', 'en');
      }
    }
    setMounted(true);
  }, []);

  const setLang = (newLang: Language) => {
    console.log('Language changing to:', newLang);
    setLangState(newLang);
    localStorage.setItem('language', newLang);
  };

  const t = (key: string) => key;

  if (!mounted) return null;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
