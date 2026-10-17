// SEO Faz 0 (2026-10-17): the site layout used to inline the whole messages
// file (~103 KB per locale) into every page's RSC payload for the client
// provider, which is why the HTML of a league page weighed 237 KB and 45 mobile
// URLs sat in Search Console's "needs improvement" bucket. Client components
// only read these namespaces (grep `useTranslations(` in 'use client' files);
// everything else is rendered on the server with getTranslations.
export const CLIENT_NAMESPACES = ['slip', 'app', 'account', 'nav', 'dashboard', 'theme', 'onboarding', 'locale', 'errors', 'common'] as const;

export function pickMessages<T extends Record<string, unknown>>(messages: T, namespaces: readonly string[] = CLIENT_NAMESPACES): T {
  const out: Record<string, unknown> = {};
  for (const ns of namespaces) if (ns in messages) out[ns] = messages[ns];
  return out as T;
}
