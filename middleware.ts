import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public routes
        if (path === '/' || path === '/login' || path === '/pricing' || path.startsWith('/api/auth') || path.startsWith('/api/stripe/webhook') || path.startsWith('/api/simulation')) {
          return true;
        }

        // Protected routes need token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
