import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin/emails';

function isAdminPath(path: string): boolean {
  return path.startsWith('/api/admin') || path === '/admin' || path.startsWith('/admin/');
}

// Machine-to-machine callers (cron / QStash) authenticate with a shared secret
// via `Authorization: Bearer <secret>` instead of a NextAuth session.
function hasValidServiceSecret(req: { headers: { get(name: string): string | null } }): boolean {
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// Public, crawlable routes — must NOT require auth (SEO).
function isPublicPath(path: string): boolean {
  if (
    path === '/' ||
    path === '/login' ||
    path === '/pricing' ||
    path === '/ai-performance' ||
    path === '/leaderboard' ||
    path === '/sitemap.xml' ||
    path === '/robots.txt' ||
    path === '/manifest.json'
  ) {
    return true;
  }
  if (path === '/analysis' || path.startsWith('/analysis/')) return true;
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/stripe/webhook') ||
    path.startsWith('/api/simulation') ||
    path.startsWith('/api/public')
  ) {
    return true;
  }
  return false;
}

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;

    if (isAdminPath(path)) {
      // Allow trusted service callers (cron/QStash) that present the secret.
      if (hasValidServiceSecret(req)) {
        return NextResponse.next();
      }
      // Otherwise require an allowlisted admin email.
      const email = req.nextauth?.token?.email as string | undefined;
      if (!isAdminEmail(email)) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public, crawlable routes.
        if (isPublicPath(path)) return true;

        // Admin routes: let the middleware function above run the precise
        // check (service-secret OR admin email) and return a proper 403/redirect.
        if (isAdminPath(path)) return true;

        // All other protected routes need a token.
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
