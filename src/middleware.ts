import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow health check requests to root path (for Replit deployment)
  if (pathname === '/' && isHealthCheckRequest(request)) {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // Allow public paths without auth
  if (
    pathname === '/login' ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  // Check authentication for other routes
  const token = request.cookies.get('auth-session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const session = await verifySessionToken(token);
  if (!session || !session.authenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

function isHealthCheckRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  const accept = request.headers.get('accept') || '';
  
  // Detect health check requests from deployment services
  return (
    userAgent.includes('replit') ||
    userAgent.includes('health') ||
    userAgent.includes('monitor') ||
    userAgent.includes('check') ||
    accept === '*/*' ||
    request.method === 'HEAD'
  );
}

export const config = {
  matcher: ['/((?!api/health|api/auth|_next|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};