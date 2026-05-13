import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SESSION_COOKIE = 'pt_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

export function getConfiguredUsername(): string {
  return process.env.APP_USERNAME?.trim() || '';
}

export function getConfiguredPassword(): string {
  return process.env.APP_PASSWORD?.trim() || '';
}

function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error('APP_SESSION_SECRET is required.');
  }
  return secret;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

async function sign(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return bytesToBase64(new Uint8Array(signature));
}

export async function createSessionToken(username: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${username}:${expiresAt}`;
  const signature = await sign(payload);
  return `${payload}:${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }
  const [username, expiresAtRaw, signature] = token.split(':');
  if (!username || !expiresAtRaw || !signature) {
    return false;
  }
  if (username !== getConfiguredUsername()) {
    return false;
  }
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = await sign(`${username}:${expiresAt}`);
  const left = base64ToBytes(signature);
  const right = base64ToBytes(expected);
  return constantTimeEqual(left, right);
}

export async function requireAuthenticatedRequest(): Promise<void> {
  const cookieStore = await cookies();
  const valid = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!valid) {
    redirect('/login');
  }
}

export async function setSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = await createSessionToken(getConfiguredUsername());
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function validateLogin(username: string, password: string): Promise<boolean> {
  return username === getConfiguredUsername() && password === getConfiguredPassword();
}
