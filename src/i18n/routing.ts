import { defineRouting } from 'next-intl/routing';

// Public site locales. EN is the default; DE uses Swiss orthography (no ß).
// TR is kept because the existing user base and ad traffic are largely Turkish.
export const routing = defineRouting({
  locales: ['en', 'de', 'it', 'tr'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  it: 'Italiano',
  tr: 'Türkçe',
};

/** Intl locale tags (DE → de-CH so numbers/dates follow Swiss conventions). */
export const INTL_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  de: 'de-CH',
  it: 'it-IT',
  tr: 'tr-TR',
};

export const DEFAULT_TIME_ZONE = 'Europe/Zurich';
