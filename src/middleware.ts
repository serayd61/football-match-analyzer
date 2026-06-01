import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin/emails';

// NOTE: This file MUST live in `src/` (not repo root) because the project uses
// a `src/` directory — Next.js only picks up `src/middleware.ts` in that case.

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

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;

    // The matcher restricts this middleware to admin paths only, but guard
    // defensively in case the matcher changes.
    if (isAdminPath(path)) {
      if (hasValidServiceSecret(req)) return NextResponse.next();
      const email = req.nextauth?.token?.email as string | undefined;
      if (!isAdminEmail(email)) {
        if (path.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Do NOT gate non-admin routes here: the app gates protected pages
      // client-side, and the matcher below ensures this middleware only runs
      // for the admin surface — so cron/QStash/webhook/SEO routes are untouched.
      authorized: () => true,
    },
  }
);

export const config = {
  // Run ONLY on the admin surface. Everything else bypasses middleware entirely,
  // exactly as before this file existed.
  matcher: ['/api/admin/:path*', '/admin/:path*'],
};
