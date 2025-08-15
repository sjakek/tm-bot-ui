import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { AuthSession } from '@/types';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key-at-least-32-characters-long'
);

const COOKIE_NAME = 'auth-session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function getCookieOptions() {
  const crossSite = process.env.USE_CROSS_SITE_COOKIES === 'true';
  if (crossSite) {
    return { sameSite: 'none' as const, secure: true };
  }
  return { sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' };
}

export function verifyPasscode(inputPasscode: string): boolean {
  const configuredPasscode = getConfiguredPasscode();
  if (!configuredPasscode) return false;
  return inputPasscode === configuredPasscode;
}

function getConfiguredPasscode(): string | null {
  // Prefer value from .env.local on disk to avoid stale runtime env in dev
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const contents = fs.readFileSync(envPath, 'utf8');
      const match = contents.match(/^\s*AUTH_PASSCODE\s*=\s*(.*)$/m);
      if (match) {
        const raw = match[1].trim();
        // Strip surrounding quotes if present
        const unquoted = raw.replace(/^['"]|['"]$/g, '');
        return unquoted;
      }
    }
  } catch (e) {
    // ignore file errors and fall back to process.env
  }
  return process.env.AUTH_PASSCODE || null;
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION;
  return await new SignJWT({ authenticated: true, expiresAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(expiresAt))
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const session = payload as unknown as AuthSession;
    if (!session.expiresAt || Date.now() > session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  const opts = getCookieOptions();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session?.authenticated === true;
}

export async function login(passcode: string): Promise<{ success: boolean; error?: string }> {
  if (!verifyPasscode(passcode)) return { success: false, error: 'Invalid passcode' };
  try {
    const token = await createSessionToken();
    await setAuthCookie(token);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to create session' };
  }
}

export async function logout(): Promise<void> {
  await clearAuthCookie();
}

export async function requireAuth(): Promise<{ authenticated: true } | { authenticated: false; redirect: string }> {
  const ok = await isAuthenticated();
  if (!ok) return { authenticated: false, redirect: '/login' };
  return { authenticated: true };
}