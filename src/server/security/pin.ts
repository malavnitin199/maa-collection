import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

/** PINs are 4–6 digits, quick to type at the counter. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/** Stored as `scrypt$<salt hex>$<hash hex>`. */
export function hashPin(pin: string): string {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 to 6 digits.');
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex || !isValidPin(pin)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function randomPin(): string {
  return String(randomInt(0, 10_000)).padStart(4, '0');
}
