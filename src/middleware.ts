import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow health check endpoint to pass through immediately
  if (pathname === '/api/health') {
    return NextResponse.next();
  }
  
  // Enhanced health check detection for root path - Replit deployment services
  const userAgent = request.headers.get('user-agent') || '';
  const isHealthCheck = 
    userAgent.includes('health') ||
    userAgent.includes('probe') ||
    userAgent.includes('check') ||
    userAgent.includes('replit') ||
    userAgent.includes('monitor') ||
    request.headers.get('x-forwarded-for')?.includes('replit') ||
    request.headers.get('x-replit-deployment-id') ||
    request.method === 'HEAD';

  if (isHealthCheck && pathname === '/') {
    return new Response('OK', { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Allow public paths without auth
  if (
    pathname === '/login' ||
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

export const config = {
  matcher: ['/((?!api/health|api/auth|_next|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};