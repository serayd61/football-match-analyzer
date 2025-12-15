import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // ⚠️ TEMPORARY: Dev mode bypass - REMOVE BEFORE DEPLOY!
        if (process.env.NODE_ENV === 'development') {
          return true;
        }
        
        const path = req.nextUrl.pathname;
        
        // Public routes
        if (path === '/' || path === '/login' || path === '/pricing' || path.startsWith('/api/auth') || path.startsWith('/api/stripe/webhook')) {
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
