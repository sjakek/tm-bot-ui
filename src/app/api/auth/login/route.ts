import { NextRequest, NextResponse } from 'next/server';
import { verifyPasscode, createSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();
    console.log('[LoginAPI] Received passcode length:', passcode ? String(passcode).trim().length : 0);
    // Log both process.env and disk .env.local read via auth util
    console.log('[LoginAPI] Using AUTH_PASSCODE length (env):', (process.env.AUTH_PASSCODE || '').length);

    if (!passcode) {
      return NextResponse.json(
        { success: false, error: 'Passcode is required' },
        { status: 400 }
      );
    }

    if (!verifyPasscode(passcode)) {
      console.warn('[LoginAPI] Invalid passcode submitted');
      return NextResponse.json(
        { success: false, error: 'Invalid passcode' },
        { status: 401 }
      );
    }

    const token = await createSessionToken();

    const res = NextResponse.json({ success: true });
    res.cookies.set('auth-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // seconds
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}