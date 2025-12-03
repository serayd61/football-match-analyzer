'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, t, TranslationKey } from '@/lib/translations';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    // localStorage'dan dil tercihini al
    const savedLang = localStorage.getItem('lang') as Language;
    if (savedLang && ['tr', 'en', 'de'].includes(savedLang)) {
      setLangState(savedLang);
    } else {
      // Tarayıcı dilini kontrol et
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === 'tr') setLangState('tr');
      else if (browserLang === 'de') setLangState('de');
      else setLangState('en');
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
  };

  const translate = (key: TranslationKey, params?: Record<string, string | number>) => {
    return t(lang, key, params);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translate }}>
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
