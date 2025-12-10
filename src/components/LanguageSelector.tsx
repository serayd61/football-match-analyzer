'use client';

import { useLanguage } from './LanguageProvider';

const languages = [
  { code: 'en' as const, flag: '🇬🇧', name: 'English' },
  { code: 'tr' as const, flag: '🇹🇷', name: 'Türkçe' },
  { code: 'de' as const, flag: '🇩🇪', name: 'Deutsch' },
];

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();

  const currentLang = languages.find((l) => l.code === lang) || languages[0];

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors">
        <span>{currentLang.flag}</span>
        <span className="text-white text-sm">{currentLang.name}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="absolute right-0 mt-2 w-36 bg-gray-800 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {languages.map((language) => (
          <button
            key={language.code}
            onClick={() => setLang(language.code)}
            className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
              lang === language.code ? 'bg-gray-700' : ''
            }`}
          >
            <span>{language.flag}</span>
            <span className="text-white text-sm">{language.name}</span>
            {lang === language.code && <span className="ml-auto text-green-500">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
