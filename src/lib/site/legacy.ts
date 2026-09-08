// Links from the localized site into the legacy (unlocalized) app shell —
// login, pricing, password reset, old settings. The shell picks its language
// from ?lang= (see LanguageProvider), so every link carries the site locale;
// otherwise a /tr visitor with a German browser lands on a German login page.
export function legacyHref(path: string, locale: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}lang=${encodeURIComponent(locale)}`;
}
