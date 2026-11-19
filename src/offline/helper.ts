/**
 * Plan v18 — the offline helper (`public/sw.js`): keeps the counter screen and
 * the app's files on the phone so the counter opens without internet. Only in
 * the built app (never with `next dev`, where files change on every save).
 */
const PAGES_CACHE = 'maa-pages-v1';

function appFilesLoaded(): string[] {
  if (typeof performance === 'undefined') return [];
  return performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => {
      try {
        const url = new URL(name);
        return url.origin === location.origin && url.pathname.startsWith('/_next/static/');
      } catch {
        return false;
      }
    });
}

export function offlineHelperEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/** Starts the helper and asks it to keep the counter and the files this screen uses. */
export async function startOfflineHelper(): Promise<void> {
  if (!offlineHelperEnabled()) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await keepForOffline();
  } catch {
    // The app works without it; only opening it offline needs it.
  }
}

/** Sends the files this screen has loaded so far (e.g. after the scanner loaded). */
export async function keepForOffline(): Promise<void> {
  if (!offlineHelperEnabled()) return;
  const ready = await navigator.serviceWorker.ready;
  ready.active?.postMessage({ type: 'keep', files: appFilesLoaded() });
}

/** Log out: the counter page saved for offline holds this person's name, so it goes. */
export async function forgetSavedPages(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(PAGES_CACHE);
  } catch {
    // Nothing saved.
  }
}
