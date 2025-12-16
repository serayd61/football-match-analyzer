'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { translations, TranslationKey } from '@/lib/translations';

type Language = 'tr' | 'en' | 'de';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
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

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('language', newLang);
    // HTML lang attribute güncelle
    document.documentElement.lang = newLang;
  }, []);

  // Gerçek çeviri fonksiyonu
  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    const langTranslations = translations[lang] || translations.en;
    let text = langTranslations[key] || translations.en[key] || String(key);
    
    // Parametreleri değiştir
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    
    return text;
  }, [lang]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

// Helper hook for getting language code for API calls
export function useAPILanguage() {
  const { lang } = useLanguage();
  return lang;
}
