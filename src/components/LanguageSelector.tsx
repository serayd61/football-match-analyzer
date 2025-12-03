'use client';

import { useLanguage } from './LanguageProvider';
import { Language } from '@/lib/translations';

const languages: { code: Language; flag: string; name: string }[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
];

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as 'tr' | 'en' | 'de')}
      className="bg-gray-700 text-white px-3 py-1 rounded-lg text-sm"
    >
      <option value="en">🇬🇧 English</option>
      <option value="tr">🇹🇷 Türkçe</option>
      <option value="de">🇩🇪 Deutsch</option>
    </select>
  );
}


  return (
    <div className="relative group">
      <button className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors">
        <span className="text-lg">{languages.find(l => l.code === lang)?.flag}</span>
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
