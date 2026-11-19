import { createSignal } from './signal';

/**
 * Plan v18 — is the shop's server reachable? The phone's own signal
 * (`navigator.onLine`) says "no network" quickly, but Wi-Fi without internet
 * still says "online"; so a request that fails or takes too long also marks
 * the server unreachable until a small ping (`/api/ping`) answers again.
 */
const reachable = createSignal(true);
let probing = false;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => reachable.set(true));
}

export function isOnline(): boolean {
  return (typeof navigator === 'undefined' || navigator.onLine !== false) && reachable.get();
}

/** For `useSyncExternalStore`. */
export function subscribeOnline(listener: () => void): () => void {
  const stop = reachable.subscribe(listener);
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    stop();
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function markReachable() {
  reachable.set(true);
}

/** A request failed or hung: treat the server as unreachable and ping until it answers. */
export function markUnreachable() {
  reachable.set(false);
  if (probing) return;
  probing = true;
  const check = async () => {
    if (reachable.get()) return void (probing = false);
    if (navigator.onLine !== false) {
      try {
        const res = await fetch('/api/ping', { cache: 'no-store', signal: timeoutSignal(4000) });
        if (res.ok) {
          probing = false;
          return reachable.set(true);
        }
      } catch {
        // Still unreachable.
      }
    }
    setTimeout(check, 5000);
  };
  setTimeout(check, 3000);
}

export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export class TookTooLong extends Error {
  constructor() {
    super('The shop did not answer in time');
  }
}

/** Waits at most `ms` for `work`; it may still finish later (sales are retry-safe). */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TookTooLong()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
