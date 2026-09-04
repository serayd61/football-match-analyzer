import type { Metadata } from 'next';
import { routing, type Locale } from '@/i18n/routing';
import { SITE_URL } from '@/lib/seo';

/**
 * Canonical + hreflang alternates for a public-site path (path WITHOUT locale,
 * e.g. "/predictions"). Every locale gets an entry plus x-default → EN.
 */
export function alternatesFor(locale: Locale, path: string): NonNullable<Metadata['alternates']> {
  const clean = path === '/' ? '' : path;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = `${SITE_URL}/${l}${clean}`;
  languages['x-default'] = `${SITE_URL}/${routing.defaultLocale}${clean}`;
  return { canonical: `${SITE_URL}/${locale}${clean}`, languages };
}

export { SITE_URL };
