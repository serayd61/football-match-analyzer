import { redirect } from 'next/navigation';
import { resolveLegacyLocale, localizedPath } from '@/lib/site/legacy-redirect';

// The sign-in page moved to the localized site (/[locale]/login) with the
// Modernist redesign (2026-09-11). `callbackUrl` and `mode=register` carry over.
export const dynamic = 'force-dynamic';

export default function LegacyLoginRedirect({ searchParams }: { searchParams: { lang?: string; callbackUrl?: string; mode?: string } }) {
  const locale = resolveLegacyLocale(searchParams.lang);
  redirect(localizedPath(locale, '/login', { callbackUrl: searchParams.callbackUrl, mode: searchParams.mode }));
}
