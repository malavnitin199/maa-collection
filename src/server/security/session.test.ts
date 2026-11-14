// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from './pin';
import { signSession, verifySession, type SessionPayload } from './session';

const secret = 'x'.repeat(40);
const payload: SessionPayload = { sid: 'abc', name: 'Vishal', role: 'salesman', exp: 2_000_000_000 };

describe('session tokens', () => {
  it('round-trips a valid token', () => {
    expect(verifySession(signSession(payload, secret), secret, 0)).toEqual(payload);
  });

  it('rejects a tampered role, a wrong secret and an expired token', () => {
    const token = signSession(payload, secret);
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ ...payload, role: 'admin' })).toString('base64url')}.${signature}`;
    expect(verifySession(forged, secret, 0)).toBeNull();
    expect(verifySession(token, 'y'.repeat(40), 0)).toBeNull();
    expect(verifySession(token, secret, 2_000_000_001_000)).toBeNull();
    expect(verifySession(undefined, secret)).toBeNull();
  });
});

describe('PIN hashing', () => {
  it('verifies the right PIN only and never stores it in plain text', () => {
    const stored = hashPin('2468');
    expect(stored).not.toContain('2468');
    expect(verifyPin('2468', stored)).toBe(true);
    expect(verifyPin('2469', stored)).toBe(false);
  });

  it('rejects PINs that are not 4–6 digits', () => {
    expect(() => hashPin('12')).toThrow();
    expect(() => hashPin('abcd')).toThrow();
  });
});
