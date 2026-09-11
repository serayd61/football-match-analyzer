import { cookies, headers } from 'next/headers';
import { routing, type Locale } from '@/i18n/routing';

// Legacy (unlocalized) /login and /pricing now live on the localized site
// (2026-09-11). Pick the locale the way the old shell did — `?lang=` first —
// then the next-intl cookie, then Accept-Language, then the default.
export function resolveLegacyLocale(lang?: string): Locale {
  const ok = (l: string | undefined | null): l is Locale => !!l && (routing.locales as readonly string[]).includes(l);
  if (ok(lang)) return lang;
  const cookie = cookies().get('NEXT_LOCALE')?.value;
  if (ok(cookie)) return cookie;
  const accept = headers().get('accept-language') || '';
  for (const part of accept.split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (ok(code)) return code;
  }
  return routing.defaultLocale;
}

export function localizedPath(locale: Locale, path: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const q = qs.toString();
  return `/${locale}${path}${q ? `?${q}` : ''}`;
}
