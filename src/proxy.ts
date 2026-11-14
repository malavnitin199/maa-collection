import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionSecret, verifySession } from './server/security/session';

/**
 * Optimistic route guard: logged-out visitors go to /login, salesmen can't open
 * /admin. Every page and server action still checks the session and role on
 * the server; this only avoids rendering a page the user can't use.
 */
export function proxy(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  const { pathname } = request.nextUrl;
  if (!session) return NextResponse.redirect(new URL('/login', request.url));
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/pos/:path*', '/admin/:path*'],
};
