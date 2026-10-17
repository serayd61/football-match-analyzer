import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { isAdminEmail } from '@/lib/admin/emails';
import { routing } from '@/i18n/routing';
import { isTwaRequest, TWA_COOKIE, TWA_COOKIE_MAX_AGE } from '@/lib/site/twa';
import { legacyLocale, legacyRedirectTarget } from '@/lib/site/legacy-paths';

// NOTE: This file MUST live in `src/` (not repo root) because the project uses
// a `src/` directory — Next.js only picks up `src/middleware.ts` in that case.

const intlMiddleware = createIntlMiddleware(routing);

function isAdminPath(path: string): boolean {
  return path.startsWith('/api/admin') || path === '/admin' || path.startsWith('/admin/');
}

// Members-only site (2026-09-08): the legacy (unlocalized) app pages that list
// fixtures or matches render client-side and fetched public APIs, so an
// anonymous visitor could still see matches on /live, /match/[id], /analysis/…
// after the localized site was gated. They now require a session here; the
// 7-day-trial / paid rule is enforced inside the pages' own API calls.
// SEO Faz 0 (2026-10-17): the public ones (/analysis, /live, /match, /leaderboard,
// /stats …) now 301 to their localized replacement first (lib/site/legacy-paths.ts);
// only the account pages and the odds tools remain gated here.
const LEGACY_MEMBER_PREFIXES = [
  '/odds-analysis', '/odds-patterns', '/favorites', '/profile', '/settings',
];
function isLegacyMemberPath(path: string): boolean {
  return LEGACY_MEMBER_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}
const MEMBER_API_PREFIXES = ['/api/livescores'];
function isMemberApiPath(path: string): boolean {
  return MEMBER_API_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

// Machine-to-machine callers (cron / QStash) authenticate with a shared secret
// via `Authorization: Bearer <secret>` instead of a NextAuth session.
function hasValidServiceSecret(req: { headers: { get(name: string): string | null } }): boolean {
  // İki sır da kabul edilir (lib/api/dev-only.hasServiceSecret ile aynı kural).
  // Önceden ADMIN_SECRET tanımlıysa CRON_SECRET'lı cron çağrıları 403 alıyordu.
  const secrets = [process.env.ADMIN_SECRET, process.env.CRON_SECRET].filter((s): s is string => !!s);
  const auth = req.headers.get('authorization') || '';
  return secrets.some((s) => auth === `Bearer ${s}`);
}

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;

    if (isAdminPath(path)) {
      if (hasValidServiceSecret(req)) return NextResponse.next();
      const email = req.nextauth?.token?.email as string | undefined;
      if (!isAdminEmail(email)) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/login', req.url));
      }
      return NextResponse.next();
    }

    // Legacy public pages → localized site, permanently (SEO Faz 0).
    const legacyTarget = legacyRedirectTarget(path, legacyLocale(req.cookies.get('NEXT_LOCALE')?.value));
    if (legacyTarget) return NextResponse.redirect(new URL(legacyTarget, req.url), 301);

    if (isLegacyMemberPath(path) || isMemberApiPath(path)) {
      const email = req.nextauth?.token?.email as string | undefined;
      if (!email) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 });
        }
        // Straight to the localized sign-in (was /login → /{locale}/login, a double hop).
        const login = new URL(`/${legacyLocale(req.cookies.get('NEXT_LOCALE')?.value)}/login`, req.url);
        login.searchParams.set('callbackUrl', path + req.nextUrl.search);
        return NextResponse.redirect(login);
      }
      return NextResponse.next();
    }

    // Public site: locale detection + prefixing (/ → /en, /predictions → /de/predictions …).
    const res = intlMiddleware(req);
    // Google Play app (TWA) opens `/?src=twa`: remember it for a year so every
    // render hides checkout / prices (Play payments policy). See lib/site/twa.ts.
    if (isTwaRequest(req)) {
      res.cookies.set(TWA_COOKIE, '1', { maxAge: TWA_COOKIE_MAX_AGE, path: '/', sameSite: 'lax', secure: true });
    }
    return res;
  },
  {
    callbacks: {
      // Do NOT gate non-admin routes here: the app gates protected pages
      // client-side. The matcher limits this middleware to the admin surface
      // and the localized public site; legacy app routes are untouched.
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    // Admin surface (unchanged behaviour)
    '/api/admin/:path*',
    '/admin/:path*',
    // Legacy app pages: public ones 301 to the localized site, account pages stay members-only
    '/live', '/tahminler', '/match/:path*', '/analysis', '/analysis/:path*',
    '/odds-analysis', '/odds-patterns', '/league-stats', '/stats', '/track-record',
    '/ai-performance', '/favorites', '/leaderboard', '/profile', '/settings', '/contact',
    '/api/livescores',
    // Localized public site
    '/',
    '/(en|de|it|tr)/:path*',
    '/dashboard',
    '/predictions/:path*',
    // SEO Faz 0: these were missing, so unprefixed /matches 404'd instead of 307'ing to /{locale}/matches
    '/matches/:path*', '/picks', '/coupon', '/account', '/s/:path*',
    '/results',
    '/performance',
    '/pricing',
    '/leagues/:path*',
    '/methodology',
    '/data', // SEO Faz 2.1: the page only — /data/{file}.csv|json are unlocalized route handlers
    '/about',
    '/privacy',
    '/terms',
  ],
};
