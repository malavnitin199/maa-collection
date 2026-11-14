import { createHmac, timingSafeEqual } from 'node:crypto';

export type Role = 'admin' | 'salesman';
export type SessionPayload = { sid: string; name: string; role: Role; exp: number };

export const SESSION_COOKIE = 'maa_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // one long shop day

/** The signing secret. Required in production; a fixed dev-only value elsewhere. */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    throw new Error('SESSION_SECRET (32+ characters) must be set in production.');
  }
  return 'dev-only-session-secret-not-for-production-use';
}

const encode = (value: string) => Buffer.from(value).toString('base64url');
const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('base64url');

/** `<base64url JSON>.<HMAC-SHA256>` */
export function signSession(payload: SessionPayload, secret: string): string {
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, nowMs = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload;
    if (typeof payload.sid !== 'string' || (payload.role !== 'admin' && payload.role !== 'salesman')) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}
