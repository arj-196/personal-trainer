import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'pt_session';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const username = process.env.APP_USERNAME?.trim() || '';
  const secret = process.env.APP_SESSION_SECRET?.trim() || '';
  if (!token || !username || !secret) {
    return false;
  }
  const [tokenUsername, expiresAtRaw, signature] = token.split(':');
  if (!tokenUsername || !expiresAtRaw || !signature || tokenUsername !== username) {
    return false;
  }
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${tokenUsername}:${expiresAt}`));
  const expected = base64UrlEncode(new Uint8Array(expectedBuffer));
  return expected === signature;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/login');

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const valid = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (valid) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
