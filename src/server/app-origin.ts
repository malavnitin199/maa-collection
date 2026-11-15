import { headers } from 'next/headers';

/**
 * Base address for item links in tag QR codes: `APP_URL` if set (e.g. a custom
 * domain), otherwise the address this page was opened at.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured && /^https?:\/\/[^\s/]+$/i.test(configured.replace(/\/+$/, ''))) return configured.replace(/\/+$/, '');
  const h = await headers();
  const forwarded = h.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = [forwarded, h.get('host')].find((value) => value && /^[a-z0-9.-]+(:\d+)?$/i.test(value)) ?? 'localhost:3000';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'http' || local ? 'http' : 'https';
  return `${proto}://${host}`;
}
