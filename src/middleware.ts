import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { isAdminEmail } from '@/lib/admin/emails';
import { routing } from '@/i18n/routing';

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
const LEGACY_MEMBER_PREFIXES = [
  '/live', '/tahminler', '/match', '/analysis', '/odds-analysis', '/odds-patterns',
  '/league-stats', '/stats', '/track-record', '/ai-performance', '/favorites',
  '/leaderboard', '/profile', '/settings',
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
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
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

    if (isLegacyMemberPath(path) || isMemberApiPath(path)) {
      const email = req.nextauth?.token?.email as string | undefined;
      if (!email) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 });
        }
        const login = new URL('/login', req.url);
        login.searchParams.set('callbackUrl', path + req.nextUrl.search);
        return NextResponse.redirect(login);
      }
      return NextResponse.next();
    }

    // Public site: locale detection + prefixing (/ → /en, /predictions → /de/predictions …).
    return intlMiddleware(req);
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
    // Legacy app pages that show matches (members only, 2026-09-08)
    '/live', '/tahminler', '/match/:path*', '/analysis', '/analysis/:path*',
    '/odds-analysis', '/odds-patterns', '/league-stats', '/stats', '/track-record',
    '/ai-performance', '/favorites', '/leaderboard', '/profile', '/settings',
    '/api/livescores',
    // Localized public site
    '/',
    '/(en|de|it|tr)/:path*',
    '/dashboard',
    '/predictions/:path*',
    '/results',
    '/performance',
    '/leagues/:path*',
    '/methodology',
    '/about',
    '/privacy',
    '/terms',
  ],
};
