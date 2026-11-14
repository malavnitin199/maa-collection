import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionSecret, verifySession } from './server/security/session';

/**
 * Optimistic route guard: logged-out visitors go to /login. Each /admin page and
 * server action checks the role and owner-granted permissions on the server.
 */
export function proxy(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (!session) return NextResponse.redirect(new URL('/login', request.url));
  // Salesmen may hold catalog/stock/price rights, so /admin pages check permissions themselves.
  return NextResponse.next();
}

export const config = {
  matcher: ['/pos/:path*', '/admin/:path*'],
};
